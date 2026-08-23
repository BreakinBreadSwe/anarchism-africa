// POST /api/content/ingest-urls  { urls: [ "https://…", … ], kind?: 'article' }
//
// One-shot ingestion for a list of URLs the admin wants in the app right
// away. For each URL: fetch → extract og:title / og:description /
// og:image / og:site_name → insert as content row (status=published) so
// item.html?type=article&id=<slug> renders it. The nightly enrich-content
// cron will backfill body / gallery / embeds within a few hours.
//
// Auth: same convention as other admin endpoints — admin token header,
// admin/publisher session cookie, or setup-mode fallback when neither
// AA_ADMIN_TOKEN nor CRON_SECRET env is set.

const sb = require('../../lib/supabase');
const { isSafeToFetch } = require('../../lib/url-safety');
const { readSession }   = require('../auth/_session.js');

module.exports = async function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method not allowed' }); }
  const gate = await allowWrite(req);
  if (!gate.ok) return res.status(gate.status).json({ error: gate.reason });
  if (!sb.configured()) return res.status(500).json({ error: 'supabase not configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const urls = Array.isArray(body?.urls) ? body.urls : null;
  if (!urls || !urls.length) return res.status(400).json({ error: 'body.urls must be a non-empty array' });
  const kind = String(body?.kind || 'article').toLowerCase();

  const summary = { requested: urls.length, inserted: 0, skipped_existing: 0, errors: [] };
  for (const raw of urls) {
    const url = String(raw || '').trim();
    if (!url || !isSafeToFetch(url)) { summary.errors.push({ url, error: 'unsafe or missing url' }); continue; }
    try {
      // Skip if this external_url is already in the DB.
      const existing = await sb.select('content', { eq: { external_url: url }, limit: 1 });
      if (existing.length) { summary.skipped_existing++; continue; }
      const meta = await scrapeMeta(url);
      const row = {
        kind,
        status:       'published',
        title:        meta.title || url,
        summary:      meta.summary || '',
        image:        meta.image  || null,
        external_url: url,
        source_url:   url,
        source:       meta.site || domainOf(url),
        author:       meta.author || null,
        published_at: meta.published_at || null,
        scraped_at:   new Date().toISOString()
      };
      const [saved] = await sb.insert('content', row);
      summary.inserted++;
      summary.errors.length < 20 && summary.errors.push({ url, id: saved?.id, title: row.title }); // report every insert
    } catch (e) {
      summary.errors.push({ url, error: String(e.message || e).slice(0, 300) });
    }
  }
  return res.status(200).json({ ok: true, ...summary });
};

/* ---------- meta scraping ---------- */
async function scrapeMeta (url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal:  ctrl.signal,
      headers: { 'User-Agent': 'ANARCHISM.AFRICA/1.0 (+ingest)' }
    });
    clearTimeout(t);
    if (!r.ok) return {};
    const buf  = await r.arrayBuffer();
    const html = new TextDecoder().decode(buf.slice(0, 300 * 1024));
    return {
      title:        meta(html, 'og:title')       || tag(html, 'title'),
      summary:      meta(html, 'og:description') || meta(html, 'description'),
      image:        toAbs(meta(html, 'og:image'), url),
      site:         meta(html, 'og:site_name'),
      author:       meta(html, 'article:author') || meta(html, 'author'),
      published_at: meta(html, 'article:published_time') || meta(html, 'datePublished')
    };
  } catch { clearTimeout(t); return {}; }
}
function meta (html, name) {
  const re = new RegExp(
    `<meta[^>]*(?:property|name)=["']${name.replace(':', '\\:')}["'][^>]*content=["']([^"']+)["']` +
    `|<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${name.replace(':', '\\:')}["']`,
    'i'
  );
  const m = html.match(re);
  return m ? (m[1] || m[2] || '').trim() : '';
}
function tag (html, name) {
  const m = html.match(new RegExp(`<${name}[^>]*>([^<]+)</${name}>`, 'i'));
  return m ? m[1].trim() : '';
}
function toAbs (src, base) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  try { return new URL(src, base).href; } catch { return null; }
}
function domainOf (url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

/* ---------- auth ---------- */
async function allowWrite (req) {
  const adminTok = (process.env.ADMIN_TOKEN || (process.env.ADMIN_TOKEN || process.env.AA_ADMIN_TOKEN));
  const cronSec  = process.env.CRON_SECRET;
  if (!adminTok && !cronSec) return { ok: true };            // setup mode
  const hdrTok = req.headers['x-admin-token'] || req.headers['x-aa-admin-token'];
  if (adminTok && hdrTok === adminTok) return { ok: true };
  try {
    const sess = readSession(req);
    if (sess && (sess.role === 'admin' || sess.role === 'publisher')) return { ok: true };
  } catch {}
  return { ok: false, status: 401, reason: 'admin or publisher required' };
}
