// Vercel serverless — auto-find a portrait image for an author.
//
// GET /api/merch/scrape-portrait?author=Sekou+Toure
//   resp: { url, source: 'wikipedia', title, license }
//
// Hits Wikipedia REST API in two steps:
//   1. Search → best matching page title
//   2. Page summary → originalimage.source (the canonical portrait file)
//
// Why: many quotes in data/afro-anarchist-quotes.json have stale or
// 400-ing Wikimedia thumb URLs (Wikipedia auto-thumbs occasionally
// invalidate when the source file moves). Re-resolving via the API
// gives a fresh URL that the SVG generator can embed without breaking.

const UA = 'ANARCHISM.AFRICA/1.0 (portrait-scrape; +https://anarchism.africa)';

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }
  const author = String(req.query.author || '').trim();
  if (!author) return res.status(400).json({ error: 'author query param required' });

  try {
    // 1. Search Wikipedia for the best-matching page title.
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(author)}&format=json&srlimit=3&origin=*`;
    const sR = await fetch(searchUrl, { headers: { 'User-Agent': UA } });
    if (!sR.ok) throw new Error('wikipedia search ' + sR.status);
    const sData = await sR.json();
    const hits = sData?.query?.search || [];
    if (!hits.length) return res.status(404).json({ error: 'no wikipedia hit for ' + author });

    // 2. Try each hit's summary until we find one with an image.
    for (const hit of hits.slice(0, 3)) {
      const title = hit.title;
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const pR = await fetch(summaryUrl, { headers: { 'User-Agent': UA } });
      if (!pR.ok) continue;
      const p = await pR.json();
      // Prefer the larger originalimage; fall back to thumbnail.
      const url = p?.originalimage?.source || p?.thumbnail?.source;
      if (url) {
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        return res.status(200).json({
          url,
          source: 'wikipedia',
          title,
          page_url: p?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
          extract: (p?.extract || '').slice(0, 300),
          // Wikimedia Commons images are predominantly CC BY-SA or public
          // domain; we surface the page link so the editor can verify the
          // licence before using on physical merch.
          license: 'see commons page for licence'
        });
      }
    }
    return res.status(404).json({ error: 'no image found across top wikipedia hits for ' + author });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
