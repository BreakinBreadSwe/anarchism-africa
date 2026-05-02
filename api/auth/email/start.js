// Vercel serverless - email magic-link auth (start).
//
// POST /api/auth/email/start
//   body: { email }
//   resp: { ok:true, sent:true } - generic so we don't leak which emails exist
//
// What it does:
//   1. Validates email shape, applies a per-email throttle (60s) by writing
//      to Vercel Blob.
//   2. Generates a single-use token (32 bytes base64url, 15-min TTL).
//   3. Stores { email, expires } in Blob at auth/email-tokens/<token>.json.
//   4. Sends a magic link to {SITE_URL}/api/auth/email/verify?token=<token>
//      via Resend (https://resend.com).
//
// Setup (Vercel env):
//   RESEND_API_KEY     - https://resend.com/api-keys
//   RESEND_FROM_EMAIL  - e.g. "ANARCHISM.AFRICA <auth@anarchism.africa>"
//                        (domain must be verified in Resend)
//   AUTH_SECRET        - same secret used by google.js for cookie signing
//   SITE_URL           - public site URL for the magic link (optional;
//                        falls back to request host)

import { put } from '@vercel/blob';
import { randomToken } from '../_session.js';

const PUBLIC_BLOB_BASE = 'https://blob.vercel-storage.com';
const TTL_MS    = 15 * 60 * 1000;
const THROTTLE  = 60 * 1000;

async function readBlob (key) {
  try { const r = await fetch(`${PUBLIC_BLOB_BASE}/${key}?ts=${Date.now()}`); if (!r.ok) return null; return await r.json(); }
  catch { return null; }
}
async function writeBlob (key, value) {
  return put(key, JSON.stringify(value), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
}

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid email' });

  if (!process.env.RESEND_API_KEY)    return res.status(500).json({ error: 'RESEND_API_KEY not set in Vercel env' });
  if (!process.env.RESEND_FROM_EMAIL) return res.status(500).json({ error: 'RESEND_FROM_EMAIL not set in Vercel env (use a Resend-verified domain)' });

  // Throttle
  const throttleKey = 'auth/email-throttle/' + Buffer.from(email).toString('hex') + '.json';
  const last = await readBlob(throttleKey);
  if (last?.ts && Date.now() - last.ts < THROTTLE) {
    return res.status(429).json({ error: 'wait 60 seconds before requesting another link' });
  }

  // Generate token + store
  const token = randomToken(24);
  await writeBlob('auth/email-tokens/' + token + '.json', {
    email,
    expires: Date.now() + TTL_MS,
    used: false
  });
  await writeBlob(throttleKey, { ts: Date.now() });

  // Build magic link
  const origin = process.env.SITE_URL || `https://${req.headers.host || 'anarchism.africa'}`;
  const link = `${origin}/api/auth/email/verify?token=${encodeURIComponent(token)}`;

  // Send via Resend
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({
      from:    process.env.RESEND_FROM_EMAIL,
      to:      [email],
      subject: 'Sign in to ANARCHISM.AFRICA',
      html: `
<!doctype html><html><body style="background:#0a0a0a;color:#f5f0e8;font-family:'Helvetica Neue',Arial,sans-serif;padding:32px;margin:0">
  <div style="max-width:520px;margin:0 auto;background:#111;border:1px solid #222;border-radius:0;padding:32px">
    <h1 style="font-family:'Bebas Neue','Helvetica Neue',Arial,sans-serif;letter-spacing:.04em;font-size:1.6rem;margin:0 0 18px;color:#f5f0e8">ANARCHISM.AFRICA</h1>
    <p style="font-size:1rem;line-height:1.6;color:#cfc8bf;margin:0 0 22px">
      Click to sign in. Link is good for 15 minutes; one use only.
    </p>
    <p style="margin:0 0 26px"><a href="${link}" style="display:inline-block;background:#f5f0e8;color:#0a0a0a;padding:14px 22px;text-decoration:none;font-weight:700;letter-spacing:.06em;border-radius:0">Sign in</a></p>
    <p style="font-size:.78rem;color:#7a7370;line-height:1.6;margin:0 0 6px">If the button doesn't work, paste this into your browser:</p>
    <p style="font-family:'JetBrains Mono',monospace;font-size:.72rem;color:#9c948e;word-break:break-all;margin:0 0 22px">${link}</p>
    <p style="font-size:.72rem;color:#7a7370;line-height:1.6;margin:0">If you didn't request this, ignore the email - nothing happens until the link is clicked. We don't sell data, run ads, or pretend.</p>
  </div>
</body></html>`,
      text: `Sign in to ANARCHISM.AFRICA\n\nClick to sign in (good for 15 min, one use):\n${link}\n\nIf you didn't request this, ignore the email.`
    })
  });
  const sendResp = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(502).json({ error: 'send failed: ' + (sendResp.message || r.status) });

  return res.status(200).json({ ok: true, sent: true });
}
