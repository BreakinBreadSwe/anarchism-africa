// Vercel Cron — DEEP-SCRAPE for existing content rows.
//
// For every published row without a body, or that hasn't been enriched yet,
// this fetches the original article page and extracts:
//   - Full body text (Readability-lite: pick the largest article-like block)
//   - Gallery of images (unique, ≥400px declared OR hero-class, skip icons)
//   - Embedded videos (YouTube + Vimeo iframes) as { platform, url, id }
// Then updates the row's body / gallery / embeds / enriched_at fields.
//
// Schema requires the columns from db/migrations/2026-06-content-enrichment.sql.
// Apply that once in Supabase SQL editor before the first cron run.
//
// Configure in vercel.json:
//   { "path": "/api/cron/enrich-content", "schedule": "30 5 * * *" }
//   (Runs 30 min after rescrape-images so image URLs are fresh when we
//    collect the gallery.)

const sb = require('../../lib/supabase');
const { isSafeToFetch } = require('../../lib/url-safety');

module.exports = async function handler (req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret && !req.headers['x-vercel-cron-signature']) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!sb.configured()) return res.status(500).json({ error: 'supabase not configured' });

  const summary = {
    checked: 0,
    enriched: 0,
    no_content_found: 0,
    skipped_deadline: 0,
    errors: []
  };
  const deadline = Date.now() + 50_000;

  try {
    // Prioritise rows never enriched, then oldest-enriched. Cap at 60 per
    // run so we don't hit the function timeout on slow-responding source
    // sites (5s each × 60 = 300s worst case, but we cut at the deadline).
    const items = await sb.select('content', {
      eq: { status: 'published' },
      order: 'enriched_at,scraped_at',
      limit: 200
    });

    // Batched in parallel — same rationale as rescrape-images: sequential
    // 6s-timeout fetches drain ~8 rows/run, batched drains ~48/run.
    const BATCH = 6;
    async function processOne (row) {
      const url = row.external_url || row.url || row.source_url;
      if (!url || !isSafeToFetch(url)) return;
      const hasBody    = !!(row.body && String(row.body).trim().length > 200);
      const hasGallery = Array.isArray(row.gallery) && row.gallery.length;
      const hasEmbeds  = Array.isArray(row.embeds)  && row.embeds.length;
      if (hasBody && (hasGallery || hasEmbeds)) return;
      summary.checked++;
      try {
        const scraped = await deepScrape(url);
        if (!scraped) { summary.no_content_found++; return; }
        const patch = { enriched_at: new Date().toISOString() };
        if (!hasBody && scraped.body)             patch.body    = scraped.body;
        if (!hasGallery && scraped.gallery.length) patch.gallery = scraped.gallery;
        if (!hasEmbeds  && scraped.embeds.length)  patch.embeds  = scraped.embeds;
        if (Object.keys(patch).length === 1) { summary.no_content_found++; return; }
        await sb.update('content', row.id, patch);
        summary.enriched++;
      } catch (e) {
        summary.errors.push({ id: row.id, error: String(e.message || e).slice(0, 200) });
      }
    }
    for (let i = 0; i < items.length; i += BATCH) {
      if (Date.now() > deadline) { summary.skipped_deadline += (items.length - i); break; }
      await Promise.all(items.slice(i, i + BATCH).map(processOne));
    }
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e), partial: summary });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, ts: Date.now(), ...summary });
};

/* Fetch the article + extract body / gallery / embeds.
   Returns { body, gallery[], embeds[] } or null on fetch failure. */
async function deepScrape (url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'ANARCHISM.AFRICA/1.0 (+content enricher)' }
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    // Up to 400KB — full body + gallery + embeds live within this window
    // for even long-form articles. Bigger risks memory + timeout.
    const html = new TextDecoder().decode(buf.slice(0, 400 * 1024));
    return {
      body:    extractBody(html),
      gallery: extractGallery(html, url),
      embeds:  extractEmbeds(html)
    };
  } catch { clearTimeout(t); return null; }
}

/* Readability-lite: pick the largest text block inside a semantic article
   container (<article>, main, div class ~ post/entry/content). Strip HTML
   tags but preserve paragraph breaks. Returns plain text (markdown-safe). */
