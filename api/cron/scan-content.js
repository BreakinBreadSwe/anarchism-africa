// Vercel Cron handler — daily scan of afro-anarchist sources.
//
// Configure in vercel.json:
//   "crons": [{ "path": "/api/cron/scan-content", "schedule": "0 */6 * * *" }]
// (Every 6 hours by default — Vercel Hobby tier allows daily.)
//
// What it does:
//   1. Fetches a curated list of RSS feeds + JSON endpoints from afro-anarchist /
//      decolonial / pan-African publishers.
//   2. Parses titles, summaries, links, dates, classifies into kinds.
//   3. POSTs each new item to /api/content/queue with action=enqueue
//      (the queue endpoint dedupes by url+title).
//   4. Returns a summary of what was added.
//
// Sources are intentionally a small curated list — quality over quantity. The
// publisher reviews everything before it goes public. Adding sources is a
// code-edit (kept here, transparently) rather than admin-UI config so the
// editorial line is visible in the repo.
//
// All sources listed here publish openly accessible content. We respect
// robots.txt and rate-limit ourselves to one request per source per run.

// Curated source list - quality over quantity. Adding a source is a
// code edit (visible in repo) rather than admin-UI config so the
// editorial line stays transparent. Tags drive the topic engine bias
// in generate-articles.js.
const SOURCES = [
  // Editorial / pan-African / decolonial / anarchist news
  { id: 'africaisacountry',   kind: 'article', name: 'Africa Is a Country',     feed: 'https://africasacountry.com/feed',                tags: ['africa','decolonial','panafrican'] },
  { id: 'roarmag',            kind: 'article', name: 'ROAR Magazine',           feed: 'https://roarmag.org/feed/',                       tags: ['anarchism','revolution','autonomy'] },
  { id: 'pambazuka',          kind: 'article', name: 'Pambazuka News',          feed: 'https://www.pambazuka.org/rss.xml',               tags: ['panafrican','liberation','africa'] },
  { id: 'darajapress-blog',   kind: 'article', name: 'Daraja Press',            feed: 'https://darajapress.com/feed',                    tags: ['anarchism','panafrican','decolonial'] },
  { id: 'crimethinc',         kind: 'article', name: 'CrimethInc.',             feed: 'https://crimethinc.com/posts.rss',                tags: ['anarchism','autonomy','direct-action'] },
  { id: 'libcom',             kind: 'article', name: 'libcom.org',              feed: 'https://libcom.org/rss.xml',                      tags: ['anarchism','labor','history'] },
  { id: 'okayafrica',         kind: 'article', name: 'OkayAfrica',              feed: 'https://www.okayafrica.com/rss/',                 tags: ['africa','culture','diaspora','portrait'] },
  { id: 'newframe',           kind: 'article', name: 'New Frame',               feed: 'https://www.newframe.com/feed/',                  tags: ['southafrica','labor','decolonial'] },
  { id: 'thecontinent',       kind: 'article', name: 'The Continent',           feed: 'https://www.thecontinent.org/feed.xml',           tags: ['africa','journalism','panafrican'] },
  { id: 'blackagendareport',  kind: 'article', name: 'Black Agenda Report',     feed: 'https://blackagendareport.com/rss.xml',           tags: ['diaspora','blackness','politics'] },
  { id: 'autonomies',         kind: 'article', name: 'Autonomies',              feed: 'https://autonomies.org/feed/',                    tags: ['anarchism','autonomy','commons'] },
  { id: 'enough-is-enough',   kind: 'article', name: 'Enough 14',               feed: 'https://enoughisenough14.org/feed/',              tags: ['anarchism','antifa','autonomy'] },
  // Diaspora portraits / culture / afro-punk / afro-funk
  { id: 'afropunk',           kind: 'article', name: 'AFROPUNK',                feed: 'https://afropunk.com/feed/',                      tags: ['afropunk','portrait','music','culture'] },
  { id: 'thefader',           kind: 'article', name: 'The FADER',               feed: 'https://www.thefader.com/feeds/all',              tags: ['music','portrait','afrofunk','afropunk'] },
  { id: 'pitchfork',          kind: 'article', name: 'Pitchfork',               feed: 'https://pitchfork.com/feed/feed-news/rss',        tags: ['music','review','afrofunk'] },
  { id: 'nts-features',       kind: 'article', name: 'NTS Radio - Features',    feed: 'https://www.nts.live/news.rss',                   tags: ['music','radio','afrofunk','afropunk'] },
  { id: 'wax-poetics',        kind: 'article', name: 'Wax Poetics',             feed: 'https://www.waxpoetics.com/feed/',                tags: ['afrofunk','afrobeat','portrait','music'] },
  // Music labels / archives - kind=song
  { id: 'soundway',           kind: 'song',    name: 'Soundway Records',        feed: 'https://www.soundwayrecords.com/blogs/news.atom', tags: ['afrofunk','afrobeat','tropical','reissue'] },
  { id: 'awesometapes',       kind: 'song',    name: 'Awesome Tapes from Africa', feed: 'https://awesometapes.com/feed/',                tags: ['africa','tape','underground','archive'] },
  { id: 'strut-records',      kind: 'song',    name: 'Strut Records',           feed: 'https://strut-records.com/feed/',                 tags: ['afrofunk','afrobeat','jazz'] },
  { id: 'analog-africa',      kind: 'song',    name: 'Analog Africa',           feed: 'https://analogafrica.com/blogs/news.atom',        tags: ['afrofunk','afrobeat','reissue','archive'] },
  { id: 'mr-bongo',           kind: 'song',    name: 'Mr Bongo Records',        feed: 'https://www.mrbongo.com/blogs/news.atom',         tags: ['afrofunk','tropical','reissue'] },
  { id: 'habibi-funk',        kind: 'song',    name: 'Habibi Funk',             feed: 'https://habibifunk.com/feed/',                    tags: ['afrofunk','arabfunk','northafrica','archive'] },
  // Books - kind=book
  { id: 'akpress',            kind: 'book',    name: 'AK Press blog',           feed: 'https://www.akpress.org/blog.atom',               tags: ['anarchism','abolition','radical'] },
  { id: 'pmpress',            kind: 'book',    name: 'PM Press blog',           feed: 'https://blog.pmpress.org/feed',                   tags: ['anarchism','radical','abolition'] },
  { id: 'verso',              kind: 'book',    name: 'Verso Books blog',        feed: 'https://www.versobooks.com/blogs.atom',           tags: ['marxism','radical','decolonial'] },
  { id: 'duke-press',         kind: 'book',    name: 'Duke University Press',   feed: 'https://dukeupress.wordpress.com/feed/',          tags: ['academic','blackstudies','decolonial'] },
  { id: 'haymarket',          kind: 'book',    name: 'Haymarket Books',         feed: 'https://www.haymarketbooks.org/blogs.atom',       tags: ['radical','abolition','decolonial'] },
  { id: 'cassava-republic',   kind: 'book',    name: 'Cassava Republic',        feed: 'https://www.cassavarepublic.biz/feed/',           tags: ['africa','literature','panafrican'] },
  // Films / festivals / cinema - kind=film
  { id: 'idfa',               kind: 'film',    name: 'IDFA news',               feed: 'https://www.idfa.nl/feed/news',                   tags: ['documentary','festival'] },
  { id: 'fespaco',            kind: 'film',    name: 'FESPACO',                 feed: 'https://www.fespaco.org/feed/',                   tags: ['africa','film','festival','panafrican'] },
  { id: 'aff-ny',             kind: 'film',    name: 'African Film Festival',   feed: 'https://www.africanfilmny.org/feed/',             tags: ['africa','film','diaspora'] },
  { id: 'mubi-notebook',      kind: 'film',    name: 'MUBI Notebook',           feed: 'https://mubi.com/notebook/feed',                  tags: ['film','criticism','arthouse'] },
  { id: 'cinema-africa',      kind: 'film',    name: 'Cinema Africa',           feed: 'https://cinemaafrica.com/feed/',                  tags: ['africa','film','diaspora'] },
  // Events / festivals / venues - kind=event
  { id: 'sauti-za-busara',    kind: 'event',   name: 'Sauti za Busara',         feed: 'https://www.busaramusic.org/feed/',               tags: ['festival','music','africa','event'] },
  { id: 'chale-wote',         kind: 'event',   name: 'Chale Wote',              feed: 'https://chalewotefestival.org/feed/',             tags: ['art','festival','accra','event'] },
  { id: 'nyege-nyege',        kind: 'event',   name: 'Nyege Nyege',             feed: 'https://nyegenyege.com/feed/',                    tags: ['festival','music','uganda','event'] }
];

