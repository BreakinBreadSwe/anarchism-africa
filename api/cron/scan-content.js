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
  { id: 'nyege-nyege',        kind: 'event',   name: 'Nyege Nyege',             feed: 'https://nyegenyege.com/feed/',                    tags: ['festival','music','uganda','event'] },

  // ── EXPANDED SOURCES (2026) ──────────────────────────────────────────────────

  // Anarchist organisations & theory
  { id: 'zabalaza',           kind: 'article', name: 'Zabalaza (ZACF)',         feed: 'https://zabalaza.net/feed/',                      tags: ['anarchism','southafrica','liberation','zacf'] },
  { id: 'anarchist-library',  kind: 'article', name: 'The Anarchist Library',   feed: 'https://theanarchistlibrary.org/atom.xml',        tags: ['anarchism','theory','pamphlet','history'] },
  { id: 'freedom-news',       kind: 'article', name: 'Freedom News (UK)',       feed: 'https://freedomnews.org.uk/feed/',                tags: ['anarchism','uk','diaspora','autonomy'] },
  { id: 'anarchist-studies',  kind: 'article', name: 'Institute for Anarchist Studies', feed: 'https://anarchiststudies.org/feed/',      tags: ['anarchism','theory','academic'] },
  { id: 'the-ex-worker',      kind: 'article', name: 'CrimethInc. Ex-Worker',   feed: 'https://crimethinc.com/podcast.rss',             tags: ['anarchism','autonomy','podcast'] },

  // Africa-focused journalism & analysis
  { id: 'african-arguments',  kind: 'article', name: 'African Arguments',       feed: 'https://africanarguments.org/feed/',              tags: ['africa','politics','analysis','panafrican'] },
  { id: 'the-africa-report',  kind: 'article', name: 'The Africa Report',       feed: 'https://www.theafricareport.com/feed/',           tags: ['africa','economy','politics'] },
  { id: 'mada-masr',          kind: 'article', name: 'Mada Masr (Egypt)',       feed: 'https://www.madamasr.com/en/feed/',               tags: ['egypt','northafrica','decolonial','journalism'] },
  { id: 'aljazeera-africa',   kind: 'article', name: 'Al Jazeera Africa',       feed: 'https://www.aljazeera.com/xml/rss/all.xml',       tags: ['africa','journalism','panafrican'] },
  { id: 'mailandguardian',    kind: 'article', name: 'Mail & Guardian',         feed: 'https://mg.co.za/feed/',                          tags: ['southafrica','politics','labor','decolonial'] },
  { id: 'sacsis',             kind: 'article', name: 'SACSIS',                  feed: 'https://sacsis.org.za/site/feed/',                tags: ['southafrica','labor','commons','decolonial'] },
  { id: 'the-elephant',       kind: 'article', name: 'The Elephant (Kenya)',    feed: 'https://www.theelephant.info/feed/',              tags: ['kenya','eastafrica','politics','decolonial'] },
  { id: 'rfi-africa',         kind: 'article', name: 'RFI Africa',              feed: 'https://www.rfi.fr/en/rss/africa.xml',            tags: ['africa','radio','francophone','panafrican'] },
  { id: 'allafrica',          kind: 'article', name: 'AllAfrica',               feed: 'https://allafrica.com/tools/headlines/rdf/africa/headlines.rdf', tags: ['africa','news','panafrican'] },

  // Radical left / theory / diaspora
  { id: 'the-bullet',         kind: 'article', name: 'The Bullet (Socialist Project)', feed: 'https://socialistproject.ca/bullet/feed/', tags: ['socialism','labor','decolonial','theory'] },
  { id: 'counterpunch',       kind: 'article', name: 'CounterPunch',            feed: 'https://www.counterpunch.org/feed/',              tags: ['radical','leftist','usa','diaspora'] },
  { id: 'jacobin',            kind: 'article', name: 'Jacobin',                 feed: 'https://jacobin.com/feed/',                       tags: ['socialism','labor','theory','decolonial'] },
  { id: 'redpepper',          kind: 'article', name: 'Red Pepper',              feed: 'https://www.redpepper.org.uk/feed/',              tags: ['leftist','ecology','commons','diaspora'] },
  { id: 'monthly-review',     kind: 'article', name: 'Monthly Review',          feed: 'https://monthlyreview.org/feed/',                 tags: ['marxism','decolonial','theory','ecology'] },

  // Black studies / afrofuturism / culture
  { id: 'the-funambulist',    kind: 'article', name: 'The Funambulist',         feed: 'https://thefunambulist.net/feed',                 tags: ['decolonial','space','architecture','blackness'] },
  { id: 'aaihs',              kind: 'article', name: 'AAIHS Black Perspectives', feed: 'https://www.aaihs.org/feed/',                    tags: ['blackstudies','history','diaspora','academia'] },
  { id: 'transition-mag',     kind: 'article', name: 'Transition Magazine',     feed: 'https://transitionmagazine.org/feed/',            tags: ['africa','literature','culture','panafrican'] },
  { id: 'africasacountry-pod',kind: 'article', name: 'Africa Is a Country Podcast', feed: 'https://africasacountry.com/podcast/feed/', tags: ['africa','podcast','decolonial','panafrican'] },

  // Liberation texts & pamphlets (RSS from publisher blogs)
  { id: 'daraja-news',        kind: 'article', name: 'Daraja Press (news)',     feed: 'https://darajapress.com/category/news/feed/',     tags: ['anarchism','panafrican','decolonial'] },
  { id: 'spectre-journal',    kind: 'article', name: 'Spectre Journal',         feed: 'https://spectrejournal.com/feed/',                tags: ['marxism','decolonial','theory','abolition'] },
  { id: 'africa-is-country-essays', kind: 'article', name: 'AiaC Essays',      feed: 'https://africasacountry.com/category/essays/feed/', tags: ['africa','decolonial','essay','panafrican'] },
];

