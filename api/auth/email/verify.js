// Vercel serverless - email magic-link auth (verify).
//
// GET /api/auth/email/verify?token=<token>
//   Browser navigates here from the email link. If the token is valid:
//   - Mark used:true in Blob (single-use)
//   - Issue HMAC session cookie (same shape as Google sign-in)
//   - 302 redirect to /?signed_in=email
//   On failure: redirect to /?auth_error=<reason>

import { put, list } from '@vercel/blob';
import { signSession, setSessionCookie } from '../_session.js';

async function readBlob (key) {
  try {
    const { blobs } = await list({ prefix: key.replace(/\.json$/, '') });
    const f = blobs.find(b => b.pathname === key);
    if (f) { const r = await fetch(f.url, { cache: 'no-store' }); if (r.ok) return await r.json(); }
  } catch {}
  return null;
}
async function writeBlob (key, value) {
  return put(key, JSON.stringify(value), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json'
  });
}

export default async function handler (req, res) {
  const token  = String((req.query || {}).token || '').trim();
  const origin = process.env.SITE_URL || `https://${req.headers.host || 'anarchism.africa'}`;
  const fail   = (reason) => {
    res.statusCode = 302;
    res.setHeader('Location', `${origin}/?auth_error=${encodeURIComponent(reason)}`);
    res.end();
  };

  if (!token) return fail('missing-token');
  const secret = process.env.AUTH_SECRET;
  if (!secret) return fail('AUTH_SECRET-not-set');

  const key = 'auth/email-tokens/' + token + '.json';
  const rec = await readBlob(key);
  if (!rec)                      return fail('token-not-found');
  if (rec.used)                  return fail('token-already-used');
  if (rec.expires < Date.now())  return fail('token-expired');

  // Mark used (single-use)
  try { await writeBlob(key, { ...rec, used: true, used_at: Date.now() }); } catch {}

  // Look up the user in the manifest so stored role / name carry through.
  const usersManifest = await readBlob('users/manifest.json') || { users: [] };
  const existing = (usersManifest.users || []).find(u => u.email === rec.email);

  const user = {
    sub:            'email:' + rec.email,
    email:          rec.email,
    email_verified: true,
    name:           existing?.name   || rec.name || rec.email.split('@')[0],
    picture:        existing?.avatar || '',
    provider:       'email',
    role:           existing?.role   || 'consumer'
  };

  const session = signSession(user, secret);
  setSessionCookie(res, session);

  res.statusCode = 302;
  res.setHeader('Location', `${origin}/?signed_in=email`);
  res.end();
}
