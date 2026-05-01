// Vercel Cron — daily article generator.
//
// Reads the latest approved scraper items + the pending queue, picks an
// emerging "trend" theme (most-tagged keyword across recent items), then
// runs the Article Lab pipeline (outline → notes → draft → polish →
// headlines) and queues the result as a *draft* in content/articles/drafts.json
// for the editor to review before publishing. Never auto-publishes.
//
// Runs daily 09:00 UTC (vercel.json). Idempotent — if the same trend
// produced an article in the last 7 days it skips.
//
// GET /api/cron/generate-articles
//   resp: { ok, theme, articleId, status }

import { put } from '@vercel/blob';

const PUBLIC_BLOB_BASE = 'https://blob.vercel-storage.com';
const DRAFTS_KEY = 'content/articles/drafts.json';
const PENDING_KEY = 'content/pending.json';
const ARTICLES_KEY = 'content/articles.json';

const STOPWORDS = new Set(['the','a','and','or','of','in','on','to','for','with','from','that','this','it','as','by','an','is','are','was','were','be','been','being','at','have','has','had','will','would','can','could','should','may','might','also','more','most','some','any','all','one','two','about','into','out','up','down','over','under','between']);

async function readJSON (key, fallback) {
  try { const r = await fetch(`${PUBLIC_BLOB_BASE}/${key}?ts=${Date.now()}`); if (!r.ok) return fallback; return await r.json(); }
  catch { return fallback; }
}
async function writeJSON (key, value) {
  return put(key, JSON.stringify(value), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
}

// Curated afro-anarchist semantic seed - boosted in the trend frequency
// table so subgenre coverage stays broad even when the news cycle drifts.
const SEED_BOOST = [
  // Anarchism / liberation theory
  'anarchism','autonomy','mutual','commons','abolition','liberation','revolution',
  'fanon','sankara','rodney','mbah','biko','cabral','garvey','nkrumah','lumumba',
  // Africa / panafrican / decolonial
  'africa','panafrican','decolonial','colonial','diaspora','blackness','futurism',
  'sahel','swahili','yoruba','igbo','zulu','kongo','amazigh','tigray',
  // Music subgenres - explicit high boost
  'afropunk','afrofunk','afrobeat','afrobeats','highlife','soukous','juju',
  'kwaito','amapiano','gqom','singeli','etiojazz','dub','reggae','calypso',
  // Diaspora / portraits / culture
  'portrait','diaspora','queer','feminism','panther','windrush','harlem',
  'brixton','marseille','salvador','kingston','accra','lagos','nairobi',
  // Visual / film / literature
  'cinema','documentary','novel','poetry','collage','mural','graffiti',
  // Movements
  'rhodesmustfall','feesmustfall','endsars','blacklivesmatter','kemetic',
  'rastafari','panther','zapatista'
];

function topTheme (items, recentDrafts) {
  const freq = {};
  for (const it of items || []) {
    const blob = `${it.title || ''} ${it.summary || ''} ${(it.tags || []).join(' ')}`.toLowerCase();
    for (const w of blob.match(/[a-z]{4,}/g) || []) {
      if (STOPWORDS.has(w)) continue;
      freq[w] = (freq[w] || 0) + 1;
    }
    // Tags carry editorial weight - count them double.
    for (const t of it.tags || []) {
      const k = String(t).toLowerCase();
      if (k && !STOPWORDS.has(k)) freq[k] = (freq[k] || 0) + 2;
    }
  }
  // 2x boost for curated seed - keeps subgenre coverage alive
  for (const k of SEED_BOOST) if (freq[k]) freq[k] *= 2.0;

  // Penalize themes we already covered in the past 14 days so coverage rotates
  const usedRecently = new Set(
    (recentDrafts || []).filter(d => Date.now() - d.ts < 14 * 86400000).map(d => d.theme)
  );
  for (const k of usedRecently) if (freq[k]) freq[k] *= 0.25;

  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : null;
}

export default async function handler (req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret && !req.headers['x-vercel-cron-signature']) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const origin = process.env.SITE_URL || `https://${req.headers.host || 'anarchism.africa'}`;

  try {
    const pending = (await readJSON(PENDING_KEY, { items: [] })).items || [];
    const articles = (await readJSON(ARTICLES_KEY, { items: [] })).items || [];
    const recentItems = [...pending, ...articles].slice(0, 80);
    const drafts = (await readJSON(DRAFTS_KEY, { items: [] })).items || [];
    const theme = topTheme(recentItems, drafts);
    if (!theme) return res.status(200).json({ ok: true, skipped: 'no theme found' });

    // Skip if we already wrote about this theme in the past 7 days
    const recentSame = drafts.find(d => (d.theme === theme) && (Date.now() - d.ts) < 7 * 86400000);
    if (recentSame) return res.status(200).json({ ok: true, skipped: 'theme covered recently', theme });

    // Step 1: outline
    const briefRes = await fetch(`${origin}/api/ai/article`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'outline', payload: { topic: theme, length: 1200, audience: 'general afro-anarchist reader' } })
    });
    const briefData = await briefRes.json();
    if (!briefRes.ok || !briefData.outline) {
      return res.status(200).json({ ok: false, theme, step: 'outline', error: briefData.error || 'no outline' });
    }
    const outline = briefData.outline;

    // Step 2: notes for each section
    const notesBySection = {};
    for (const sec of (outline.sections || []).slice(0, 4)) {
      const r = await fetch(`${origin}/api/ai/article`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'research', payload: { topic: theme, sectionHeading: sec.heading, beats: sec.beats || [] } })
      });
      const d = await r.json();
      notesBySection[sec.heading] = d.notes || '';
    }
    const notes = Object.entries(notesBySection).map(([k, v]) => `## ${k}\n${v}`).join('\n\n');

    // Step 3: draft
    const draftRes = await fetch(`${origin}/api/ai/article`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'draft', payload: { outline, notes } })
    });
    const draftData = await draftRes.json();
    const draft = draftData.draft || '';

    // Step 4: polish + headlines (parallel)
    const [polishedRes, headlineRes] = await Promise.all([
      fetch(`${origin}/api/ai/article`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: 'polish', payload: { draft } }) }),
      fetch(`${origin}/api/ai/article`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: 'headline', payload: { draft } }) })
    ]);
    const polished = (await polishedRes.json()).polished || draft;
    const headlines = await headlineRes.json();

    const articleId = 'autoart_' + Date.now().toString(36);
    const entry = {
      id: articleId,
      ts: Date.now(),
      theme,
      title: headlines?.titles?.[0] || outline.title || theme,
      deck: headlines?.deck || '',
      blurb: headlines?.blurb || outline.hook || '',
      body: polished,
      outline,
      headlines,
      author: 'AA · auto-draft',
      status: 'pending_editor_review'
    };
    drafts.unshift(entry);
    await writeJSON(DRAFTS_KEY, { items: drafts.slice(0, 200), updated: Date.now() });

    return res.status(200).json({ ok: true, theme, articleId, status: 'queued for editor review' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
