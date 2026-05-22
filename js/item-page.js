/* ANARCHISM.AFRICA — full-page item view at /item.html?type=<kind>&id=<id>
 *
 * Reads everything live via AA.loadSeed() (Vercel Blob overlay on top of
 * the bundled fixture). Renders title, hero, full body for articles + books,
 * external links, related items by shared tags/themes/people. Includes the
 * wishlist heart (auto-attached by js/wishlist.js).
 */
(function () {
  const KIND_TO_KEY = { film:'films', article:'articles', event:'events', song:'music', book:'books', merch:'merch', grant:'grants' };
  const KIND_LABEL  = { film:'Film',  article:'Article', event:'Event',  song:'Song',  book:'Book',  merch:'Item', grant:'Grant' };

  const param = n => new URLSearchParams(location.search).get(n);
  const escapeHTML = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

  function notFound (main, msg) {
    main.innerHTML = `
      <div class="panel" style="padding:30px 28px">
        <h1 style="margin:0 0 6px">Not found</h1>
        <p style="color:var(--fg-dim);margin:0 0 14px">${escapeHTML(msg)}</p>
        <p><a class="btn primary" href="index.html">Back to home</a></p>
      </div>`;
  }

  function detailLines (type, it) {
    const out = [];
    if (it.author)       out.push(['Author', it.author]);
    if (it.director)     out.push(['Director', it.director]);
    if (it.artist)       out.push(['Artist', it.artist]);
    if (it.year)         out.push(['Year', it.year]);
    if (it.publisher)    out.push(['Publisher', it.publisher]);
    if (it.duration)     out.push([type === 'song' ? 'Duration' : 'Runtime', formatDuration(it.duration, type)]);
    if (it.pages)        out.push(['Pages', it.pages]);
    if (it.language)     out.push(['Language', it.language]);
    if (it.starts_at)    out.push(['When', new Date(it.starts_at).toLocaleString()]);
    if (it.venue)        out.push(['Venue', it.venue]);
    if (it.city)         out.push(['City', it.city + (it.country ? ', ' + it.country : '')]);
    if (it.category)     out.push(['Category', it.category]);
    if (it.reading_time) out.push(['Reading', it.reading_time + ' min']);
    if (it.funder)       out.push(['Funder', it.funder]);
    if (it.amount)       out.push(['Amount', it.amount]);
    if (it.deadline)     out.push(['Deadline', it.deadline]);
    if (it.region)       out.push(['Region', it.region]);
    if (it.price_eur)    out.push(['Price', '€' + it.price_eur]);
    return out;
  }
  function formatDuration (d, type) {
    if (typeof d !== 'number') return d;
    if (type === 'song') return Math.floor(d/60) + ':' + String(d%60).padStart(2,'0');
    return d + ' min';
  }
  function formatBody (body) {
    return body.split(/\n\s*\n/).map(p => {
      const html = escapeHTML(p)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, l, u) => /^https?:|^mailto:/.test(u) ? `<a href="${escapeHTML(u)}" target="_blank" rel="noopener">${escapeHTML(l)}</a>` : escapeHTML(l))
        .replace(/\n/g, '<br>');
      return `<p>${html}</p>`;
    }).join('');
  }

  function fmtDate (it) {
    // published_at (ISO) → "12 May 2026"  |  scraped_at fallback  |  year only
    const raw = it.published_at || it.scraped_at || it.created_at;
    if (raw) {
      try {
        return new Date(raw).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      } catch {}
    }
    return it.year ? String(it.year) : '';
  }

  function render (main, type, it, seed) {
    const label = KIND_LABEL[type] || type;
    const ext = (it.external_url || it.url || '').trim();
    const safeExt = /^https?:\/\//i.test(ext) ? ext : '';
    const details = detailLines(type, it);
    const dateStr = fmtDate(it);

    main.innerHTML = `
      <article class="item-page" data-wish-id="${escapeHTML(it.id)}" data-wish-type="${escapeHTML(type)}">
        <div class="item-meta-row">
          <div class="item-meta-pill mono">${escapeHTML(label.toUpperCase())}${it.year ? ' · ' + it.year : ''}${it.category ? ' · ' + escapeHTML(it.category) : ''}</div>
          ${dateStr ? `<time class="item-date-badge mono" datetime="${escapeHTML(it.published_at || it.year || '')}">${escapeHTML(dateStr)}</time>` : ''}
        </div>
        ${renderCredit(it)}
        ${renderItemHero(it, type)}
        <h1 class="item-title">${escapeHTML(it.title || '')}</h1>
        ${it.deck ? `<p class="item-lede">${escapeHTML(it.deck)}</p>` : ''}
        ${it.summary ? `<p class="item-lede">${escapeHTML(it.summary)}</p>` : ''}
        ${details.length ? `
          <dl class="item-details">
            ${details.map(([k, v]) => `<div><dt>${escapeHTML(k)}</dt><dd>${escapeHTML(v)}</dd></div>`).join('')}
          </dl>` : ''}
        ${renderHero(it)}
        ${renderPullQuote(it, 0)}
        ${it.body ? `<div class="item-body">${formatBody(it.body)}</div>` : ''}
        ${renderStats(it)}
        ${renderEmbeds(it)}
        ${renderGallery(it)}
        ${renderPullQuote(it, 1)}
        ${renderSources(it)}
        ${renderVerify(it)}
        ${type === 'song' && it.audio ? `<audio controls style="width:100%;margin-top:16px" src="${escapeHTML(it.audio)}"></audio>` : ''}
        ${type === 'film' && it.embed ? `<video controls style="width:100%;border-radius:12px;margin-top:16px" src="${escapeHTML(it.embed)}"></video>` : ''}
        <div class="item-actions">
          ${safeExt ? `<a class="btn primary" href="${safeExt}" target="_blank" rel="noopener">Open source ↗</a>` : ''}
          ${type === 'event' ? `<button class="btn primary" onclick="window.AA_LIVE.rsvp('${escapeHTML(it.id)}', this)">RSVP</button>
                                <button class="btn ghost" onclick="window.AA_LIVE.calendar('${escapeHTML(it.id)}')">Add to calendar</button>` : ''}
          ${type === 'merch' ? `<button class="btn primary" onclick="window.AA_LIVE.buy('${escapeHTML(it.id)}', this)">Order</button>` : ''}
          <button class="btn ghost" id="item-share">Copy share link</button>
          <a class="btn ghost" href="index.html#${escapeHTML(KIND_TO_KEY[type] || type)}">Back to ${escapeHTML(KIND_TO_KEY[type] || type)}</a>
        </div>
        <section id="item-related" class="item-related"></section>
      </article>`;
    // Populate related items asynchronously so the main article paints first
    renderRelated(type, it, seed).catch(() => {});

    document.getElementById('item-share')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        const b = document.getElementById('item-share');
        const old = b.textContent; b.textContent = 'Copied ✓';
        setTimeout(() => { b.textContent = old; }, 1400);
      } catch {}
    });

    // YouTube hero: click play → swap thumbnail for embedded player
    const ytHero = main.querySelector('.item-hero--yt');
    if (ytHero) {
      ytHero.addEventListener('click', function () {
        const id = this.dataset.yt;
        if (!id) return;
        this.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:none"></iframe>`;
        this.style.backgroundImage = 'none';
        this.style.cursor = 'default';
        this.classList.add('is-playing');
      });
    }

    renderRelated(type, it, seed);
  }

  // ----- hero cascade: image → yt thumbnail → text fallback ----------------
  function renderItemHero (it, type) {
    // 1. Real image supplied (from seed or DB)
    if (it.image) {
      return `<div class="item-hero" style="background-image:url('${escapeHTML(it.image)}')"></div>`;
    }
    // 2. YouTube embed → use thumbnail with play-button overlay
    const ytEmbed = (it.embeds || []).find(e => e && e.url && /youtube\.com|youtu\.be/.test(e.url));
    if (ytEmbed) {
      const ytId = (ytEmbed.url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/) || [])[1];
      if (ytId) {
        const thumb = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        return `<div class="item-hero item-hero--yt" data-yt="${escapeHTML(ytId)}" style="background-image:url('${thumb}')">
          <button class="item-hero-play-btn" aria-label="Play trailer">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="rgba(0,0,0,0.65)"/><polygon points="10,8 18,12 10,16" fill="white"/></svg>
          </button>
        </div>`;
      }
    }
    // 3. Text / gradient fallback — never show a blank black box
    const sub = [it.director, it.artist, it.author, it.year].filter(Boolean).join(' · ');
    return `<div class="item-hero item-hero--text">
      <div class="item-hero-eyebrow mono">${escapeHTML((type || 'item').toUpperCase())}</div>
      <div class="item-hero-wordmark">${escapeHTML(it.title || '')}</div>
      ${sub ? `<div class="item-hero-sub mono">${escapeHTML(sub)}</div>` : ''}
    </div>`;
  }

  function renderRelated (type, it, seed) {
    const host = document.getElementById('item-related'); if (!host) return;
    const tags = new Set([...(it.tags || []), ...(it.themes || [])]);
    const authorish = it.author || it.director || it.artist;
    const sameAuthor = [], sharedTagged = [];
    for (const [k, kind] of Object.entries({ films:'film', articles:'article', books:'book', music:'song', events:'event', merch:'merch', grants:'grant' })) {
      for (const x of (seed[k] || [])) {
        if (x.id === it.id && kind === type) continue;
        if (authorish && [x.author, x.director, x.artist].includes(authorish)) sameAuthor.push({ x, kind });
        else if (tags.size && (x.tags || x.themes || []).some(t => tags.has(t))) sharedTagged.push({ x, kind });
      }
    }
    const top = [...sameAuthor.slice(0, 4), ...sharedTagged.slice(0, 8 - Math.min(4, sameAuthor.length))].slice(0, 8);
    if (!top.length) {
      host.innerHTML = `<h2>Connected on the mindmap</h2>
        <p style="color:var(--muted)">No direct cross-references yet. <a href="index.html#mindmap" style="color:var(--accent)">Open the full mindmap →</a></p>`;
      return;
    }
    host.innerHTML = `
      <h2>Connected</h2>
      <div class="item-related-grid">
        ${top.map(({ x, kind }) => `
          <a class="item-related-card" href="item.html?type=${kind}&id=${encodeURIComponent(x.id)}">
            ${x.image ? `<div class="item-related-thumb" style="background-image:url('${escapeHTML(x.image)}')"></div>` : '<div class="item-related-thumb"></div>'}
            <div class="item-related-body">
              <div class="mono" style="font-size:.65rem;color:var(--muted);letter-spacing:.14em">${(KIND_LABEL[kind]||kind).toUpperCase()}</div>
              <h3>${escapeHTML(x.title || x.id)}</h3>
              <p>${escapeHTML((x.summary||'').slice(0, 90))}${(x.summary||'').length>90?'…':''}</p>
            </div>
          </a>`).join('')}
      </div>`;
  }

  async function load () {
    const type = (param('type') || '').toLowerCase();
    const id   = param('id') || '';
    const main = document.getElementById('item-main');
    if (!type || !id) return notFound(main, 'Missing ?type and ?id in the URL.');

    try {
      const seed = await window.AA.loadSeed();
      const list = seed[KIND_TO_KEY[type] || type] || [];
      const item = list.find(x => x.id === id);
      if (!item) return notFound(main, `No ${KIND_LABEL[type] || type} with id "${id}" in the live database yet.`);
      render(main, type, item, seed);
      document.title = `${item.title} — ANARCHISM.AFRICA`;
      const desc = item.summary || (item.body && item.body.slice(0, 160));
      if (desc) document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
      if (item.image) {
        document.querySelector('meta[property="og:image"]')?.setAttribute('content', item.image);
        document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', item.image);
      }
      document.querySelector('meta[property="og:title"]')?.setAttribute('content', item.title);
    } catch (e) {
      notFound(main, 'Could not reach the live database: ' + e.message);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();


  // ----- enriched article media renderers ---------------------------------
  function renderHero (it) {
    const h = it.hero_image;
    if (!h) return '';
    const url = h.url || h.src || '';
    const q   = h.query || h.alt || '';
    if (url) return `<figure class="item-rich-hero"><img src="${escapeHTML(url)}" alt="${escapeHTML(h.alt || '')}"/>${h.caption ? `<figcaption>${escapeHTML(h.caption)}</figcaption>` : ''}</figure>`;
    if (q)   return `<div class="item-rich-hero placeholder mono"><span>HERO IMAGE</span><small>${escapeHTML(q)}</small></div>`;
    return '';
  }
  function renderPullQuote (it, idx) {
    const q = (it.pull_quotes || [])[idx];
    if (!q) return '';
    return `<blockquote class="item-pullquote">${escapeHTML(q)}</blockquote>`;
  }
  function renderStats (it) {
    const stats = (it.stats || []).filter(s => s && (s.label || s.value));
    if (!stats.length) return '';
    const max = Math.max(1, ...stats.map(s => Number(String(s.value).replace(/[^\d.\-]/g, '')) || 0));
    return `<section class="item-stats">
      <h3 class="item-section-h">By the numbers</h3>
      <div class="item-stats-grid">
        ${stats.map(s => {
          const num = Number(String(s.value).replace(/[^\d.\-]/g, '')) || 0;
          const pct = max > 0 ? Math.round(num / max * 100) : 0;
          return `<div class="item-stat">
            <div class="item-stat-num">${escapeHTML(String(s.value))}<span>${escapeHTML(s.unit || '')}</span></div>
            <div class="item-stat-label">${escapeHTML(s.label || '')}</div>
            <div class="item-stat-bar"><i style="width:${pct}%"></i></div>
            ${s.source ? `<div class="item-stat-src mono">${escapeHTML(s.source)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </section>`;
  }
  function renderEmbeds (it) {
    const embeds = (it.embeds || []).filter(e => e);
    if (!embeds.length) return '';
    return `<section class="item-embeds">
      <h3 class="item-section-h">Watch &amp; listen</h3>
      ${embeds.map(e => {
        if (e.url && /youtube\.com|youtu\.be/.test(e.url)) {
          const id = (e.url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/) || [])[1];
          if (id) return `<div class="item-embed video"><iframe src="https://www.youtube.com/embed/${id}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
        }
        if (e.url && /vimeo\.com/.test(e.url)) {
          const id = (e.url.match(/vimeo\.com\/(\d+)/) || [])[1];
          if (id) return `<div class="item-embed video"><iframe src="https://player.vimeo.com/video/${id}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe></div>`;
        }
        if (e.url) return `<div class="item-embed"><a href="${escapeHTML(e.url)}" target="_blank" rel="noopener" class="btn ghost">Open ${escapeHTML(e.platform || 'link')} ↗</a><span class="mono">${escapeHTML(e.why || '')}</span></div>`;
        // suggestion-only (no URL yet)
        return `<div class="item-embed placeholder mono"><b>${escapeHTML((e.kind || 'video').toUpperCase())}</b> · ${escapeHTML(e.platform || '')} · "${escapeHTML(e.search_query || '')}"<small>${escapeHTML(e.why || '')}</small></div>`;
      }).join('')}
    </section>`;
  }
  function renderGallery (it) {
    const g = (it.gallery || []).filter(x => x);
    if (!g.length) return '';
    return `<section class="item-gallery">
      <h3 class="item-section-h">Gallery</h3>
      <div class="item-gallery-grid">
        ${g.map(x => x.url
          ? `<figure><img src="${escapeHTML(x.url)}" alt="${escapeHTML(x.alt || '')}"/>${x.caption ? `<figcaption>${escapeHTML(x.caption)}</figcaption>` : ''}</figure>`
          : `<figure class="placeholder mono"><span>${escapeHTML(x.query || '')}</span><small>${escapeHTML(x.caption || x.alt || '')}</small></figure>`
        ).join('')}
      </div>
    </section>`;
  }
  function renderSources (it) {
    const src = (it.sources || []).filter(s => s && s.uri);
    if (!src.length) return '';
    return `<section class="item-sources">
      <h3 class="item-section-h">Sources</h3>
      <ol class="item-sources-list">
        ${src.map(s => `<li><a href="${escapeHTML(s.uri)}" target="_blank" rel="noopener">${escapeHTML(s.title || s.uri)}</a></li>`).join('')}
      </ol>
    </section>`;
  }
  function renderVerify (it) {
    const v = (it.verify || []).filter(Boolean);
    if (!v.length) return '';
    return `<aside class="item-verify"><h4>Editor: verify before publishing</h4><ul>${v.map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ul></aside>`;
  }

  /* Mirror credit — every scraped item carries the source it was mirrored
     from. We surface a source chip with favicon logo, linkback, author,
     and license so attribution is unmistakable. */
  function renderCredit (it) {
    const url = it.source_url || it.url || it.external_url || '';
    if (!url || !/^https?:\/\//i.test(url)) return '';
    const source  = it.source || '';
    const author  = it.source_author || '';
    const license = it.source_license || '';
    let domain = '';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    const display = source || domain || 'source';
    const logo = it.source_logo || (domain ? `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}` : '');
    const logoHtml = logo
      ? `<img src="${escapeHTML(logo)}" alt="" width="16" height="16" loading="lazy" style="border-radius:3px;vertical-align:middle;flex-shrink:0" onerror="this.style.display='none'">`
      : '';
    const parts = [];
    parts.push(`via ${logoHtml}<a href="${escapeHTML(url)}" target="_blank" rel="noopener nofollow">${escapeHTML(display)}</a>`);
    if (author)  parts.push('by ' + escapeHTML(author));
    if (license && license !== 'all rights reserved (linkback only)') parts.push(escapeHTML(license));
    return `<p class="item-credit mono" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">${parts.join(' · ')}</p>`;
  }

  /* Related content — pull a few items of the same kind from the seed
     and render a small grid below the article. Tag overlap (or simple
     same-kind randomness) is enough for now; AI-curated suggestions can
     replace this later. */
  async function renderRelated (type, it, seed) {
    const host = document.getElementById('item-related');
    if (!host || !seed) return;
    const buckets = { film: 'films', article: 'articles', event: 'events', song: 'music', book: 'books', merch: 'merch' };
    const list = seed[buckets[type] || type] || [];
    const tags = new Set((it.tags || []).map(t => String(t).toLowerCase()));
    function score (other) {
      if (other.id === it.id) return -1;
      const ot = (other.tags || []).map(t => String(t).toLowerCase());
      const overlap = ot.filter(t => tags.has(t)).length;
      return overlap * 10 + Math.random();
    }
    const picks = list.slice().sort((a,b) => score(b) - score(a)).slice(0, 6);
    if (!picks.length) return;
    host.innerHTML = `
      <h3 class="item-section-h">More from the library</h3>
      <div class="grid item-related-grid">
        ${picks.map(p => `
          <a class="card" href="item.html?type=${encodeURIComponent(type)}&id=${encodeURIComponent(p.id)}">
            ${p.image ? `<div class="cover" style="background-image:url('${escapeHTML(p.image)}')"></div>` : ''}
            <div class="meta">
              <h3>${escapeHTML(p.title || p.name || '')}</h3>
              <p class="lead">${escapeHTML((p.summary || p.deck || '').slice(0, 120))}</p>
            </div>
          </a>`).join('')}
      </div>`;
  }
})();
