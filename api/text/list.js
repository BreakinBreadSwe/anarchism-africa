// GET /api/text/list
// Returns the text-library manifest from Vercel Blob.
// Query params:
//   ?type=pamphlet|book|thesis|periodical|speech
//   ?lang=en|fr|pt|ar|sw  (language filter)
//   ?q=<search term>       (title/author/tag full-text filter, server-side)
// Cache: 5 minutes public.

import { list } from '@vercel/blob';

const BLOB_KEY = 'text-library/manifest.json';

export default async function handler (req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    const { blobs } = await list({ prefix: 'text-library/manifest' });
    const f = blobs.find(b => b.pathname === BLOB_KEY);

    if (!f) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).json({ texts: [], total: 0, updated: null });
    }

    const r = await fetch(f.url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`blob fetch ${r.status}`);

    let { texts = [], updated, total } = await r.json();

    // Server-side filters — keeps the payload small for category/search views
    const { type, lang, q } = req.query || {};

    if (type && type !== 'all') {
      texts = texts.filter(t => t.type === type);
    }
    if (lang) {
      texts = texts.filter(t => (t.language || 'en').startsWith(lang));
    }
    if (q) {
      const term = q.toLowerCase();
      texts = texts.filter(t =>
        (t.title  || '').toLowerCase().includes(term) ||
        (t.author || '').toLowerCase().includes(term) ||
        (t.tags   || []).some(tag => tag.includes(term))
      );
    }

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ texts, total: texts.length, updated });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
