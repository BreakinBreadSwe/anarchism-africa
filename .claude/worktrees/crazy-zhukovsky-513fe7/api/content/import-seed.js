/* POST /api/content/import-seed
 * Imports the bundled seed.json into the content table. Idempotent — uses
 * upsert keyed on slug (or id for items that already have one). Run this
 * once after the Supabase project is configured to bootstrap the public
 * library so it's not empty.
 *
 * Auth: ADMIN_TOKEN header OR aa_role=admin/publisher cookie.
 */
const fs = require('fs');
const path = require('path');
const sb = require('../../lib/supabase');

const KIND_MAP = { films: 'film', articles: 'article', events: 'event', music: 'song', books: 'book', merch: 'merch', grants: 'grant' };

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

function slugify (s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function mapItem (kind, raw) {
  return {
    slug:         raw.id || slugify(raw.title || raw.name),
    kind,
    status:       'published',
    title:        raw.title || raw.name || '',
    subtitle:     raw.subtitle || null,
    deck:         raw.deck || null,
    summary:      raw.summary || raw.description || null,
    body:         raw.body || null,
    language:     raw.language || 'en',
    category:     raw.category || null,
    tags:         raw.tags || [],
    image:        raw.image || raw.cover || null,
    audio:        raw.audio || null,
    video:        raw.video || raw.embed || null,
    duration:     raw.duration || null,
    reading_time: raw.reading_time || null,
    author:       raw.author || null,
    director:     raw.director || null,
    artist:       raw.artist || null,
    publisher:    raw.publisher || null,
    year:         raw.year || null,
    starts_at:    raw.starts_at || null,
    ends_at:      raw.ends_at || null,
    venue:        raw.venue || null,
    city:         raw.city || null,
    country:      raw.country || null,
    price_eur:    raw.price_eur || null,
    provider:     raw.provider || null,
    external_url: raw.external_url || raw.url || null,
    published_at: raw.published_at || raw.year ? new Date(raw.year + '-01-01').toISOString() : new Date().toISOString()
  };
}

module.exports = async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  if (!authed(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!sb.configured()) return res.status(500).json({ ok: false, error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE missing' });

  try {
    const seedPath = path.join(process.cwd(), 'data', 'seed.json');
    const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const counts = {};
    const errors = [];

    for (const [bucket, kind] of Object.entries(KIND_MAP)) {
      const list = raw[bucket] || [];
      counts[kind] = 0;
      for (const item of list) {
        try {
          const row = mapItem(kind, item);
          await sb.upsert('content', row, { onConflict: 'slug' });
          counts[kind] += 1;
        } catch (e) {
          errors.push({ kind, title: item.title, error: String(e.message || e) });
        }
      }
    }

    // Ambassadors
    if (Array.isArray(raw.ambassadors)) {
      counts.ambassadors = 0;
      for (const a of raw.ambassadors) {
        try {
          await sb.upsert('ambassadors', {
            name: a.name, city: a.city, country: a.country, bio: a.bio,
            reach: a.reach || 0, status: a.status || 'active',
            email: a.email || null, social: a.social || {}
          }, { onConflict: 'id' });
          counts.ambassadors += 1;
        } catch {}
      }
    }

    // Grants
    if (Array.isArray(raw.grants)) {
      counts.grants = 0;
      for (const g of raw.grants) {
        try {
          await sb.upsert('grants', {
            funder: g.funder, title: g.title, amount: g.amount,
            deadline: g.deadline || null, url: g.url || null,
            status: g.status || 'open'
          });
          counts.grants += 1;
        } catch {}
      }
    }

    res.status(200).json({ ok: true, imported: counts, errors });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
