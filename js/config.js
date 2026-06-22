/* ANARCHISM.AFRICA — runtime config
 * Drives which backend and which AI model the app talks to.
 * The Studio (admin.html) can override `ai.provider` and `ai.model` at runtime
 * via localStorage('aa.config') — see api.js getConfig().
 */
window.AA_CONFIG = {
  // ---------- DATA BACKEND ------------------------------------------------
  // 'local'    : reads /data/seed.json (works offline, used for the demo)
  // 'vercel'   : reads/writes JSON via /api/blob/* (Vercel Blob storage)
  // 'supabase' : uses window.AA_SUPABASE_URL / ANON_KEY (Vercel env injects)
  // Auto-picks 'vercel' when running on a *.vercel.app or anarchism.africa
  // domain, else falls back to 'local' for the offline demo.
  backend: (function () {
    if (typeof location === 'undefined') return 'local';
    if (/\.vercel\.app$/.test(location.hostname)) return 'vercel';
    if (location.hostname === 'anarchism.africa' || location.hostname.endsWith('.anarchism.africa')) return 'vercel';
    return 'local';
  })(),

  // Vercel Blob: data + media live as objects in Blob.
  // Reads happen via /api/blob/get?key=... ; writes via /api/blob/put.
  vercel: {
    apiBase: '/api/blob'
  },

  supabase: {
    url:  (typeof window !== 'undefined' && window.AA_SUPABASE_URL)  || '',
    anon: (typeof window !== 'undefined' && window.AA_SUPABASE_ANON) || ''
  },

  // ---------- AI PROVIDER (model-agnostic) -------------------------------
  // 'auto' lets the server pick from its FALLBACK_CHAIN in api/ai/chat.js:
  // kimi → deepseek → qwen → openrouter (DeepSeek V3 free) → gemini.
  // Independent / open-weights providers first; Google as last-resort
  // safety net. Set the model only when overriding a specific call.
  ai: {
    provider: 'auto',
    model:    null,
    fallbacks: ['deepseek/deepseek-chat-v3.1:free', 'qwen/qwen3-235b-a22b:free', 'kimi-k2-0905-preview', 'deepseek-chat', 'qwen-plus', 'gemini-1.5-flash'],
    // Routes are server-side proxies (api/ai/[provider].js) — keys never live in browser.
    endpoint: '/api/ai/chat'
  },

  // ---------- AUTH (consumer sign-in) ------------------------------------
  // Paste your Google OAuth Web client ID here (or set in Vercel env as
  // GOOGLE_CLIENT_ID and the server picks it up). The client ID is public —
  // safe to ship in JS. The corresponding AUTH_SECRET stays server-side only.
  googleClientId: window.AA_GOOGLE_CLIENT_ID || '',

  // ---------- POD / MERCH PROVIDERS --------------------------------------
  // Eco-first: ranked by sustainability score. Backend rotates / chooses.
  pod_providers: [
    { slug: 'stanley_stella',  name: 'Stanley/Stella (via Printful)', eco: 92, cert: ['GOTS','Fair Wear'] },
    { slug: 'teemill',         name: 'Teemill (Rapanui)',             eco: 95, cert: ['Climate-Neutral','B-Corp','Circular'] },
    { slug: 'fairshare',       name: 'FairShare Print',                eco: 88, cert: ['GOTS','SA8000'] },
    { slug: 'ohh_deer',        name: 'Ohh Deer (FSC paper goods)',     eco: 85, cert: ['FSC','Recycled'] },
    { slug: 'gelato_eco',      name: 'Gelato (Eco line)',              eco: 80, cert: ['Climate-Neutral','GRS'] }
  ],

  // ---------- HERO / SLIDESHOW -------------------------------------------
  hero: { autoplay: true, interval_ms: 7000, shuffle: false }
};
