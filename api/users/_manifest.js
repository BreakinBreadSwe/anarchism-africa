// Shared helpers for users/manifest.json stored in Vercel Blob.
//
// Manifest shape:
//   { users: [{ id, email, name, role, city, avatar, createdAt, updatedAt }], updated }
//
// Blob path: users/manifest.json (public, fixed path — not guessable by content, only by URL)

import { list, put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { readSession } from '../auth/_session.js';

const MANIFEST    = 'users/manifest.json';
const ADMIN_TOKEN = process.env.AA_ADMIN_TOKEN || '';

export const VALID_ROLES = ['admin', 'publisher', 'merch', 'partner', 'ambassador', 'consumer'];

// Accept: explicit x-aa-admin-token header  OR  signed session cookie with role=admin.
// SETUP-MODE FALLBACK: if AA_ADMIN_TOKEN isn't configured in env yet AND there's
// no signed session (typical when bootstrapping AA from zero — auth can't be
// configured because the admin endpoints that configure it are locked), allow.
// The moment AA_ADMIN_TOKEN is set in Vercel env, the gate becomes strict.
// Same self-healing pattern used by api/autopilot/run.js and api/content/queue.js.
export function isAdmin (req) {
  if (ADMIN_TOKEN && req.headers['x-aa-admin-token'] === ADMIN_TOKEN) return true;
  const user = readSession(req);
  if (user?.role === 'admin') return true;
  if (!ADMIN_TOKEN) return true; // setup mode — see comment above
  return false;
}

export async function readManifest () {
  try {
    const { blobs } = await list({ prefix: 'users/manifest' });
    const f = blobs.find(b => b.pathname === MANIFEST);
    if (f) {
      const r = await fetch(f.url, { cache: 'no-store' });
      if (r.ok) return await r.json();
    }
  } catch {}
  return { users: [], updated: null };
}

export async function writeManifest (data) {
  await put(MANIFEST, JSON.stringify(data), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json'
  });
}

export { randomUUID };
