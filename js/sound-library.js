/* ANARCHISM.AFRICA — A.A. Sound Library
 *
 * Fetches tracks from /api/sound/list (Vercel Blob manifest),
 * renders a filterable, sortable, searchable archive with inline embed players.
 *
 * No framework — vanilla JS, zero dependencies.
 */
(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────────

  const CATEGORIES = [
    { value: 'all',         label: 'All',          emoji: '🎧' },
    { value: 'music',       label: 'Music',         emoji: '🎵' },
    { value: 'radio',       label: 'Radio',         emoji: '📻' },
    { value: 'documentary', label: 'Documentary',   emoji: '🎬' },
    { value: 'mix',         label: 'Mixes',         emoji: '🎛' },
    { value: 'podcast',     label: 'Podcast',       emoji: '🎙' },
    { value: 'field',       label: 'Field',         emoji: '🌍' },
    { value: 'other',       label: 'Other',         emoji: '🔗' },
  ];

  const EMBED_ICONS = {
    soundcloud: '☁', spotify: '🟢', youtube: '▶',
    vimeo: '🎬', bandcamp: '🎸', mixcloud: '🎛', other: '🔗',
  };

  function embedHeight(type) {
    return { soundcloud: 166, spotify: 152, bandcamp: 120, mixcloud: 180 }[type] || 340;
  }

  // ── State ─────────────────────────────────────────────────────────────────────

  let allTracks  = [];
  let category   = 'all';

  // Resolve a directly-playable audio URL for a track (used to build the player queue).
  function slAudioSrc(t) {
    return t?.audio || t?.audioUrl || (t?.url?.match?.(/\.(mp3|aac|ogg|flac|m4a)(\?|$)/i) ? t.url : null);
  }
  // Map a track → the song shape the mini-player expects.
  function slToSong(t) {
    return {
      id:     t.id || t.slug || (t.title || 'track'),
      title:  t.title || 'Untitled',
      artist: t.author || t.artist || '',
      audio:  slAudioSrc(t),
      image:  t.coverImageUrl || t.image || '',
    };
  }
  let sortMode   = 'newest';
  let searchTerm = '';
  let groupByYear = false;
  let expandedId  = null;
  let randomSeed  = 0;

  // ── DOM refs ──────────────────────────────────────────────────────────────────

  const $content     = document.getElementById('sl-content');
  const $cats        = document.getElementById('sl-cats');
  const $count       = document.getElementById('sl-count');
  const $meta        = document.getElementById('sl-meta');
  const $search      = document.getElementById('sl-search');
  const $searchClear = document.getElementById('sl-search-clear');
  const $sortSel     = document.getElementById('sl-sort-select');
  const $randomBtn   = document.getElementById('sl-random-btn');
  const $yearBtn     = document.getElementById('sl-year-btn');

  // ── Fetch ─────────────────────────────────────────────────────────────────────

  async function load() {
    showSkeleton();
    try {
      const res = await fetch('/api/sound/list');
      const data = await res.json();
      allTracks = data.tracks || [];
      if ($meta) {
        const years = [...new Set(allTracks.map(t => t.year || new Date(t.publishedAt || 0).getFullYear()))].filter(Boolean);
        $meta.textContent = `${allTracks.length} recording${allTracks.length !== 1 ? 's' : ''} · ${years.length} year${years.length !== 1 ? 's' : ''}${data.updated ? ' · updated ' + fmtDate(data.updated) : ''}`;
      }
    } catch (e) {
      allTracks = [];
      console.error('[sound-library] fetch failed', e);
    }
    buildCategoryChips();
    render();
  }

  // ── Filter / sort pipeline ────────────────────────────────────────────────────

  function pipeline() {
    let result = allTracks.slice();

    // Category
    if (category !== 'all') {
      result = result.filter(t => (t.category || 'other') === category);
    }

    // Search
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      result = result.filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.author || '').toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q)) ||
        (t.excerpt || '').toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortMode) {
      case 'newest':
        result.sort((a, b) => ts(b) - ts(a)); break;
      case 'oldest':
        result.sort((a, b) => ts(a) - ts(b)); break;
      case 'az':
        result.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
      case 'za':
        result.sort((a, b) => (b.title || '').localeCompare(a.title || '')); break;
      case 'year-desc':
        result.sort((a, b) => yr(b) - yr(a)); break;
      case 'year-asc':
        result.sort((a, b) => yr(a) - yr(b)); break;
      case 'random':
        shuffle(result); break;
    }

    return result;
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  function render() {
    const tracks = pipeline();
    $count.textContent = `${tracks.length} result${tracks.length !== 1 ? 's' : ''}`;

    if (!tracks.length) {
      $content.innerHTML = `
        <div class="sl-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="14" r="4"/><path d="M13 14V4l7 2v9"/><circle cx="17" cy="15" r="3"/></svg>
          <p class="sl-empty-title">No recordings found</p>
          <p class="sl-empty-sub">${searchTerm ? 'Try a different search term' : 'Check back after the next update'}</p>
        </div>`;
      return;
    }

    if (groupByYear) {
      renderGrouped(tracks);
    } else {
      renderFlat(tracks);
    }
  }

  function renderFlat(tracks) {
    const grid = document.createElement('div');
    grid.className = 'sl-grid';
    tracks.forEach(t => grid.appendChild(makeCard(t)));
    $content.innerHTML = '';
    $content.appendChild(grid);
  }

  function renderGrouped(tracks) {
    // Build year → tracks map
    const map = new Map();
    tracks.forEach(t => {
      const y = yr(t);
      if (!map.has(y)) map.set(y, []);
      map.get(y).push(t);
    });
    const years = [...map.keys()].sort((a, b) => b - a);

    const frag = document.createDocumentFragment();
    years.forEach(year => {
      const items = map.get(year);
      const hdr = document.createElement('div');
      hdr.className = 'sl-year-hdr';
      hdr.innerHTML = `<h2>${year}</h2><div class="sl-year-hdr-line"></div><span class="sl-year-hdr-count">${items.length} track${items.length !== 1 ? 's' : ''}</span>`;
      frag.appendChild(hdr);

      const grid = document.createElement('div');
      grid.className = 'sl-grid';
      items.forEach(t => grid.appendChild(makeCard(t)));
      frag.appendChild(grid);
    });

    $content.innerHTML = '';
    $content.appendChild(frag);
  }

  // ── Card factory ──────────────────────────────────────────────────────────────

  function makeCard(track) {
    const id       = track.id || track.slug || Math.random().toString(36).slice(2);
    const cat      = track.category || 'other';
    const catInfo  = CATEGORIES.find(c => c.value === cat) || CATEGORIES.at(-1);
    const embeds   = track.embeds || [];
    const isExp    = expandedId === id;

    const card = document.createElement('div');
    card.className = 'sl-card' + (isExp ? ' expanded' : '');
    card.dataset.id = id;

    // Thumb
    const thumbHtml = track.coverImageUrl
      ? `<img src="${esc(track.coverImageUrl)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><div class="sl-card-thumb-emoji" style="display:none">${catInfo.emoji}</div>`
      : `<div class="sl-card-thumb-emoji">${catInfo.emoji}</div>`;

    // Embed type chips
    const embedTypes = [...new Set(embeds.map(e => e.type || 'other'))];
    const embedChips = embedTypes.map(t => `<span class="sl-embed-chip" title="${t}">${EMBED_ICONS[t] || '🔗'}</span>`).join('');

    // Year
    const year = yr(track);

    // A direct MP3/audio URL means we can play via the footer player.
    const hasDirectAudio = !!(track.audio || track.audioUrl || track.url?.match?.(/\.(mp3|aac|ogg|flac|m4a)(\?|$)/i));

    card.innerHTML = `
      <button class="sl-card-header" aria-expanded="${isExp}">
        <div class="sl-card-thumb">
          ${thumbHtml}
          <div class="sl-card-thumb-play">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          </div>
        </div>
        <div class="sl-card-meta">
          <p class="sl-card-title">${esc(track.title || 'Untitled')}</p>
          <p class="sl-card-author">${esc(track.author || track.artist || '')}</p>
          <div class="sl-card-chips">
            <span class="sl-cat-chip cat--${cat}">${catInfo.emoji} ${catInfo.label}</span>
            ${year ? `<span class="sl-year-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${year}</span>` : ''}
            ${hasDirectAudio ? '<span class="sl-embed-chip" title="Direct audio">▶</span>' : embedChips}
          </div>
        </div>
        <div class="sl-card-chevron">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${isExp ? '<path d="M18 15l-6-6-6 6"/>' : '<path d="M6 9l6 6 6-6"/>'}
          </svg>
        </div>
      </button>
      ${isExp ? buildBody(track, embeds) : ''}
    `;

    card.querySelector('.sl-card-header').addEventListener('click', () => {
      // Direct audio tracks: fire footer player immediately, no expand needed
      if (hasDirectAudio && window.MP) {
        const audioSrc = slAudioSrc(track);
        if (audioSrc) {
          // Build a queue of every playable track in the current archive so the
          // player's prev/next actually navigate (they were no-ops because the
          // queue was never populated — callers only ever used MP.play(one)).
          const playable = allTracks.filter(slAudioSrc);
          const startIdx = Math.max(0, playable.indexOf(track));
          if (window.MP.queue) window.MP.queue(playable.map(slToSong), startIdx);
          else window.MP.play(slToSong(track));
          // Still toggle expand so metadata/tags are visible
        }
      }
      expandedId = expandedId === id ? null : id;
      render();
      if (expandedId === id) {
        setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
      }
    });

    // Embed tab switching (inside body)
    if (isExp) {
      card.querySelectorAll('.sl-embed-tab').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const idx = +btn.dataset.idx;
          card.querySelectorAll('.sl-embed-tab').forEach((b, i) => b.classList.toggle('active', i === idx));
          const frameWrap = card.querySelector('.sl-embed-frame-wrap');
          if (frameWrap) frameWrap.innerHTML = buildEmbed(embeds[idx]);
        });
      });
    }

    return card;
  }

  function buildBody(track, embeds) {
    const tabsHtml = embeds.length > 1
      ? `<div class="sl-embed-tabs">${embeds.map((e, i) => `<button class="sl-embed-tab${i === 0 ? ' active' : ''}" data-idx="${i}">${EMBED_ICONS[e.type] || '🔗'} ${e.type}</button>`).join('')}</div>`
      : '';

    const frameHtml = embeds[0] ? `<div class="sl-embed-frame-wrap">${buildEmbed(embeds[0])}</div>` : '';

    const tagsHtml = (track.tags || []).length
      ? `<div class="sl-tags">${(track.tags || []).map(t => `<span class="sl-tag">${esc(t)}</span>`).join('')}</div>` : '';

    const creditsHtml = (track.credits || []).length
      ? `<div class="sl-credits"><p class="sl-credits-label">Credits</p>${(track.credits || []).map(c => `<p class="sl-credit-row">${esc(c.role)}: <span>${esc(c.name)}</span></p>`).join('')}</div>` : '';

    const linksHtml = track.sourceUrl
      ? `<div class="sl-links"><a class="sl-link" href="${esc(track.sourceUrl)}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>Source</a></div>` : '';

    const excerptHtml = track.excerpt
      ? `<p class="sl-excerpt">${esc(track.excerpt).slice(0, 280)}${track.excerpt.length > 280 ? '…' : ''}</p>` : '';

    return `
      <div class="sl-card-body">
        ${tabsHtml}
        ${frameHtml}
        ${excerptHtml}
        ${tagsHtml}
        ${creditsHtml}
        ${linksHtml}
      </div>`;
  }

  function buildEmbed(embed) {
    if (!embed || !embed.embedUrl) return '';
    const src = embed.embedUrl;
    if (embed.type === 'youtube' || embed.type === 'vimeo') {
      return `<div class="sl-video-aspect"><iframe src="${esc(src)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    }
    return `<iframe src="${esc(src)}" height="${embedHeight(embed.type)}" allow="autoplay" scrolling="no" loading="lazy"></iframe>`;
  }

  // ── Category chips ────────────────────────────────────────────────────────────

  function buildCategoryChips() {
    if (!$cats) return;
    const counts = { all: allTracks.length };
    allTracks.forEach(t => {
      const c = t.category || 'other';
      counts[c] = (counts[c] || 0) + 1;
    });

    $cats.innerHTML = CATEGORIES.filter(c => c.value === 'all' || counts[c.value]).map(c => `
      <button class="sl-cat-btn${category === c.value ? ' active' : ''}" data-cat="${c.value}">
        ${c.emoji} ${c.label} <span class="sl-cat-count">${counts[c.value] || 0}</span>
      </button>`).join('');

    $cats.querySelectorAll('.sl-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        category = btn.dataset.cat;
        expandedId = null;
        buildCategoryChips();
        render();
      });
    });
  }

  // ── Skeleton ──────────────────────────────────────────────────────────────────

  function showSkeleton() {
    $content.innerHTML = `<div class="sl-skeleton-grid">${Array.from({ length: 8 }).map(() => '<div class="sl-skeleton-card"></div>').join('')}</div>`;
  }

  // ── Event listeners ───────────────────────────────────────────────────────────

  $search && $search.addEventListener('input', () => {
    searchTerm = $search.value;
    $searchClear && $searchClear.classList.toggle('visible', !!searchTerm);
    expandedId = null;
    render();
  });

  $searchClear && $searchClear.addEventListener('click', () => {
    $search.value = '';
    searchTerm = '';
    $searchClear.classList.remove('visible');
    expandedId = null;
    render();
    $search.focus();
  });

  $sortSel && $sortSel.addEventListener('change', () => {
    sortMode = $sortSel.value;
    expandedId = null;
    render();
  });

  $randomBtn && $randomBtn.addEventListener('click', () => {
    sortMode = 'random';
    randomSeed++;
    $sortSel && ($sortSel.value = 'newest'); // reset visual
    expandedId = null;
    $randomBtn.classList.add('active');
    render();
    setTimeout(() => $randomBtn.classList.remove('active'), 400);
  });

  $yearBtn && $yearBtn.addEventListener('click', () => {
    groupByYear = !groupByYear;
    $yearBtn.classList.toggle('active', groupByYear);
    expandedId = null;
    render();
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function ts(t) { return new Date(t.publishedAt || t.updatedAt || 0).getTime(); }
  function yr(t) {
    if (t.year) return t.year;
    const d = new Date(t.publishedAt || 0);
    return isNaN(d) ? 0 : d.getFullYear();
  }
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return ''; }
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────────

  load();

})();
