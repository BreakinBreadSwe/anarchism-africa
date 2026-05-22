// POST /api/blob/seed  — idempotent seed of Vercel Blob with the bundled
// content. Run once after the first deploy: curl -X POST https://your.vercel.app/api/blob/seed
// Or hit it in a browser. It's safe to re-run; it overwrites the JSON keys.
import { put, list } from '@vercel/blob';
import fs from 'node:fs';
import path from 'node:path';

export default async function handler (req, res) {
  if (req.method !== 'POST' && req.query.confirm !== 'yes') {
    return res.status(200).json({
      hint: 'Send POST or add ?confirm=yes to seed Blob from data/seed.json',
      bundled: true
    });
  }
  try {
    const seedPath = path.join(process.cwd(), 'data', 'seed.json');
    const seed = fs.readFileSync(seedPath, 'utf8');
    const out = [];
    out.push(await put('seed.json', seed, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' }));
    // also create empty keys for the mutable lists, so put.js doesn't 404 on first append
    for (const k of ['mailing_list.json','amb_applications.json','pledges.json','community_posts.json']) {
      const existing = await list({ prefix: k });
      if (!existing.blobs.find(b => b.pathname === k)) {
        out.push(await put(k, '[]', { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' }));
      }
    }
    res.status(200).json({ ok: true, seeded: out.map(b => b.pathname) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
