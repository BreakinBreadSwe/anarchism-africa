// POST /api/auth/passcode
// Sign in with email + role passcode.
//
// Body: { email, code }
// If the code matches a stored role passcode, issues a session cookie for that role.
// The email will be looked up in the users manifest — if found, name/avatar are
// taken from there; otherwise the email prefix is used as display name.
//
// Setup: set role passcodes via POST /api/auth/passcodes-admin

import { list, put } from '@vercel/blob';
import crypto from 'node:crypto';
import { signSession, setSessionCookie } from './_session.js';

const PASSCODES_KEY = 'auth/role-passcodes.json';

function hashCode (code) {
  const secret = process.env.AUTH_SECRET || 'aa-dev-secret';
  return crypto.createHmac('sha256', secret).update(String(code).trim()).digest('hex');
}

async function readBlob (key) {
  try {
    const { blobs } = await list({ prefix: key.replace(/\.json$/, '') });
    const f = blobs.find(b => b.pathname === key);
    if (f) { const r = await fetch(f.url, { cache: 'no-store' }); if (r.ok) return await r.json(); }
  } catch {}
  return null;
}

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body  = req.body || {};
  const email = String(body.email || '').toLowerCase().trim();
  const code  = String(body.code  || '').trim();

  if (!email || !code) return res.status(400).json({ error: 'email and code required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'invalid email' });

  const secret = process.env.AUTH_SECRET;
  if (!secret) return res.status(500).json({ error: 'AUTH_SECRET not set' });

  // Load stored passcodes
  const passcodes = await readBlob(PASSCODES_KEY) || {};
  const hash = hashCode(code);

  // Find role whose stored hash matches
  const matchedRole = Object.entries(passcodes).find(([, h]) => h === hash)?.[0];
  if (!matchedRole) return res.status(401).json({ error: 'invalid passcode' });

  // Look up user profile in manifest for name / avatar
  const usersManifest = await readBlob('users/manifest.json') || { users: [] };
  const existing = (usersManifest.users || []).find(u => u.email === email);

  const user = {
    sub:            'email:' + email,
    email,
    email_verified: true,
    name:           existing?.name || email.split('@')[0],
    picture:        existing?.avatar || '',
    role:           matchedRole,
    provider:       'passcode'
  };

  const session = signSession(user, secret);
  setSessionCookie(res, session);
  res.status(200).json({ ok: true, user });
}
