// POST /api/archive/upload
//
// Two modes:
//   1. File upload  { title, b64, name, mimeType, size?, description?, tags? }
//      → stores binary in Vercel Blob at content/archive/{id}/{name}
//   2. URL reference { title, url, mimeType, size?, description?, tags? }
//      → no binary storage; metadata only
//
// Both modes append an entry to archive/manifest.json.
//
// Auth: x-aa-admin-token header must match AA_ADMIN_TOKEN env var.
// Max base64 payload ≈ 4.5 MB → 3.3 MB raw (fine for images, PDFs, short
// clips). For large video files use mode 2: upload to Blob via the Vercel
// dashboard or CLI and pass the public URL here.

import { put, list } from '@vercel/blob';
import { randomUUID } from 'node:crypto';

const MANIFEST = 'archive/manifest.json';
const ADMIN_TOKEN = process.env.AA_ADMIN_TOKEN || '';

function isAuthorized (req) {
  if (!ADMIN_TOKEN) return false;
  return req.headers['x-aa-admin-token'] === ADMIN_TOKEN;
}

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body || {};
  const { title, description = '', tags = [],
          mimeType = 'application/octet-stream', uploadedBy = 'admin' } = body;
  if (!title) return res.status(400).json({ error: 'title required' });

  const id  = randomUUID();
  let   url = body.url || null;

  // Mode 1 — binary upload via base64
  if (body.b64 && !url) {
    const safeName = (body.name || `file-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const blobKey  = `content/archive/${id}/${safeName}`;
    const buf      = Buffer.from(body.b64, 'base64');
    const r = await put(blobKey, buf, {
      access:          'public',
      addRandomSuffix: false,
      allowOverwrite:  false,
      contentType:     mimeType
    });
    url = r.url;
  }

  if (!url) return res.status(400).json({ error: 'b64 or url required' });

  const entry = {
    id,
    title,
    url,
    mimeType,
    size:        body.size   || null,
    description: description || '',
    tags:        Array.isArray(tags) ? tags : [],
    uploadedAt:  new Date().toISOString(),
    uploadedBy
  };

  // Append to manifest
  const manifest = await readManifest();
  manifest.items.unshift(entry);
  manifest.items   = manifest.items.slice(0, 2000);
  manifest.updated = Date.now();
  await writeManifest(manifest);

  res.status(200).json({ ok: true, entry });
}

async function readManifest () {
  try {
    const { blobs } = await list({ prefix: 'archive/manifest' });
    const f = blobs.find(b => b.pathname === MANIFEST);
    if (f) {
      const r = await fetch(f.url, { cache: 'no-store' });
      if (r.ok) return await r.json();
    }
  } catch {}
  return { items: [], updated: null };
}

async function writeManifest (data) {
  await put(MANIFEST, JSON.stringify(data), {
    access:          'public',
    addRandomSuffix: false,
    allowOverwrite:  true,
    contentType:     'application/json'
  });
}
