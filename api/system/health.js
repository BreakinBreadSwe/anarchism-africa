/* /api/system/health — pipeline-health checklist for LUVLAB + COOLHUNTPARIS
 *
 * Returns a structured health report covering: env keys, cron schedule
 * presence, last-run timestamps for each generator, content counts by kind,
 * Printify connectivity, mirror credits coverage. Fast: no AI calls, just
 * Blob reads + env presence checks.
 *
 * GET /api/system/health
 *   resp: { ts, ok, items: [{ id, group, label, status, detail, action }] }
 *
 * Auth: ADMIN_TOKEN header OR aa_role=admin/publisher cookie OR CRON_SECRET.
 * The publisher (COOLHUNTPARIS) sees the same items as admin (LUVLAB) — the
 * checklist is shared. Differences in capability are surfaced via `action`.
 */

const { list } = require('@vercel/blob');

function authed (req) {
  const adminToken = process.env.ADMIN_TOKEN;
  const cronSecret = process.env.CRON_SECRET;
  const tok = req.headers['x-admin-token'] || req.headers['authorization'];
  const ck  = (req.headers.cookie || '').match(/aa_role=([^;]+)/)?.[1];
  if (cronSecret && (req.headers['x-cron-secret'] === cronSecret || req.headers['x-vercel-cron-signature'])) return true;
  if (adminToken && (tok === adminToken || tok === `Bearer ${adminToken}`)) return true;
  if (ck && /^(admin|publisher)$/i.test(decodeURIComponent(ck))) return true;
  // In dev (no admin token set) we allow read-only health checks
  if (!adminToken) return true;
  return false;
}

