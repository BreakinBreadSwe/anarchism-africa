/* GET /api/content/list?kind=film&limit=50&offset=0&status=published
 *   resp: { items: [...], total }
 *
 * Replaces the old blob-backed seed.json reads. Public; no auth required.
 *
 * For kind=song, the default behavior FILTERS OUT non-playable rows —
 * songs with no audio URL or with audio_status != 200 are excluded. The
 * music tab should never show a row whose play button does nothing.
 * Pass ?include_unplayable=1 to bypass this filter (for admin views that
 * want to see broken rows for triage).
 */
const sb = require('../../lib/supabase');

module.exports = async function handler (req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const { kind, limit = '60', offset = '0', status = 'published', q = '', include_unplayable } = req.query || {};
  try {
    const filter = { eq: {}, order: '-published_at', limit: Math.min(parseInt(limit, 10) || 60, 200), offset: parseInt(offset, 10) || 0 };
    if (kind)   filter.eq.kind = kind;
    if (status) filter.eq.status = status;
    if (q)      filter.like = { title: '%' + q + '%' };

    // For songs: read straight from the playable_songs view (which already
    // filters published + audio + audio_status=200). Falls through to the
    // raw content table when include_unplayable=1 (admin) or when status
    // isn't published (queue review etc).
    let items;
    if (kind === 'song' && status === 'published' && !include_unplayable) {
      const songFilter = { ...filter };
      delete songFilter.eq.kind;
      delete songFilter.eq.status;
      items = await sb.select('playable_songs', songFilter);
    } else {
      items = await sb.select('content', filter);
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ ok: true, items, count: items.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
