/* /api/content/queue — Supabase-backed queue for scraped + submitted items.
 *
 * GET  /api/content/queue                 → list pending items (newest first, max 200)
 * GET  /api/content/queue?status=approved → filter by status
 * GET  /api/content/queue?kind=article    → filter by kind
 *
 * POST /api/content/queue
 *   body: { action, item?, id?, patch? }
 *   actions:
 *     'enqueue' → insert new item into content_queue (used by scraper)
 *     'approve' → mark queue item approved + COPY into content table as published
 *     'reject'  → mark queue item rejected (kept for audit)
 *     'edit'    → patch fields of a pending item
 *
 * Auth: ADMIN_TOKEN header, aa_role cookie, or CRON_SECRET (for scraper).
 */
const sb = require('../../lib/supabase');

function authed (req, allowCron = false) {
  const adminTok = process.env.ADMIN_TOKEN;
  const cronSec  = process.env.CRON_SECRET;
  if (adminTok) {
    const tok = req.headers['x-admin-token'] || req.headers['authorization'];
    if (tok === adminTok || tok === 'Bearer ' + adminTok) return true;
  }
  if (allowCron && cronSec && (req.headers['x-cron-secret'] === cronSec || req.headers['x-vercel-cron-signature'])) return true;
  const cookie = req.headers.cookie || '';
  if (/aa_role=(admin|publisher|editor)/.test(cookie)) return true;
  if (!adminTok) return true;
  return false;
}

module.exports = async function handler (req, res) {
  if (!sb.configured()) return res.status(500).json({ ok: false, error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE missing in Vercel env' });

  if (req.method === 'GET') {
    if (!authed(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const { kind, status = 'pending', limit = '200' } = req.query || {};
    const filter = { eq: {}, order: '-scraped_at', limit: Math.min(parseInt(limit, 10) || 200, 500) };
    if (kind)   filter.eq.kind = kind;
    if (status) filter.eq.status = status;
    try {
      const items = await sb.select('content_queue', filter);
      return res.status(200).json({ ok: true, items, count: items.length });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });
  if (!authed(req, /*allowCron=*/true)) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const { action, item, id, patch } = req.body || {};
  try {
    if (action === 'enqueue') {
      if (!item || !item.url || !item.title || !item.kind) {
        return res.status(400).json({ ok: false, error: 'item.url, item.title, item.kind required' });
      }
      // Try insert; if duplicate URL hash, return deduped:true.
      try {
        const out = await sb.insert('content_queue', {
          kind:           item.kind,
          title:          String(item.title).slice(0, 500),
          summary:        item.summary ? String(item.summary).slice(0, 800) : null,
          url:            item.url,
          source_url:     item.source_url || item.url,
          source_title:   item.source_title || item.title,
          source_author:  item.source_author || null,
          source_license: item.source_license || 'all rights reserved (linkback only)',
          source_name:    item.source || item.source_name || null,
          source_id:      item.source_id || null,
          tags:           item.tags || [],
          published_at:   item.published_at || null,
          scraped_at:     item.scraped_at || new Date().toISOString(),
          status:         'pending'
        });
        return res.status(200).json({ ok: true, queued: 1, item: Array.isArray(out) ? out[0] : out });
      } catch (err) {
        const msg = String(err.message || err);
        if (msg.includes('duplicate') || msg.includes('content_queue_url_hash_idx')) {
          return res.status(200).json({ ok: true, deduped: true });
        }
        throw err;
      }
    }

    if (action === 'approve') {
      if (!id) return res.status(400).json({ ok: false, error: 'id required' });
      const q = await sb.getById('content_queue', id);
      if (!q) return res.status(404).json({ ok: false, error: 'queue item not found' });
      // Insert into content + mark queue item approved + link
      const newItemArr = await sb.insert('content', {
        kind:           q.kind,
        title:          q.title,
        summary:        q.summary,
        external_url:   q.url,
        source_url:     q.source_url,
        source_title:   q.source_title,
        source_author:  q.source_author,
        source_license: q.source_license,
        source_name:    q.source_name,
        tags:           q.tags,
        published_at:   q.published_at || new Date().toISOString(),
        scraped_at:     q.scraped_at,
        status:         'published'
      });
      const newItem = Array.isArray(newItemArr) ? newItemArr[0] : newItemArr;
      await sb.update('content_queue', id, {
        status:         'approved',
        reviewed_at:    new Date().toISOString(),
        promoted_to_id: newItem.id
      });
      return res.status(200).json({ ok: true, approved: true, content_id: newItem.id });
    }

    if (action === 'reject') {
      if (!id) return res.status(400).json({ ok: false, error: 'id required' });
      await sb.update('content_queue', id, { status: 'rejected', reviewed_at: new Date().toISOString() });
      return res.status(200).json({ ok: true, rejected: true });
    }

    if (action === 'edit') {
      if (!id || !patch) return res.status(400).json({ ok: false, error: 'id + patch required' });
      const out = await sb.update('content_queue', id, patch);
      return res.status(200).json({ ok: true, item: Array.isArray(out) ? out[0] : out });
    }

    return res.status(400).json({ ok: false, error: 'unknown action' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