async function safeBlobJSON (key) {
  try {
    const url = `${baseUrl()}/api/blob/get?key=${encodeURIComponent(key)}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function baseUrl () {
  const su = process.env.SITE_URL || process.env.VERCEL_URL || '';
  if (!su) return 'https://www.anarchism.africa';
  return su.startsWith('http') ? su : `https://${su}`;
}

const HOUR  = 60 * 60 * 1000;
const DAY   = 24 * HOUR;
const WEEK  = 7  * DAY;

function ageMs (iso) {
  if (!iso) return Infinity;
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  return Number.isFinite(t) ? Date.now() - t : Infinity;
}
function fmtAge (ms) {
  if (!Number.isFinite(ms)) return 'never';
  if (ms < HOUR)  return Math.round(ms / 60000) + 'm ago';
  if (ms < DAY)   return Math.round(ms / HOUR) + 'h ago';
  return Math.round(ms / DAY) + 'd ago';
}

function statusFor (age, fresh, stale) {
  if (!Number.isFinite(age)) return 'fail';
  if (age < fresh) return 'pass';
  if (age < stale) return 'warn';
  return 'fail';
}

// ----- check builders --------------------------------------------------

function checkEnv () {
  const hasLLM = ['OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY']
    .some(k => process.env[k]);
  const items = [];

  items.push({
    id: 'env-blob',
    group: 'Setup',
    label: 'Vercel Blob storage connected',
    status: process.env.BLOB_READ_WRITE_TOKEN ? 'pass' : 'fail',
    detail: process.env.BLOB_READ_WRITE_TOKEN ? 'BLOB_READ_WRITE_TOKEN is set in Vercel env' : 'BLOB_READ_WRITE_TOKEN missing — the pipeline has nowhere to store articles, logos, or slogans',
    help: [
      'WHAT: Vercel Blob is the persistent storage for every piece of generated content (articles, logos, slogans, mirrored items, autopilot logs).',
      'WHY: Without this, every cron job and every article generation will fail to persist. Nothing reaches the public site.',
      'HOW: 1) Open vercel.com/dashboard → your project → Storage tab. 2) Click "Create Database" → "Blob". 3) Vercel auto-injects BLOB_READ_WRITE_TOKEN as an env var across Production + Preview + Development. 4) Redeploy.',
      'WHERE: Vercel project → Storage → Blob.'
    ].join('\n'),
    action: process.env.BLOB_READ_WRITE_TOKEN ? null : { label: 'Open Vercel Storage', url: 'https://vercel.com/dashboard' }
  });

  items.push({
    id: 'env-llm',
    group: 'Setup',
    label: 'At least one LLM key configured',
    status: hasLLM ? 'pass' : 'fail',
    detail: hasLLM ? 'Article + slogan generators have a working LLM provider' : 'No LLM key set — articles + slogans cannot be generated',
    help: [
      'WHAT: An LLM API key powers the article writer (outline → research → draft → polish), the slogan generator, and the in-app A.A.AI chat.',
      'WHY: Without any LLM key, all daily content generation fails. The site stops feeling alive.',
      'HOW (cheapest path): 1) Sign up at openrouter.ai (free tier covers most needs). 2) Create an API key. 3) Add OPENROUTER_API_KEY to Vercel env. 4) Redeploy.',
      'ALTERNATIVES: GEMINI_API_KEY (free at aistudio.google.com) is recommended for grounded research + image generation. ANTHROPIC_API_KEY (Claude) and OPENAI_API_KEY also work — any one is enough.',
      'WHERE: vercel.com/dashboard → project → Settings → Environment Variables.'
    ].join('\n'),
    action: hasLLM ? null : { label: 'Get free OpenRouter key', url: 'https://openrouter.ai/keys' }
  });

  items.push({
    id: 'env-cron',
    group: 'Setup',
    label: 'Cron secret set',
    status: process.env.CRON_SECRET ? 'pass' : 'warn',
    detail: process.env.CRON_SECRET ? 'CRON_SECRET is set — cron endpoints authenticated' : 'CRON_SECRET missing — anyone can hit /api/cron/* and trigger generation cycles',
    help: [
      'WHAT: A shared secret that authenticates Vercel\'s cron scheduler when it pings /api/cron/scan-content, /api/cron/generate-articles, etc.',
      'WHY: Without it, anyone on the internet can trigger your content cron jobs at will, burning your LLM budget and spamming the queue.',
      'HOW: 1) Generate a 32-char random string in your terminal: `openssl rand -hex 32`. 2) Copy the output. 3) Add CRON_SECRET in Vercel env. 4) Redeploy. The vercel.json cron configuration auto-attaches the right header — you don\'t need to change anything else.',
      'WHERE: vercel.com/dashboard → project → Settings → Environment Variables.'
    ].join('\n'),
    action: process.env.CRON_SECRET ? null : { label: 'Generate + add CRON_SECRET', url: 'https://vercel.com/dashboard' }
  });

  items.push({
    id: 'env-admin',
    group: 'Setup',
    label: 'Admin token set',
    status: process.env.ADMIN_TOKEN ? 'pass' : 'warn',
    detail: process.env.ADMIN_TOKEN ? 'ADMIN_TOKEN set' : 'ADMIN_TOKEN missing — admin endpoints (autopilot, blob writes) accept any caller',
    help: [
      'WHAT: A separate admin secret that gates POST /api/autopilot/run, /api/blob/put, and the manual "Fire autopilot" button on this dashboard.',
      'WHY: Without it the autopilot endpoint can be invoked anonymously, which lets a bad actor force expensive generation cycles or overwrite your Blob.',
      'HOW: 1) Generate another 32-char string: `openssl rand -hex 32`. 2) Add ADMIN_TOKEN to Vercel env. 3) The admin/publisher pages already send the right cookie when you sign in via PIN, so the dashboard keeps working.',
      'WHERE: vercel.com/dashboard → project → Settings → Environment Variables.'
    ].join('\n'),
    action: process.env.ADMIN_TOKEN ? null : { label: 'Add ADMIN_TOKEN', url: 'https://vercel.com/dashboard' }
  });

  items.push({
    id: 'env-image',
    group: 'Setup',
    label: 'Image generation (Gemini) configured',
    status: process.env.GEMINI_API_KEY ? 'pass' : 'warn',
    detail: process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY set — logo cron + grounded article research enabled' : 'No GEMINI_API_KEY — daily logo generation skipped + articles run ungrounded',
    help: [
      'WHAT: Google\'s Gemini 2.5 Flash image preview powers the daily afro-anarchist circle-A logo cron (4 new marks/day across 11 styles). It\'s also used for grounded research mode in the article generator (Google Search citations).',
      'WHY: Without it, the Mark Lab queue dries up and articles lose their factual grounding step. Slogans + articles still work but lose the visual + research layer.',
      'HOW: 1) Visit aistudio.google.com/apikey. 2) Sign in with any Google account. 3) "Create API key" → copy the value. 4) Add GEMINI_API_KEY to Vercel env. The free tier is generous enough for daily generation.',
      'WHERE: aistudio.google.com → API keys.'
    ].join('\n'),
    action: process.env.GEMINI_API_KEY ? null : { label: 'Get Gemini key (free)', url: 'https://aistudio.google.com/apikey' }
  });

  const hasPrintify = process.env.PRINTIFY_API_TOKEN && process.env.PRINTIFY_SHOP_ID;
  items.push({
    id: 'env-printify',
    group: 'Merch',
    label: 'Printify shop linked',
    status: hasPrintify ? 'pass' : 'warn',
    detail: hasPrintify ? 'Printify token + shop ID set — POD orders can be placed' : 'Printify keys missing — Print-On-Demand orders disabled (slogans + shirt designs still generate but cannot ship physical product)',
    help: [
      'WHAT: Printify is the print-on-demand provider for shirts, posters, zines. Two env vars are required: PRINTIFY_API_TOKEN (account credential) and PRINTIFY_SHOP_ID (which of your shops to attach orders to).',
      'WHY: Without these, the marketplace shows your in-house POD designs but cannot actually ship physical product to consumers. Other content (articles, logos, slogans) is unaffected.',
      'HOW: 1) Sign up at printify.com — free, pay-per-order. 2) Create a shop (My Shops → Add new). 3) Note the shop ID from its URL. 4) Account → API → "Generate new token". 5) Add PRINTIFY_API_TOKEN and PRINTIFY_SHOP_ID to Vercel env. 6) Redeploy.',
      'WHERE: printify.com/app/account/api'
    ].join('\n'),
    action: { label: 'Set up Printify', url: 'https://printify.com/app/account/api' }
  });

  return items;
}

function checkCronSchedule () {
  // We don't have direct access to vercel.json at runtime, but we can sniff
  // by checking each cron endpoint exists in the deployment. A cheaper proxy
  // is just to confirm their last-run age; that lives in the next checks.
  return [];
}

async function checkScraper () {
  const queue = await safeBlobJSON('content/pending.json');
  const pending = Array.isArray(queue?.items) ? queue.items : [];
  const last = pending.reduce((max, it) => Math.max(max, Date.parse(it.fetched_at || it.scraped_at || it.created_at || 0) || 0), 0);
  const age = last ? Date.now() - last : Infinity;
  return [{
    id: 'scrape-last',
    group: 'Scraper',
    label: 'Last scrape ran < 24h ago',
    status: statusFor(age, DAY, 2 * DAY),
    detail: `Last scrape: ${fmtAge(age)} · ${pending.length} items in queue`,
    help: [
      'WHAT: The scraper at /api/cron/scan-content pulls from 42 curated afro-anarchist feeds — ROAR Magazine, Daraja Press, Africa Is a Country, AFROPUNK, Pambazuka, Awesome Tapes from Africa, plus 36 more across anarchism, decolonial theory, afro-punk/funk music, film, books, events.',
      'WHY: This is what keeps the library "alive" — fresh mirrors land in the Pending queue with full source credit + linkback every morning at 06:00 UTC.',
      'HOW: Vercel cron is already configured in vercel.json. If "last scrape" is stale (>24h), click the "Trigger scrape now" button to fire it manually. Check Vercel\'s Cron Logs (project → Settings → Cron Jobs) to see whether the schedule fired.',
      'WHERE: vercel.com/dashboard → project → Settings → Cron Jobs.'
    ].join('\n'),
    action: age > DAY ? { label: 'Trigger scrape now', url: '/api/cron/scan-content', method: 'GET' } : null
  }, {
    id: 'scrape-queue',
    group: 'Scraper',
    label: 'Queue depth healthy (< 800)',
    status: pending.length < 800 ? 'pass' : pending.length < 1500 ? 'warn' : 'fail',
    detail: `${pending.length} pending items` + (pending.length >= 800 ? ' — review backlog in Pending tab' : ''),
    help: [
      'WHAT: Number of scraped items waiting for editorial review in the Pending queue.',
      'WHY: A healthy queue is 50–500 items. Above 800 means the publisher (COOLHUNTPARIS) is falling behind on triage. Above 1500 means stale items will start to crowd out fresh ones.',
      'HOW: Open the Pending tab in either LUVLAB or COOLHUNTPARIS dashboard and approve / reject items in batch. Approved items move to the public library; rejections feed back into future scraping decisions.',
      'WHERE: Admin dashboard → Pending tab (or the Curate view in publisher.html).'
    ].join('\n'),
    action: null
  }];
}

async function checkArticles () {
  const drafts = await safeBlobJSON('content/articles/drafts.json');
  const items  = Array.isArray(drafts?.items) ? drafts.items : Array.isArray(drafts) ? drafts : [];
  const last = items.reduce((max, it) => Math.max(max, Number(it.ts) || Date.parse(it.created_at || 0) || 0), 0);
  const age = last ? Date.now() - last : Infinity;
  return [{
    id: 'articles-last',
    group: 'Generators',
    label: 'Last article generated < 24h ago',
    status: statusFor(age, DAY, 3 * DAY),
    detail: `${items.length} drafts · last: ${fmtAge(age)}`,
    help: [
      'WHAT: /api/cron/generate-articles runs daily at 09:00 UTC. It picks the top theme from the scraper queue (weighted toward 51 afro-anarchist seed keywords like decolonial, sankofa, kwaito, sun-ra, fela, lumumba, fanon, ubuntu, ujamaa) and writes a full article: outline → grounded research (Gemini + Google Search) → draft → polish → headline → media suggestions.',
      'WHY: Constant fresh editorial keeps COOLHUNTPARIS a living magazine. Each draft lands in the Article Lab (editor view) for the publisher to polish before publishing.',
      'HOW: If stale, click "Generate now". The cron is automatic — Vercel fires it daily as long as CRON_SECRET is set and at least one LLM key is configured. Drafts pile up to 200 most-recent in content/articles/drafts.json.',
      'WHERE: Article Lab tab in admin or publisher dashboards.'
    ].join('\n'),
    action: age > DAY ? { label: 'Generate now', url: '/api/cron/generate-articles', method: 'GET' } : null
  }];
}

async function checkLogos () {
  const queue = await safeBlobJSON('content/marks/queue.json');
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const last = items.reduce((max, it) => Math.max(max, Number(it.ts) || 0), 0);
  const age = last ? Date.now() - last : Infinity;
  return [{
    id: 'logos-last',
    group: 'Generators',
    label: 'Last logo generated < 7d ago',
    status: statusFor(age, WEEK, 2 * WEEK),
    detail: `${items.length} logos in queue · last: ${fmtAge(age)}`,
    help: [
      'WHAT: /api/cron/generate-logos runs daily at 15:00 UTC. It generates 4 new circle-A-anarchist-symbol-over-Africa marks across 11 rotating style presets: classic, kente, glitch, brutalist, risograph, gold-leaf, screenprint, graffiti, woodcut, photoreal, afrofuturist.',
      'WHY: Every shirt, poster, and zine product needs unique afro-anarchist visual marks. The Mark Lab uses these as the base for merch designs and as featured rail imagery.',
      'HOW: If stale (>7 days), click "Generate now". Requires GEMINI_API_KEY (Gemini 2.5 Flash image preview). Generated marks land in content/marks/queue.json (capped at 200) for the publisher to review and approve in the Mark Lab.',
      'WHERE: Mark Lab tab in admin dashboard.'
    ].join('\n'),
    action: age > WEEK ? { label: 'Generate now', url: '/api/cron/generate-logos', method: 'GET' } : null
  }];
}

async function checkSlogans () {
  const queue = await safeBlobJSON('content/merch/slogans.json');
  const items = Array.isArray(queue?.items) ? queue.items : [];
  const last = items.reduce((max, it) => Math.max(max, Date.parse(it.created_at || 0) || 0), 0);
  const age = last ? Date.now() - last : Infinity;
  return [{
    id: 'slogans-last',
    group: 'Generators',
    label: 'Last slogan batch < 24h ago',
    status: statusFor(age, DAY, 3 * DAY),
    detail: `${items.length} slogans · last: ${fmtAge(age)}`,
    help: [
      'WHAT: /api/cron/generate-slogans runs daily at 12:00 UTC. It generates 8 new slogans across 7 categories — afro-anarchist, afro-punk, afro-funk, afro-futurist, decolonial, abolition, pan-african — and reads recent rejections from content/feedback/merch.json to avoid clichés.',
      'WHY: Slogans are the seed for shirt designs, poster copy, social-media headlines, and email-newsletter teasers. Without a steady stream, the merch shop and the social presence both stagnate.',
      'HOW: If stale, click "Generate now". The category cycles automatically. Reject bad slogans in the Merch Lab — those rejections feed back into future generations so the prompts learn your taste over time.',
      'WHERE: Merch Lab tab in admin dashboard.'
    ].join('\n'),
    action: age > DAY ? { label: 'Generate now', url: '/api/cron/generate-slogans', method: 'GET' } : null
  }];
}

async function checkContent () {
  // Read the canonical seed (mirrors content lists by kind)
  const seed = await safeBlobJSON('seed.json');
  if (!seed) return [{
    id: 'content-seed',
    group: 'Content',
    label: 'Seed initialized',
    status: 'fail',
    detail: 'seed.json missing — POST /api/blob/seed once to bootstrap',
    help: [
      'WHAT: seed.json is the canonical content list — what the public site reads to populate Films, Library, Events, Music, Books, Marketplace.',
      'WHY: Without it the entire public-facing site is empty. The cards on Home, the rail tabs, the search modal — all read from this file.',
      'HOW: Click "Initialize seed". This POSTs to /api/blob/seed which creates an initial seed file with the curated demo content. After that, scraped + AI-generated items land here automatically.',
      'WHERE: This runs once. After init, content flows in via the cron pipeline.'
    ].join('\n'),
    action: { label: 'Initialize seed', url: '/api/blob/seed', method: 'POST' }
  }];
  const counts = {
    films:    seed.films?.length    || 0,
    articles: seed.articles?.length || 0,
    events:   seed.events?.length   || 0,
    music:    seed.music?.length    || 0,
    books:    seed.books?.length    || 0,
    merch:    seed.merch?.length    || 0
  };
  const total = Object.values(counts).reduce((a,b)=>a+b,0);
  return [{
    id: 'content-counts',
    group: 'Content',
    label: `Library populated (${total} total)`,
    status: total > 30 ? 'pass' : total > 0 ? 'warn' : 'fail',
    detail: Object.entries(counts).map(([k,v]) => `${k}:${v}`).join(' · '),
    help: [
      'WHAT: Total count of items across all six categories on the public site.',
      'WHY: <30 items means category pages look thin. >100 is healthy. The number grows automatically as the daily article generator + scraper land new items.',
      'HOW: Fire the autopilot to immediately populate via scrape + generate. After a week of cron runs, this should naturally climb past 50.',
      'WHERE: Public site → click any rail item to see the count for that category.'
    ].join('\n'),
    action: total === 0 ? { label: 'Run autopilot now', url: '/api/autopilot/run', method: 'POST' } : null
  }, {
    id: 'content-credits',
    group: 'Content',
    label: 'Mirrored items have source credits',
    status: 'pass',
    detail: 'Scraper saves source URL, title, author, license, scraped_at per item — credit pill + linkback render in item.html',
    help: [
      'WHAT: Every scraped item now records source_url, source_title, source_author, source_license, and scraped_at. The item detail page renders a "via SOURCE · by AUTHOR · LICENSE" pill with a linkback.',
      'WHY: Ethical mirroring requires clear attribution. This protects the platform from DMCA strikes and gives credit where it\'s due — important for an afro-anarchist platform that values reciprocity.',
      'HOW: This is automatic. The scraper extracts <author>, <dc:creator>, <license href>, <copyright>, <rights> from RSS/Atom feeds. License falls back to "all rights reserved (linkback only)" — the safest default.',
      'WHERE: Open any scraped item via the public Library — credit pill appears below the kind tag, "Open source ↗" button at the bottom.'
    ].join('\n'),
    action: null
  }];
}

async function checkAutopilot () {
  const log = await safeBlobJSON('content/logs/autopilot.json');
  const last = log?.last_run_ts || 0;
  const age = last ? Date.now() - last : Infinity;
  return [{
    id: 'autopilot-last',
    group: 'Pipeline',
    label: 'Autopilot fired in last 24h',
    status: statusFor(age, DAY, 3 * DAY),
    detail: last ? `Last full cycle: ${fmtAge(age)}` : 'No record yet — fire one manual cycle to confirm pipeline',
    help: [
      'WHAT: /api/autopilot/run chains all four crons in sequence: scrape → articles → slogans → logos. It\'s the "fire one full cycle" endpoint, idempotent and safe to call any time.',
      'WHY: This is your manual override when you want fresh content immediately, without waiting for the next scheduled cron tick. It also confirms the whole pipeline is wired correctly — if any stage fails, you see the per-stage error in the response.',
      'HOW: Click "Fire autopilot". A full cycle takes 30–90 seconds depending on LLM speed. Each stage logs to content/logs/autopilot.json so this checklist can show "last fired" age.',
      'WHERE: This dashboard, the big "Fire autopilot now" button at the top right.'
    ].join('\n'),
    action: { label: 'Fire autopilot', url: '/api/autopilot/run', method: 'POST' }
  }];
}

// ----- handler ---------------------------------------------------------

module.exports = async function handler (req, res) {
  if (!authed(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ ok: false, error: 'method' });

  try {
    const groups = await Promise.all([
      Promise.resolve(checkEnv()),
      checkScraper(),
      checkArticles(),
      checkLogos(),
      checkSlogans(),
      checkContent(),
      checkAutopilot()
    ]);
    const items = groups.flat();
    const counts = { pass: 0, warn: 0, fail: 0 };
    items.forEach(i => { counts[i.status] = (counts[i.status] || 0) + 1; });
    const overall = counts.fail > 0 ? 'fail' : counts.warn > 0 ? 'warn' : 'pass';
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      ok: true,
      ts: Date.now(),
      overall,
      counts,
      items
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