function extractBody (html) {
  // Priority containers, tried in order. Take the largest text block from
  // whichever matches first.
  const containers = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<div\b[^>]*class=["'][^"']*\b(?:post-content|entry-content|article-body|post-body|content-body|story-body)\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  ];
  let candidate = '';
  for (const re of containers) {
    const m = html.match(re);
    if (m && m[1] && m[1].length > candidate.length) candidate = m[1];
  }
  if (!candidate) return null;
  // Strip scripts, styles, forms, nav, aside.
  candidate = candidate
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi,   '')
    .replace(/<form\b[\s\S]*?<\/form>/gi,     '')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi,       '')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi,   '');
  // Convert <br> and <p> boundaries to newlines; strip remaining tags.
  const text = candidate
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  // Cap at 20KB — anything longer is either a full ebook or a broken parse.
  return text.length > 200 ? text.slice(0, 20_000) : null;
}

/* All <img> tags with declared dimensions ≥400px or a hero-class hint.
   Dedupes by URL, skips icons/avatars/spacers/SVG/GIF. */
function extractGallery (html, base) {
  const gallery = [];
  const seen = new Set();
  const imgRe = /<img\b[^>]+>/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null && gallery.length < 12) {
    const tag = m[0];
    const src = (tag.match(/\bsrc=["']([^"']+)["']/i) ||
                 tag.match(/\bdata-src=["']([^"']+)["']/i) || [, ''])[1];
    if (!src) continue;
    const abs = toAbsolute(src.trim(), base);
    if (!abs || seen.has(abs)) continue;
    if (/\/(icons?|avatars?|logos?|badges?|sprites?|spacer|1x1|tracking|pixel)\b/i.test(abs)) continue;
    if (/\.(svg|gif)(\?|$)/i.test(abs)) continue;
    const w = parseInt((tag.match(/\bwidth=["']?(\d+)/i) || [, '0'])[1], 10);
    const h = parseInt((tag.match(/\bheight=["']?(\d+)/i) || [, '0'])[1], 10);
    const cls = (tag.match(/\bclass=["']([^"']+)["']/i) || [, ''])[1];
    const looksHero = /\b(hero|featured|wp-image|wp-post-image|entry|article|post|full)\b/i.test(cls);
    if (!looksHero && w < 400 && h < 400 && (w || h)) continue;
    const alt = (tag.match(/\balt=["']([^"']*)["']/i) || [, ''])[1];
    gallery.push({ url: abs, alt: alt.slice(0, 200) || null });
    seen.add(abs);
  }
  return gallery;
}

/* All embedded videos (YouTube + Vimeo). Returns [{ platform, id, url }]. */
function extractEmbeds (html) {
  const embeds = [];
  const seen = new Set();
  // YouTube — iframe embed URLs + inline youtu.be links.
  const ytIframe = /<iframe[^>]+src=["'](?:https?:)?\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{6,20})/gi;
  const ytLink   = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,20})/gi;
  let m;
  while ((m = ytIframe.exec(html)) !== null) {
    if (!seen.has(m[1])) { embeds.push({ platform: 'youtube', id: m[1], url: `https://youtu.be/${m[1]}` }); seen.add(m[1]); }
  }
  while ((m = ytLink.exec(html)) !== null) {
    if (!seen.has(m[1])) { embeds.push({ platform: 'youtube', id: m[1], url: `https://youtu.be/${m[1]}` }); seen.add(m[1]); }
  }
  // Vimeo
  const vimeoIframe = /<iframe[^>]+src=["'](?:https?:)?\/\/player\.vimeo\.com\/video\/(\d+)/gi;
  const vimeoLink   = /https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/gi;
  while ((m = vimeoIframe.exec(html)) !== null) {
    if (!seen.has('v' + m[1])) { embeds.push({ platform: 'vimeo', id: m[1], url: `https://vimeo.com/${m[1]}` }); seen.add('v' + m[1]); }
  }
  while ((m = vimeoLink.exec(html)) !== null) {
    if (!seen.has('v' + m[1])) { embeds.push({ platform: 'vimeo', id: m[1], url: `https://vimeo.com/${m[1]}` }); seen.add('v' + m[1]); }
  }
  return embeds;
}

function toAbsolute (src, base) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith('//')) return 'https:' + src;
  try { return new URL(src, base).href; } catch { return null; }
}
