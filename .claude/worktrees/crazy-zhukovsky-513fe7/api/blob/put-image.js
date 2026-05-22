// POST /api/blob/put-image
//   body: { key, b64, mimeType?, meta? }
//
// Saves a base64-encoded image to Vercel Blob and (optionally) updates the
// marks-manifest at content/marks/index.json so the Mark Lab gallery has a
// fast, single-fetch listing of saved favorites.
//
// Allowed key prefixes:
//   - content/marks/...        (Mark Lab favorites)
//   - content/uploads/...      (admin custom-logo uploads)
//
// Requires BLOB_READ_WRITE_TOKEN (Vercel auto-injects this when Blob storage
// is enabled on the project).

import { put } from '@vercel/blob';

const ALLOW_PREFIX = ['content/marks/', 'content/uploads/'];
const MANIFEST_KEY = 'content/marks/index.json';

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { key, b64, mimeType = 'image/png', meta = null } = req.body || {};
  if (!key || !b64) return res.status(400).json({ error: 'key and b64 required' });
  if (!ALLOW_PREFIX.some(p => key.startsWith(p))) {
    return res.status(403).json({ error: 'key prefix not allowed: ' + key });
  }
  try {
    const buf = Buffer.from(b64, 'base64');
    const r = await put(key, buf, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: mimeType
    });

    let manifestEntry = null;
    if (key.startsWith('content/marks/') && key !== MANIFEST_KEY && meta) {
      manifestEntry = await appendToManifest({
        key,
        url:  r.url,
        mime: mimeType,
        ts:   Date.now(),
        meta
      });
    }

    return res.status(200).json({ ok: true, url: r.url, pathname: r.pathname, manifestEntry });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}

async function appendToManifest (entry) {
  // Read current manifest (best-effort), append entry, write back.
  let list = [];
  try {
    const cur = await fetch(`https://blob.vercel-storage.com/${MANIFEST_KEY}`).catch(() => null);
    if (cur && cur.ok) {
      const j = await cur.json().catch(() => ({}));
      if (Array.isArray(j.items)) list = j.items;
    }
  } catch {}
  list.unshift(entry);
  list = list.slice(0, 500); // cap
  try {
    await put(MANIFEST_KEY, JSON.stringify({ items: list, updated: Date.now() }), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json'
    });
  } catch {}
  return entry;
}
