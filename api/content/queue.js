// GET  /api/content/queue            — list current pending items (newest first)
// POST /api/content/queue            — body: { action, item|id, patch? }
//   actions:
//     'enqueue'  → push a new pending item (used by the scraper + manual submit)
//     'approve'  → move item to seed.json under its `kind` (films/articles/...)
//     'reject'   → drop the item from the queue
//     'edit'     → patch fields of a pending item
//
// Storage: Vercel Blob at content/pending.json   = { items: [...], updated }
//          Vercel Blob at content/<kind>.json    = { items: [...], updated }
//
// Items shape:
//   {
//     id, kind, title, summary, source, url, fetched_at, image?,
//     author?, year?, director?, artist?, deadline?, ...
//     status: 'pending' | 'approved' | 'rejected',
//     submitted_by: 'scraper:africaisacountry' | 'journalist:<email>'
//   }

import { put } from '@vercel/blob';

const QUEUE_KEY = 'content/pending.json';
const PUBLIC_BLOB_BASE = 'https://blob.vercel-storage.com';

const KIND_KEYS = {
  film: 'content/films.json',
  article: 'content/articles.json',
  event: 'content/events.json',
  song: 'content/music.json',
  book: 'content/books.json',
  merch: 'content/merch.json',
  grant: 'content/grants.json'
};

async function readBlobJSON (key, fallback) {
  try {
    const r = await fetch(`${PUBLIC_BLOB_BASE}/${key}?ts=${Date.now()}`);
    if (!r.ok) return fallback;
    return await r.json();
  } catch { return fallback; }
}

async function writeBlobJSON (key, value) {
  return put(key, JSON.stringify(value), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json'
  });
}

export default async function handler (req, res) {
  try {
    if (req.method === 'GET') {
      const cur = await readBlobJSON(QUEUE_KEY, { items: [], updated: 0 });
      return res.status(200).json(cur);
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });

    const { action, item, id, patch } = req.body || {};
    const cur = await readBlobJSON(QUEUE_KEY, { items: [], updated: 0 });

    if (action === 'enqueue') {
      if (!item || !item.kind || !item.title) return res.status(400).json({ error: 'item.kind and item.title required' });
      // de-dupe by url+title
      const dupKey = (item.url || '') + '::' + (item.title || '');
      if (cur.items.some(x => ((x.url || '') + '::' + (x.title || '')) === dupKey)) {
        return res.status(200).json({ ok: true, deduped: true });
      }
      cur.items.unshift({
        id: 'pend_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        status: 'pending', fetched_at: Date.now(),
        ...item
      });
      cur.items = cur.items.slice(0, 1000);
      cur.updated = Date.now();
      await writeBlobJSON(QUEUE_KEY, cur);
      return res.status(200).json({ ok: true, count: cur.items.length });
    }

    if (action === 'edit') {
      const idx = cur.items.findIndex(x => x.id === id);
      if (idx < 0) return res.status(404).json({ error: 'not found' });
      cur.items[idx] = { ...cur.items[idx], ...(patch || {}) };
      cur.updated = Date.now();
      await writeBlobJSON(QUEUE_KEY, cur);
      return res.status(200).json({ ok: true });
    }

    if (action === 'reject') {
      const before = cur.items.length;
      cur.items = cur.items.filter(x => x.id !== id);
      cur.updated = Date.now();
      await writeBlobJSON(QUEUE_KEY, cur);
      return res.status(200).json({ ok: true, removed: before - cur.items.length });
    }

    if (action === 'approve') {
      const idx = cur.items.findIndex(x => x.id === id);
      if (idx < 0) return res.status(404).json({ error: 'not found' });
      const it = cur.items[idx];
      const target = KIND_KEYS[it.kind];
      if (!target) return res.status(400).json({ error: 'unknown kind: ' + it.kind });
      // load published list, prepend, write back
      const pub = await readBlobJSON(target, { items: [], updated: 0 });
      const arr = Array.isArray(pub.items) ? pub.items : [];
      const published = {
        ...it,
        id: (it.kind === 'article' ? 'art_' : it.kind[0] + '_') + Date.now().toString(36),
        status: 'approved',
        published_at: new Date().toISOString()
      };
      arr.unshift(published);
      await writeBlobJSON(target, { items: arr.slice(0, 5000), updated: Date.now() });
      // remove from queue
      cur.items.splice(idx, 1);
      cur.updated = Date.now();
      await writeBlobJSON(QUEUE_KEY, cur);
      return res.status(200).json({ ok: true, published });
    }

    return res.status(400).json({ error: 'unknown action: ' + action });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
