// GET /api/archive/list
// Returns the archive manifest from Vercel Blob at archive/manifest.json.
// Responds { items: [], updated: null } if no manifest exists yet.
// Cache: 30 s (public).

import { list } from '@vercel/blob';

export default async function handler (req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  try {
    const { blobs } = await list({ prefix: 'archive/manifest' });
    const f = blobs.find(b => b.pathname === 'archive/manifest.json');
    if (f) {
      const r = await fetch(f.url, { cache: 'no-store' });
      if (r.ok) {
        const body = await r.text();
        res.setHeader('Cache-Control', 'public, max-age=30');
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(body);
      }
    }
  } catch {}
  res.status(200).json({ items: [], updated: null });
}
