/* ANARCHISM.AFRICA — User logo generator
 *
 * A discoverable panel that lets every user:
 *   - upload an image as their logo (drag-drop or pick file)
 *   - pick a procedural African pattern as their logo
 *   - paint a tiny 64×64 grid by hand (1-bit pixel editor)
 *   - reset to the AA visitor default
 *
 * Saved to localStorage['aa.user.logo'] — only affects this device's view.
 * Admin / publisher get an extra "Save as visitor default" action that pushes
 * to /api/site/visitor-defaults (admin token gated).
 *
 * Discovery:
 *   - long-press the corner logo → opens the generator (already wired in logo-mark.js's existing long-press)
 *   - new menu item in the rail / mobile menu pop-up: "Logo lab"
 *   - public API: AA.logoGen.open()
 */
(function () {
  const $ = (s, r=document) => r.querySelector(s);

  // ---- Hash + RNG (same as elsewhere) ---------------------------------
  function hash (s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h<<5)+h+s.charCodeAt(i))|0; return Math.abs(h); }
  function rng (seed) { let s = seed >>> 0; return () => (s = (s*1664525 + 1013904223) >>> 0)/0xffffffff; }

  // ---- Pattern families (same as logo-mark) ---------------------------
  const PATTERN_FNS = {
    kente   (r) { let s=''; let y=0; while (y<48) { const t=1+Math.floor(r()*5); s+=`<rect x="0" y="${y}" width="48" height="${t}" fill="currentColor" opacity="${(0.3+r()*0.7).toFixed(2)}"/>`; y+=t+1; } return s; },
    adinkra (r) { let s=''; const c=10; for(let x=c/2;x<48;x+=c)for(let y=c/2;y<48;y+=c)if(r()>0.45)s+=`<circle cx="${x}" cy="${y}" r="${1+r()*2.5}" fill="currentColor" opacity="${(0.4+r()*0.6).toFixed(2)}"/>`; return s; },
    kuba    (r) { let s=''; const c=12; for(let i=0;i<48;i+=c)for(let j=0;j<48;j+=c){if(r()>0.4){const f=r()>0.5;const p=f?`${i},${j} ${i+c},${j} ${i},${j+c}`:`${i+c},${j} ${i+c},${j+c} ${i},${j+c}`;s+=`<polygon points="${p}" fill="currentColor" opacity="${(0.3+r()*0.6).toFixed(2)}"/>`;}} return s; },
    ndebele (r) { let s=''; const c=9; for(let i=0;i<48;i+=c)for(let j=0;j<48;j+=c){if(r()>0.4){const sz=c-2-r()*2;s+=`<rect x="${i+(c-sz)/2}" y="${j+(c-sz)/2}" width="${sz.toFixed(1)}" height="${sz.toFixed(1)}" fill="none" stroke="currentColor" stroke-width="${(0.5+r()*1.5).toFixed(1)}" opacity="${(0.4+r()*0.6).toFixed(2)}"/>`;}} return s; },
    sona    (r) { let s=''; for (let n=0;n<3;n++){ const y=12+n*12+r()*4; let d=`M 0 ${y.toFixed(1)}`; for(let x=0;x<48;x+=8){const dy=(Math.sin((x+r()*100)*0.12)*4+r()*2-1).toFixed(1);d+=` Q ${x+4} ${(y+dy).toFixed(1)} ${x+8} ${y.toFixed(1)}`;} s+=`<path d="${d}" fill="none" stroke="currentColor" stroke-width="${(0.7+r()*1.4).toFixed(1)}" opacity="${(0.4+r()*0.5).toFixed(2)}"/>`;} return s; }
  };

  function patternSVG (family, seed) {
    const r = rng(hash(family + ':' + (seed || Date.now())));
    const inner = (PATTERN_FNS[family] || PATTERN_FNS.kente)(r);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#000"/><g style="color:#fff">${inner}</g></svg>`;
  }
  function svgToDataUrl (svg) { return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg); }

  // ---- Pixel editor (8×8 grid mapped to 64×64 SVG) --------------------
  let pxGrid = new Array(64).fill(false);
  function pxSVG () {
    let cells = '';
    for (let i = 0; i < 64; i++) if (pxGrid[i]) {
      const x = (i % 8) * 8, y = Math.floor(i / 8) * 8;
      cells += `<rect x="${x}" y="${y}" width="8" height="8" fill="#fff"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#000"/>${cells}</svg>`;
  }

  // ---- Save / preview --------------------------------------------------
  function setUser (url) {
    if (window.AA?.logo?.setUser) window.AA.logo.setUser(url);
    else { try { localStorage.setItem('aa.user.logo', url); } catch {} }
    // also paint the menu-toggle logo immediately
    document.querySelectorAll('.menu-toggle .logo, .bottombar-logo .logo, .brand .logo').forEach(el => {
      el.style.backgroundImage = `url('${url}')`;
    });
  }
  function clearUser () {
    if (window.AA?.logo?.clearUser) window.AA.logo.clearUser();
    else { try { localStorage.removeItem('aa.user.logo'); } catch {} }
    document.querySelectorAll('.menu-toggle .logo, .bottombar-logo .logo, .brand .logo').forEach(el => {
      el.style.backgroundImage = `url('/icons/AAlogo1.svg')`;
    });
  }

  // ---- Panel UI --------------------------------------------------------
  function template () {
    return `
      <div class="lg-page" role="dialog" aria-modal="true" aria-labelledby="lg-title">
        <button class="lg-close" id="lg-close" aria-label="Close">&times;</button>
        <div class="lg-grid">
          <header class="lg-head">
            <h1 id="lg-title">Logo lab</h1>
            <p class="lg-sub">Make the corner logo yours. Upload an image, pick an African pattern, or paint your own pixel mark.
              Your choice persists on this device only — it doesn't change anything for other users.</p>
          </header>

          <section class="lg-section" aria-labelledby="lg-up-title">
            <h2 id="lg-up-title">1 · Upload an image</h2>
            <p>SVG / PNG / JPG up to 700&nbsp;KB. Square works best.</p>
            <div class="lg-drop" id="lg-drop">
              <input type="file" id="lg-file" accept="image/*" hidden/>
              <button class="btn primary" id="lg-pick">Choose file</button>
              <p class="lg-drop-hint">or drag &amp; drop here</p>
            </div>
          </section>

          <section class="lg-section" aria-labelledby="lg-pat-title">
            <h2 id="lg-pat-title">2 · Pick an African pattern</h2>
            <div class="lg-patterns" id="lg-patterns"></div>
          </section>

          <section class="lg-section" aria-labelledby="lg-pix-title">
            <h2 id="lg-pix-title">3 · Paint your own (8×8)</h2>
            <div class="lg-pixrow">
              <div class="lg-pixgrid" id="lg-pixgrid" role="grid" aria-label="8×8 pixel grid"></div>
              <div class="lg-pixctl">
                <button class="btn ghost" id="lg-pix-clear">Clear</button>
                <button class="btn ghost" id="lg-pix-random">Random</button>
                <button class="btn primary" id="lg-pix-save">Use as logo</button>
              </div>
            </div>
          </section>

          <section class="lg-section lg-actions">
            <button class="btn ghost" id="lg-reset">Reset to AA default</button>
            <button class="btn ghost" id="lg-share" type="button">Copy logo URL</button>
            <span id="lg-status" class="mono"></span>
          </section>
        </div>
      </div>`;
  }

  function paintPatterns () {
    const host = $('#lg-patterns');
    if (!host) return;
    const families = Object.keys(PATTERN_FNS);
    host.innerHTML = '';
    families.forEach(family => {
      // 4 variants per family
      for (let i = 0; i < 4; i++) {
        const seed = family + '-' + (Date.now() + i * 17);
        const url = svgToDataUrl(patternSVG(family, seed));
        const tile = document.createElement('button');
        tile.className = 'lg-pat-tile';
        tile.type = 'button';
        tile.setAttribute('aria-label', `${family} variant ${i+1}`);
        tile.style.backgroundImage = `url('${url}')`;
        tile.dataset.url = url;
        tile.innerHTML = `<span class="lg-pat-label">${family}</span>`;
        tile.addEventListener('click', () => {
          setUser(url);
          status('Saved — corner logo is now this pattern.', 'ok');
        });
        host.appendChild(tile);
      }
    });
  }

  function paintPixGrid () {
    const grid = $('#lg-pixgrid'); if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < 64; i++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'lg-pixcell' + (pxGrid[i] ? ' on' : '');
      cell.setAttribute('aria-label', `cell ${i+1}`);
      cell.dataset.idx = i;
      cell.addEventListener('click', () => {
        pxGrid[i] = !pxGrid[i];
        cell.classList.toggle('on', pxGrid[i]);
      });
      grid.appendChild(cell);
    }
  }

  function status (msg, kind) {
    const el = $('#lg-status'); if (!el) return;
    el.textContent = msg || '';
    el.style.color = kind === 'ok' ? 'var(--green)' : kind === 'error' ? 'var(--red)' : 'var(--muted)';
    if (msg) setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 4000);
  }

  function open () {
    let host = document.getElementById('aa-logo-gen');
    if (!host) {
      host = document.createElement('div');
      host.id = 'aa-logo-gen';
      host.innerHTML = template();
      document.body.appendChild(host);
      bind();
    }
    document.body.classList.add('aa-logo-gen-open');
    paintPatterns();
    paintPixGrid();
  }
  function close () {
    document.body.classList.remove('aa-logo-gen-open');
    document.getElementById('aa-logo-gen')?.remove();
  }

  function bind () {
    const host = document.getElementById('aa-logo-gen');
    host.addEventListener('click', e => {
      if (e.target.closest('#lg-close')) return close();
    });
    document.addEventListener('keydown', function onEsc (e) {
      if (e.key === 'Escape' && document.body.classList.contains('aa-logo-gen-open')) {
        close(); document.removeEventListener('keydown', onEsc);
      }
    });

    // Upload / drop
    const file = $('#lg-file');
    $('#lg-pick').addEventListener('click', () => file.click());
    file.addEventListener('change', e => handleFile(e.target.files?.[0]));
    const drop = $('#lg-drop');
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('over');
      handleFile(e.dataTransfer?.files?.[0]);
    });

    // Pixel editor controls
    $('#lg-pix-clear').addEventListener('click', () => { pxGrid = new Array(64).fill(false); paintPixGrid(); });
    $('#lg-pix-random').addEventListener('click', () => {
      pxGrid = pxGrid.map(() => Math.random() > 0.55); paintPixGrid();
    });
    $('#lg-pix-save').addEventListener('click', () => {
      if (!pxGrid.some(Boolean)) { status('Paint a few cells first.', 'error'); return; }
      const url = svgToDataUrl(pxSVG());
      setUser(url);
      status('Saved — your pixel mark is the new corner logo.', 'ok');
    });

    // Reset / share
    $('#lg-reset').addEventListener('click', () => {
      clearUser();
      status('Reverted to the AA visitor default.', 'ok');
    });
    $('#lg-share').addEventListener('click', async () => {
      const url = window.AA?.logo?.src?.() || localStorage.getItem('aa.user.logo') || '/icons/AAlogo1.svg';
      try { await navigator.clipboard.writeText(url); status('Logo URL copied.', 'ok'); }
      catch { status('Copy failed.', 'error'); }
    });
  }

  function handleFile (f) {
    if (!f) return;
    if (!/^image\//.test(f.type)) { status('Image files only.', 'error'); return; }
    if (f.size > 700 * 1024)      { status('Keep it under 700 KB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => { setUser(reader.result); status('Saved — corner logo is now your image.', 'ok'); };
    reader.readAsDataURL(f);
  }

  window.AA = window.AA || {};
  window.AA.logoGen = { open, close };
})();
