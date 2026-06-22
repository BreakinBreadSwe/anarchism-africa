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
    // Default sort: newest acquisition first. scraped_at wins so freshly
    // scraped items always lead — regardless of what published_at says
    // (some feeds publish archived items with old dates). published_at +
    // created_at fall back when scraped_at is null (seed/manually-added
    // rows). nullslast keeps NULL columns from poisoning the top.
    const order = req.query.order || 'scraped_at.desc.nullslast,published_at.desc.nullslast,created_at.desc.nullslast';
    const filter = { eq: {}, order, limit: Math.min(parseInt(limit, 10) || 60, 200), offset: parseInt(offset, 10) || 0 };
    if (kind)   filter.eq.kind = kind;
    if (status) filter.eq.status = status;
    if (q)      filter.like = { title: '%' + q + '%' };

    // For songs: query content directly so newly-added tracks (audio_status = NULL,
    // not yet verified by the cron) appear immediately. We exclude only songs
    // where audio_status is known-broken (non-null AND not 200). Songs with
    // audio_status = NULL (unchecked) or 200 (verified OK) are included.
    // Pass ?include_unplayable=1 to bypass the audio filter (admin triage).
    let items;
    if (kind === 'song' && status === 'published' && !include_unplayable) {
      items = await sb.select('content', {
        ...filter,
        not_null: ['audio'],
        or: 'audio_status.eq.200,audio_status.is.null'
      });
    } else {
      items = await sb.select('content', filter);
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ ok: true, items, count: items.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
