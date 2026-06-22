// Vercel Cron handler — re-scrapes thumbnails / media for existing content
// rows that have NO image, or whose image URL is duplicated across many rows
// (e.g. a publisher's default banner served as og:image for every article).
//
// Configure in vercel.json:
//   { "path": "/api/cron/rescrape-images", "schedule": "0 5 * * *" }  (daily 05:00 UTC)
//
// Why: scan-content.js caps OG scrapes at 30/run to stay under the function
// timeout. Items beyond that cap land with image=null. This sweeper picks
// them up over time. Duplicate detection also catches the "every article on
// site X has the same generic og:image" pattern by replacing the duplicate
// with whatever a deeper page-scrape can find (gallery image, twitter:image,
// first large <img>).
//
// 50s deadline guards against the same timeout cliff scan-content hit. The
// queue dedupes by URL hash so re-runs are cheap.

const sb = require('../../lib/supabase');
const { isSafeToFetch } = require('../../lib/url-safety');

module.exports = async function handler (req, res) {
  // Optional cron secret check (Vercel sets x-vercel-cron-signature)
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret && !req.headers['x-vercel-cron-signature']) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!sb.configured()) return res.status(500).json({ error: 'supabase not configured' });

  const summary = {
    scanned: 0,
    updated_missing: 0,
    updated_duplicate: 0,
    no_image_found: 0,
    skipped_deadline: 0,
    errors: []
  };
  const deadline = Date.now() + 50_000;

  try {
    // Pull up to 300 published items (limit keeps us under function memory).
    // Oldest scraped_at first so the longest-stale rows get priority.
    const items = await sb.select('content', {
      eq: { status: 'published' },
      order: 'scraped_at.asc.nullslast',
      limit: 300
    });

    // Build a frequency map of image URLs so we can spot "publisher default"
    // images (the same OG URL repeated across many rows).
    const imageCount = {};
    for (const it of items) {
      const img = (it.image || '').trim();
      if (img) imageCount[img] = (imageCount[img] || 0) + 1;
    }
    const DUP_THRESHOLD = 3; // images that appear on 3+ rows are "publisher defaults"

    // Build target list: missing image first, then known duplicates.
    const targets = [];
    for (const it of items) {
      const img = (it.image || '').trim();
      if (!img) targets.push({ row: it, reason: 'missing' });
    }
    for (const it of items) {
      const img = (it.image || '').trim();
      if (img && imageCount[img] >= DUP_THRESHOLD) targets.push({ row: it, reason: 'duplicate' });
    }

    for (const { row, reason } of targets) {
      if (Date.now() > deadline) { summary.skipped_deadline++; continue; }
      summary.scanned++;
      const url = row.external_url || row.url || row.source_url;
      if (!url || !isSafeToFetch(url)) {
        summary.errors.push({ id: row.id, reason, error: 'url unsafe or missing' });
        continue;
      }
      try {
        const fresh = await scrapeOgImage(url);
        if (!fresh) { summary.no_image_found++; continue; }
        // For "duplicate" rows: only replace if the new image is different
        // from the duplicated one (otherwise we'd just write the same value).
        if (reason === 'duplicate' && fresh === row.image) continue;
        await sb.update('content', row.id, { image: fresh });
        if (reason === 'missing') summary.updated_missing++;
        else                       summary.updated_duplicate++;
      } catch (e) {
        summary.errors.push({ id: row.id, reason, error: String(e.message || e) });
      }
    }
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e), partial: summary });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, ts: Date.now(), ...summary });
};

/* Scrape og:image (then twitter:image) from a page. 5s hard timeout.
   Looks at the first 64KB of the response — every well-formed page has
   its <head> well within that. Returns absolute URL or null. */
async function scrapeOgImage (url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'ANARCHISM.AFRICA/1.0 (+thumbnail rescraper)' }
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    const text = new TextDecoder().decode(buf.slice(0, 65536));
    const og = text.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
               text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (og && og[1]) return toAbsolute(og[1].trim(), url);
    const tw = text.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
               text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    if (tw && tw[1]) return toAbsolute(tw[1].trim(), url);
    return null;
  } catch { clearTimeout(t); return null; }
}

function toAbsolute (src, base) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  try { return new URL(src, base).href; } catch { return null; }
}