export default async function handler (req, res) {
  // Optional Cron secret check (Vercel sets x-vercel-cron-signature; the env
  // CRON_SECRET can be required from the public POST path)
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret && !req.headers['x-vercel-cron-signature']) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const origin = process.env.SITE_URL || `https://${req.headers.host || 'anarchism.africa'}`;
  const summary = { scanned: 0, queued: 0, deduped: 0, rejected_404: 0, og_scraped: 0, errors: [], ogScrapeCount: 0, sources_skipped_deadline: 0 };

  // HARD deadline so the function returns before Vercel kills it. Hobby caps
  // at 10s, Pro at 60s — 50s leaves headroom for the final JSON response
  // serialisation. Without this, ~55 sources × 5-10s each blows the budget
  // every run and the function never logs ANY scrape (the symptom the
  // health checker reads as "Last scrape: never"). Dedupe makes re-runs
  // cheap so a deadline-truncated run is safe to retry hourly.
  const deadline = Date.now() + 50_000;

  for (const src of SOURCES) {
    if (Date.now() > deadline) { summary.sources_skipped_deadline++; continue; }
    try {
      const xml = await fetchText(src.feed);
      // Per-source slice raised 6 → 15. The 50s deadline budget still
      // truncates correctly — fewer sources per run but each one gets
      // deeper coverage. Dedupe + hourly cadence makes wide vs deep
      // a wash over a day.
      const items = parseFeed(xml).slice(0, 15);
      summary.scanned += items.length;
      for (const it of items) {
        if (Date.now() > deadline) break;
        // VALIDATE the link before queueing. Many feeds publish a slug
        // before the article goes live, or the publisher 410s old posts.
        // We do a HEAD request, follow redirects, and only queue items
        // that resolve to a 2xx final URL.
        const verified = await verifyUrl(it.link);
        if (!verified.ok) {
          summary.rejected_404 += 1;
          continue;
        }
        const finalUrl = verified.finalUrl || it.link;

            // Grab image: feed-inline first, then OG scrape from the article page.
        // Cap at 30 OG scrapes per run to stay within cron timeout budget;
        // most feeds include inline images so real cap is typically <10.
        let image = it.image || null;
        if (!image && summary.ogScrapeCount < 30) {
          image = await scrapeOgImage(finalUrl);
          summary.ogScrapeCount = (summary.ogScrapeCount || 0) + 1;
          if (image) summary.og_scraped++;
        }

        // Source domain — used for the favicon logo URL
        const srcDomain = (() => { try { return new URL(src.feed).hostname.replace(/^www\./, ''); } catch { return ''; } })();
        const source_logo = srcDomain ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(srcDomain)}` : '';

        const payload = {
          kind:           src.kind,
          title:          it.title,
          summary:        cleanText(it.summary).slice(0, 600),
          url:            finalUrl,
          image:          image || null,
          // Mirror credit fields — every scraped item retains a path back
          // to its original source, so item.html can render a "via" credit
          // and a clear linkback. License falls back to the source's known
          // license when the feed entry doesn't declare one.
          source:         src.name,
          source_id:      src.id,
          source_url:     finalUrl,
          source_logo,
          source_title:   it.title,
          source_author:  it.author || src.author || '',
          source_license: it.license || src.license || 'all rights reserved (linkback only)',
          scraped_at:     new Date().toISOString(),
          tags:           src.tags || [],
          published_at:   it.date ? new Date(it.date).toISOString() : new Date().toISOString(),
          submitted_by:   'scraper:' + src.id
        };
        const r = await fetch(`${origin}/api/content/queue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret || '' },
          body: JSON.stringify({ action: 'enqueue', item: payload })
        });
        const j = await r.json().catch(() => ({}));
        // Surface queue failures explicitly. Previous code silently dropped
        // items when the queue POST returned anything other than ok/deduped,
        // which is exactly how 'scanned: 18, queued: 0' happened — schema
        // mismatch / 500s were invisible.
        if (j.deduped) summary.deduped += 1;
        else if (j.ok) summary.queued += 1;
        else summary.errors.push({ src: src.id, item_title: it.title, status: r.status, err: j.error || j.message || 'unknown queue error' });
      }
    } catch (e) {
      summary.errors.push({ src: src.id, error: String(e.message || e) });
    }
  }

  return res.status(200).json({ ok: true, ts: Date.now(), ...summary });
}

