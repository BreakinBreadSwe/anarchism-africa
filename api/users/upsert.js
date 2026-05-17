// POST /api/users/upsert
// Admin-only: create or update a user entry in the manifest.
//
// Create: body must include { email, name?, role?, city?, avatar? }
//         id must NOT be present — one will be generated.
// Update: body must include { id, name?, email?, role?, city?, avatar? }
//         At least one field besides id must differ from current value.
//
// Responds { ok: true, user: {...} }

import { isAdmin, readManifest, writeManifest, randomUUID, VALID_ROLES } from './_manifest.js';

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!isAdmin(req))         return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body || {};
  const { id } = body;
  const email   = (body.email  || '').toLowerCase().trim();
  const name    = (body.name   || '').trim();
  const role    = (body.role   || 'consumer').trim();
  const city    = (body.city   || '').trim();
  const avatar  = (body.avatar || '').trim();

  if (role && !VALID_ROLES.includes(role))
    return res.status(400).json({ error: 'invalid role — must be one of: ' + VALID_ROLES.join(', ') });

  try {
    const manifest = await readManifest();
    const now = new Date().toISOString();

    if (id) {
      // ── Update ──────────────────────────────────────────────────────────────
      const idx = manifest.users.findIndex(u => u.id === id);
      if (idx === -1) return res.status(404).json({ error: 'user not found' });
      const prev = manifest.users[idx];
      manifest.users[idx] = {
        ...prev,
        ...(email  ? { email }  : {}),
        ...(name   ? { name }   : {}),
        ...(role   ? { role }   : {}),
        ...(city   !== undefined ? { city }   : {}),
        ...(avatar !== undefined ? { avatar } : {}),
        updatedAt: now
      };
      manifest.updated = Date.now();
      await writeManifest(manifest);
      return res.status(200).json({ ok: true, user: manifest.users[idx] });
    } else {
      // ── Create ──────────────────────────────────────────────────────────────
      if (!email) return res.status(400).json({ error: 'email required for new users' });
      if (!/.+@.+\..+/.test(email)) return res.status(400).json({ error: 'invalid email' });
      if (manifest.users.find(u => u.email === email))
        return res.status(409).json({ error: 'a user with that email already exists' });

      const user = {
        id:        randomUUID(),
        email,
        name:      name || email.split('@')[0],
        role:      role || 'consumer',
        city,
        avatar,
        createdAt: now,
        updatedAt: now
      };
      manifest.users.unshift(user);
      manifest.updated = Date.now();
      await writeManifest(manifest);
      return res.status(200).json({ ok: true, user });
    }
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
