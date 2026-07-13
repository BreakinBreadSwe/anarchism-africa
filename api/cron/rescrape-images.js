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
      order: 'scraped_at',
      limit: 300
    });

    // Build a frequency map of image URLs so we can spot "publisher default"
    // images (the same OG URL repeated across many rows).
    const imageCount = {};
    for (const it of items) {
      const img = (it.image || '').trim();
      if (img) imageCount[img] = (imageCount[img] || 0) + 1;
    }
    const DUP_THRESHOLD = 2; // images that appear on 2+ rows are duplicates — tighten aggressively

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
        // For duplicate rows, tell the scraper to AVOID returning the same
        // URL again — most publisher-default OG banners are also set as
        // twitter:image and image_src, so blind re-scraping just fetches
        // the same duplicate. avoidUrl forces the scraper to skip past it
        // and reach for a body-inline image instead.
        const fresh = await scrapeImage(url, { avoidUrl: reason === 'duplicate' ? row.image : null });
        if (!fresh) {
          // No unique image found. For missing rows this is a wash. For
          // duplicate rows, explicitly NULL the field so js/thumb.js's
          // procedural generator kicks in per-item (title-seeded, so every
          // article gets a visually distinct pattern).
          if (reason === 'duplicate' && row.image) {
            await sb.update('content', row.id, { image: null });
            summary.updated_duplicate++;
          } else {
            summary.no_image_found++;
          }
          continue;
        }
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

/* Scrape a page for a good thumbnail. Tries in order:
     1. og:image
     2. twitter:image
     3. <link rel="image_src">
     4. JSON-LD schema.org "image" property (article microdata)
     5. First body <img> with dimensions ≥ 400px OR reasonably-named class
   If avoidUrl is provided, any candidate matching it is skipped — used
   when we already KNOW the site's default OG banner is the duplicate we
   want to escape from. Fetches up to 250KB (was 64KB) so body-inline
   images are reachable.
   Returns absolute URL or null. 5s hard timeout. */
async function scrapeImage (url, opts = {}) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const { avoidUrl } = opts;
  const skip = (candidate) => !candidate || (avoidUrl && candidate === avoidUrl);
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
    const text = new TextDecoder().decode(buf.slice(0, 250 * 1024));

    // 1. og:image
    let m = text.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
            text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (m && m[1]) {
      const abs = toAbsolute(m[1].trim(), url);
      if (!skip(abs)) return abs;
    }

    // 2. twitter:image
    m = text.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
        text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    if (m && m[1]) {
      const abs = toAbsolute(m[1].trim(), url);
      if (!skip(abs)) return abs;
    }

    // 3. <link rel="image_src">
    m = text.match(/<link[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["']/i);
    if (m && m[1]) {
      const abs = toAbsolute(m[1].trim(), url);
      if (!skip(abs)) return abs;
    }

    // 4. JSON-LD "image" — matches "image":"URL" and "image":["URL",...] and
    //    "image":{"url":"URL"}. Regex is loose on purpose; malformed JSON-LD
    //    is common in the wild.
    m = text.match(/"image"\s*:\s*"([^"]+)"/i) ||
        text.match(/"image"\s*:\s*\[\s*"([^"]+)"/i) ||
        text.match(/"image"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/i);
    if (m && m[1]) {
      const abs = toAbsolute(m[1].trim(), url);
      if (!skip(abs)) return abs;
    }

    // 5. First body <img> with dimensions ≥ 400 OR feature/hero class.
    //    A single regex sweep — we skip icons, avatars, spacers, and any
    //    image we're avoiding.
    const imgRe = /<img\b[^>]+>/gi;
    let img;
    while ((img = imgRe.exec(text)) !== null) {
      const tag = img[0];
      const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i) ||
                       tag.match(/\bdata-src=["']([^"']+)["']/i);
      if (!srcMatch) continue;
      const abs = toAbsolute(srcMatch[1].trim(), url);
      if (skip(abs)) continue;
      // Skip obvious non-hero images by URL pattern.
      if (/\/(icons?|avatars?|logos?|badges?|sprites?|spacer|1x1|tracking|pixel)\b/i.test(abs)) continue;
      if (/\.(svg|gif)(\?|$)/i.test(abs)) continue;
      // Prefer images that declare width/height ≥ 400 OR live in a "hero",
      // "featured", "post-thumb" style container class.
      const wm = tag.match(/\bwidth=["']?(\d+)/i);
      const hm = tag.match(/\bheight=["']?(\d+)/i);
      const w = wm ? parseInt(wm[1], 10) : 0;
      const h = hm ? parseInt(hm[1], 10) : 0;
      const cls = (tag.match(/\bclass=["']([^"']+)["']/i) || [, ''])[1];
      const looksHero = /\b(hero|featured|post-thumb|entry-image|article-image|wp-post-image)\b/i.test(cls);
      if (looksHero || (w >= 400 || h >= 400) || (!w && !h)) return abs;
    }

    return null;
  } catch { clearTimeout(t); return null; }
}

function toAbsolute (src, base) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  try { return new URL(src, base).href; } catch { return null; }
}
