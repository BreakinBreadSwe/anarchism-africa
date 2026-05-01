// Vercel serverless — Site visitor defaults (admin-managed)
//
// LUVLAB and COOLHUNTPARIS use this to set what NEW visitors see by default
// for: app logo, header bg modes, menu pop-up bg. Every user can override
// these on their own device via localStorage; this endpoint only writes the
// global defaults.
//
// GET  /api/site/visitor-defaults
//   resp: { logo_url, header_modes, header_default_mode, menu_bg_url,
//           patterns_enabled, gif_enabled, gif_api_key_present, updated }
//
// POST /api/site/visitor-defaults
//   header: x-cron-secret OR x-aa-admin-token (must match ADMIN_TOKEN env)
//   body:   { ...same shape (partial allowed) }
//
// Storage: Vercel Blob at content/site/visitor-defaults.json

import { put } from '@vercel/blob';
const KEY = 'content/site/visitor-defaults.json';
const PUBLIC = 'https://blob.vercel-storage.com';

const DEFAULTS = {
  logo_url: '/icons/AAlogo1.svg',
  header_modes: ['title', 'quote', 'pattern', 'gif', 'ad'],
  header_default_mode: 'title',
  menu_bg_url: '',
  patterns_enabled: ['kente','adinkra','kuba','ndebele','sona'],
  gif_enabled: true,
  updated: 0
};

async function read () {
  try {
    const r = await fetch(`${PUBLIC}/${KEY}?ts=${Date.now()}`);
    if (!r.ok) return { ...DEFAULTS };
    const d = await r.json();
    return { ...DEFAULTS, ...d };
  } catch { return { ...DEFAULTS }; }
}
async function write (val) {
  return put(KEY, JSON.stringify(val), { access:'public', addRandomSuffix:false, allowOverwrite:true, contentType:'application/json' });
}

export default async function handler (req, res) {
  if (req.method === 'GET') {
    const cur = await read();
    return res.status(200).json({ ...cur, gif_api_key_present: !!process.env.GIPHY_API_KEY });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });

  // Admin auth: ADMIN_TOKEN env (rotate via Vercel) — set the token in the admin
  // user-settings panel and stored in localStorage; server compares.
  const need = process.env.ADMIN_TOKEN;
  if (need && req.headers['x-aa-admin-token'] !== need) {
    return res.status(401).json({ error: 'admin token required' });
  }

  const body = req.body || {};
  const cur = await read();
  const patch = {};
  // whitelist: only known keys are settable; arrays sanitized
  if (typeof body.logo_url === 'string')         patch.logo_url = body.logo_url.slice(0, 2000);
  if (Array.isArray(body.header_modes))          patch.header_modes = body.header_modes.filter(m => DEFAULTS.header_modes.includes(m));
  if (typeof body.header_default_mode === 'string' && DEFAULTS.header_modes.includes(body.header_default_mode))
                                                  patch.header_default_mode = body.header_default_mode;
  if (typeof body.menu_bg_url === 'string')      patch.menu_bg_url = body.menu_bg_url.slice(0, 2000);
  if (Array.isArray(body.patterns_enabled))      patch.patterns_enabled = body.patterns_enabled.filter(p => DEFAULTS.patterns_enabled.includes(p));
  if (typeof body.gif_enabled === 'boolean')     patch.gif_enabled = body.gif_enabled;

  const next = { ...cur, ...patch, updated: Date.now() };
  await write(next);
  return res.status(200).json(next);
}
