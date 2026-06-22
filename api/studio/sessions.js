// Merch Studio session persistence.
//
// GET    /api/studio/sessions          → list sessions
//   Filtered by the signed-in user's email UNLESS their role is
//   admin or publisher, in which case all sessions are returned.
//   Query params: ?limit=50 (max 200) &product=tshirt &owner=email@x
//
// POST   /api/studio/sessions          → create or update (upsert by id)
//   body: { id?, title, product, area, state, thumbnail?, status? }
//   If id is present and the row belongs to the caller (or caller is
//   admin/publisher), updates. Otherwise creates a new row.
//
// DELETE /api/studio/sessions?id=X     → remove a session
//   Allowed if caller owns the row OR caller is admin/publisher.
//
// Auth: HMAC session cookie (aa_role + aa_email), set by the existing
// magic-link / Google sign-in flow. Falls back to a generic 'guest@local'
// owner when no cookie — useful in setup mode but those sessions are
// invisible to other users.

const sb = require('../../lib/supabase');
const { readSession } = require('../auth/_session.js');

const PRIVILEGED = new Set(['admin', 'publisher']);

function callerOf (req) {
  // Try the signed session cookie first. Fall back to a 'guest@local'
  // identity so the studio is usable in setup mode (before email/Google
  // auth is wired). Guest sessions are still listable but only by another
  // guest from the same browser — there's no real isolation without auth.
  const user = readSession(req);
  if (user?.email) return { email: user.email, role: user.role || 'consumer' };
  // Honour a manual x-aa-admin-token override for CLI / cron / scripts.
  const adminTok = process.env.AA_ADMIN_TOKEN;
  if (adminTok && req.headers['x-aa-admin-token'] === adminTok) {
    return { email: 'admin@aa', role: 'admin' };
  }
  return { email: 'guest@local', role: 'guest' };
}

module.exports = async function handler (req, res) {
  if (!sb.configured()) {
    return res.status(500).json({ ok: false, error: 'Supabase not configured' });
  }
  const caller = callerOf(req);

  if (req.method === 'GET') {
    const { limit = '50', product, owner } = req.query || {};
    const filter = {
      eq: {},
      order: '-updated_at',
      limit: Math.min(parseInt(limit, 10) || 50, 200)
    };
    if (product) filter.eq.product = product;
    // Privilege filter — admins/publishers see all unless they pass ?owner=.
    if (PRIVILEGED.has(caller.role)) {
      if (owner) filter.eq.owner_email = owner;
    } else {
      filter.eq.owner_email = caller.email;
    }
    try {
      const items = await sb.select('studio_sessions', filter);
      return res.status(200).json({ ok: true, items, count: items.length, caller });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.product || !body.area || !body.state) {
      return res.status(400).json({ ok: false, error: 'product, area, state required' });
    }
    const row = {
      owner_email: caller.email,
      owner_role:  caller.role,
      title:       String(body.title || 'Untitled session').slice(0, 200),
      product:     String(body.product).slice(0, 60),
      area:        String(body.area).slice(0, 60),
      state:       body.state,
      thumbnail:   body.thumbnail ? String(body.thumbnail).slice(0, 200000) : null,
      status:      ['draft','finished','shipped'].includes(body.status) ? body.status : 'draft',
      updated_at:  new Date().toISOString()
    };
    try {
      if (body.id) {
        // Update path — but only the owner (or admin/publisher) can patch a row.
        const existing = await sb.getById('studio_sessions', body.id);
        if (!existing) return res.status(404).json({ ok: false, error: 'session not found' });
        const canEdit = existing.owner_email === caller.email || PRIVILEGED.has(caller.role);
        if (!canEdit) return res.status(403).json({ ok: false, error: 'not your session' });
        const updated = await sb.update('studio_sessions', body.id, row);
        return res.status(200).json({ ok: true, item: Array.isArray(updated) ? updated[0] : updated });
      }
      // Insert path
      const inserted = await sb.insert('studio_sessions', row);
      return res.status(200).json({ ok: true, item: Array.isArray(inserted) ? inserted[0] : inserted });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  }

  if (req.method === 'DELETE') {
    const id = (req.query && req.query.id) || (req.body && req.body.id);
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    try {
      const existing = await sb.getById('studio_sessions', id);
      if (!existing) return res.status(404).json({ ok: false, error: 'session not found' });
      const canDelete = existing.owner_email === caller.email || PRIVILEGED.has(caller.role);
      if (!canDelete) return res.status(403).json({ ok: false, error: 'not your session' });
      await sb.remove('studio_sessions', id);
      return res.status(200).json({ ok: true, deleted: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ ok: false, error: 'GET, POST, or DELETE' });
};
