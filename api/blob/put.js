// POST /api/blob/put  { key, value }
// Writes a JSON object to Vercel Blob. Requires the BLOB_READ_WRITE_TOKEN
// environment variable (Vercel sets this automatically when you enable
// Blob storage on the project).
//
// In production you'd add auth here so consumers can't overwrite curator data.
// For the MVP, role-aware mutations live in the publisher/admin Studio (admin.html);
// consumer-facing writes (mailing list, applications, pledges) are append-only
// to dedicated keys (mailing_list.json, amb_applications.json, pledges.json).
import { put } from '@vercel/blob';

const ALLOW_KEYS = new Set([
  'seed.json',
  'mailing_list.json',
  'amb_applications.json',
  'pledges.json',
  'community_posts.json',
  'campaigns.json',
  'grants.json',
  'theme.json'
]);

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { key, value } = req.body || {};
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });
  if (!ALLOW_KEYS.has(key) && !key.startsWith('content/')) {
    return res.status(403).json({ error: 'key not allowed: ' + key });
  }

  try {
    const body = typeof value === 'string' ? value : JSON.stringify(value);
    const r = await put(key, body, {
      access: 'public',
      addRandomSuffix: false,    // keep the same path for replace
      allowOverwrite: true,
      contentType: 'application/json'
    });
    res.status(200).json({ ok: true, url: r.url, pathname: r.pathname });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
