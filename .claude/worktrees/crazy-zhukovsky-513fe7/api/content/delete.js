/* DELETE /api/content/delete?id=<uuid>
 * (or POST with { id })
 *
 * Soft-delete by default (sets status='archived'); pass ?hard=1 for a real DELETE.
 * Auth: ADMIN_TOKEN header OR aa_role=admin/publisher cookie.
 */
const sb = require('../../lib/supabase');

function authed (req) {
  const adminTok = process.env.ADMIN_TOKEN;
  if (adminTok) {
    const tok = req.headers['x-admin-token'] || req.headers['authorization'];
    if (tok === adminTok || tok === 'Bearer ' + adminTok) return true;
  }
  const cookie = req.headers.cookie || '';
  if (/aa_role=(admin|publisher)/.test(cookie)) return true;
  if (!adminTok) return true;
  return false;
}

module.exports = async function handler (req, res) {
  if (!['DELETE','POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'DELETE or POST only' });
  if (!authed(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const id = (req.query?.id || req.body?.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });
  const hard = req.query?.hard === '1' || req.body?.hard === true;

  try {
    if (hard) {
      await sb.remove('content', id);
    } else {
      await sb.update('content', id, { status: 'archived' });
    }
    res.status(200).json({ ok: true, id, hard });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
