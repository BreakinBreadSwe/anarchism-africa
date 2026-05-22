// GET /api/blob/get?key=<filename>
// Reads a JSON object from Vercel Blob. If `fallback=1` and the key is missing,
// returns the local data/seed.json bundled at deploy time so the public site
// never shows an empty state.
import { list, get as blobGet } from '@vercel/blob';
import fs from 'node:fs';
import path from 'node:path';

export default async function handler (req, res) {
  const { key, fallback } = req.query || {};
  if (!key) return res.status(400).json({ error: 'key required' });

  try {
    // 1. try Blob
    const { blobs } = await list({ prefix: key });
    const exact = blobs.find(b => b.pathname === key);
    if (exact) {
      const r = await fetch(exact.url);
      const body = await r.text();
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(body);
    }
  } catch (e) {
    // fallthrough to fallback
  }

  // 2. fallback: bundled seed for the homepage / unseen content
  if (fallback === '1' && key === 'seed.json') {
    try {
      const seedPath = path.join(process.cwd(), 'data', 'seed.json');
      const body = fs.readFileSync(seedPath, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(body);
    } catch (e) {}
  }

  res.status(404).json({ error: 'not found', key });
}