/* Cheap URL liveness check — HEAD with 5s timeout, follow up to 5 redirects.
   Falls back to GET on servers that 405 HEAD (some CDN-fronted sites do).
   Returns { ok: true, finalUrl } if 2xx, or { ok: false, status, finalUrl }. */
async function verifyUrl (url) {
  if (!url || !/^https?:\/\//i.test(url)) return { ok: false, status: 0 };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    let r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal,
      headers: { 'User-Agent': 'ANARCHISM.AFRICA/1.0 (+url verifier)' } });
    if (r.status === 405 || r.status === 501) {
      r = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal,
        headers: { 'User-Agent': 'ANARCHISM.AFRICA/1.0 (+url verifier)' } });
    }
    clearTimeout(t);
    return { ok: r.ok, status: r.status, finalUrl: r.url || url };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, status: 0, error: String(e.message || e) };
  }
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
    // Author: <author><name>...</name></author> (Atom) or <dc:creator> /
    // <author> (RSS). Fall through any of the variants we see in the wild.
    const author  = pick(m, /<author[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/) ||
                    pick(m, /<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/) ||
                    pick(m, /<author[^>]*>([\s\S]*?)<\/author>/);
    // License: <license href="..."/> (Atom) or <copyright> (RSS) or
    // <dc:rights>. Many feeds publish under Creative Commons; capture it.
    const license = (m.match(/<license[^>]*href="([^"]+)"/) || [, ''])[1] ||
                    pick(m, /<dc:rights[^>]*>([\s\S]*?)<\/dc:rights>/) ||
                    pick(m, /<copyright[^>]*>([\s\S]*?)<\/copyright>/) ||
                    pick(m, /<rights[^>]*>([\s\S]*?)<\/rights>/);
    // Image: media:content url, media:thumbnail url, enclosure url, itunes:image href.
    // These are the three most common feed-inline image patterns.
    const image = (m.match(/<media:content[^>]*url="([^"]+)"/) ||
                   m.match(/<media:thumbnail[^>]*url="([^"]+)"/) ||
                   m.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/) ||
                   m.match(/<itunes:image[^>]*href="([^"]+)"/) || [, ''])[1] || '';
    if (title && link) out.push({
      title:   cleanText(title),
      link:    cleanText(link),
      summary,
      date,
      author:  cleanText(author),
      license: cleanText(license),
      image:   image || ''
    });
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

/* Scrape the og:image / twitter:image meta tag from an article page.
   Hard-capped at a 5-second fetch so a slow publisher can't block the run.
   Returns the absolute URL string or null. */
async function scrapeOgImage (url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'ANARCHISM.AFRICA/1.0 (+thumbnail scraper)' }
    });
    clearTimeout(t);
    if (!r.ok) return null;
    // Only read the first 64 KB — the <head> is always in there.
    const buf  = await r.arrayBuffer();
    const text = new TextDecoder().decode(buf.slice(0, 65536));
    // Priority: og:image → twitter:image → first large <img src>
    const og  = text.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (og && og[1]) return toAbsolute(og[1].trim(), url);
    const tw  = text.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    if (tw && tw[1]) return toAbsolute(tw[1].trim(), url);
    return null;
  } catch {
    clearTimeout(t);
    return null;
  }
}

function toAbsolute (src, base) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  try {
    return new URL(src, base).href;
  } catch {
    return null;
  }
}
