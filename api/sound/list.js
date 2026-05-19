// GET /api/sound/list
// Returns the A.A. Sound Library manifest from Vercel Blob.
// Supports ?category=music|spoken-word|radio|documentary|field filter.
// Cached 5 minutes publicly (scraper runs daily so staleness is fine).

import { list } from '@vercel/blob';

const BLOB_KEY = 'sound-library/manifest.json';

export default async function handler (req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { category } = req.query;

  try {
    const { blobs } = await list({ prefix: 'sound-library/manifest' });
    const f = blobs.find(b => b.pathname === BLOB_KEY);
    if (f) {
      const r = await fetch(f.url, { cache: 'no-store' });
      if (r.ok) {
        const body = await r.json();
        const tracks = category
          ? (body.tracks || []).filter(t => t.category === category)
          : (body.tracks || []);
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).json({ tracks, total: tracks.length, updated: body.updated });
      }
    }
  } catch {}

  res.setHeader('Cache-Control', 'public, max-age=60');
  return res.status(200).json({ tracks: [], total: 0, updated: null });
}
