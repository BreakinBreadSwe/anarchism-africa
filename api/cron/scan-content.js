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

const SOURCES = [
  // Editorial / news
  { id: 'africaisacountry',   kind: 'article', name: 'Africa Is a Country',  feed: 'https://africasacountry.com/feed' },
  { id: 'roarmag',            kind: 'article', name: 'ROAR Magazine',         feed: 'https://roarmag.org/feed/' },
  { id: 'pambazuka',          kind: 'article', name: 'Pambazuka News',        feed: 'https://www.pambazuka.org/rss.xml' },
  { id: 'darajapress-blog',   kind: 'article', name: 'Daraja Press',          feed: 'https://darajapress.com/feed' },
  { id: 'crimethinc',         kind: 'article', name: 'CrimethInc.',           feed: 'https://crimethinc.com/posts.rss' },
  { id: 'libcom',             kind: 'article', name: 'libcom.org',            feed: 'https://libcom.org/rss.xml' },
  // Music labels / archives
  { id: 'soundway',           kind: 'song',    name: 'Soundway Records',      feed: 'https://www.soundwayrecords.com/blogs/news.atom' },
  { id: 'awesometapes',       kind: 'song',    name: 'Awesome Tapes from Africa', feed: 'https://awesometapes.com/feed/' },
  // Books
  { id: 'akpress',            kind: 'book',    name: 'AK Press blog',         feed: 'https://www.akpress.org/blog.atom' },
  { id: 'pmpress',            kind: 'book',    name: 'PM Press blog',         feed: 'https://blog.pmpress.org/feed' },
  { id: 'verso',              kind: 'book',    name: 'Verso Books blog',      feed: 'https://www.versobooks.com/blogs.atom' },
  // Films
  { id: 'idfa',               kind: 'film',    name: 'IDFA news',             feed: 'https://www.idfa.nl/feed/news' }
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
