// Vercel serverless - phone OTP auth (verify).
//
// POST /api/auth/phone/verify
//   body: { phone, code }
//   resp: { ok:true, user } + sets aa_session cookie
//
// Rules: max 5 attempts per OTP record; expired/invalid responds generically.

import { put } from '@vercel/blob';
import { signSession, setSessionCookie, timingSafeEqual } from '../_session.js';

const PUBLIC_BLOB_BASE = 'https://blob.vercel-storage.com';
const MAX_ATTEMPTS = 5;

async function readBlob (key) {
  try { const r = await fetch(`${PUBLIC_BLOB_BASE}/${key}?ts=${Date.now()}`); if (!r.ok) return null; return await r.json(); }
  catch { return null; }
}
async function writeBlob (key, value) {
  return put(key, JSON.stringify(value), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
}

function e164 (phone) {
  const cleaned = String(phone || '').replace(/[^\d+]/g, '');
  return /^\+[1-9]\d{6,14}$/.test(cleaned) ? cleaned : null;
}
function phoneKey (phone) { return Buffer.from(phone).toString('hex'); }

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const phone = e164((req.body || {}).phone);
  const code  = String((req.body || {}).code || '').trim();
  if (!phone)              return res.status(400).json({ error: 'phone must be in E.164 format' });
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'code must be 6 digits' });

  const secret = process.env.AUTH_SECRET;
  if (!secret) return res.status(500).json({ error: 'AUTH_SECRET not set' });

  const key = 'auth/phone-tokens/' + phoneKey(phone) + '.json';
  const rec = await readBlob(key);
  if (!rec)                       return res.status(401).json({ error: 'no code requested - start over' });
  if (rec.expires < Date.now())   return res.status(401).json({ error: 'code expired - request a new one' });
  if (rec.attempts >= MAX_ATTEMPTS) return res.status(429).json({ error: 'too many attempts - request a new code' });

  if (!timingSafeEqual(code, rec.code)) {
    try { await writeBlob(key, { ...rec, attempts: rec.attempts + 1 }); } catch {}
    return res.status(401).json({ error: 'wrong code', remaining: MAX_ATTEMPTS - rec.attempts - 1 });
  }

  // Burn the OTP so it can't be reused
  try { await writeBlob(key, { ...rec, used: true, used_at: Date.now() }); } catch {}

  const user = {
    sub:       'phone:' + phone,
    phone,
    phone_verified: true,
    name:      phone,
    picture:   '',
    provider:  'phone',
    role:      'consumer'
  };
  const session = signSession(user, secret);
  setSessionCookie(res, session);
  return res.status(200).json({ ok: true, user });
}
