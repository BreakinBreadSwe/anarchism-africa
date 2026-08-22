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

  async function playRandom (ev) {
    const btn = document.getElementById('aa-random-radio');
    setBusy(btn, true);
    // Snapshot the pool minus session-dead, shuffle it, walk in order
    // — first station that probes OK wins.
    const pool = RADIO_STATIONS.filter(s => !dead.has(s.id));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let picked = null;
    for (const s of pool) {
      const ok = await probe(s.audio);
      if (ok) { picked = s; break; }
      dead.add(s.id);
    }
    setBusy(btn, false);
    if (!picked) {
      toast('No radio stations available right now.');
      // Hide the button for the rest of the session — if nothing's up
      // there's no point taunting the user with a broken control.
      if (btn) btn.style.display = 'none';
      return;
    }
    if (window.MP?.play) {
      window.MP.play({ ...picked, image: '' });
    } else {
      // No mini-player on this page — bounce to sound library with
      // the picked id so its onload can pick it up.
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
