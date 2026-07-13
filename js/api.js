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
    // Overlay live content from Supabase (one /api/content/list call per
    // kind). When the new DB has rows, they replace the seed bucket so the
    // public site is always showing the latest published items + approved
    // scraper items + admin edits. If the call fails (DB not configured
    // yet, network blip), we fall through silently to the bundled fixture
    // so the site never goes blank.
    const KIND_TO_BUCKET = {
      film: 'films', article: 'articles', event: 'events',
      song: 'music', book: 'books', merch: 'merch'
    };
    await Promise.all(Object.entries(KIND_TO_BUCKET).map(async ([kind, bucket]) => {
      try {
        const r = await fetch(`/api/content/list?kind=${kind}&status=published&limit=2000`, { cache: 'no-store' });
        if (!r.ok) return; // network/server error — keep seed fallback for THIS kind
        const j = await r.json();
        // Authoritative replacement: if the API responds (even with []), trust it.
        // Previous behaviour kept the seed bucket alive when the DB was empty —
        // that's what made demo titles persist on the public site after the user
        // emptied the DB. Now: empty DB → empty bucket → real state shown.
        if (Array.isArray(j.items)) data[bucket] = j.items;
      } catch {} // only network/JSON errors keep the seed fallback
    }));

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

    async getHero (mode)    {
      // Mode controls how the hero pool is ordered.
      //   'random' (default) — Fisher-Yates shuffle across articles + sounds +
      //     seed. Recent items get weighted copies so fresh content surfaces
      //     more often without monopolising the slideshow.
      //   'newest'           — pure chronological by acquisition timestamp
      //     (scraped_at first, then published_at, then year). No shuffle. The
      //     latest scraped item across all categories leads slide 1.
      // The mode is persisted by app.js in localStorage('aa-hero-mode').
      mode = mode === 'newest' ? 'newest' : 'random';
      const pool = [];

      // 1. Live articles from Vercel API (works even when Supabase key is broken)
      try {
        const r = await fetch('/api/content/list?status=published&limit=400&_=' + Math.floor(Date.now() / 3600000));
        if (r.ok) {
          const d = await r.json();
          const items = (d.items || []).filter(x => x.image);
          items.forEach(x => pool.push({
            id:       x.id,
            title:    x.title,
            summary:  x.summary || x.deck || '',
            image:    x.image,
            type:     x.kind || 'article',
            tab:      ({ film:'films', article:'articles', event:'events', song:'music', book:'books' })[x.kind] || 'articles',
            ts:       Date.parse(x.published_at || x.created_at || 0) || 0,
          }));
        }
      } catch {}

      // 2. Live sounds that have cover art
      try {
        const r = await fetch('/api/sound/list?_=' + Math.floor(Date.now() / 3600000));
        if (r.ok) {
          const d = await r.json();
          // Only PLAYABLE tracks belong in the hero pool — a direct-audio URL
          // means the '▶ Play' hero CTA can actually fire MP.play(). Without
          // the audio field the CTA silently falls back to 'Open Song' which
          // just switches tabs (looks like 'player stopped working'). Filter
          // out embed-only tracks (SoundCloud / Bandcamp iframes have no
          // direct URL).
          const audioSrc = (x) => x.audio || x.audioUrl || (x.url?.match?.(/\.(mp3|aac|ogg|flac|m4a)(\?|$)/i) ? x.url : null);
          (d.tracks || []).filter(x => x.image && audioSrc(x)).slice(0, 80).forEach(x => pool.push({
            id:      x.id,
            title:   x.title,
            artist:  x.artist || '',
            summary: x.artist ? `${x.artist}${x.year ? ' · ' + x.year : ''}` : '',
            image:   x.image,
            audio:   audioSrc(x),
            type:    'song',
            tab:     'music',
            ts:      x.year ? new Date(String(x.year) + '-01-01').getTime() : 0,
          }));
        }
      } catch {}

      // 3. Seed fallback hero items (always available)
      try {
        const seed = await loadSeed();
        (seed.hero || []).forEach(x => pool.push({ ...x, ts: 0 }));
      } catch {}

      if (!pool.length) return [];

      let bag;
      if (mode === 'newest') {
        // Sort by acquisition timestamp DESC and dedupe — no shuffle, no
        // weighting. Latest scraped item across all categories takes slide 1.
        bag = pool.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
      } else {
        // Weight: items from last 30 days get 3 copies in the shuffle bag,
        // last 7 days get 5 copies — makes recent scrapes dominate without
        // fully excluding older classics.
        const now = Date.now();
        bag = [];
        pool.forEach(x => {
          const age = now - (x.ts || 0);
          const weight = age < 7 * 86400000 ? 5 : age < 30 * 86400000 ? 3 : 1;
          for (let i = 0; i < weight; i++) bag.push(x);
        });
        // Fisher-Yates shuffle
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }

      // Deduplicate by id and return up to 14 slides
      const seen = new Set();
      const out = [];
      for (const x of bag) {
        if (out.length >= 14) break;
        if (!seen.has(x.id)) { seen.add(x.id); out.push(x); }
      }
      return out;
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