export default async function handler (req, res) {
  // Optional Cron secret check (Vercel sets x-vercel-cron-signature; the env
  // CRON_SECRET can be required from the public POST path)
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret && !req.headers['x-vercel-cron-signature']) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const origin = process.env.SITE_URL || `https://${req.headers.host || 'anarchism.africa'}`;
  const summary = { scanned: 0, queued: 0, deduped: 0, errors: [] };

  for (const src of SOURCES) {
    try {
      const xml = await fetchText(src.feed);
      const items = parseFeed(xml).slice(0, 12);
      summary.scanned += items.length;
      for (const it of items) {
        const payload = {
          kind:         src.kind,
          title:        it.title,
          summary:      cleanText(it.summary).slice(0, 600),
          url:          it.link,
          source:       src.name,
          source_id:    src.id,
          tags:         src.tags || [],
          published_at: it.date || null,
          submitted_by: 'scraper:' + src.id
        };
        const r = await fetch(`${origin}/api/content/queue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret || '' },
          body: JSON.stringify({ action: 'enqueue', item: payload })
        });
        const j = await r.json().catch(() => ({}));
        if (j.deduped) summary.deduped += 1;
        else if (j.ok) summary.queued += 1;
      }
    } catch (e) {
      summary.errors.push({ src: src.id, error: String(e.message || e) });
    }
  }

  return res.status(200).json({ ok: true, ts: Date.now(), ...summary });
}

async function fetchText (url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'ANARCHISM.AFRICA/1.0 (+content scanner)' } });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.text();
}

// Minimal RSS / Atom parser — gets us title, link, summary, date per item.
// Not bullet-proof; the queue endpoint dedupes so re-running is safe.
function parseFeed (xml) {
  const out = [];
  if (!xml) return out;
  const isAtom = xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"');
  const itemRe = isAtom ? /<entry[\s\S]*?<\/entry>/g : /<item[\s\S]*?<\/item>/g;
  for (const m of xml.match(itemRe) || []) {
    const title   = pick(m, /<title[^>]*>([\s\S]*?)<\/title>/);
    const link    = isAtom
      ? (m.match(/<link[^>]*href="([^"]+)"/) || [, ''])[1]
      : pick(m, /<link[^>]*>([\s\S]*?)<\/link>/);
    const summary = pick(m, /<description[^>]*>([\s\S]*?)<\/description>/) ||
                    pick(m, /<summary[^>]*>([\s\S]*?)<\/summary>/) ||
                    pick(m, /<content[^>]*>([\s\S]*?)<\/content>/);
    const date    = pick(m, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) ||
                    pick(m, /<published[^>]*>([\s\S]*?)<\/published>/) ||
                    pick(m, /<updated[^>]*>([\s\S]*?)<\/updated>/);
    if (title && link) out.push({ title: cleanText(title), link: cleanText(link), summary, date });
  }
  return out;
}

function pick (s, re) {
  const m = s.match(re); return m ? m[1].trim() : '';
}
function cleanText (s) {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}
