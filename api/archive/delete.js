// DELETE /api/archive/delete?id=<uuid>
// Admin-only: removes an entry from the manifest.
// Does NOT delete the Blob object itself (use Vercel dashboard for that).

import { list, put } from '@vercel/blob';

const MANIFEST    = 'archive/manifest.json';
const ADMIN_TOKEN = process.env.AA_ADMIN_TOKEN || '';

export default async function handler (req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'DELETE only' });
  const token = req.headers['x-aa-admin-token'];
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const manifest = await readManifest();
    const before   = manifest.items.length;
    manifest.items = manifest.items.filter(i => i.id !== id);
    if (manifest.items.length === before) return res.status(404).json({ error: 'not found' });
    manifest.updated = Date.now();
    await writeManifest(manifest);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

async function readManifest () {
  try {
    const { blobs } = await list({ prefix: 'archive/manifest' });
    const f = blobs.find(b => b.pathname === MANIFEST);
    if (f) {
      const r = await fetch(f.url, { cache: 'no-store' });
      if (r.ok) return await r.json();
    }
  } catch {}
  return { items: [], updated: null };
}

async function writeManifest (data) {
  await put(MANIFEST, JSON.stringify(data), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json'
  });
}
