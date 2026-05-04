/* GET /api/content/list?kind=film&limit=50&offset=0&status=published
 *   resp: { items: [...], total }
 *
 * Replaces the old blob-backed seed.json reads. Public; no auth required.
 */
const sb = require('../../lib/supabase');

module.exports = async function handler (req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const { kind, limit = '60', offset = '0', status = 'published', q = '' } = req.query || {};
  try {
    const filter = { eq: {}, order: '-published_at', limit: Math.min(parseInt(limit, 10) || 60, 200), offset: parseInt(offset, 10) || 0 };
    if (kind)   filter.eq.kind = kind;
    if (status) filter.eq.status = status;
    if (q)      filter.like = { title: '%' + q + '%' };
    const items = await sb.select('content', filter);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ ok: true, items, count: items.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
