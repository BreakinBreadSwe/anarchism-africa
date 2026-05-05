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

function authed (req) {
  const adminTok = process.env.ADMIN_TOKEN;
  const cronSec  = process.env.CRON_SECRET;
  if (cronSec && (req.headers['x-cron-secret'] === cronSec || req.headers['x-vercel-cron-signature'])) return true;
  if (adminTok) {
    const tok = req.headers['x-admin-token'] || req.headers['authorization'];
    if (tok === adminTok || tok === 'Bearer ' + adminTok) return true;
  }
  const cookie = req.headers.cookie || '';
  if (/aa_role=(admin|publisher|editor)/.test(cookie)) return true;
  if (!adminTok && !cronSec) return true;
  return false;
}

async function verifyUrl (url) {
  if (!url || !/^https?:\/\//i.test(url)) return { status: 0 };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  const ua = { 'User-Agent': 'ANARCHISM.AFRICA/1.0 (+link verifier)' };
  try {
    let r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: ua });
    if (r.status === 405 || r.status === 501) {
      r = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: ua });
    }
    clearTimeout(t);
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
  const limit    = Math.min(parseInt(req.query?.limit || '200', 10) || 200, 1000);
  const table    = useQueue ? 'content_queue' : 'content';
  const t0       = Date.now();

  try {
    // Pull rows whose links are stalest (or never checked) first
    const rows = await sb.select(table, {
      select: 'id,external_url,source_url,url',
      order: 'link_checked_at.nullsfirst',
      limit
    });

    let checked = 0, ok = 0, broken = 0, archived = 0, redirected = 0;
    const errors = [];

    for (const row of rows || []) {
      const target = row.external_url || row.source_url || row.url;
      if (!target) continue;
      checked += 1;
      const v = await verifyUrl(target);
      const patch = {
        link_status:     v.status || 0,
        link_checked_at: new Date().toISOString(),
        link_final_url:  v.finalUrl || null
      };
      // If the URL redirected to a different canonical, also rewrite
      // external_url so card clicks go to the live page from now on.
      if (v.finalUrl && v.finalUrl !== target && v.status >= 200 && v.status < 400) {
        patch.external_url = v.finalUrl;
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
      duration_ms: Date.now() - t0,
      errors
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
