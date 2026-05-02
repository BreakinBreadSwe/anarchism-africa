// Vercel serverless - phone OTP auth (start).
//
// POST /api/auth/phone/start
//   body: { phone }   (E.164 format: "+33612345678")
//   resp: { ok:true, sent:true }
//
// What it does:
//   1. Validates E.164 shape, applies a per-phone throttle (60s).
//   2. Generates a 6-digit OTP, stores { phone, code, expires, attempts:0 }
//      in Blob at auth/phone-tokens/<phone>.json (10-min TTL).
//   3. Sends via Twilio SMS.
//
// Setup (Vercel env):
//   TWILIO_ACCOUNT_SID  - Twilio Console -> Account -> API keys & tokens
//   TWILIO_AUTH_TOKEN   - same
//   TWILIO_FROM_PHONE   - a Twilio phone number in E.164 (+15555550100)
//                         OR a Messaging Service SID starting with "MG..."
//   AUTH_SECRET         - same secret as google.js / email auth

import { put } from '@vercel/blob';
import { randomDigits } from '../_session.js';

const PUBLIC_BLOB_BASE = 'https://blob.vercel-storage.com';
const TTL_MS    = 10 * 60 * 1000;
const THROTTLE  = 60 * 1000;

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
  if (!phone) return res.status(400).json({ error: 'phone must be in E.164 format, e.g. +33612345678' });

  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_FROM_PHONE;
  if (!sid || !token) return res.status(500).json({ error: 'TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN must be set in Vercel env' });
  if (!from)          return res.status(500).json({ error: 'TWILIO_FROM_PHONE must be set (E.164 number or MG... messaging service SID)' });

  // Throttle
  const tKey = 'auth/phone-throttle/' + phoneKey(phone) + '.json';
  const last = await readBlob(tKey);
  if (last?.ts && Date.now() - last.ts < THROTTLE) {
    return res.status(429).json({ error: 'wait 60 seconds before requesting another code' });
  }

  // Generate OTP
  const code = randomDigits(6);
  await writeBlob('auth/phone-tokens/' + phoneKey(phone) + '.json', {
    phone, code, expires: Date.now() + TTL_MS, attempts: 0
  });
  await writeBlob(tKey, { ts: Date.now() });

  // Send via Twilio
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const params = new URLSearchParams();
  params.set('To', phone);
  if (from.startsWith('MG')) params.set('MessagingServiceSid', from);
  else                       params.set('From', from);
  params.set('Body', `ANARCHISM.AFRICA verification code: ${code}\n\nGood for 10 minutes. If you didn't request this, ignore.`);

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type':  'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(502).json({ error: 'Twilio send failed: ' + (data.message || r.status) });

  return res.status(200).json({ ok: true, sent: true });
}
