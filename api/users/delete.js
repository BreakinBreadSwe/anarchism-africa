// DELETE /api/users/delete?id=<uuid>
// Admin-only: removes a user from the manifest.

import { isAdmin, readManifest, writeManifest } from './_manifest.js';

export default async function handler (req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'DELETE only' });
  if (!isAdmin(req))           return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const manifest = await readManifest();
    const before = manifest.users.length;
    manifest.users = manifest.users.filter(u => u.id !== id);
    if (manifest.users.length === before) return res.status(404).json({ error: 'user not found' });
    manifest.updated = Date.now();
    await writeManifest(manifest);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
