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
    // Filter out hidden media (soft-deleted from CMS). Include the
    // hidden list so the CMS can also render a "hidden" section
    // for admins wanting to unhide.
    const hidden = await readHiddenSet();
    const visible = items.filter(m => !hidden.has(m.url));
    visible.sort((a, b) => a.name.localeCompare(b.name));
    return res.status(200).json({ ok: true, items: visible, hidden: [...hidden] });
  }

  if (req.method === 'DELETE') {
    const gate = await allowWrite(req);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.reason });
    const url = String(req.query?.url || req.headers['x-media-url'] || '');
    if (!url) return res.status(400).json({ error: 'url required' });
    // /media/ files (git-tracked, can't fs-unlink from a serverless
    // function) → soft-hide via the shared manifest's hiddenMedia list.
    // The file stays in the repo; the CMS + hero library both filter
    // it out. Undo by removing the URL from hiddenMedia.
    if (url.startsWith('/media/')) {
      const added = await addToHidden(url);
      return res.status(200).json({ ok: true, hidden: url, mode: 'soft' });
    }
    try {
      const { del } = require('@vercel/blob');
      await del(url);
      // Also strip from any hiddenMedia entry (defensive)
      await removeFromHidden(url);
      return res.status(200).json({ ok: true, deleted: url, mode: 'blob' });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e.message || e).slice(0, 300) });
    }
  }

  if (req.method === 'PATCH') {
    // Unhide a previously soft-hidden /media/ URL. Body: { url: 'string' }.
    const gate = await allowWrite(req);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.reason });
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const url = String(body?.url || '');
    if (!url) return res.status(400).json({ error: 'body.url required' });
    await removeFromHidden(url);
    return res.status(200).json({ ok: true, unhidden: url });
  }

  res.setHeader('Allow', 'GET, DELETE, PATCH');
  return res.status(405).json({ error: 'method not allowed' });
};

// The hidden list lives on the same manifest the CMS writes (Vercel
// Blob 'africa-slides/manifest.json'). We read + write via HTTP against
// the sibling endpoint so the schema stays single-source.
async function readHiddenSet () {
  try {
    const { list } = require('@vercel/blob');
    const { blobs } = await list({ prefix: 'africa-slides/manifest' });
    const f = blobs.find(b => b.pathname === 'africa-slides/manifest.json');
    if (f) {
      const r = await fetch(f.url);
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d.hiddenMedia)) return new Set(d.hiddenMedia);
      }
    }
  } catch {}
  return new Set();
}
async function addToHidden (url) {
  const doc = await loadFullDoc();
  const set = new Set(doc.hiddenMedia || []);
  set.add(url);
  doc.hiddenMedia = [...set];
  await putFullDoc(doc);
}
async function removeFromHidden (url) {
  const doc = await loadFullDoc();
  const set = new Set(doc.hiddenMedia || []);
  if (!set.delete(url)) return;
  doc.hiddenMedia = [...set];
  await putFullDoc(doc);
}
async function loadFullDoc () {
  try {
    const { list } = require('@vercel/blob');
    const { blobs } = await list({ prefix: 'africa-slides/manifest' });
    const f = blobs.find(b => b.pathname === 'africa-slides/manifest.json');
    if (f) {
      const r = await fetch(f.url);
      if (r.ok) return await r.json();
    }
  } catch {}
  return { slides: [], hiddenMedia: [] };
}
async function putFullDoc (doc) {
  try {
    const { put } = require('@vercel/blob');
    await put('africa-slides/manifest.json',
      JSON.stringify({ updated_at: new Date().toISOString(), ...doc }, null, 2),
      { access: 'public', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 0 }
    );
  } catch {}
}

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
