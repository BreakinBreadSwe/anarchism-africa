/* ANARCHISM.AFRICA — shared mini-player module
 * Exposes window.MP = { play(song), queue(list, startIndex), next, prev, current }
 * Loaded before app.js in index.html AND before sound-library.js in sound-library.html.
 * Requires the #mini-player / #mp-* DOM already in the page.
 */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);

  window.MP = (function () {
    let audio = null, current = null, queue = [], queueIndex = -1;
    const ui = {
      bar:    $('#mini-player'),
      art:    $('#mp-art'),
      prev:   $('#mp-prev'),
      play:   $('#mp-play'),
      next:   $('#mp-next'),
      title:  $('#mp-title'),
      artist: $('#mp-artist'),
      cur:    $('#mp-cur'),
      dur:    $('#mp-dur'),
      track:  $('#mp-track'),
      bar2:   $('#mp-bar'),
      buffer: $('#mp-buffer'),
      knob:   $('#mp-knob'),
      like:   $('#mp-like'),
      share:  $('#mp-share'),
      close:  $('#mp-close'),
      iconPlay:   document.querySelector('#mp-play .mp-icon-play'),
      iconPause:  document.querySelector('#mp-play .mp-icon-pause'),
      waveCanvas: document.getElementById('mp-waveform'),
      vuCanvas:   document.getElementById('mp-vu-canvas')
    };

    function fmt (s) {
      if (!Number.isFinite(s) || s < 0) return '0:00';
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return m + ':' + String(sec).padStart(2, '0');
    }

    // ---- waveform + VU meter ------------------------------------------
    let waveData = null;
    let vuRAF    = null;

    function lcg (seed) {
      let s = ((seed ^ 0xdeadbeef) >>> 0) || 1;
      return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 0xffffffff;
    }
    function buildWaveData (id) {
      const seed = id
        ? [...String(id)].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 7)
        : Date.now();
      const rng = lcg(seed >>> 0);
      const n   = 220;
      const d   = new Float32Array(n);
      for (let i = 0; i < n; i++)
        d[i] = Math.sin(i / n * Math.PI) * 0.65 + 0.12 + rng() * 0.48;
      const mx = Math.max(...d);
      for (let i = 0; i < n; i++) d[i] /= mx;
      return d;
    }
    function drawWaveform (playedPct) {
      const cv = ui.waveCanvas;
      if (!cv || !waveData) return;
      const W = cv.offsetWidth, H = cv.offsetHeight;
      if (!W || !H) return;
      if (cv.width !== W)  cv.width  = W;
      if (cv.height !== H) cv.height = H;
      const ctx    = cv.getContext('2d');
      const n      = waveData.length;
      const barW   = W / n;
      const gap    = Math.max(0.4, barW * 0.28);
      const accent = getComputedStyle(document.documentElement)
                       .getPropertyValue('--accent').trim() || '#FFD700';
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < n; i++) {
        const x    = i * barW;
        const barH = Math.max(2, waveData[i] * H * 0.84);
        const y    = (H - barH) / 2;
        ctx.fillStyle = (x / W) <= playedPct ? accent : 'rgba(255,255,255,0.17)';
        ctx.fillRect(x + gap / 2, Math.floor(y), Math.max(1, barW - gap), Math.ceil(barH));
      }
    }
    function drawVU () {
      const cv = ui.vuCanvas;
      if (!cv) return;
      const W = cv.offsetWidth || cv.parentElement?.offsetWidth || 0;
      const H = cv.offsetHeight || 12;
      if (!W) { vuRAF = requestAnimationFrame(drawVU); return; }
      if (cv.width !== W)  cv.width  = W;
      if (cv.height !== H) cv.height = H;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, W, H);
      let level = 0;
      if (audio && !audio.paused && audio.currentTime) {
        const t = audio.currentTime;
        level = 0.42
          + 0.24 * Math.sin(t *  7.3)
          + 0.15 * Math.sin(t * 14.7)
          + 0.08 * Math.sin(t *  3.2)
          + 0.07 * Math.sin(t * 29.1)
          + 0.04 * Math.sin(t * 61.3);
        level = Math.max(0.03, Math.min(1, level));
      }
      const stride = 4;
      const nSegs  = Math.floor(W / stride);
      const lit    = Math.floor(level * nSegs);
      for (let i = 0; i < nSegs; i++) {
        ctx.fillStyle = i < lit
          ? `hsl(${(120 - (i / nSegs) * 120).toFixed(0)},88%,52%)`
          : 'rgba(255,255,255,0.06)';
        ctx.fillRect(i * stride, 1, 3, H - 2);
      }
      vuRAF = requestAnimationFrame(drawVU);
    }
    function startVU () {
      if (vuRAF) cancelAnimationFrame(vuRAF);
      vuRAF = null;
      drawVU();
    }
    function stopVU () {
      if (vuRAF) { cancelAnimationFrame(vuRAF); vuRAF = null; }
      try { ui.waveCanvas?.getContext('2d')?.clearRect(0, 0, ui.waveCanvas.width, ui.waveCanvas.height); } catch {}
      try { ui.vuCanvas?.getContext('2d')?.clearRect(0, 0, ui.vuCanvas.width, ui.vuCanvas.height); } catch {}
    }

    function show () { ui.bar?.classList.add('show'); document.body.classList.add('mp-active'); }
    function hide () { ui.bar?.classList.remove('show'); document.body.classList.remove('mp-active'); }

    function setPlayingUI (playing) {
      if (!ui.play) return;
      ui.play.classList.toggle('playing', playing);
      if (ui.iconPlay)  ui.iconPlay.hidden  = playing;
      if (ui.iconPause) ui.iconPause.hidden = !playing;
      ui.play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }

    function syncLike () {
      if (!ui.like || !current) return;
      const isOn = !!window.AA?.wishlist?.has?.(current.id, 'song');
      ui.like.classList.toggle('is-on', isOn);
      ui.like.setAttribute('aria-pressed', String(isOn));
    }

    // Tearing down the previous Audio properly is the difference between
    // playback that "just works" and the chaos users see when tapping tracks
    // in quick succession:
    //   - The old Audio's queued `error` fires AFTER we've already started
    //     the new one, hitting a handler whose closure references the NEW
    //     audio → shows a "can't be played" toast for the wrong track, then
    //     calls next() which skips past the track the user actually tapped.
    // Solution: use on* properties (they replace on assign, so the old
    // handlers are unreachable the moment we set them on the new Audio), and
    // null every one on the old object before dropping its src.
    function destroyAudio (a) {
      if (!a) return;
      try { a.pause(); } catch {}
      a.onplay = a.onpause = a.onended = a.onerror = null;
      a.ontimeupdate = a.onloadedmetadata = a.onprogress = null;
      try { a.removeAttribute('src'); a.load(); } catch {}
    }

    function play (song) {
      if (!song?.audio) return;
      if (audio && current?.id === song.id) {
        if (audio.paused) audio.play().catch(() => {}); else audio.pause();
        return;
      }
      destroyAudio(audio);
      const a = new Audio();
      audio = a;
      current = song;
      if (ui.title)  ui.title.textContent  = song.title || '—';
      if (ui.artist) ui.artist.textContent = song.artist || '';
      if (ui.art)    ui.art.style.backgroundImage = song.image ? `url("${song.image}")` : '';
      if (ui.cur)    ui.cur.textContent = '0:00';
      if (ui.dur)    ui.dur.textContent = song.duration ? fmt(song.duration) : '0:00';
      if (ui.bar2)   ui.bar2.style.width = '0%';
      if (ui.knob)   ui.knob.style.left  = '0%';
      waveData = buildWaveData(song.id);
      drawWaveform(0);
      startVU();
      // Guard EVERY handler: if the user tapped a different track meanwhile
      // (audio no longer === a) then this callback belongs to a dead Audio
      // and must not touch the UI.
      const alive = () => audio === a;
      a.onplay  = () => { if (alive()) setPlayingUI(true); };
      a.onpause = () => { if (alive()) setPlayingUI(false); };
      a.onloadedmetadata = () => { if (alive() && ui.dur) ui.dur.textContent = fmt(a.duration); };
      a.ontimeupdate = () => {
        if (!alive() || !a.duration) return;
        const pct = a.currentTime / a.duration * 100;
        if (ui.bar2) ui.bar2.style.width = pct + '%';
        if (ui.knob) ui.knob.style.left  = pct + '%';
        if (ui.cur)  ui.cur.textContent  = fmt(a.currentTime);
        if (ui.track) ui.track.setAttribute('aria-valuenow', String(Math.round(pct)));
        drawWaveform(pct / 100);
      };
      a.onprogress = () => {
        if (!alive() || !a.duration || !a.buffered.length) return;
        const end = a.buffered.end(a.buffered.length - 1);
        if (ui.buffer) ui.buffer.style.width = (end / a.duration * 100) + '%';
      };
      a.onended = () => {
        if (!alive()) return;
        if (queueIndex >= 0 && queueIndex < queue.length - 1) next();
        else setPlayingUI(false);
      };
      a.onerror = () => {
        if (!alive()) return;
        setPlayingUI(false);
        try {
          const t = document.createElement('div');
          t.textContent = `"${song.title}" can't be played — track unavailable.`;
          t.style.cssText = 'position:fixed;left:50%;bottom:140px;transform:translateX(-50%);background:var(--fg,#fff);color:var(--bg,#000);padding:10px 16px;font:600 .82rem JetBrains Mono,monospace;letter-spacing:.04em;z-index:10001;box-shadow:2px 2px 0 0 rgba(0,0,0,.25);max-width:80vw;text-align:center';
          document.body.appendChild(t);
          setTimeout(() => t.remove(), 3500);
        } catch {}
        if (queueIndex >= 0 && queueIndex < queue.length - 1) next();
        else { hide(); current = null; }
      };
      show();
      setPlayingUI(false);
      a.src = song.audio;
      a.play().catch(() => { if (alive()) setPlayingUI(false); });
      syncLike();
    }

    function next () {
      if (queueIndex < 0 || !queue.length) return;
      const i = (queueIndex + 1) % queue.length;
      queueIndex = i;
      play(queue[i]);
    }
    function prev () {
      if (queueIndex < 0 || !queue.length) return;
      if (audio && audio.currentTime > 3) { audio.currentTime = 0; return; }
      const i = (queueIndex - 1 + queue.length) % queue.length;
      queueIndex = i;
      play(queue[i]);
    }

    // ---- timeline scrubbing ------------------------------------------
    if (ui.track) {
      const seekFromEvent = e => {
        if (!audio || !audio.duration) return;
        const rect = ui.track.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        audio.currentTime = pct * audio.duration;
      };
      let dragging = false;
      ui.track.addEventListener('pointerdown', e => {
        dragging = true; ui.track.classList.add('scrubbing');
        try { ui.track.setPointerCapture(e.pointerId); } catch {}
        seekFromEvent(e);
      });
      ui.track.addEventListener('pointermove', e => { if (dragging) seekFromEvent(e); });
      ui.track.addEventListener('pointerup',     () => { dragging = false; ui.track.classList.remove('scrubbing'); });
      ui.track.addEventListener('pointercancel', () => { dragging = false; ui.track.classList.remove('scrubbing'); });
      ui.track.addEventListener('keydown', e => {
        if (!audio || !audio.duration) return;
        const step = e.shiftKey ? 10 : 5;
        if (e.key === 'ArrowRight') { audio.currentTime = Math.min(audio.duration, audio.currentTime + step); e.preventDefault(); }
        if (e.key === 'ArrowLeft')  { audio.currentTime = Math.max(0, audio.currentTime - step); e.preventDefault(); }
        if (e.key === ' ')          { (audio.paused ? audio.play() : audio.pause()); e.preventDefault(); }
      });
    }

    // ---- transport buttons -------------------------------------------
    ui.play?.addEventListener('click',  () => { if (audio) (audio.paused ? audio.play() : audio.pause()); });
    ui.next?.addEventListener('click',  next);
    ui.prev?.addEventListener('click',  prev);
    ui.close?.addEventListener('click', () => {
      destroyAudio(audio);
      audio = null; current = null; queueIndex = -1; queue = [];
      waveData = null; stopVU(); hide(); setPlayingUI(false);
    });

    // ---- like (wishlist) ---------------------------------------------
    ui.like?.addEventListener('click', () => {
      if (!current) return;
      const W = window.AA?.wishlist;
      if (!W) return;
      if (W.has?.(current.id, 'song')) W.remove?.(current.id, 'song');
      else W.add?.({ id: current.id, title: current.title, image: current.image }, 'song');
      syncLike();
    });
    document.addEventListener('aa:wishlist:change', syncLike);

    // ---- share -------------------------------------------------------
    ui.share?.addEventListener('click', async () => {
      if (!current) return;
      const url = location.origin + '/item.html?type=song&id=' + encodeURIComponent(current.id);
      try {
        if (navigator.share) await navigator.share({ title: current.title, text: `${current.title} — ${current.artist}`, url });
        else { await navigator.clipboard.writeText(url); }
      } catch {}
    });

    return {
      play,
      queue (list, startIndex = 0) {
        queue = list.slice();
        queueIndex = Math.max(0, Math.min(startIndex, queue.length - 1));
        if (queue[queueIndex]) play(queue[queueIndex]);
      },
      next, prev,
      get current () { return current; }
    };
  })();
})();
