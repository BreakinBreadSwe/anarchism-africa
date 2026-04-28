/* ANARCHISM.AFRICA — runtime config
 * Drives which backend and which AI model the app talks to.
 * The Studio (admin.html) can override `ai.provider` and `ai.model` at runtime
 * via localStorage('aa.config') — see api.js getConfig().
 */
window.AA_CONFIG = {
  // ---------- DATA BACKEND ------------------------------------------------
  // 'local' : reads /data/seed.json (works offline, used for the demo)
  // 'supabase': uses window.AA_SUPABASE_URL / ANON_KEY (Vercel env injects)
  // 'neon'   : uses /api/* serverless endpoints backed by Neon/Postgres
  backend: 'local',

  supabase: {
    url:  window.AA_SUPABASE_URL  || '',
    anon: window.AA_SUPABASE_ANON || ''
  },

  // ---------- AI PROVIDER (model-agnostic) -------------------------------
  // gemini default. The provider list is plug-and-play — add Qwen, DeepSeek,
  // Kimi, GLM, Yi, Hunyuan, MoonshotAI for Chinese stack support.
  ai: {
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    fallbacks: ['qwen-3', 'deepseek-v3', 'kimi-k2', 'glm-4', 'claude-haiku-4-5'],
    // Routes are server-side proxies (api/ai/[provider].js) — keys never live in browser.
    endpoint: '/api/ai/chat'
  },

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
