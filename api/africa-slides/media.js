// GET    /api/africa-slides/media       — list all managed media
//    Returns { ok, items: [{ url, name, source: 'blob'|'repo', size, type }] }.
//    Merges Vercel Blob uploads (africa-hero/uploads/*) with the /media/
//    folder shipped in the repo so admin sees everything in one place.
//
// DELETE /api/africa-slides/media?url=… — remove one blob upload.
//    /media/ files are read-only (repo-tracked); trying to delete one
//    returns 400 with a note.
//
// Auth: same admin/publisher gate as sibling endpoints.

const fs   = require('fs');
const path = require('path');
const { readSession } = require('../auth/_session.js');

module.exports = async function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const items = [];
    // 1. Blob uploads
    try {
      const { list } = require('@vercel/blob');
      const { blobs } = await list({ prefix: 'africa-hero/uploads/' });
      for (const b of (blobs || [])) {
        items.push({
          url:    b.url,
          name:   b.pathname.split('/').pop(),
          source: 'blob',
          size:   b.size || 0,
          type:   guessType(b.pathname)
        });
      }
    } catch {}
    // 2. Repo /media/ files
    try {
      const dir = path.join(process.cwd(), 'media');
      if (fs.existsSync(dir)) {
        for (const name of fs.readdirSync(dir)) {
          if (name.startsWith('.')) continue;
          if (!/\.(jpe?g|png|webp|avif|gif|mp4|webm|mov|m4v)$/i.test(name)) continue;
          const stat = fs.statSync(path.join(dir, name));
          items.push({
            url:    '/media/' + name,
            name,
            source: 'repo',
            size:   stat.size,
            type:   guessType(name)
          });
        }
      }
    } catch {}
    items.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json({ ok: true, items });
  }

  if (req.method === 'DELETE') {
    const gate = await allowWrite(req);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.reason });
    const url = String(req.query?.url || req.headers['x-media-url'] || '');
    if (!url) return res.status(400).json({ error: 'url required' });
    if (url.startsWith('/media/')) {
      return res.status(400).json({ error: '/media/ files are git-tracked; delete via a commit that removes the file' });
    }
    try {
      const { del } = require('@vercel/blob');
      await del(url);
      return res.status(200).json({ ok: true, deleted: url });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e.message || e).slice(0, 300) });
    }
  }

  res.setHeader('Allow', 'GET, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
};

function guessType (name) {
  if (/\.(mp4|webm|mov|m4v)$/i.test(name)) return 'video';
  if (/\.gif$/i.test(name)) return 'gif';
  return 'image';
}

async function allowWrite (req) {
  const adminTok = process.env.AA_ADMIN_TOKEN;
  const cronSec  = process.env.CRON_SECRET;
  if (!adminTok && !cronSec) return { ok: true };
  const hdrTok = req.headers['x-admin-token'] || req.headers['x-aa-admin-token'];
  if (adminTok && hdrTok === adminTok) return { ok: true };
  try {
    const sess = readSession(req);
    if (sess && (sess.role === 'admin' || sess.role === 'publisher')) return { ok: true };
  } catch {}
  return { ok: false, status: 401, reason: 'admin or publisher required' };
}
