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

// Article generator now writes to Supabase (content table, status='pending').
// Old blob keys are no longer read or written. The Article Lab editor reads
// from /api/content/list?status=pending&kind=article for the publisher to
// review and approve. Approved drafts get status='published' and show on
// the public site immediately.
const sb = require('../../lib/supabase');

const STOPWORDS = new Set(['the','a','and','or','of','in','on','to','for','with','from','that','this','it','as','by','an','is','are','was','were','be','been','being','at','have','has','had','will','would','can','could','should','may','might','also','more','most','some','any','all','one','two','about','into','out','up','down','over','under','between']);

// (Blob helpers removed — we read recent items from Supabase content_queue
// + content tables now.)

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

  if (!sb.configured()) return res.status(500).json({ ok: false, error: 'SUPABASE not configured' });

  try {
    // Read source signal: recent scraped items (queue) + recent published content
    const queue   = await sb.select('content_queue', { order: '-scraped_at', limit: 60 });
    const recent  = await sb.select('content',       { order: '-created_at', limit: 30 });
    const recentItems = [...(queue || []), ...(recent || [])];

    // Recent drafts: existing pending or published articles in the last 14 days,
    // mapped to a {theme, ts} shape so topTheme() can penalize repeats.
    const recentArticles = await sb.select('content', {
      eq: { kind: 'article' },
      order: '-created_at',
      limit: 60
    });
    const drafts = (recentArticles || []).map(a => ({
      theme: (a.tags && a.tags[0]) || (a.title || '').toLowerCase().split(' ')[0],
      ts: Date.parse(a.created_at) || 0
    }));

    const theme = topTheme(recentItems, drafts);
    if (!theme) return res.status(200).json({ ok: true, skipped: 'no theme found' });

    // Skip if we already wrote about this theme in the past 7 days
    const recentSame = drafts.find(d => (d.theme === theme) && (Date.now() - d.ts) < 7 * 86400000);
    if (recentSame) return res.status(200).json({ ok: true, skipped: 'theme covered recently', theme });

    // Single compose call - end-to-end article (outline -> grounded research
    // -> draft -> polish -> headlines -> media). Returns the full structured
    // article record ready to render on item.html with text + images + embeds
    // + pull-quotes + stats + sources.
    const composeRes = await fetch(`${origin}/api/ai/article`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'compose',
        payload: {
          topic: theme,
          length: 1500,
          audience: 'general afro-anarchist reader',
          grounded: true        // uses NOTEBOOKLM_API_KEY / GEMINI_API_KEY when set
        }
      })
    });
    const composeData = await composeRes.json();
    if (!composeRes.ok || !composeData.article) {
      return res.status(200).json({ ok: false, theme, step: 'compose', error: composeData.error || 'compose failed' });
    }
    const article = composeData.article;

    // Insert into content table as a pending draft. The publisher reviews
    // it in Article Lab and can flip status to 'published' to ship it.
    const inserted = await sb.insert('content', {
      kind:           'article',
      status:         'pending',
      title:          article.title || ('Draft on ' + theme),
      subtitle:       article.subtitle || null,
      deck:           article.deck || null,
      summary:        article.blurb || article.summary || null,
      body:           article.body || null,
      tags:           Array.isArray(article.tags) ? article.tags : [theme],
      image:          article.hero_image || null,
      gallery:        article.gallery || [],
      embeds:         article.embeds || [],
      pull_quotes:    article.pull_quotes || [],
      stats:          article.stats || [],
      sources_cited:  article.sources || [],
      verify_notes:   article.verify || [],
      author:         'AA · auto-draft',
      reading_time:   Math.max(1, Math.round((article.body || '').split(/\s+/).length / 220)),
      published_at:   null,
      created_by:     'cron:generate-articles'
    });
    const row = Array.isArray(inserted) ? inserted[0] : inserted;

    return res.status(200).json({
      ok: true,
      theme,
      articleId: row?.id,
      title: row?.title,
      grounded: !!article.grounded,
      sources: (article.sources || []).length,
      sections: (article.body || '').split(/^##\s/m).length - 1,
      status: 'queued for editor review (Supabase content.status=pending)'
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
