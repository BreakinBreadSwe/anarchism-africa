// Vercel Cron handler — HOURLY scrape of afro-anarchist / afrofuturist /
// alternative / diaspora EVENTS around the planet.
//
// Configure in vercel.json:
//   { "path": "/api/cron/scrape-events", "schedule": "0 * * * *" }
//
// Why hourly: events drop unpredictably (lineup announcements, ticket
// releases, last-minute pop-ups). News scrapers don't need this cadence;
// events do. The queue endpoint dedupes by url+title so re-running is
// cheap — a scan that finds nothing new just exits fast.
//
// Source taxonomy:
//   AF-* : Africa-based (continent-wide festivals, biennials, bookfairs)
//   DI-* : Diaspora (US, UK, EU, Caribbean, Brazil — afro-diasporic events)
//   AN-* : Anarchist / radical (bookfairs, mutual-aid summits, anti-state)
//   FU-* : Afrofuturist / experimental (art, sound, expanded cinema)
//
// All sources must publish an RSS or Atom feed. Many cultural orgs don't —
// those get scraped via /api/cron/scan-content's HTML scraper instead, or
// added here once they expose a feed. PRs welcome.

const SOURCES = [
  // ── AF — AFRICA (continent) ─────────────────────────────────────────────
  { id: 'sauti-za-busara',    name: 'Sauti za Busara (Zanzibar)',  feed: 'https://www.busaramusic.org/feed/',           region: 'AF', tags: ['festival','music','tanzania','zanzibar','panafrican'] },
  { id: 'chale-wote',         name: 'Chale Wote (Accra)',          feed: 'https://chalewotefestival.org/feed/',         region: 'AF', tags: ['art','festival','accra','ghana'] },
  { id: 'nyege-nyege',        name: 'Nyege Nyege (Uganda)',        feed: 'https://nyegenyege.com/feed/',                region: 'AF', tags: ['festival','music','uganda','experimental'] },
  { id: 'bushfire',           name: 'MTN Bushfire (Eswatini)',     feed: 'https://www.bush-fire.com/feed/',             region: 'AF', tags: ['festival','music','eswatini','panafrican'] },
  { id: 'fespaco',            name: 'FESPACO (Ouagadougou)',       feed: 'https://www.fespaco.org/feed/',               region: 'AF', tags: ['film','festival','burkinafaso','panafrican'] },
  { id: 'dakart',             name: "Dak'Art Biennial",            feed: 'https://biennaledakar.org/feed/',             region: 'AF', tags: ['biennial','art','senegal','panafrican'] },
  { id: 'lagosphoto',         name: 'LagosPhoto Festival',         feed: 'https://lagosphotofestival.com/feed/',        region: 'AF', tags: ['photography','lagos','nigeria','festival'] },
  { id: 'lagosbiennial',      name: 'Lagos Biennial',              feed: 'https://lagosbiennial.org/feed/',             region: 'AF', tags: ['biennial','art','lagos','nigeria'] },
  { id: 'cape-town-carnival', name: 'Cape Town Carnival',          feed: 'https://capetowncarnival.com/feed/',          region: 'AF', tags: ['carnival','festival','southafrica','capetown'] },
  { id: 'fnb-joburg-art',     name: 'FNB Art Joburg',              feed: 'https://www.fnbartjoburg.com/feed/',          region: 'AF', tags: ['art','fair','johannesburg','southafrica'] },
  { id: 'goethe-africa',      name: 'Goethe-Institut Africa',      feed: 'https://www.goethe.de/ins/za/en/index.cms?type=rss', region: 'AF', tags: ['culture','africa','panafrican','events'] },

  // ── DI — DIASPORA US ────────────────────────────────────────────────────
  { id: 'afropunk',           name: 'AFROPUNK',                    feed: 'https://afropunk.com/feed/',                  region: 'DI', tags: ['festival','afropunk','diaspora','usa','culture'] },
  { id: 'afrofuture-detroit', name: 'Afrofuture Fest (Detroit)',   feed: 'https://afrofuturefestival.com/feed/',        region: 'DI', tags: ['afrofuturist','detroit','usa','festival'] },
  { id: 'essence-fest',       name: 'ESSENCE Festival',            feed: 'https://www.essence.com/feed/',               region: 'DI', tags: ['festival','neworleans','usa','blackness','culture'] },
  { id: 'schomburg',          name: 'Schomburg Center (Harlem)',   feed: 'https://www.nypl.org/blog/feed/Schomburg',    region: 'DI', tags: ['archive','harlem','diaspora','events','academic'] },
  { id: 'mocada',             name: 'MoCADA (Brooklyn)',           feed: 'https://www.mocada.org/feed/',                region: 'DI', tags: ['art','museum','brooklyn','diaspora'] },

  // ── DI — DIASPORA UK / EUROPE ────────────────────────────────────────────
  { id: 'notting-hill',       name: 'Notting Hill Carnival',       feed: 'https://nhcarnival.org/feed/',                region: 'DI', tags: ['carnival','london','uk','caribbean','diaspora'] },
  { id: 'africa-writes',      name: 'Africa Writes (London)',      feed: 'https://www.africawrites.org/feed/',          region: 'DI', tags: ['literature','london','uk','africa','panafrican'] },
  { id: 'akaa-paris',         name: 'AKAA Paris',                  feed: 'https://www.akaafair.com/feed/',              region: 'DI', tags: ['art','fair','paris','africa','diaspora'] },
  { id: '1-54',               name: '1-54 Contemporary African Art Fair', feed: 'https://www.1-54.com/feed/',         region: 'DI', tags: ['art','fair','africa','london','newyork','marrakech'] },
  { id: 'savvy-berlin',       name: 'SAVVY Contemporary (Berlin)', feed: 'https://savvy-contemporary.com/feed/',        region: 'DI', tags: ['art','berlin','decolonial','diaspora'] },
  { id: 'iniva',              name: 'Iniva (London)',              feed: 'https://iniva.org/feed/',                     region: 'DI', tags: ['art','london','decolonial','diaspora'] },

  // ── DI — DIASPORA CARIBBEAN / BRAZIL / LATAM ────────────────────────────
  { id: 'caribana',           name: 'Caribana (Toronto)',          feed: 'https://www.thecaribbeancarnival.com/feed/',  region: 'DI', tags: ['carnival','toronto','canada','caribbean','diaspora'] },
  { id: 'sxm-festival',       name: 'SXM Festival (St Martin)',    feed: 'https://www.sxmfestival.com/feed/',           region: 'DI', tags: ['festival','caribbean','music','diaspora'] },

  // ── AN — ANARCHIST / RADICAL / MUTUAL AID ────────────────────────────────
  { id: 'london-bookfair-ana',name: 'London Anarchist Bookfair',   feed: 'https://anarchistbookfair.org.uk/feed/',      region: 'AN', tags: ['bookfair','anarchism','london','uk'] },
  { id: 'nyc-bookfair-ana',   name: 'NYC Anarchist Bookfair',      feed: 'https://anarchistbookfair.net/feed/',         region: 'AN', tags: ['bookfair','anarchism','newyork','usa'] },
  { id: 'bay-bookfair-ana',   name: 'Bay Area Anarchist Bookfair', feed: 'https://bayareaanarchistbookfair.org/feed/',  region: 'AN', tags: ['bookfair','anarchism','bayarea','usa'] },
  { id: 'akpress-events',     name: 'AK Press events',             feed: 'https://www.akpress.org/events.atom',         region: 'AN', tags: ['anarchism','radical','events','bookfair'] },
  { id: 'pmpress-events',     name: 'PM Press events',             feed: 'https://blog.pmpress.org/category/events/feed/', region: 'AN', tags: ['anarchism','radical','events'] },
  { id: 'haymarket-events',   name: 'Haymarket Books events',      feed: 'https://www.haymarketbooks.org/events.atom',  region: 'AN', tags: ['radical','events','abolition','decolonial'] },
  { id: 'enough14-events',    name: 'Enough 14 (Europe)',          feed: 'https://enoughisenough14.org/feed/',          region: 'AN', tags: ['anarchism','autonomy','europe','antifa'] },

  // ── FU — AFROFUTURIST / EXPERIMENTAL / SOUND ────────────────────────────
  { id: 'unsound',            name: 'Unsound Festival (Krakow)',   feed: 'https://www.unsound.pl/feed/',                region: 'FU', tags: ['festival','experimental','music','krakow','poland'] },
  { id: 'ctm-berlin',         name: 'CTM Festival (Berlin)',       feed: 'https://www.ctm-festival.de/feed/',           region: 'FU', tags: ['festival','experimental','music','berlin'] },
  { id: 'transmediale',       name: 'transmediale (Berlin)',       feed: 'https://transmediale.de/feed',                region: 'FU', tags: ['festival','digital','art','berlin','experimental'] },
  { id: 'mutek-montreal',     name: 'MUTEK (Montreal)',            feed: 'https://montreal.mutek.org/feed/',            region: 'FU', tags: ['festival','electronic','montreal','experimental'] },
];

