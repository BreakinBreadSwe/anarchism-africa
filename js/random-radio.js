/* ANARCHISM.AFRICA — random radio button
 *
 * Injects a small floating "📻 RANDOM RADIO" button at the footer
 * bottom-left. Click → pick a random stream from RADIO_STATIONS and
 * play it via the existing mini-player (window.MP.play).
 *
 * Stations are open community/diaspora streams — verified to be
 * publicly accessible and CORS-friendly. Add/remove entries here.
 */
(function () {
  'use strict';

  const RADIO_STATIONS = [
    { id: 'r1', title: 'Radio Africa №1',       artist: 'Libreville',        audio: 'https://stream.zeno.fm/g8g6h4y3608uv' },
    { id: 'r2', title: 'Africa Radio Sunny',    artist: 'Diaspora',          audio: 'https://stream.zeno.fm/6q0we2f2ehhvv' },
    { id: 'r3', title: 'Vibes FM Lagos',        artist: 'Naija',             audio: 'https://stream.zeno.fm/j0jqfws0ha0uv' },
    { id: 'r4', title: 'Reggae Radio Africa',   artist: 'Pan-Diaspora',      audio: 'https://stream.zeno.fm/03fkkg0uqhhvv' },
    { id: 'r5', title: 'Highlife Classics',     artist: 'Accra',             audio: 'https://stream.zeno.fm/7wq5w42w608uv' },
    { id: 'r6', title: 'Amapiano Sessions',     artist: 'Johannesburg',      audio: 'https://stream.zeno.fm/rt1qkbe2mnhvv' },
    { id: 'r7', title: 'Afrobeat Underground',  artist: 'Lagos / Paris',     audio: 'https://stream.zeno.fm/mgd7d1p7deutv' },
    { id: 'r8', title: 'Sahel Sounds Radio',    artist: 'Bamako',            audio: 'https://stream.zeno.fm/hz54usarw7zuv' },
    { id: 'r9', title: 'Radio Djibouti Live',   artist: 'Horn of Africa',    audio: 'https://stream.zeno.fm/qgdqxwn3ha0uv' }
  ];

  function pickRandom () {
    if (!RADIO_STATIONS.length) return null;
    return RADIO_STATIONS[Math.floor(Math.random() * RADIO_STATIONS.length)];
  }

  function playRandom () {
    const s = pickRandom();
    if (!s) return;
    // MP.play takes { id, title, artist, image, audio } — image can be
    // omitted; thumb.js will fill in a procedural pattern per station id.
    if (window.MP?.play) {
      window.MP.play({ ...s, image: '' });
    } else {
      // Fallback: open the sound library page which auto-mounts its own player
      location.href = 'sound-library.html?play=' + encodeURIComponent(s.id);
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
  window.AA.randomRadio = { play: playRandom, stations: RADIO_STATIONS };
})();
