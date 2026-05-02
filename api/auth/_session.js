// Shared session helpers - matches the shape used by api/auth/google.js so
// every provider lands the same `aa_session` cookie + JSON shape.
import crypto from 'node:crypto';

export const COOKIE   = 'aa_session';
export const TTL_DAYS = 30;

export function signSession (user, secret) {
  const payload = Buffer.from(JSON.stringify({ ...user, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function setSessionCookie (res, session) {
  const exp = new Date(Date.now() + TTL_DAYS * 24 * 3600 * 1000).toUTCString();
  res.setHeader('Set-Cookie',
    `${COOKIE}=${encodeURIComponent(session)}; Path=/; Expires=${exp}; HttpOnly; Secure; SameSite=Lax`);
}

export function randomToken (bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function randomDigits (n = 6) {
  let s = '';
  for (let i = 0; i < n; i++) s += String(Math.floor(Math.random() * 10));
  return s;
}

// Constant-time string compare
export function timingSafeEqual (a, b) {
  const ab = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
