// GET /api/users/list
// Admin-only: returns the full user manifest.
// Responds { users: [], updated: null } if no manifest exists yet.

import { isAdmin, readManifest } from './_manifest.js';

export default async function handler (req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (!isAdmin(req))        return res.status(401).json({ error: 'Unauthorized' });
  try {
    const manifest = await readManifest();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ users: manifest.users || [], updated: manifest.updated || null });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
