// GET  /api/auth/passcodes-admin  — admin only, returns which roles have a passcode set
//                                    (booleans only — never returns actual hashes)
// POST /api/auth/passcodes-admin  — admin only, { role, code }
//                                    Set a new passcode for the role.
//                                    POST { role, code: "" } to clear it.
//
// Passcodes are stored as HMAC-SHA256 hashes keyed by AUTH_SECRET so the Blob
// contents are never reversible even if the URL were to leak.

import { list, put } from '@vercel/blob';
import crypto from 'node:crypto';
import { readSession } from './_session.js';

const PASSCODES_KEY = 'auth/role-passcodes.json';
const ADMIN_TOKEN   = process.env.AA_ADMIN_TOKEN || '';
const VALID_ROLES   = ['admin', 'publisher', 'merch', 'partner', 'ambassador', 'consumer'];

function isAdmin (req) {
  if (ADMIN_TOKEN && req.headers['x-aa-admin-token'] === ADMIN_TOKEN) return true;
  const user = readSession(req);
  return user?.role === 'admin';
}
function hashCode (code) {
  const secret = process.env.AUTH_SECRET || 'aa-dev-secret';
  return crypto.createHmac('sha256', secret).update(String(code).trim()).digest('hex');
}

async function readPasscodes () {
  try {
    const { blobs } = await list({ prefix: 'auth/role-passcodes' });
    const f = blobs.find(b => b.pathname === PASSCODES_KEY);
    if (f) { const r = await fetch(f.url, { cache: 'no-store' }); if (r.ok) return await r.json(); }
  } catch {}
  return {};
}
async function writePasscodes (data) {
  await put(PASSCODES_KEY, JSON.stringify(data), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json'
  });
}

export default async function handler (req, res) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const codes = await readPasscodes();
    const roles = {};
    VALID_ROLES.forEach(r => { roles[r] = !!codes[r]; });
    return res.status(200).json({ roles });
  }

  if (req.method === 'POST') {
    const { role, code } = req.body || {};
    if (!role || !VALID_ROLES.includes(role))
      return res.status(400).json({ error: 'invalid role' });

    const codes = await readPasscodes();
    if (!code || !String(code).trim()) {
      delete codes[role]; // remove passcode
    } else {
      codes[role] = hashCode(code);
    }
    await writePasscodes(codes);
    return res.status(200).json({ ok: true, cleared: !code || !String(code).trim() });
  }

  return res.status(405).json({ error: 'GET or POST only' });
}
