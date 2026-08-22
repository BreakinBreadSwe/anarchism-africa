/* ANARCHISM.AFRICA — random radio button
 *
 * Injects a small floating "📻 RANDOM RADIO" button. Click → probe
 * random stations from RADIO_STATIONS in a random order, hand off the
 * first one that actually loads to window.MP.play. Dead URLs are
 * skipped, not surfaced as errors. If every station in the pool fails
 * we show one clear toast and hide the button for the rest of the
 * session — "not available? then don't show it" per user feedback.
 */
(function () {
  'use strict';

  // Zeno.fm IDs decay over time (user-created streams, no guarantee of
  // persistence). We keep a broad pool and probe each pick before playing;
  // dead ones get skipped silently. Add new sources here.
  const RADIO_STATIONS = [
    { id: 'r1',  title: 'Africa №1',           artist: 'Libreville',        audio: 'https://stream.zeno.fm/g8g6h4y3608uv' },
    { id: 'r2',  title: 'Africa Radio Sunny',  artist: 'Diaspora',          audio: 'https://stream.zeno.fm/6q0we2f2ehhvv' },
    { id: 'r3',  title: 'Vibes FM Lagos',      artist: 'Naija',             audio: 'https://stream.zeno.fm/j0jqfws0ha0uv' },
    { id: 'r4',  title: 'Reggae Radio Africa', artist: 'Pan-Diaspora',      audio: 'https://stream.zeno.fm/03fkkg0uqhhvv' },
    { id: 'r5',  title: 'Highlife Classics',   artist: 'Accra',             audio: 'https://stream.zeno.fm/7wq5w42w608uv' },
    { id: 'r6',  title: 'Amapiano Sessions',   artist: 'Johannesburg',      audio: 'https://stream.zeno.fm/rt1qkbe2mnhvv' },
    { id: 'r7',  title: 'Afrobeat Underground',artist: 'Lagos / Paris',     audio: 'https://stream.zeno.fm/mgd7d1p7deutv' },
    { id: 'r8',  title: 'Sahel Sounds Radio',  artist: 'Bamako',            audio: 'https://stream.zeno.fm/hz54usarw7zuv' },
    { id: 'r9',  title: 'Radio Djibouti Live', artist: 'Horn of Africa',    audio: 'https://stream.zeno.fm/qgdqxwn3ha0uv' },
    // Public-service streams — direct MP3/AAC URLs, historically stable.
    { id: 'r10', title: 'RFI Afrique',         artist: 'Radio France Intl.', audio: 'https://rfienrfianews.ice.infomaniak.ch/rfienrfianews-48.mp3' },
    { id: 'r11', title: 'BBC World Service',   artist: 'Africa desk',        audio: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service' },
    { id: 'r12', title: 'Voice of Africa',     artist: 'Pan-African',        audio: 'https://s2.radio.co/s2b2b68449/listen' }
  ];

  // Session-scoped dead list so we don't retry stations we've already
  // seen fail this pageview.
  const dead = new Set();

  // Probe a stream URL: create a throwaway Audio, resolve true on
  // 'canplay' / false on 'error' / false after a 5s timeout. Never
  // touches the visible mini-player, so users don't see a flash of
  // "can't be played" toasts for dead picks.
  function probe (url) {
    return new Promise(resolve => {
      let a = new Audio();
      let done = false;
      const finish = ok => {
        if (done) return;
        done = true;
        try { a.oncanplay = a.onerror = a.onloadedmetadata = null; a.pause(); a.removeAttribute('src'); a.load(); } catch {}
        a = null;
        resolve(ok);
      };
      a.preload = 'metadata';
      a.crossOrigin = 'anonymous';   // hint — server may or may not honour it
      a.oncanplay        = () => finish(true);
      a.onloadedmetadata = () => finish(true);
      a.onerror          = () => finish(false);
      try { a.src = url; a.load(); } catch { finish(false); }
      setTimeout(() => finish(false), 5000);
    });
  }

  function toast (msg) {
    try {
      const t = document.createElement('div');
      t.textContent = msg;
      t.style.cssText = 'position:fixed;left:50%;bottom:140px;transform:translateX(-50%);background:var(--fg,#fff);color:var(--bg,#000);padding:10px 16px;font:600 .78rem JetBrains Mono,monospace;letter-spacing:.04em;z-index:10001;box-shadow:2px 2px 0 0 rgba(0,0,0,.25);max-width:80vw;text-align:center';
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3500);
    } catch {}
  }

  function setBusy (btn, on) {
    if (!btn) return;
    btn.disabled = on;
    btn.classList.toggle('is-busy', on);
    const lbl = btn.querySelector('.lbl');
    if (lbl) lbl.textContent = on ? 'FINDING…' : 'RANDOM RADIO';
  }

  // Fetch the sound-library manifest and reduce to tracks with a
  // directly-playable audio URL — the same predicate the sound-library
  // page uses. We SPREAD the raw track so the now-playing page can read
  // description / year / category / duration / source / url / tags
  // without a second API call. Cached in-module so repeat clicks are cheap.
  let libraryPool = null;
  async function loadLibrary () {
    if (libraryPool) return libraryPool;
    try {
      const r = await fetch('/api/sound/list', { cache: 'no-store' });
      if (!r.ok) return [];
      const d = await r.json();
      libraryPool = (d.tracks || [])
        .map(t => ({
          ...t,
          id:     t.id || t.slug || t.title || Math.random().toString(36).slice(2),
          title:  t.title || 'Untitled',
          artist: t.author || t.artist || '',
          image:  t.coverImageUrl || t.image || '',
          audio:  t.audio || t.audioUrl ||
                  (t.url?.match?.(/\.(mp3|aac|ogg|flac|m4a)(\?|$)/i) ? t.url : null)
        }))
        .filter(t => t.audio);
      return libraryPool;
    } catch {
      return [];
    }
  }

  async function playRandom (ev) {
    const btn = document.getElementById('aa-random-radio');
    setBusy(btn, true);

    // Primary: pick a random AUDIO FILE from the sound library. Every
    // click reshuffles and walks in order, probing each until one loads.
    // Failed tracks join the session-dead set — you won't get the same
    // broken pick twice in one visit.
    const library = await loadLibrary();
    var libraryShuffled = library
      .filter(t => !dead.has(t.id))
      .map(t => [Math.random(), t])
      .sort((a, b) => a[0] - b[0])
      .map(([, t]) => t);
    let picked = null;
    // Cap the library scan to keep clicks snappy — 12 probes @ 5s max
    // is the worst case (~60s), which is already too long. If none of
    // the first 12 respond, fall through to stations.
    for (const t of libraryShuffled.slice(0, 12)) {
      const ok = await probe(t.audio);
      if (ok) { picked = t; break; }
      dead.add(t.id);
    }

    // Fallback: live radio streams if nothing in the library loaded.
    if (!picked) {
      const pool = RADIO_STATIONS.filter(s => !dead.has(s.id));
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      for (const s of pool) {
        const ok = await probe(s.audio);
        if (ok) { picked = s; break; }
        dead.add(s.id);
      }
    }

    setBusy(btn, false);
    if (!picked) {
      toast('No random audio available right now.');
      if (btn) btn.style.display = 'none';
      return;
    }
    // Load the whole shuffled library as an MP queue so the mini-player's
    // NEXT button has something to advance to. picked's index in the
    // shuffled pool becomes queueIndex; MP.play alone left queueIndex=-1
    // and made next() a no-op — that's what user reported ('next audio
    // button in the player doesn't work').
    if (window.MP?.queue) {
      const pool = libraryShuffled.length ? libraryShuffled : [picked];
      const startIdx = Math.max(0, pool.findIndex(t => t.id === picked.id));
      window.MP.queue(pool, startIdx);
    } else if (window.MP?.play) {
      window.MP.play(picked);
    } else {
      location.href = 'sound-library.html?play=' + encodeURIComponent(picked.id);
    }
  }

  function mount () {
    if (document.getElementById('aa-random-radio')) return;
    const btn = document.createElement('button');
    btn.id = 'aa-random-radio';
    btn.type = 'button';
    btn.className = 'aa-random-radio';
    btn.setAttribute('aria-label', 'Play a random radio station');
    btn.setAttribute('title', 'Random Radio');
    btn.innerHTML = `
      <span class="glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
          <rect x="3" y="9" width="18" height="12" rx="2"/>
          <path d="M8 9V5l10-2v6"/>
          <circle cx="16" cy="15" r="2"/>
          <path d="M6 15h6"/>
        </svg>
      </span>
      <span class="lbl">RANDOM RADIO</span>
    `;
    btn.addEventListener('click', playRandom);
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.AA = window.AA || {};
  window.AA.randomRadio = { play: playRandom, stations: RADIO_STATIONS, dead };
})();
