/* ANARCHISM.AFRICA — data layer
 * Abstract over backends so the same UI runs on:
 *   - local seed.json (the demo)
 *   - Supabase (production)
 *   - Neon/Postgres via /api/* serverless routes
 */
(function () {
  const cfg = () => {
    const stored = localStorage.getItem('aa.config');
    if (stored) try { return Object.assign({}, window.AA_CONFIG, JSON.parse(stored)); } catch {}
    return window.AA_CONFIG;
  };

  const cache = { seed: null };

  async function loadSeed () {
    if (cache.seed) return cache.seed;
    const r = await fetch('data/seed.json');
    if (!r.ok) throw new Error('seed not found');
    cache.seed = await r.json();
    return cache.seed;
  }

  // ---------- Supabase REST helper (no SDK needed) ----------
  async function sb (path, opts = {}) {
    const c = cfg().supabase;
    if (!c.url || !c.anon) throw new Error('Supabase not configured');
    const url = `${c.url}/rest/v1/${path}`;
    const r = await fetch(url, {
      ...opts,
      headers: {
        apikey: c.anon,
        Authorization: `Bearer ${c.anon}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      }
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
    return r.json();
  }

  // ---------- public API -----------------------------------
  const API = {
    async getSite ()   { return (await loadSeed()).site; },
    async getTheme ()  { return (await loadSeed()).theme; },

    async getHero ()        {
      if (cfg().backend === 'supabase') {
        return sb('content_items?featured=eq.true&order=created_at.desc&limit=8');
      }
      return (await loadSeed()).hero;
    },

    async getByType (type) {
      if (cfg().backend === 'supabase') {
        return sb(`content_items?type=eq.${type}&status=eq.published&order=created_at.desc`);
      }
      const seed = await loadSeed();
      const map = { film: 'films', article: 'articles', event: 'events',
                    song: 'music', book: 'books', merch: 'merch' };
      return seed[map[type] || type] || [];
    },

    async getCommunity () { return (await loadSeed()).community; },
    async getAmbassadors () { return (await loadSeed()).ambassadors; },
    async getCampaigns () { return (await loadSeed()).campaigns; },
    async getGrants ()    { return (await loadSeed()).grants; },

    // mailing list -----------------------------------------------------
    async subscribe (email, name = '') {
      if (cfg().backend === 'supabase') {
        return sb('mailing_list', { method: 'POST', body: JSON.stringify({ email, name }) });
      }
      const list = JSON.parse(localStorage.getItem('aa.mailing') || '[]');
      if (!list.find(x => x.email === email)) list.push({ email, name, ts: Date.now() });
      localStorage.setItem('aa.mailing', JSON.stringify(list));
      return { ok: true, count: list.length };
    },

    // ambassadors ------------------------------------------------------
    async applyAmbassador (data) {
      const list = JSON.parse(localStorage.getItem('aa.amb_apps') || '[]');
      list.push({ ...data, ts: Date.now(), status: 'pending' });
      localStorage.setItem('aa.amb_apps', JSON.stringify(list));
      return { ok: true };
    },

    // community --------------------------------------------------------
    async postToCommunity (post) {
      const list = JSON.parse(localStorage.getItem('aa.posts') || '[]');
      const item = { ...post, id: 'p' + Date.now(), likes: 0, ts: Date.now() };
      list.unshift(item);
      localStorage.setItem('aa.posts', JSON.stringify(list));
      return item;
    },
    async getLocalPosts () { return JSON.parse(localStorage.getItem('aa.posts') || '[]'); },

    // pledge -----------------------------------------------------------
    async pledge (campaign_id, amount_cents) {
      const list = JSON.parse(localStorage.getItem('aa.pledges') || '[]');
      list.push({ campaign_id, amount_cents, ts: Date.now() });
      localStorage.setItem('aa.pledges', JSON.stringify(list));
      return { ok: true };
    },

    // role -------------------------------------------------------------
    setRole (role) { localStorage.setItem('aa.role', role); },
    getRole ()     { return localStorage.getItem('aa.role') || 'consumer'; },

    // config -----------------------------------------------------------
    cfg,
    setConfig (patch) {
      const merged = Object.assign({}, cfg(), patch);
      localStorage.setItem('aa.config', JSON.stringify(merged));
      return merged;
    }
  };

  window.AA = API;
})();