export default async function handler (req, res) {
  // Optional cron secret check (Vercel sets x-vercel-cron-signature)
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret && !req.headers['x-vercel-cron-signature']) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const origin = process.env.SITE_URL || `https://${req.headers.host || 'anarchism.africa'}`;
  const summary = { scanned: 0, queued: 0, deduped: 0, rejected_404: 0, og_scraped: 0, errors: [], by_region: { AF: 0, DI: 0, AN: 0, FU: 0 } };

  // Hard time budget: don't blow past 50s on Vercel Hobby's 60s function limit.
  // Hourly cadence + dedupe means an interrupted run loses nothing.
  const deadline = Date.now() + 50_000;

  for (const src of SOURCES) {
    if (Date.now() > deadline) {
      summary.errors.push({ src: src.id, error: 'time-budget exhausted, skipped' });
      continue;
    }
    try {
      const xml = await fetchText(src.feed);
      // Event feeds tend to publish less, so we take the top 6 per source.
      const items = parseFeed(xml).slice(0, 6);
      summary.scanned += items.length;
      for (const it of items) {
        const verified = await verifyUrl(it.link);
        if (!verified.ok) { summary.rejected_404++; continue; }
        const finalUrl = verified.finalUrl || it.link;

        // OG image scrape — capped (~20 per run keeps us under budget).
        let image = it.image || null;
        if (!image && summary.og_scraped < 20) {
          image = await scrapeOgImage(finalUrl);
          if (image) summary.og_scraped++;
        }

        const srcDomain = (() => { try { return new URL(src.feed).hostname.replace(/^www\./, ''); } catch { return ''; } })();
        const source_logo = srcDomain ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(srcDomain)}` : '';

        const payload = {
          kind:           'event',
          title:          it.title,
          summary:        cleanText(it.summary).slice(0, 600),
          url:            finalUrl,
          image:          image || null,
          source:         src.name,
          source_id:      src.id,
          source_url:     finalUrl,
          source_logo,
          source_title:   it.title,
          source_author:  it.author || '',
          source_license: it.license || 'all rights reserved (linkback only)',
          region:         src.region,
          scraped_at:     new Date().toISOString(),
          tags:           src.tags || [],
          published_at:   it.date ? new Date(it.date).toISOString() : new Date().toISOString(),
          submitted_by:   'scrape-events:' + src.id
        };
        const r = await fetch(`${origin}/api/content/queue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret || '' },
          body: JSON.stringify({ action: 'enqueue', item: payload })
        });
        const j = await r.json().catch(() => ({}));
        if (j.deduped) summary.deduped++;
        else if (j.ok) { summary.queued++; summary.by_region[src.region] = (summary.by_region[src.region] || 0) + 1; }
      }
    } catch (e) {
      summary.errors.push({ src: src.id, error: String(e.message || e) });
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true, ts: Date.now(), sources: SOURCES.length, ...summary });
}

