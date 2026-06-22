/* lib/supabase.js — server-side Supabase client wrapper.
 *
 * Used by every /api/* endpoint that reads or writes site data. Single
 * source of truth for connection config + a thin REST wrapper that doesn't
 * pull in @supabase/supabase-js (keeps Vercel cold-start fast).
 *
 * Env vars required:
 *   SUPABASE_URL                   = https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE          = service-role key (server-only, never ship to client)
 *   SUPABASE_ANON_KEY (optional)   = publishable key (only used for read-only public reads)
 *
 * Usage:
 *   const sb = require('../lib/supabase');
 *   const films = await sb.select('content', { eq: { kind: 'film', status: 'published' }, order: '-published_at', limit: 20 });
 *   await sb.insert('content_queue', { kind: 'article', title, url, ... });
 *   await sb.update('content', id, { title: 'New title' });
 *   await sb.upsert('mailing_list', { email, name }, { onConflict: 'email' });
 */

// (clean() defined below — URL gets cleaned at use site since it's referenced
// after KEY declarations. Apply the same whitespace strip to be safe.)
const URL = String(process.env.SUPABASE_URL || '').replace(/\s+/g, '');
// Supabase rolled out new key names (sb_secret_*, sb_publishable_*) — accept
// any of the variants so the user can paste under whichever Vercel env name
// feels natural. Server-side, ALWAYS prefer the secret key over the
// publishable one; we only fall back to publishable for read-only paths.
// Strip ALL whitespace (incl. embedded \n, \r, tabs) from env values. Pasting
// long secrets into the Vercel UI sometimes wraps them with a literal newline;
// fetch's Headers API then throws "invalid header value" on every request
// because `apikey: "sb_secret_...\n..."` is malformed. Real Supabase keys are
// dense whitespace-free strings — stripping is lossless. Symptom this avoids:
// scrape produces 0 queued items + article handler crashes with
// FUNCTION_INVOCATION_FAILED, both because every Supabase REST call dies.
function clean (v) { return String(v == null ? '' : v).replace(/\s+/g, ''); }

const KEY = clean(process.env.SUPABASE_SECRET_KEY)
         || clean(process.env.SUPABASE_SERVICE_ROLE)
         || clean(process.env.SUPABASE_SERVICE_ROLE_KEY)
         || clean(process.env.SUPABASE_ANON_KEY)
         || clean(process.env.SUPABASE_PUBLISHABLE_KEY)
         || '';

function rest (path, opts = {}) {
  if (!URL || !KEY) {
    return Promise.reject(new Error('SUPABASE_URL or SUPABASE_SECRET_KEY missing in Vercel env (set both)'));
  }
  const headers = {
    'apikey': KEY,
    'Authorization': 'Bearer ' + KEY,
    'Content-Type': 'application/json',
    ...(opts.headers || {})
  };
  if (opts.prefer) headers['Prefer'] = opts.prefer;
  return fetch(URL + '/rest/v1' + path, {
    method:  opts.method || 'GET',
    headers,
    body:    opts.body ? JSON.stringify(opts.body) : undefined
  }).then(async r => {
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`supabase ${r.status} ${path} :: ${txt.slice(0, 400)}`);
    }
    if (r.status === 204) return null;
    return r.json();
  });
}

// Build a PostgREST query string from filter helpers.
function buildQS (q = {}) {
  const parts = [];
  if (q.select) parts.push('select=' + encodeURIComponent(q.select));
  if (q.eq) for (const k of Object.keys(q.eq)) parts.push(`${k}=eq.${encodeURIComponent(q.eq[k])}`);
  if (q.in) for (const k of Object.keys(q.in)) parts.push(`${k}=in.(${q.in[k].map(encodeURIComponent).join(',')})`);
  if (q.lt) for (const k of Object.keys(q.lt)) parts.push(`${k}=lt.${encodeURIComponent(q.lt[k])}`);
  if (q.gt) for (const k of Object.keys(q.gt)) parts.push(`${k}=gt.${encodeURIComponent(q.gt[k])}`);
  if (q.like)     for (const k of Object.keys(q.like)) parts.push(`${k}=ilike.${encodeURIComponent(q.like[k])}`);
  // not_null: array of column names that must be IS NOT NULL
  if (q.not_null) for (const k of q.not_null) parts.push(`${k}=not.is.null`);
  // or: raw PostgREST OR expression, e.g. 'audio_status.eq.200,audio_status.is.null'
  if (q.or)       parts.push('or=(' + q.or + ')');
  if (q.order) {
    // '-col' = desc, 'col' = asc, comma-separated for multiple
    const o = q.order.split(',').map(s => {
      const desc = s.startsWith('-');
      return (desc ? s.slice(1) : s) + (desc ? '.desc' : '.asc');
    }).join(',');
    parts.push('order=' + o);
  }
  if (q.limit)  parts.push('limit=' + q.limit);
  if (q.offset) parts.push('offset=' + q.offset);
  return parts.length ? '?' + parts.join('&') : '';
}

module.exports = {
  configured: () => !!URL && !!KEY,
  url: URL,

  select  (table, q)        { return rest('/' + table + buildQS(q || {})); },
  insert  (table, row, ret = 'representation') {
    return rest('/' + table, { method: 'POST', body: Array.isArray(row) ? row : [row], prefer: 'return=' + ret });
  },
  update  (table, idOrFilter, patch, ret = 'representation') {
    const filter = typeof idOrFilter === 'string'
      ? { eq: { id: idOrFilter } }
      : idOrFilter;
    return rest('/' + table + buildQS(filter), { method: 'PATCH', body: patch, prefer: 'return=' + ret });
  },
  upsert  (table, row, opts = {}) {
    const onConflict = opts.onConflict ? '?on_conflict=' + opts.onConflict : '';
    return rest('/' + table + onConflict, {
      method: 'POST',
      body: Array.isArray(row) ? row : [row],
      prefer: 'return=representation,resolution=merge-duplicates'
    });
  },
  remove  (table, idOrFilter) {
    const filter = typeof idOrFilter === 'string'
      ? { eq: { id: idOrFilter } }
      : idOrFilter;
    return rest('/' + table + buildQS(filter), { method: 'DELETE' });
  },

  // Convenience: get-by-id, returns null if not found.
  async getById (table, id) {
    const rows = await this.select(table, { eq: { id }, limit: 1 });
    return rows && rows.length ? rows[0] : null;
  },

  // KV — generic key/value (replaces blob.put/get during migration).
  async kvGet (key) {
    const rows = await this.select('kv', { eq: { key }, limit: 1 });
    return rows && rows.length ? rows[0].value : null;
  },
  async kvPut (key, value) {
    return this.upsert('kv', { key, value }, { onConflict: 'key' });
  }
};
