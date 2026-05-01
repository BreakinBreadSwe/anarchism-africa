// Vercel Cron — constant stream of AA brand-mark variations.
//
// Runs every 6h (vercel.json). Generates N marks across the available
// image-gen providers (Gemini / Grok / Replicate) and queues them at
// content/marks/queue.json for publisher review in Mark Lab. Style auto-
// rotates so the queue diversifies; rejection feedback (stored at
// content/feedback/marks.json) is pulled into the prompt so the cron
// learns over time.
//
// GET /api/cron/generate-logos
//   query: ?count=8&style=random
//   resp:  { ok, generated, queued, errors }

import { put } from '@vercel/blob';

const QUEUE_KEY = 'content/marks/queue.json';
const PUBLIC_BLOB_BASE = 'https://blob.vercel-storage.com';
const STYLES = ['classic','kente','glitch','brutalist','risograph','goldleaf','screenprint','graffiti','woodcut','afrofuturist','afro-punk'];

async function readJSON (key, fallback) {
  try { const r = await fetch(`${PUBLIC_BLOB_BASE}/${key}?ts=${Date.now()}`); if (!r.ok) return fallback; return await r.json(); }
  catch { return fallback; }
}
async function writeJSON (key, value) {
  return put(key, JSON.stringify(value), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
}

export default async function handler (req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret && !req.headers['x-vercel-cron-signature']) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const origin = process.env.SITE_URL || `https://${req.headers.host || 'anarchism.africa'}`;
  const count  = Math.min(8, Math.max(1, parseInt(req.query?.count, 10) || 4));
  const summary = { ok: true, generated: 0, queued: 0, errors: [] };

  try {
    const style = (req.query?.style && req.query.style !== 'random')
      ? req.query.style
      : STYLES[(Math.floor(Date.now() / 3600000)) % STYLES.length];

    const r = await fetch(`${origin}/api/ai/generate-mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ provider: 'random', style, count })
    });
    const data = await r.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    summary.generated = items.length;

    if (items.length) {
      const cur = await readJSON(QUEUE_KEY, { items: [], updated: 0 });
      const ts = Date.now();
      items.forEach((it, idx) => {
        if (it.error) { summary.errors.push(it.error); return; }
        cur.items.unshift({
          id: 'mark_' + ts.toString(36) + '_' + idx,
          ts, provider: it.provider, style: it.style, prompt: it.prompt,
          mimeType: it.mimeType || 'image/png', b64: it.b64, status: 'pending'
        });
        summary.queued += 1;
      });
      cur.items = cur.items.slice(0, 200);
      cur.updated = ts;
      await writeJSON(QUEUE_KEY, cur);
    }
  } catch (e) {
    summary.ok = false;
    summary.errors.push(String(e.message || e));
  }
  return res.status(200).json(summary);
}
