/* POST /api/content/save
 *   body: { id?, kind, ...fields }
 *   - if id provided: UPDATE that row
 *   - if id missing:  INSERT new row
 *
 * Auth: ADMIN_TOKEN header OR aa_role=admin/publisher cookie.
 *
 * This is what powers the admin "Save" button on every Edit dialog.
 * Fixes the "tried to update a films link, but got error because we don't
 * have a database yet" bug — now we have one, and this endpoint persists.
 */
const sb = require('../../lib/supabase');

const ALLOWED = new Set([
  'kind','status','slug','title','subtitle','deck','summary','body','language','category','tags',
  'image','gallery','embeds','audio','video','duration','reading_time',
  'author','director','artist','publisher','year',
  'starts_at','ends_at','venue','city','country',
  'price_eur','provider','external_url',
  'source_url','source_title','source_author','source_license','source_name',
  'pull_quotes','stats','sources_cited','verify_notes',
  'published_at'
]);

function authed (req) {
  const adminTok = process.env.ADMIN_TOKEN;
  if (adminTok) {
    const tok = req.headers['x-admin-token'] || req.headers['authorization'];
    if (tok === adminTok || tok === 'Bearer ' + adminTok) return true;
  }
  const cookie = req.headers.cookie || '';
  if (/aa_role=(admin|publisher|editor)/.test(cookie)) return true;
  // If no admin token is configured, allow writes (dev / first-run)
  if (!adminTok) return true;
  return false;
}

function clean (body) {
  const out = {};
  for (const k of Object.keys(body || {})) {
    if (ALLOWED.has(k) && body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

module.exports = async function handler (req, res) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).json({ ok: false, error: 'POST or PATCH only' });
  if (!authed(req)) return res.status(401).json({ ok: false, error: 'unauthorized — sign in as admin or publisher' });
  if (!sb.configured()) return res.status(500).json({ ok: false, error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE missing in Vercel env' });

  try {
    const body  = req.body || {};
    const id    = body.id;
    const patch = clean(body);
    if (!patch.kind && !id) return res.status(400).json({ ok: false, error: 'kind required for new content' });
    if (!patch.title && !id) return res.status(400).json({ ok: false, error: 'title required for new content' });

    let row;
    if (id) {
      const out = await sb.update('content', id, patch);
      row = Array.isArray(out) ? out[0] : out;
      if (!row) return res.status(404).json({ ok: false, error: 'no row with that id' });
    } else {
      const out = await sb.insert('content', patch);
      row = Array.isArray(out) ? out[0] : out;
    }
    res.status(200).json({ ok: true, item: row });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
