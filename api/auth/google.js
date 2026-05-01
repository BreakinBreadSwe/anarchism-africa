// Vercel serverless — Google OAuth (GSI verify-token flow)
//
// The browser uses Google Sign-In ("GIS") to obtain an ID token client-side
// (no client secret needed). It then POSTs that token to this endpoint, which:
//   1. Verifies the token with Google's tokeninfo endpoint.
//   2. Verifies the audience matches GOOGLE_CLIENT_ID.
//   3. Returns a normalized profile { sub, email, name, picture, locale } and
//      a signed session cookie (HMAC over the profile + 30-day expiry).
//
// Setup:
//   1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID
//      (type: Web application). Authorized JavaScript origin: your site URL.
//      No redirect URI needed for GIS button.
//   2. Vercel env vars:
//      GOOGLE_CLIENT_ID  — the OAuth web-client ID (the public one is fine)
//      AUTH_SECRET       — any 32+ random chars (used to sign the session cookie)
//   3. Drop the client ID into js/auth.js (or set window.AA_GOOGLE_CLIENT_ID).
//
// POST /api/auth/google
//   body: { credential: <google-id-token> }
//   resp: { ok:true, user:{...}, session: '<cookie value>' }
//   side-effect: sets `aa_session` cookie

import crypto from 'node:crypto';

const COOKIE = 'aa_session';
const TTL_DAYS = 30;

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'credential required' });

  const expectedAud = process.env.GOOGLE_CLIENT_ID;
  if (!expectedAud) return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not set in Vercel env' });
  const secret = process.env.AUTH_SECRET;
  if (!secret) return res.status(500).json({ error: 'AUTH_SECRET not set in Vercel env (any 32+ random chars)' });

  try {
    // Verify the ID token via Google's tokeninfo (simple + no extra deps).
    const v = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    const data = await v.json();
    if (!v.ok || data.error) {
      return res.status(401).json({ error: 'Google verify failed: ' + (data.error || v.status) });
    }
    if (data.aud !== expectedAud) {
      return res.status(401).json({ error: 'audience mismatch' });
    }
    if (parseInt(data.exp, 10) * 1000 < Date.now()) {
      return res.status(401).json({ error: 'token expired' });
    }

    const user = {
      sub:     data.sub,
      email:   data.email,
      email_verified: data.email_verified === 'true' || data.email_verified === true,
      name:    data.name || '',
      picture: data.picture || '',
      locale:  data.locale || '',
      provider: 'google',
      role:    'consumer'
    };
    const session = signSession(user, secret);
    const exp = new Date(Date.now() + TTL_DAYS * 24 * 3600 * 1000).toUTCString();
    res.setHeader('Set-Cookie',
      `${COOKIE}=${encodeURIComponent(session)}; Path=/; Expires=${exp}; HttpOnly; Secure; SameSite=Lax`);
    return res.status(200).json({ ok: true, user });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}

function signSession (user, secret) {
  const payload = Buffer.from(JSON.stringify({ ...user, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
