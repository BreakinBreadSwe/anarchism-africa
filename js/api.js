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

  const cache = { seed: null, blob: {} };

  // Always read from the live DB first (Vercel Blob via /api/blob/get with
  // fallback=1 so cold-start serves the bundled fixture). The local fixture
  // is ONLY a bootstrap for first deploy; once the publisher / scraper writes
  // anything, Blob is the source of truth. No UI code should fetch the local
  // seed.json directly — every read flows through here.
  async function loadSeed () {
    if (cache.seed) return cache.seed;
    const useBlob = (cfg().backend === 'vercel');
    let r, data = null;
    if (useBlob) {
      try {
        r = await fetch(`${cfg().vercel.apiBase}/get?key=seed.json&fallback=1`, { cache: 'no-store' });
        if (r.ok) data = await r.json();
      } catch {}
    }
    // Bootstrap fixture fallback (cold start, local dev, or blob unreachable).
    if (!data) {
      r = await fetch('data/seed.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('seed not reachable (blob + fixture both failed)');
      data = await r.json();
    }
    // Overlay any live content writes on top of the seed (films, articles,
    // events, music, books, merch, grants, etc.) so approved scraper items
    // and publisher edits show up everywhere immediately.
    if (useBlob) {
      const KINDS = [
        ['films','content/films.json'], ['articles','content/articles.json'],
        ['events','content/events.json'], ['music','content/music.json'],
        ['books','content/books.json'], ['merch','content/merch.json'],
        ['grants','content/grants.json']
      ];
      await Promise.all(KINDS.map(async ([key, blobKey]) => {
        try {
          const o = await blobGet(blobKey);
          if (o && Array.isArray(o.items) && o.items.length) data[key] = o.items;
        } catch {}
      }));
    }
    cache.seed = data;
    return cache.seed;
  }
  function invalidateSeed () { cache.seed = null; cache.blob = {}; }

  // ---------- Vercel Blob helpers ------------------------------------
  async function blobGet (key) {
    if (cache.blob[key]) return cache.blob[key];
    const r = await fetch(`${cfg().vercel.apiBase}/get?key=${encodeURIComponent(key)}`);
    if (!r.ok) return null;
    const data = await r.json();
    cache.blob[key] = data;
    return data;
  }
  async function blobPut (key, value) {
    delete cache.blob[key];
    const r = await fetch(`${cfg().vercel.apiBase}/put`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });
    if (!r.ok) throw new Error('blob put failed: ' + r.status);
    return r.json();
  }
  async function blobAppend (key, item) {
    const list = (await blobGet(key)) || [];
    list.unshift(item);
    return blobPut(key, list);
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

    // marketplace -----------------------------------------------------
    async getAlliedShops () { return (await loadSeed()).external_shops || []; },
    async getServices ()    {
      const seed = (await loadSeed()).services || [];
      const local = JSON.parse(localStorage.getItem('aa.userOfferings.services') || '[]');
      return [...local, ...seed];
    },
    async getSeminars ()    {
      const seed = (await loadSeed()).seminars || [];
      const local = JSON.parse(localStorage.getItem('aa.userOfferings.seminars') || '[]');
      return [...local, ...seed];
    },
    async getJobs ()        {
      const seed = (await loadSeed()).jobs || [];
      const local = JSON.parse(localStorage.getItem('aa.userOfferings.jobs') || '[]');
      return [...local, ...seed];
    },
    async postOffering (kind, item) {
      const key = 'aa.userOfferings.' + kind;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      const out = { ...item, id: kind[0] + Date.now(), ts: Date.now(), userPosted: true };
      list.unshift(out);
      localStorage.setItem(key, JSON.stringify(list));
      return out;
    },

    // mailing list -----------------------------------------------------
    async subscribe (email, name = '') {
      if (cfg().backend === 'vercel') {
        await blobAppend('mailing_list.json', { email, name, ts: Date.now() });
        const list = (await blobGet('mailing_list.json')) || [];
        return { ok: true, count: list.length };
      }
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
      const item = { ...data, ts: Date.now(), status: 'pending' };
      if (cfg().backend === 'vercel') { await blobAppend('amb_applications.json', item); return { ok: true }; }
      const list = JSON.parse(localStorage.getItem('aa.amb_apps') || '[]');
      list.push(item);
      localStorage.setItem('aa.amb_apps', JSON.stringify(list));
      return { ok: true };
    },

    // community --------------------------------------------------------
    async postToCommunity (post) {
      const item = { ...post, id: 'p' + Date.now(), likes: 0, ts: Date.now() };
      if (cfg().backend === 'vercel') { await blobAppend('community_posts.json', item); return item; }
      const list = JSON.parse(localStorage.getItem('aa.posts') || '[]');
      list.unshift(item);
      localStorage.setItem('aa.posts', JSON.stringify(list));
      return item;
    },
    async getLocalPosts () {
      if (cfg().backend === 'vercel') return (await blobGet('community_posts.json')) || [];
      return JSON.parse(localStorage.getItem('aa.posts') || '[]');
    },

    // pledge -----------------------------------------------------------
    async pledge (campaign_id, amount_cents) {
      const item = { campaign_id, amount_cents, ts: Date.now() };
      if (cfg().backend === 'vercel') { await blobAppend('pledges.json', item); return { ok: true }; }
      const list = JSON.parse(localStorage.getItem('aa.pledges') || '[]');
      list.push(item);
      localStorage.setItem('aa.pledges', JSON.stringify(list));
      return { ok: true };
    },

    // expose the unified read so UI code never fetches data/seed.json directly
    loadSeed,
    invalidateSeed,
    blobGet, blobPut, blobAppend,

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
