// POST /api/admin/purge-offtopic  { dryRun?: true, limit?: 500 }
//
// One-shot cleanup: scans the content + content_queue tables, runs
// lib/relevance on every row, and DELETEs the ones that don't relate to
// Africa / Pan-Africa / diaspora / afro-anarchism / Africa-facing
// militants + artists. This is the counterpart to the pre-enqueue filter
// added in api/content/queue.js — the filter stops future off-topic
// items; this endpoint removes ones that already slipped in.
//
// dryRun:true just returns the list of items that WOULD be deleted,
// without actually deleting them — for the admin to eyeball first.

const sb = require('../../lib/supabase');
const { relevance } = require('../../lib/relevance');
const { readSession } = require('../auth/_session.js');

module.exports = async function handler (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method not allowed' }); }
  const gate = await allowWrite(req);
  if (!gate.ok) return res.status(gate.status).json({ error: gate.reason });
  if (!sb.configured()) return res.status(500).json({ error: 'supabase not configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const dryRun = body?.dryRun !== false;   // default TRUE — safe by default
  const limit  = Math.min(2000, Math.max(1, Number(body?.limit) || 1000));

  const summary = { scanned: 0, offtopic: 0, deleted: 0, kept: 0, dryRun, samples: { deleted: [], kept: [] } };

  for (const table of ['content', 'content_queue']) {
    let rows = [];
    try {
      rows = await sb.select(table, { limit, order: '-scraped_at' });
    } catch (e) {
      summary[table + '_error'] = String(e.message || e).slice(0, 200);
      continue;
    }
    for (const row of rows) {
      summary.scanned++;
      const rel = relevance(row);
      if (rel.isRelevant) {
        summary.kept++;
        if (summary.samples.kept.length < 5) summary.samples.kept.push({ id: row.id, title: (row.title || '').slice(0, 90), reason: rel.reason });
        continue;
      }
      summary.offtopic++;
      if (summary.samples.deleted.length < 30) {
        summary.samples.deleted.push({ id: row.id, table, title: (row.title || '').slice(0, 90), source: row.source_name || row.source, reason: rel.reason });
      }
      if (!dryRun) {
        try {
          await sb.remove(table, row.id);
          summary.deleted++;
        } catch (e) {
          summary[`${table}_delete_error_${row.id}`] = String(e.message || e).slice(0, 120);
        }
      }
    }
  }

  return res.status(200).json({ ok: true, summary });
};

async function allowWrite (req) {
  const adminTok = (process.env.ADMIN_TOKEN || process.env.AA_ADMIN_TOKEN);
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