// ── Helpers (mirrored from scan-content.js; refactor to lib/feed.js when 3rd consumer lands) ──

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
  const r = await fetch(url, { headers: { 'User-Agent': 'ANARCHISM.AFRICA/1.0 (+events scanner)' } });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.text();
}

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
    const author  = pick(m, /<author[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/) ||
                    pick(m, /<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/) ||
                    pick(m, /<author[^>]*>([\s\S]*?)<\/author>/);
    const license = (m.match(/<license[^>]*href="([^"]+)"/) || [, ''])[1] ||
                    pick(m, /<dc:rights[^>]*>([\s\S]*?)<\/dc:rights>/) ||
                    pick(m, /<copyright[^>]*>([\s\S]*?)<\/copyright>/) ||
                    pick(m, /<rights[^>]*>([\s\S]*?)<\/rights>/);
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

function pick (s, re) { const m = s.match(re); return m ? m[1].trim() : ''; }
function cleanText (s) {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

async function scrapeOgImage (url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'ANARCHISM.AFRICA/1.0 (+thumbnail scraper)' } });
    clearTimeout(t);
    if (!r.ok) return null;
    const buf  = await r.arrayBuffer();
    const text = new TextDecoder().decode(buf.slice(0, 65536));
    const og  = text.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (og && og[1]) return toAbsolute(og[1].trim(), url);
    const tw  = text.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    if (tw && tw[1]) return toAbsolute(tw[1].trim(), url);
    return null;
  } catch { clearTimeout(t); return null; }
}

function toAbsolute (src, base) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  try { return new URL(src, base).href; } catch { return null; }
}
