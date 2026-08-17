// GET  /api/africa-slides            — public list of slides (read-only)
// POST /api/africa-slides            — replace the whole slide list (admin+publisher)
//   body: { slides: [{ type, text|src, duration, className?, alt? }, ...] }
//
// Storage: Vercel Blob at 'africa-slides/manifest.json'. Falls back to the
// repo-committed data/africa-slides.json seed when the Blob is empty.

const { readSession } = require('./auth/_session.js');

const BLOB_KEY = 'africa-slides/manifest.json';

module.exports = async function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const doc = await readDoc();
    return res.status(200).json({ ok: true, slides: doc.slides, background: doc.background || null });
  }

  if (req.method === 'POST') {
    const gate = await allowWrite(req);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.reason });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const slides = Array.isArray(body?.slides) ? body.slides : null;
    if (!slides) return res.status(400).json({ error: 'body.slides must be an array' });

    // Sanitise each slide — accept only known fields.
    const clean = slides.map(s => ({
      type:      String(s.type || 'text').toLowerCase(),
      text:      s.text ? String(s.text).slice(0, 500) : undefined,
      src:       s.src  ? String(s.src).slice(0, 2000) : undefined,
      alt:       s.alt  ? String(s.alt).slice(0, 200)  : undefined,
      className: s.className ? String(s.className).slice(0, 80) : undefined,
      duration:  Math.max(500, Math.min(60000, Number(s.duration) || 3500))
    }));

    // Optional background config for the OUTSIDE-africa layer.
    let background = null;
    if (body?.background && body.background.value) {
      background = {
        type:  String(body.background.type  || 'color').toLowerCase(),
        value: String(body.background.value || '').slice(0, 2000)
      };
    }

    const wrote = await writeDoc({ slides: clean, background });
    if (!wrote.ok) return res.status(500).json({ error: wrote.error });
    return res.status(200).json({ ok: true, count: clean.length });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
};

/* ------- storage ------- */

async function readDoc () {
  try {
    const { list } = require('@vercel/blob');
    const { blobs } = await list({ prefix: 'africa-slides/manifest' });
    const f = blobs.find(b => b.pathname === BLOB_KEY);
    if (f) {
      const r = await fetch(f.url);
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d.slides) && d.slides.length) return { slides: d.slides, background: d.background || null };
      }
    }
  } catch {}
  try {
    const fs = require('fs');
    const path = require('path');
    const seed = path.join(process.cwd(), 'data', 'africa-slides.json');
    if (fs.existsSync(seed)) {
      const d = JSON.parse(fs.readFileSync(seed, 'utf8'));
      if (Array.isArray(d.slides)) return { slides: d.slides, background: d.background || null };
    }
  } catch {}
  return { slides: [], background: null };
}

async function writeDoc (doc) {
  try {
    const { put } = require('@vercel/blob');
    const body = JSON.stringify({ updated_at: new Date().toISOString(), ...doc }, null, 2);
    await put(BLOB_KEY, body, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: 0
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/* ------- auth gate ------- */
async function allowWrite (req) {
  const adminTok = process.env.AA_ADMIN_TOKEN;
  const cronSec  = process.env.CRON_SECRET;
  // Setup mode: no admin token set yet → allow (rescue path used by other
  // endpoints in this codebase — same convention).
  if (!adminTok && !cronSec) return { ok: true };

  // Admin token header wins.
  const hdrTok = req.headers['x-admin-token'] || req.headers['x-aa-admin-token'];
  if (adminTok && hdrTok === adminTok) return { ok: true };

  // Otherwise, session cookie must belong to an admin or publisher user.
  try {
    const sess = readSession(req);
    if (sess && (sess.role === 'admin' || sess.role === 'publisher')) return { ok: true };
  } catch {}

  return { ok: false, status: 401, reason: 'admin or publisher required' };
}
