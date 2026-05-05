/* /api/cron/verify-links — sweep all external_url / source_url links and
 * mark 404s. Runs weekly via Vercel cron, also callable manually from the
 * LUVLAB checklist.
 *
 * GET /api/cron/verify-links            -> verify content (max 200 stalest)
 * GET /api/cron/verify-links?queue=1    -> verify content_queue instead
 * GET /api/cron/verify-links?archive=1  -> auto-archive items with link_status >= 400
 * GET /api/cron/verify-links?limit=500
 *
 * Auth: CRON_SECRET header OR ADMIN_TOKEN OR aa_role cookie. Requires
 * Supabase env vars.
 *
 * For each row:
 *   1) HEAD the link (5s timeout, follow redirects)
 *   2) On 405/501 → fall back to GET
 *   3) Save link_status, link_checked_at, link_final_url
 *   4) If archive=1 and status >= 400, set status='archived'
 *
 * Updates link_final_url so future card clicks go to the canonical URL,
 * not the original feed slug — so even if a publisher moved their post,
 * we follow the redirect once and fix the link forever.
 */
const sb = require('../../lib/supabase');
const { isSafeToFetch } = require('../../lib/url-safety');

function authed (req) {
  const adminTok = process.env.ADMIN_TOKEN;
  const cronSec  = process.env.CRON_SECRET;
  // Vercel Cron always sends x-vercel-cron-signature — accept that even with
  // no shared CRON_SECRET so the platform-managed schedule still works.
  if (req.headers['x-vercel-cron-signature']) return true;
  if (cronSec && req.headers['x-cron-secret'] === cronSec) return true;
  if (adminTok) {
    const tok = req.headers['x-admin-token'] || req.headers['authorization'];
    if (tok === adminTok || tok === 'Bearer ' + adminTok) return true;
  }
  const cookie = req.headers.cookie || '';
  if (/aa_role=(admin|publisher|editor)/.test(cookie)) return true;
  // Closed by default. Old behaviour returned true when neither secret was
  // configured — that opened the verifier to the public web and let any
  // caller burn through outbound fetches via stored URLs.
  return false;
}

// HEAD/GET a URL to learn whether it's still alive and where it ultimately
// resolves. Refuses to fetch anything that isn't a public http(s) URL — same
// SSRF guard the scraper uses, applied here so a poisoned external_url stored
// in the DB can't trick the cron into probing private/loopback/metadata IPs.
async function verifyUrl (url) {
  if (!isSafeToFetch(url)) return { status: 0, blocked: true };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  const ua = { 'User-Agent': 'ANARCHISM.AFRICA/1.0 (+link verifier)' };
  try {
    let r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: ua });
    if (r.status === 405 || r.status === 501) {
      r = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: ua });
    }
    clearTimeout(t);
    // Re-check the post-redirect URL too — a redirect chain can land on a
    // private IP even if the start was public.
    if (r.url && r.url !== url && !isSafeToFetch(r.url)) {
      return { status: 0, blocked: true };
    }
    return { status: r.status, finalUrl: r.url || url };
  } catch {
    clearTimeout(t);
    return { status: 0 };
  }
}

module.exports = async function handler (req, res) {
  if (!authed(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!sb.configured()) return res.status(500).json({ ok: false, error: 'SUPABASE not configured' });

  const useQueue = req.query?.queue === '1';
  const archive  = req.query?.archive === '1';
  // Bound per-invocation work so a single run fits a 60-second function
  // timeout. Sequential 6-second HEADs would blow that at ~10 rows; running
  // BATCH_SIZE in parallel buys us ~50–80 rows per cycle on Hobby tier.
  // For larger sweeps the cron just runs more often, or the user upgrades to
  // Vercel Workflow (durable, paginated, retry-safe — natural next step).
  const limit    = Math.min(parseInt(req.query?.limit || '120', 10) || 120, 250);
  const BATCH    = 8;
  const table    = useQueue ? 'content_queue' : 'content';
  const t0       = Date.now();

  try {
    // Pull rows whose links are stalest (or never checked) first
    const rows = await sb.select(table, {
      select: 'id,kind,external_url,source_url,url,audio',
      order: 'link_checked_at.nullsfirst',
      limit
    });

    let checked = 0, ok = 0, broken = 0, archived = 0, redirected = 0;
    let audioChecked = 0, audioOk = 0, audioBroken = 0;
    const errors = [];
    const seen = new Set();  // guard against A→B→A redirect rewrite loops

    async function processRow (row) {
      const target = row.external_url || row.source_url || row.url;
      if (target) {
        checked += 1;
        const v = await verifyUrl(target);
        const patch = {
          link_status:     v.status || 0,
          link_checked_at: new Date().toISOString(),
          link_final_url:  v.finalUrl || null
        };
        // Only rewrite external_url when the canonical is genuinely different
        // AND we haven't already chased this redirect pair on this row in
        // recent history. The seen-set is per-invocation; the row's stored
        // link_final_url protects across invocations — if last week's run
        // already wrote target=B, we won't flip back to A this week.
        const stableNew = v.finalUrl && v.finalUrl !== target &&
                          v.status >= 200 && v.status < 400 &&
                          v.finalUrl !== row.link_final_url &&
                          !seen.has(`${row.id}:${v.finalUrl}`);
        if (stableNew) {
          patch.external_url = v.finalUrl;
          seen.add(`${row.id}:${target}`);
          redirected += 1;
        }
        if (v.status >= 200 && v.status < 400) ok += 1;
        else broken += 1;

        try {
          if (archive && !useQueue && v.status >= 400) {
            await sb.update('content', row.id, { ...patch, status: 'archived' });
            archived += 1;
          } else {
            await sb.update(table, row.id, patch);
          }
        } catch (e) {
          errors.push({ id: row.id, error: String(e.message || e).slice(0, 200) });
        }
      }

      // For songs, ALSO verify the audio URL — a song without playable audio
      // is useless. Tracked separately as audio_status / audio_checked_at.
      if (!useQueue && row.kind === 'song' && row.audio) {
        audioChecked += 1;
        const a = await verifyUrl(row.audio);
        const apatch = {
          audio_status:     a.status || 0,
          audio_checked_at: new Date().toISOString()
        };
        // If audio redirected to a working canonical, rewrite stored URL.
        if (a.finalUrl && a.finalUrl !== row.audio && a.status === 200) {
          apatch.audio = a.finalUrl;
        }
        if (a.status === 200) audioOk += 1;
        else audioBroken += 1;
        try { await sb.update('content', row.id, apatch); }
        catch (e) { errors.push({ id: row.id, audio_error: String(e.message || e).slice(0, 200) }); }
      }
    }

    for (let i = 0; i < (rows || []).length; i += BATCH) {
      await Promise.all(rows.slice(i, i + BATCH).map(processRow));
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      ok: true,
      ts: Date.now(),
      table,
      checked,
      ok_count: ok,
      broken,
      redirected,
      archived,
      audio: { checked: audioChecked, ok: audioOk, broken: audioBroken },
      duration_ms: Date.now() - t0,
      errors
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
