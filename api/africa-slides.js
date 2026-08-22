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
    return res.status(200).json({
      ok:         true,
      slides:     doc.slides,
      background:  doc.background  || null,
      css:         doc.css         || null,
      appLogo:     doc.appLogo     || null,
      hiddenMedia: doc.hiddenMedia || []
    });
  }

  if (req.method === 'POST') {
    const gate = await allowWrite(req);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.reason });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const slides = Array.isArray(body?.slides) ? body.slides : null;
    if (!slides) return res.status(400).json({ error: 'body.slides must be an array' });

    // Sanitise each slide — accept only known fields.
    const clamp = (v, min, max, def) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
    };
    const clean = slides.map(s => ({
      type:      String(s.type || 'text').toLowerCase(),
      text:      s.text ? String(s.text).slice(0, 500) : undefined,
      src:       s.src  ? String(s.src).slice(0, 2000) : undefined,
      alt:       s.alt  ? String(s.alt).slice(0, 200)  : undefined,
      className: s.className ? String(s.className).slice(0, 80) : undefined,
      duration:  Math.max(500, Math.min(60000, Number(s.duration) || 3500)),
      // Per-slide focal point + zoom for centering within africa.
      // focalX/Y in percent (0=left/top, 100=right/bottom, 50=center).
      // zoom = 100..400 (100% = object-fit:cover natural).
      focalX:    s.focalX !== undefined ? clamp(s.focalX, 0, 100, 50)   : undefined,
      focalY:    s.focalY !== undefined ? clamp(s.focalY, 0, 100, 50)   : undefined,
      zoom:      s.zoom   !== undefined ? clamp(s.zoom, 100, 400, 100)  : undefined
    }));

    // Optional background config for the OUTSIDE-africa layer.
    let background = null;
    if (body?.background && body.background.value) {
      background = {
        type:  String(body.background.type  || 'color').toLowerCase(),
        value: String(body.background.value || '').slice(0, 2000)
      };
    }

    // Optional CSS knobs + app-logo config, persisted on the same doc.
    let css = null;
    if (body?.css && typeof body.css === 'object') {
      css = {
        heroSize:      clampNum(body.css.heroSize,      40, 100, 88),
        outlineWidth:  clampNum(body.css.outlineWidth,   1,  80, 35),
        crossfadeMs:   clampNum(body.css.crossfadeMs, 200, 10000, 4000),
        advanceMs:     clampNum(body.css.advanceMs,   500,  30000, 2000),
        // Big-A slide gets injected every N slides (1..50; 6 = default).
        aFrequency:    clampNum(body.css.aFrequency,    1,    50,    6)
      };
    }
    let appLogo = null;
    if (body?.appLogo && typeof body.appLogo === 'object') {
      appLogo = {
        showOutline:  body.appLogo.showOutline !== false,
        rotateMs:     clampNum(body.appLogo.rotateMs, 1000, 60000, 4500),
        // Independent slide list for the header app-logo mini-hero.
        // Same slide schema as the hero — { type, src|text, duration }
        // — but stored separately so admin can curate the tiny 40x40
        // rotation without touching the fullscreen hero.
        slides:       Array.isArray(body.appLogo.slides)
          ? body.appLogo.slides.map(s => ({
              type:     String(s.type || 'image').toLowerCase(),
              src:      s.src ? String(s.src).slice(0, 2000) : undefined,
              text:     s.text ? String(s.text).slice(0, 200) : undefined,
              duration: clampNum(s.duration, 500, 60000, 4500)
            })).slice(0, 200)
          : undefined
      };
    }

    // Hidden-media URLs — /media/ files can't be filesystem-deleted from
    // the CMS (git-tracked), so we mask them via this list instead. Blob
    // deletes go through the real DELETE endpoint.
    const hiddenMedia = Array.isArray(body?.hiddenMedia)
      ? body.hiddenMedia.map(s => String(s).slice(0, 2000)).slice(0, 500)
      : undefined;

    const wrote = await writeDoc({ slides: clean, background, css, appLogo, hiddenMedia });
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
        if (Array.isArray(d.slides)) return {
          slides:       d.slides,
          background:   d.background   || null,
          css:          d.css          || null,
          appLogo:      d.appLogo      || null,
          hiddenMedia:  Array.isArray(d.hiddenMedia) ? d.hiddenMedia : []
        };
      }
    }
  } catch {}
  try {
    const fs = require('fs');
    const path = require('path');
    const seed = path.join(process.cwd(), 'data', 'africa-slides.json');
    if (fs.existsSync(seed)) {
      const d = JSON.parse(fs.readFileSync(seed, 'utf8'));
      if (Array.isArray(d.slides)) return { slides: d.slides, background: d.background || null, css: null, appLogo: null, hiddenMedia: [] };
    }
  } catch {}
  return { slides: [], background: null, css: null, appLogo: null, hiddenMedia: [] };
}
function clampNum (v, min, max, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
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
