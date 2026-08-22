// GET /api/share?kind=<type>&id=<id>
//
// Serves a lightweight HTML shell whose <head> carries proper Open Graph /
// Twitter Card metadata for a specific item (article, film, song, etc.),
// then immediately redirects a human browser to the real detail page.
//
// This exists because link previewers (WhatsApp, Signal, Telegram, iMessage,
// Slack, IG DMs, X, Facebook, etc.) fetch the target URL with a bot user-agent
// and parse HTML statically — they DO NOT execute JavaScript. Our SPA-style
// item.html has generic OG tags baked in; without server-side per-item
// metadata, every shared link previews as the same generic card.
//
// Client-side aa-share.js constructs share URLs pointing here, e.g.
//   https://anarchism.africa/api/share?kind=article&id=a13
// Bots see the item-specific OG tags. Humans get instantly bounced to
//   /item.html?type=article&id=a13
// via a meta-refresh + script fallback.

const fs   = require('fs');
const path = require('path');

const KIND_TO_KEY = {
  article: 'articles', film: 'films', event: 'events', song: 'music',
  book: 'books', merch: 'merch', grant: 'grants'
};
const TYPE_TO_ROUTE = {
  song: (id) => `/sound-library.html?track=${encodeURIComponent(id)}`
};

module.exports = async function handler (req, res) {
  const kind = String(req.query?.kind || req.query?.type || 'article').toLowerCase();
  const id   = String(req.query?.id   || '').trim();

  const item = await lookup(kind, id);

  const rawTitle = (item?.title || 'ANARCHISM.AFRICA').trim();
  const rawDesc  = (item?.summary || item?.description || item?.deck ||
                    'Afrofuturist 360° on afro-anarchism — Africa & diaspora.').trim();
  const image    = absoluteUrl(item?.image || item?.coverImageUrl ||
                    'https://anarchism.africa/icons/og-image.png');
  const dest     = destinationFor(kind, id);
  const origin   = originOf(req);
  const canonical = origin + dest;

  const title = esc(rawTitle);
  const desc  = esc(rawDesc.slice(0, 300));
  const img   = esc(image);
  const url   = esc(canonical);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Cache for a minute at the edge — items don't change often and this
  // endpoint is hot when many people share the same URL.
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — ANARCHISM.AFRICA</title>
  <meta name="description" content="${desc}" />
  <link rel="canonical" href="${url}" />

  <meta property="og:site_name"    content="ANARCHISM.AFRICA" />
  <meta property="og:title"        content="${title}" />
  <meta property="og:description"  content="${desc}" />
  <meta property="og:image"        content="${img}" />
  <meta property="og:image:alt"    content="${title}" />
  <meta property="og:url"          content="${url}" />
  <meta property="og:type"         content="article" />

  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${title}" />
  <meta name="twitter:description" content="${desc}" />
  <meta name="twitter:image"       content="${img}" />

  <meta http-equiv="refresh" content="0; url=${esc(dest)}" />
  <script>location.replace(${JSON.stringify(dest)});</script>
  <style>
    html,body{background:#0a0a0a;color:#eee;font-family:system-ui,sans-serif;margin:0;padding:0}
    .wrap{max-width:600px;margin:12vh auto 0;padding:24px;text-align:center}
    a{color:#ffd700}
  </style>
</head>
<body>
  <div class="wrap">
    <h1 style="font-weight:900;letter-spacing:.02em">${title}</h1>
    <p>${desc}</p>
    <p><a href="${esc(dest)}">Continue →</a></p>
  </div>
</body>
</html>`);
};

function esc (s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

function absoluteUrl (u) {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('/'))  return 'https://anarchism.africa' + u;
  return u;
}

function originOf (req) {
  const host  = req.headers['x-forwarded-host'] || req.headers.host || 'anarchism.africa';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

function destinationFor (kind, id) {
  const router = TYPE_TO_ROUTE[kind];
  if (router) return router(id);
  return `/item.html?type=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`;
}

// Lookup an item by kind + id. Reads the same data sources item-page.js
// does — /api/content/list first (Supabase/Blob), then the bundled
// data/seed.json as a fallback. We ONLY need the display fields
// (title/summary/image) here, so a shallow read is fine.
async function lookup (kind, id) {
  const key = KIND_TO_KEY[kind] || kind + 's';
  try {
    const { list } = require('@vercel/blob');
    const { blobs } = await list({ prefix: 'sound-library/manifest' });
    if (kind === 'song') {
      const f = blobs.find(b => b.pathname === 'sound-library/manifest.json');
      if (f) {
        const r = await fetch(f.url);
        if (r.ok) {
          const d = await r.json();
          const t = (d.tracks || []).find(t => (t.id || t.slug) === id);
          if (t) return normalizeTrack(t);
        }
      }
    }
  } catch {}
  try {
    const p = path.join(process.cwd(), 'data', 'seed.json');
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    const list = d[key] || [];
    const found = list.find(x => x.id === id);
    if (found) return found;
  } catch {}
  return null;
}
function normalizeTrack (t) {
  return {
    title:   t.title,
    summary: t.description || t.summary || t.notes || (t.author ? `by ${t.author}` : ''),
    image:   t.coverImageUrl || t.image || ''
  };
}

module.exports.config = { runtime: 'nodejs' };
