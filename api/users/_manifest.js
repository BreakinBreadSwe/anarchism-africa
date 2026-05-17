// Shared helpers for users/manifest.json stored in Vercel Blob.
//
// Manifest shape:
//   { users: [{ id, email, name, role, city, avatar, createdAt, updatedAt }], updated }
//
// Blob path: users/manifest.json (public, fixed path — not guessable by content, only by URL)

import { list, put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';

const MANIFEST     = 'users/manifest.json';
const ADMIN_TOKEN  = process.env.AA_ADMIN_TOKEN || '';

export const VALID_ROLES = ['admin', 'publisher', 'merch', 'partner', 'ambassador', 'consumer'];

export function isAdmin (req) {
  if (!ADMIN_TOKEN) return false;
  return req.headers['x-aa-admin-token'] === ADMIN_TOKEN;
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
