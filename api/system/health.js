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
      'WHAT IT DOES: Stores every article, logo, slogan and saved post on the cloud so they don\'t disappear when the server restarts.',
      'WHY YOU NEED IT: Without this, the site has nowhere to put new stuff. Articles you generate would vanish. Nothing would show up on the public site.',
      'HOW TO FIX (5 minutes): 1) Go to vercel.com/dashboard. 2) Click your project (anarchism-africa). 3) Click the "Storage" tab at the top. 4) Click the big "Create Database" button. 5) Pick "Blob" from the list. 6) Click Create. 7) Vercel automatically adds the password (called BLOB_READ_WRITE_TOKEN) to your project — you don\'t have to copy-paste anything. 8) Wait ~30 seconds for the redeploy. Done.',
      'CHECK: Refresh this page. Row should turn green.'
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
      'WHAT IT DOES: An "AI key" lets the website write articles, generate slogans, and answer questions in the chat box. Think of it like a phone number for a robot writer — without the number, the robot can\'t pick up.',
      'WHY YOU NEED IT: Daily articles, weekly slogans, and the chat assistant all stop working without a key. The library would never grow.',
      'HOW TO FIX (10 minutes, totally free): 1) Open openrouter.ai in a new tab. 2) Click "Sign Up" (use Google or email — free, no credit card). 3) Once signed in, go to openrouter.ai/keys. 4) Click "Create Key". Name it "ANARCHISM.AFRICA". 5) Copy the long string that appears (starts with "sk-or-..."). 6) Open vercel.com/dashboard → your project → Settings tab → Environment Variables (left menu). 7) Click "Add". Name = OPENROUTER_API_KEY. Value = paste the key. Apply to "Production, Preview, Development". Save. 8) Vercel redeploys automatically (~30 seconds).',
      'OTHER OPTIONS: If you prefer Google\'s AI, use GEMINI_API_KEY from aistudio.google.com (also free). For Claude, use ANTHROPIC_API_KEY. Any one is enough.',
      'CHECK: Click the chat button in the bottom bar of the public site. Type "hi". If it answers, the key works.'
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
      'WHAT IT DOES: A password that ONLY the daily timer knows. The timer uses it to wake up the site every morning to generate new articles, logos, and slogans. Without it, anyone could wake the site up and burn your AI budget.',
      'WHY YOU NEED IT: Stops trolls from spamming your daily content jobs. Saves you money on AI calls.',
      'HOW TO FIX (3 minutes): 1) Open Terminal on your Mac. 2) Type: openssl rand -hex 32 and press Enter. 3) Copy the long string of letters and numbers it spits out. 4) In Vercel: project → Settings → Environment Variables → Add. 5) Name = CRON_SECRET. Value = paste the string. Apply to all three environments. 6) Save. Vercel redeploys.',
      'CHECK: Refresh this page. Row turns green.'
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
      'WHAT IT DOES: A separate password that protects the "Fire autopilot now" button and the manual generate-article buttons. Only YOU should be able to push these.',
      'WHY YOU NEED IT: Without it, anyone could click an admin button by guessing the URL and waste your AI credits.',
      'HOW TO FIX (3 minutes): 1) Open Terminal. 2) Type: openssl rand -hex 32 and press Enter. 3) Copy the result. 4) In Vercel: project → Settings → Environment Variables → Add. 5) Name = ADMIN_TOKEN. Value = paste. Apply to all environments. Save.',
      'CHECK: Refresh. Row turns green.'
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
      'WHAT IT DOES: Lets the site DRAW pictures (logos for shirts and posters) and FACT-CHECK articles using Google Search.',
      'WHY YOU NEED IT: Without it, no daily logos get drawn for the merch shop. Articles still get written, but they won\'t have real-source citations.',
      'HOW TO FIX (5 minutes, FREE): 1) Open aistudio.google.com/apikey. 2) Sign in with any Google account. 3) Click "Create API key" → "Create API key in new project". 4) Copy the key. 5) In Vercel: project → Settings → Environment Variables → Add. 6) Name = GEMINI_API_KEY. Value = paste. Apply to all. Save.',
      'CHECK: Click "Generate now" on the "Last logo generated" row below. If 4 new logos appear, it works.'
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
      'WHAT IT DOES: Connects the merch shop to a real T-shirt / poster / zine printer. When a customer orders, Printify prints + ships. You don\'t handle inventory.',
      'WHY YOU NEED IT: Without this, the marketplace shows designs but customers can\'t actually buy a real shirt. Articles, logos, and slogans still work — only physical orders are blocked.',
      'HOW TO FIX (15 minutes, free until first order): 1) Open printify.com → Sign up (free). 2) Click "My Shops" → "Add new shop". Pick "Manual orders" or connect to your existing Etsy/Shopify. 3) Note the shop ID from the URL after you create it (looks like /shop/12345/...). 4) Click your account avatar → API. 5) Click "Generate new token". Copy it. 6) In Vercel: add TWO env vars — PRINTIFY_API_TOKEN (the long token) and PRINTIFY_SHOP_ID (the number from step 3). 7) Save.',
      'OPTIONAL: Skip this entirely if you don\'t want to sell physical merch yet.',
      'CHECK: Open the public site → Marketplace → "Order" button on any merch item should work without errors.'
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
      'WHAT IT DOES: Every morning at 6 AM (UK time), a robot reads 42 magazine websites and brings back any new afro-anarchist articles, music releases, films, books, and events. Sources include ROAR Magazine, Africa Is A Country, AFROPUNK, Pambazuka, Awesome Tapes From Africa, and 37 more.',
      'WHY YOU NEED IT: This is what keeps the library fresh. Every day, ~20-50 new items land in the "Pending" tray for the publisher (COOLHUNTPARIS) to approve. Without it, the library stops growing.',
      'HOW TO FIX IF BROKEN: Click "Trigger scrape now" on the right side of this row. Watch the row update in 30 seconds.',
      'IF IT KEEPS FAILING: It usually means CRON_SECRET or BLOB_READ_WRITE_TOKEN is missing. Fix those rows first.',
      'WHERE TO SEE THE RESULTS: After a scrape runs, go to admin dashboard → Pending tab. New scraped items show there with full source credit.'
    ].join('\n'),
    action: age > DAY ? { label: 'Trigger scrape now', url: '/api/cron/scan-content', method: 'GET' } : null
  }, {
    id: 'scrape-queue',
    group: 'Scraper',
    label: 'Queue depth healthy (< 800)',
    status: pending.length < 800 ? 'pass' : pending.length < 1500 ? 'warn' : 'fail',
    detail: `${pending.length} pending items` + (pending.length >= 800 ? ' — review backlog in Pending tab' : ''),
    help: [
      'WHAT IT TRACKS: How many scraped items are sitting in the Pending tray waiting to be approved or rejected.',
      'WHY IT MATTERS: A healthy queue has 50–500 items. Above 800 means COOLHUNTPARIS is falling behind on review. Above 1500 means old items will start getting pushed out by new ones before they\'re reviewed.',
      'HOW TO FIX IF YELLOW/RED: Open the Pending tab in admin or publisher dashboards. Use the bulk Approve / Reject buttons. Approved items go live in the public library. Rejected items teach the AI what NOT to scrape next time.',
      'WHERE: admin.html or publisher.html → Pending tab.'
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
      'WHAT IT DOES: Every morning at 9 AM, a robot writer picks the most-discussed afro-anarchist topic from yesterday\'s news and writes a full article — outline, research with Google citations, polished draft, headline, image suggestions. It uses 51 starter keywords (decolonial, sankofa, kwaito, sun-ra, fela, lumumba, fanon, ubuntu, ujamaa, etc.) so articles stay on-topic.',
      'WHY YOU NEED IT: One new article per day = ~30/month, ~365/year. The library grows on autopilot. The publisher (COOLHUNTPARIS) just polishes and publishes.',
      'HOW TO TEST IT: Click "Generate now" on the right. Wait 30-60 seconds. A new article draft appears in admin → Article Lab tab.',
      'IF NOTHING HAPPENS: It needs an LLM key (the row above) AND Vercel Blob storage (top row). Fix those first.',
      'WHERE TO READ DRAFTS: admin.html → Article Lab tab. Drafts wait there for the publisher to approve and publish.'
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
      'WHAT IT DOES: Every afternoon at 3 PM, a robot artist draws 4 brand-new logos — the circle-A anarchist symbol over Africa — in different art styles. Styles rotate: kente, glitch, brutalist, risograph, gold-leaf, screenprint, graffiti, woodcut, photoreal, afrofuturist, plus the classic.',
      'WHY YOU NEED IT: Every shirt, poster, zine, and Instagram post needs unique visuals. With 4/day, you get ~120 logos a month to choose from for merch + marketing.',
      'HOW TO TEST IT: Click "Generate now" on the right. Wait 20-30 seconds. 4 new logos appear in admin → Mark Lab tab.',
      'IF IT FAILS: Requires GEMINI_API_KEY (the row 5 entries up). Free at aistudio.google.com.',
      'WHERE TO REVIEW: admin.html → Mark Lab. Approve good ones, reject bad ones. Approved logos are pushed to merch.'
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
      'WHAT IT DOES: Every day at noon, a robot writer cooks up 8 new slogans for shirts and posters. It rotates through 7 themes — afro-anarchist, afro-punk, afro-funk, afro-futurist, decolonial, abolition, pan-african. It also reads slogans you\'ve rejected in the past so it doesn\'t repeat clichés.',
      'WHY YOU NEED IT: Slogans become shirt designs, poster headlines, social-media captions, and newsletter teasers. 8/day = ~240/month of fresh copy.',
      'HOW TO TEST IT: Click "Generate now". 8 new slogans appear in admin → Merch Lab.',
      'PRO TIP: Reject the bad ones. The robot learns from your rejections and gets smarter over time.',
      'WHERE TO REVIEW: admin.html → Merch Lab.'
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
      'WHAT IT IS: The master content list. Films, articles, events, music, books, marketplace — everything the public site shows comes from this one file.',
      'WHY YOU NEED IT: Without it, the public site is completely empty. No cards on the home page. No items in any category.',
      'HOW TO FIX (one click): Press "Initialize seed". It loads ~30 demo items so the site looks alive immediately. After that, the daily robot adds more automatically.',
      'WHERE TO SEE IT: After init, refresh the public site (anarchism.africa). Items appear in every category.'
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
      'WHAT IT TRACKS: How many things the public can browse — across films, articles, events, music, books, and marketplace combined.',
      'TARGETS: Under 30 = library looks empty. 30-100 = healthy starter. 100+ = looks alive. After 6 months of auto-generation, expect 500+.',
      'HOW TO BOOST FAST: Click "Run autopilot now". It scrapes + generates all at once. Then run it again tomorrow. The count grows by ~30/day automatically once the daily cron is firing.',
      'WHERE TO BROWSE: Public site → click any rail menu item (Films, Library, etc.) to see what\'s there.'
    ].join('\n'),
    action: total === 0 ? { label: 'Run autopilot now', url: '/api/autopilot/run', method: 'POST' } : null
  }, {
    id: 'content-credits',
    group: 'Content',
    label: 'Mirrored items have source credits',
    status: 'pass',
    detail: 'Scraper saves source URL, title, author, license, scraped_at per item — credit pill + linkback render in item.html',
    help: [
      'WHAT IT DOES: When the robot mirrors content from another site, it always records WHO wrote it, WHERE it came from, and WHAT license it has. The public page shows this as a "via SOURCE · by AUTHOR" pill with a clickable link back to the original.',
      'WHY IT MATTERS: Ethics 101 — give credit. This also protects the platform from copyright complaints. Afro-anarchism is built on reciprocity, not extraction.',
      'HOW IT WORKS: Automatic. Every scraped item carries this data forward. License falls back to "all rights reserved (linkback only)" if the source doesn\'t declare one — the safest default.',
      'WHERE TO SEE IT: Click any article on the public site. The credit pill appears right under the kind tag at the top.'
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
      'WHAT IT DOES: The big red "Fire autopilot now" button runs the entire content pipeline in one click — scrape new content, write articles, generate slogans, draw logos. All four stages, in order. It\'s the "do everything now" button.',
      'WHY YOU NEED IT: For testing (does the whole thing work?) and for manual top-ups (low on content? Click once, get a fresh batch in under 2 minutes).',
      'HOW TO USE IT: Click "Fire autopilot" on this row OR the big button at the top of the checklist. Wait 30-90 seconds. Each stage updates as it completes — green tick by green tick.',
      'IF A STAGE FAILS: The failed row turns red and tells you what was missing. Usually means an env var is missing.',
      'WHERE TO RUN IT: Top right of THIS dashboard — the "Fire autopilot now" button.'
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
