// /api/house/projects — save / list / delete House Lab projects for the
// signed-in user (aa_session cookie). The browser keeps a localStorage copy
// too, so nothing is lost when signed out or offline.
//
//   GET    /api/house/projects            → { projects: [{id,name,updated_at,plan,options,pitch}] }
//   POST   /api/house/projects  {project} → { project }
//   DELETE /api/house/projects?id=...     → { ok }
//
// Storage: Supabase table `house_projects` (db/migrations/2026-09-house-projects.sql)
// when configured, else Vercel Blob under house/<owner-hash>/<id>.json,
// else 501 so the client stays on localStorage.
import crypto from 'node:crypto';
import { readSession } from '../auth/_session.js';
import estimator from '../../lib/house-estimator.js';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

function ownerHash (email) { return crypto.createHash('sha256').update(String(email).toLowerCase()).digest('hex').slice(0, 24); }
function newId () { return 'hp_' + crypto.randomBytes(6).toString('hex'); }

function sanitize (p, email) {
  const plan = estimator.normalizePlan(p.plan);
  return {
    id: /^hp_[a-f0-9]{12}$/.test(String(p.id || '')) ? p.id : newId(),
    owner_email: email,
    name: String(p.name || plan.name || 'Untitled house').slice(0, 120),
    plan,
    options: typeof p.options === 'object' && p.options ? p.options : {},
    pitch: String(p.pitch || '').slice(0, 40000),
    thumbnail: /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]{1,200000}$/.test(String(p.thumbnail || '')) ? p.thumbnail : null,
    updated_at: new Date().toISOString()
  };
}

export default async function handler (req, res) {
  const user = readSession(req);
  if (!user || !user.email) return res.status(401).json({ error: 'sign in to save to the cloud (local saves still work)' });
  const email = user.email;

  let sb = null;
  try { sb = require('../../lib/supabase'); if (!sb.configured()) sb = null; } catch { sb = null; }
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    if (req.method === 'GET') {
      if (sb) {
        const rows = await sb.select('house_projects', { eq: { owner_email: email }, order: '-updated_at', limit: 100 });
        return res.status(200).json({ projects: rows, storage: 'supabase' });
      }
      if (blobToken) {
        const { list } = await import('@vercel/blob');
        const prefix = `house/${ownerHash(email)}/`;
        const { blobs } = await list({ prefix });
        const projects = await Promise.all(blobs.map(async b => { try { return await (await fetch(b.url)).json(); } catch { return null; } }));
        return res.status(200).json({ projects: projects.filter(Boolean).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')), storage: 'blob' });
      }
      return res.status(501).json({ error: 'no cloud storage configured' });
    }

    if (req.method === 'POST') {
      const project = sanitize((req.body && req.body.project) || req.body || {}, email);
      if (sb) {
        const rows = await sb.upsert('house_projects', project, { onConflict: 'id' });
        return res.status(200).json({ project: rows && rows[0] ? rows[0] : project, storage: 'supabase' });
      }
      if (blobToken) {
        const { put } = await import('@vercel/blob');
        await put(`house/${ownerHash(email)}/${project.id}.json`, JSON.stringify(project), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
        return res.status(200).json({ project, storage: 'blob' });
      }
      return res.status(501).json({ error: 'no cloud storage configured' });
    }

    if (req.method === 'DELETE') {
      const id = String((req.query && req.query.id) || '');
      if (!/^hp_[a-f0-9]{12}$/.test(id)) return res.status(400).json({ error: 'bad id' });
      if (sb) { await sb.remove('house_projects', { eq: { id, owner_email: email } }); return res.status(200).json({ ok: true }); }
      if (blobToken) { const { del } = await import('@vercel/blob'); await del(`house/${ownerHash(email)}/${id}.json`).catch(() => {}); return res.status(200).json({ ok: true }); }
      return res.status(501).json({ error: 'no cloud storage configured' });
    }

    res.status(405).json({ error: 'GET, POST or DELETE' });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
