/* ============================================================
   MERCH STUDIO — /js/merch-studio.js
   Canvas-based merchandise design editor.
   Mounts into #view-studio as a fixed overlay.
   Public API: window.MerchStudio = { render() }
   IIFE — no import/export, no external libraries.
   ============================================================ */
(function () {
  'use strict';

  // ---- Load extra Google Fonts once ------------------------------------
  (function loadFonts () {
    if (document.getElementById('ms-gfonts')) return;
    const link = document.createElement('link');
    link.id = 'ms-gfonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&family=Teko:wght@400;700&family=Chakra+Petch:wght@400;700&family=Black+Ops+One&family=Permanent+Marker&display=swap';
    document.head.appendChild(link);
  })();

  // ---- Product definitions ---------------------------------------------
  const PRODUCTS = {
    tshirt: {
      label: 'T-Shirt', emoji: '👕', w: 4500, h: 5400,
      areas: {
        front:       { label: 'Front',     x: 800,  y: 900,  w: 2900, h: 3600 },
        back:        { label: 'Back',      x: 800,  y: 900,  w: 2900, h: 3600 },
        left_sleeve: { label: 'L. Sleeve', x: 100,  y: 1200, w: 700,  h: 2200 },
        right_sleeve:{ label: 'R. Sleeve', x: 3700, y: 1200, w: 700,  h: 2200 },
        neck:        { label: 'Neck',      x: 1800, y: 200,  w: 900,  h: 500  },
        full:        { label: 'Full Print',x: 0,    y: 0,    w: 4500, h: 5400 },
      },
      printify: { blueprint_id: 5, print_provider_id: 1 },
      printful: { catalog_id: 71 },
    },
    poster: {
      label: 'Poster', emoji: '🖼️', w: 5400, h: 7200,
      areas: {
        front: { label: 'Print area', x: 200, y: 200, w: 5000, h: 6800 },
        full:  { label: 'Full bleed', x: 0,   y: 0,   w: 5400, h: 7200 },
      },
      printify: { blueprint_id: 271 },
      printful: { catalog_id: 254 },
    },
    mug: {
      label: 'Mug', emoji: '☕', w: 2475, h: 1125,
      areas: {
        wrap: { label: 'Wrap', x: 0, y: 0, w: 2475, h: 1125 },
      },
      printify: { blueprint_id: 34 },
      printful: { catalog_id: 19 },
    },
    towel: {
      label: 'Bath Towel', emoji: '🛁', w: 3600, h: 5400,
      areas: {
        front: { label: 'Front',      x: 200, y: 200, w: 3200, h: 5000 },
        full:  { label: 'Full print', x: 0,   y: 0,   w: 3600, h: 5400 },
      },
      printify: { blueprint_id: 468 },
      printful: { catalog_id: 389 },
    },
    tote: {
      label: 'Tote Bag', emoji: '🛍️', w: 4200, h: 4200,
      areas: {
        front: { label: 'Front', x: 600, y: 800,  w: 3000, h: 2800 },
        back:  { label: 'Back',  x: 600, y: 800,  w: 3000, h: 2800 },
        full:  { label: 'Full',  x: 0,   y: 0,    w: 4200, h: 4200 },
      },
      printify: { blueprint_id: 77 },
      printful: { catalog_id: 218 },
    },
  };

  // ---- Fonts -----------------------------------------------------------
  const FONTS = [
    { id: 'bebas',    label: 'Bebas Neue',       stack: "'Bebas Neue',sans-serif" },
    { id: 'space',    label: 'Space Grotesk',    stack: "'Space Grotesk',sans-serif" },
    { id: 'mono',     label: 'JetBrains Mono',   stack: "'JetBrains Mono',monospace" },
    { id: 'oswald',   label: 'Oswald',           stack: "'Oswald',sans-serif" },
    { id: 'teko',     label: 'Teko',             stack: "'Teko',sans-serif" },
    { id: 'chakra',   label: 'Chakra Petch',     stack: "'Chakra Petch',sans-serif" },
    { id: 'blackops', label: 'Black Ops One',    stack: "'Black Ops One',sans-serif" },
    { id: 'marker',   label: 'Permanent Marker', stack: "'Permanent Marker',cursive" },
    { id: 'impact',   label: 'Impact',           stack: "Impact,'Arial Black',sans-serif" },
    { id: 'courier',  label: 'Courier',          stack: "'Courier New',monospace" },
  ];

  // ---- State -----------------------------------------------------------
  const state = {
    product: 'tshirt',
    area: 'front',
    bg: '#000000',
    bgImage: null,
    layers: [],
    selected: null,
    adminToken: '',
    blueprintId: null,
    printProviderId: null,
    printfulStoreId: null,
    productTitle: '',
    variants: [],
    // internal
    _mounted: false,
    _prevTab: 'dashboard',
  };

  // ---- Image cache -----------------------------------------------------
  const imgCache = new Map();

  function loadImage (url) {
    if (imgCache.has(url)) return imgCache.get(url);
    const promise = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    imgCache.set(url, promise);
    return promise;
  }

  // ---- UUID helper -----------------------------------------------------
  function uuid () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // ---- Canvas rendering ------------------------------------------------
  let canvas, ctx;

  function getCanvasSize () {
    const col = document.getElementById('ms-canvas-col');
    if (!col) return { w: 400, h: 500 };
    const prod = PRODUCTS[state.product];
    const area = prod.areas[state.area];
    const maxW = Math.min(col.clientWidth - 40, 460);
    const maxH = col.clientHeight - 40;
    const aspect = area.h / area.w;
    let w = maxW;
    let h = w * aspect;
    if (h > maxH) { h = maxH; w = h / aspect; }
    return { w: Math.floor(w), h: Math.floor(h) };
  }

  async function renderCanvas () {
    if (!canvas) return;
    const prod  = PRODUCTS[state.product];
    const area  = prod.areas[state.area];
    const { w, h } = getCanvasSize();

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);

    // background colour
    ctx.fillStyle = state.bg;
    ctx.fillRect(0, 0, w, h);

    // background image
    if (state.bgImage) {
      const img = await loadImage(state.bgImage);
      if (img) {
        ctx.save();
        ctx.drawImage(img, 0, 0, w, h);
        ctx.restore();
      }
    }

    // layers
    for (const layer of state.layers) {
      ctx.save();
      if (layer.type === 'image') await drawImageLayer(layer, area, w, h);
      if (layer.type === 'text')  drawTextLayer(layer, area, w, h);
      ctx.restore();
    }

    // print-area guide border (dashed)
    ctx.save();
    ctx.strokeStyle = 'rgba(255,215,0,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    const scale = w / area.w;
    ctx.strokeRect(0, 0, area.w * scale, area.h * scale);
    ctx.restore();

    // selected layer highlight
    if (state.selected) {
      const sel = state.layers.find(l => l.id === state.selected);
      if (sel) drawSelectionHandle(sel, area, w, h);
    }
  }

  function drawTextLayer (layer, area, cw, ch) {
    const scale = cw / area.w;
    ctx.globalAlpha = layer.opacity ?? 1;
    if (layer.shadow) {
      ctx.shadowColor = layer.shadowColor || '#000000';
      ctx.shadowBlur  = (layer.shadowBlur || 20) * scale;
    }
    const fontStack = (FONTS.find(f => f.id === layer.font) || FONTS[0]).stack;
    const style = [
      layer.italic ? 'italic' : '',
      layer.bold   ? 'bold'   : '600',
      ((layer.size || 320) * scale) + 'px',
      fontStack,
    ].filter(Boolean).join(' ');
    ctx.font = style;
    ctx.fillStyle = layer.color || '#ffffff';
    ctx.textAlign = layer.align || 'center';
    ctx.textBaseline = 'top';
    if (layer.letterSpacing) ctx.letterSpacing = (layer.letterSpacing * scale) + 'px';

    const raw = (layer.uppercase ? (layer.text || '').toUpperCase() : (layer.text || ''));
    const lines = raw.split('\n');
    const lh = (layer.lineHeight || 1.1) * (layer.size || 320) * scale;
    const totalH = lines.length * lh;
    let startY = (layer.y ?? 0.3) * ch - totalH / 2;

    const xPos = layer.align === 'left'  ? (layer.x ?? 0.5) * cw :
                 layer.align === 'right' ? (layer.x ?? 0.5) * cw :
                                           (layer.x ?? 0.5) * cw;

    for (const line of lines) {
      ctx.fillText(line, xPos, startY);
      startY += lh;
    }
    ctx.letterSpacing = '0px';
    ctx.shadowBlur = 0;
  }

  async function drawImageLayer (layer, area, cw, ch) {
    if (!layer.url) return;
    const img = await loadImage(layer.url);
    if (!img) return;

    ctx.globalAlpha = layer.opacity ?? 1;
    if (layer.blend && layer.blend !== 'normal') ctx.globalCompositeOperation = layer.blend;

    const drawW = (layer.scale || 0.5) * cw;
    const aspect = img.naturalHeight / img.naturalWidth;
    const drawH = drawW * aspect;
    const cx = (layer.x ?? 0.5) * cw;
    const cy = (layer.y ?? 0.5) * ch;

    ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawSelectionHandle (layer, area, cw, ch) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,215,0,0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);

    if (layer.type === 'text') {
      const scale = cw / area.w;
      const fontStack = (FONTS.find(f => f.id === layer.font) || FONTS[0]).stack;
      ctx.font = ((layer.size || 320) * scale) + 'px ' + fontStack;
      const raw = (layer.uppercase ? (layer.text || '').toUpperCase() : (layer.text || ''));
      const lines = raw.split('\n');
      const lh = (layer.lineHeight || 1.1) * (layer.size || 320) * scale;
      const totalH = lines.length * lh;
      const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
      const x = (layer.x ?? 0.5) * cw;
      const y = (layer.y ?? 0.3) * ch - totalH / 2;
      const pad = 8;
      const offX = layer.align === 'left' ? 0 : layer.align === 'right' ? -maxW : -maxW / 2;
      ctx.strokeRect(x + offX - pad, y - pad, maxW + pad * 2, totalH + pad * 2);
    } else if (layer.type === 'image') {
      const drawW = (layer.scale || 0.5) * cw;
      const cx = (layer.x ?? 0.5) * cw;
      const cy = (layer.y ?? 0.5) * ch;
      const pad = 8;
      ctx.strokeRect(cx - drawW / 2 - pad, cy - drawW / 2 - pad, drawW + pad * 2, drawW + pad * 2);
    }
    ctx.restore();
  }

  // ---- Render scheduling -----------------------------------------------
  let _rafPending = false;
  function scheduleRender () {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(() => {
      _rafPending = false;
      renderCanvas();
    });
  }

  // ---- Status message --------------------------------------------------
  let _statusTimer = null;
  function setStatus (msg, duration) {
    const el = document.getElementById('ms-status');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(_statusTimer);
    if (duration !== 0) {
      _statusTimer = setTimeout(() => el.classList.remove('visible'), duration || 3000);
    }
  }

  // ---- Build overlay HTML ---------------------------------------------
  function buildOverlay () {
    const ov = document.createElement('div');
    ov.className = 'ms-overlay';
    ov.id = 'ms-overlay';
    ov.innerHTML = buildTopbar() + buildBody();
    document.body.appendChild(ov);
    // vault modal (sibling)
    const vm = document.createElement('div');
    vm.className = 'ms-vault-modal';
    vm.id = 'ms-vault-modal';
    vm.innerHTML = `
      <div class="ms-vault-inner">
        <div class="ms-vault-head">
          <h3>Media Vault</h3>
          <button class="ms-close-btn" id="ms-vault-close">Close</button>
        </div>
        <div class="ms-vault-body">
          <div class="ms-vault-grid" id="ms-vault-grid"></div>
        </div>
      </div>`;
    document.body.appendChild(vm);
  }

  function buildTopbar () {
    const prod = PRODUCTS[state.product];
    const productTabs = Object.entries(PRODUCTS).map(([k, v]) =>
      `<button class="ms-product-tab${k === state.product ? ' active' : ''}" data-ms-product="${k}">
        <span class="emoji">${v.emoji}</span>${v.label}
      </button>`
    ).join('');

    const areaTabs = Object.entries(prod.areas).map(([k, v]) =>
      `<button class="ms-area-tab${k === state.area ? ' active' : ''}" data-ms-area="${k}">${v.label}</button>`
    ).join('');

    return `
    <div class="ms-topbar" id="ms-topbar">
      <span class="ms-topbar-title">Studio</span>
      <div class="ms-topbar-group" id="ms-product-tabs">${productTabs}</div>
      <div class="ms-topbar-sep"></div>
      <div class="ms-topbar-group" id="ms-area-tabs">${areaTabs}</div>
      <div class="ms-topbar-spacer"></div>
      <button class="ms-close-btn" id="ms-close-btn">✕ Close</button>
    </div>`;
  }

  function buildBody () {
    return `
    <div class="ms-body">
      ${buildLeftPanel()}
      <div class="ms-canvas-col" id="ms-canvas-col">
        <div class="ms-canvas-wrap" id="ms-canvas-wrap">
          <canvas id="ms-canvas"></canvas>
          <div class="ms-status" id="ms-status"></div>
        </div>
      </div>
      ${buildRightPanel()}
    </div>`;
  }

  function buildLeftPanel () {
    const cats = ['general', 'revolution', 'solidarity', 'pan-african', 'mutual-aid', 'diaspora', 'decolonize'];
    const catOpts = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    return `
    <div class="ms-left" id="ms-left">
      <div class="ms-section" id="ms-sec-slogan">
        <button class="ms-section-head" data-ms-toggle="ms-sec-slogan">
          Slogan Generator <span class="ms-chevron">▾</span>
        </button>
        <div class="ms-section-body">
          <span class="ms-label">Category</span>
          <select class="ms-select" id="ms-slogan-cat">${catOpts}</select>
          <button class="ms-btn primary" id="ms-slogan-gen">Generate slogans</button>
          <div class="ms-slogan-list" id="ms-slogan-list"></div>
        </div>
      </div>

      <div class="ms-section" id="ms-sec-bg">
        <button class="ms-section-head" data-ms-toggle="ms-sec-bg">
          Background <span class="ms-chevron">▾</span>
        </button>
        <div class="ms-section-body">
          <span class="ms-label">Color</span>
          <div class="ms-color-row">
            <input type="color" id="ms-bg-color" value="${state.bg}" />
            <span class="ms-color-hex" id="ms-bg-hex">${state.bg}</span>
          </div>
          <button class="ms-btn" id="ms-bg-vault-btn">BG image from vault</button>
          <button class="ms-btn danger" id="ms-bg-clear-btn" style="font-size:.7rem">Clear BG image</button>
        </div>
      </div>

      <div class="ms-section" id="ms-sec-add">
        <button class="ms-section-head" data-ms-toggle="ms-sec-add">
          Add Layer <span class="ms-chevron">▾</span>
        </button>
        <div class="ms-section-body">
          <button class="ms-btn primary" id="ms-add-text">+ Add text</button>
          <button class="ms-btn" id="ms-add-img-vault">+ Image from vault</button>
          <label class="ms-btn" style="cursor:pointer">
            + Upload image
            <input type="file" id="ms-upload-img" accept="image/*" style="display:none" />
          </label>
        </div>
      </div>

      <div class="ms-section" id="ms-sec-export">
        <button class="ms-section-head" data-ms-toggle="ms-sec-export">
          Export <span class="ms-chevron">▾</span>
        </button>
        <div class="ms-section-body">
          <button class="ms-btn" id="ms-dl-png">Download PNG (print)</button>
          <button class="ms-btn" id="ms-dl-web">Download PNG (web)</button>
        </div>
      </div>
    </div>`;
  }

  function buildRightPanel () {
    return `
    <div class="ms-right" id="ms-right">
      <div class="ms-section" id="ms-sec-layers">
        <button class="ms-section-head" data-ms-toggle="ms-sec-layers">
          Layers <span class="ms-chevron">▾</span>
        </button>
        <div class="ms-section-body">
          <ul class="ms-layer-list" id="ms-layer-list"></ul>
        </div>
      </div>

      <div class="ms-section" id="ms-sec-controls">
        <button class="ms-section-head" data-ms-toggle="ms-sec-controls">
          Layer Controls <span class="ms-chevron">▾</span>
        </button>
        <div class="ms-section-body" id="ms-layer-controls">
          <p class="ms-no-layer">Select a layer to edit it.</p>
        </div>
      </div>

      <div class="ms-section" id="ms-sec-printify">
        <button class="ms-section-head" data-ms-toggle="ms-sec-printify">
          Push to Printify <span class="ms-chevron">▾</span>
        </button>
        <div class="ms-section-body">
          <div class="ms-push-section">
            <div class="ms-push-title">PRINTIFY</div>
            <span class="ms-label">Admin token</span>
            <input class="ms-input" id="ms-py-token" type="password" placeholder="Admin token" autocomplete="off" />
            <span class="ms-label">Blueprint ID</span>
            <input class="ms-input" id="ms-py-blueprint" type="number" placeholder="5" />
            <span class="ms-label">Print provider ID</span>
            <input class="ms-input" id="ms-py-provider" type="number" placeholder="1" />
            <span class="ms-label">Product title</span>
            <input class="ms-input" id="ms-py-title" placeholder="ANARCHISM.AFRICA · T-Shirt" />
            <button class="ms-btn primary" id="ms-py-push">Upload + create product</button>
            <div id="ms-py-status" class="mono" style="font-size:.72rem;color:var(--muted);min-height:16px;margin-top:4px"></div>
          </div>
        </div>
      </div>

      <div class="ms-section" id="ms-sec-printful">
        <button class="ms-section-head" data-ms-toggle="ms-sec-printful">
          Push to Printful <span class="ms-chevron">▾</span>
        </button>
        <div class="ms-section-body">
          <div class="ms-push-section">
            <div class="ms-push-title">PRINTFUL</div>
            <span class="ms-label">Admin token</span>
            <input class="ms-input" id="ms-pf-token" type="password" placeholder="Admin token" autocomplete="off" />
            <span class="ms-label">Store ID (optional)</span>
            <input class="ms-input" id="ms-pf-store" placeholder="auto-detect" />
            <span class="ms-label">Catalog product ID</span>
            <input class="ms-input" id="ms-pf-catalog" type="number" placeholder="71" />
            <span class="ms-label">Product name</span>
            <input class="ms-input" id="ms-pf-title" placeholder="ANARCHISM.AFRICA · T-Shirt" />
            <button class="ms-btn primary" id="ms-pf-push">Upload + create product</button>
            <div id="ms-pf-status" class="mono" style="font-size:.72rem;color:var(--muted);min-height:16px;margin-top:4px"></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ---- Layer list render -----------------------------------------------
  function renderLayerList () {
    const ul = document.getElementById('ms-layer-list');
    if (!ul) return;
    if (!state.layers.length) {
      ul.innerHTML = '<p class="ms-no-layer">No layers yet. Add text or an image.</p>';
      return;
    }
    ul.innerHTML = state.layers.map((l, i) => {
      const icon  = l.type === 'text' ? '𝐓' : '🖼';
      const label = l.type === 'text'
        ? (l.text || 'Text').replace(/\n/g, ' ').slice(0, 22)
        : (l.url ? 'Image' : 'Image (empty)');
      return `
        <li class="ms-layer-row${l.id === state.selected ? ' active' : ''}" data-ms-layer="${l.id}">
          <span class="ms-layer-icon">${icon}</span>
          <span class="ms-layer-label">${escHtml(label)}</span>
          <span class="ms-layer-moves">
            ${i > 0 ? `<button data-ms-move-up="${l.id}" title="Move up">↑</button>` : ''}
            ${i < state.layers.length - 1 ? `<button data-ms-move-down="${l.id}" title="Move down">↓</button>` : ''}
          </span>
        </li>`;
    }).join('');
  }

  // ---- Layer controls render -------------------------------------------
  function renderLayerControls () {
    const host = document.getElementById('ms-layer-controls');
    if (!host) return;

    const layer = state.selected ? state.layers.find(l => l.id === state.selected) : null;
    if (!layer) { host.innerHTML = '<p class="ms-no-layer">Select a layer to edit it.</p>'; return; }

    if (layer.type === 'text') {
      const fontOpts = FONTS.map(f => `<option value="${f.id}"${f.id === layer.font ? ' selected' : ''}>${f.label}</option>`).join('');
      host.innerHTML = `
        <div class="ms-controls">
          <div class="ms-control-row">
            <span class="ms-label">Text</span>
            <textarea class="ms-textarea" id="ms-ctrl-text" rows="3">${escHtml(layer.text || '')}</textarea>
          </div>
          <div class="ms-control-row">
            <span class="ms-label">Font</span>
            <select class="ms-select" id="ms-ctrl-font">${fontOpts}</select>
          </div>
          <div class="ms-control-row">
            <span class="ms-label">Size <span class="ms-slider-val" id="ms-ctrl-size-val">${layer.size}</span></span>
            <input type="range" class="ms-range" id="ms-ctrl-size" min="30" max="800" step="5" value="${layer.size}" />
          </div>
          <div class="ms-control-row">
            <span class="ms-label">Color</span>
            <div class="ms-color-row">
              <input type="color" id="ms-ctrl-color" value="${layer.color}" />
              <span class="ms-color-hex" id="ms-ctrl-color-hex">${layer.color}</span>
            </div>
          </div>
          <div class="ms-control-row">
            <span class="ms-label">Align</span>
            <div class="ms-align-row">
              <button class="ms-btn${layer.align === 'left'   ? ' active-toggle' : ''}" data-ms-align="left">Left</button>
              <button class="ms-btn${layer.align === 'center' ? ' active-toggle' : ''}" data-ms-align="center">Center</button>
              <button class="ms-btn${layer.align === 'right'  ? ' active-toggle' : ''}" data-ms-align="right">Right</button>
            </div>
          </div>
          <div class="ms-control-row">
            <div class="ms-btn-row">
              <button class="ms-btn${layer.bold      ? ' active-toggle' : ''}" data-ms-toggle-prop="bold">Bold</button>
              <button class="ms-btn${layer.italic    ? ' active-toggle' : ''}" data-ms-toggle-prop="italic">Italic</button>
              <button class="ms-btn${layer.uppercase ? ' active-toggle' : ''}" data-ms-toggle-prop="uppercase">Caps</button>
              <button class="ms-btn${layer.shadow    ? ' active-toggle' : ''}" data-ms-toggle-prop="shadow">Shadow</button>
            </div>
          </div>
          ${layer.shadow ? `
          <div class="ms-control-row">
            <span class="ms-label">Shadow color</span>
            <input type="color" id="ms-ctrl-shadow-color" value="${layer.shadowColor || '#000000'}" />
          </div>
          <div class="ms-control-row">
            <span class="ms-label">Shadow blur <span class="ms-slider-val" id="ms-ctrl-sblur-val">${layer.shadowBlur || 20}</span></span>
            <input type="range" class="ms-range" id="ms-ctrl-sblur" min="0" max="80" value="${layer.shadowBlur || 20}" />
          </div>` : ''}
          <div class="ms-control-row">
            <span class="ms-label">Letter spacing <span class="ms-slider-val" id="ms-ctrl-ls-val">${layer.letterSpacing}</span></span>
            <input type="range" class="ms-range" id="ms-ctrl-ls" min="0" max="120" value="${layer.letterSpacing}" />
          </div>
          <div class="ms-control-row">
            <span class="ms-label">Line height <span class="ms-slider-val" id="ms-ctrl-lh-val">${layer.lineHeight}</span></span>
            <input type="range" class="ms-range" id="ms-ctrl-lh" min="0.7" max="2.5" step="0.05" value="${layer.lineHeight}" />
          </div>
          <div class="ms-control-row">
            <span class="ms-label">Opacity <span class="ms-slider-val" id="ms-ctrl-op-val">${layer.opacity}</span></span>
            <input type="range" class="ms-range" id="ms-ctrl-op" min="0" max="1" step="0.05" value="${layer.opacity}" />
          </div>
          <div class="ms-control-row">
            <span class="ms-label">X position <span class="ms-slider-val" id="ms-ctrl-x-val">${layer.x.toFixed(2)}</span></span>
            <input type="range" class="ms-range" id="ms-ctrl-x" min="0" max="1" step="0.01" value="${layer.x}" />
          </div>
          <div class="ms-control-row">
            <span class="ms-label">Y position <span class="ms-slider-val" id="ms-ctrl-y-val">${layer.y.toFixed(2)}</span></span>
            <input type="range" class="ms-range" id="ms-ctrl-y" min="0" max="1" step="0.01" value="${layer.y}" />
          </div>
          <div class="ms-divider"></div>
          <button class="ms-btn danger" id="ms-del-layer">Delete layer</button>
        </div>`;
    } else if (layer.type === 'image') {
      const blendModes = ['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion'];
      const blendOpts = blendModes.map(m => `<option value="${m}"${m === layer.blend ? ' selected' : ''}>${m}</option>`).join('');
      host.innerHTML = `
        <div class="ms-controls">
          <div class="ms-control-row">
            <span class="ms-label">Scale <span class="ms-slider-val" id="ms-ctrl-scale-val">${layer.scale.toFixed(2)}</span></span>
            <input type="range" class="ms-range" id="ms-ctrl-scale" min="0.05" max="2" step="0.05" value="${layer.scale}" />
          </div>
          <div class="ms-control-row">
            <span class="ms-label">X position <span class="ms-slider-val" id="ms-ctrl-x-val">${layer.x.toFixed(2)}</span></span>
            <input type="range" class="ms-range" id="ms-ctrl-x" min="0" max="1" step="0.01" value="${layer.x}" />
          </div>
          <div class="ms-control-row">
            <span class="ms-label">Y position <span class="ms-slider-val" id="ms-ctrl-y-val">${layer.y.toFixed(2)}</span></span>
            <input type="range" class="ms-range" id="ms-ctrl-y" min="0" max="1" step="0.01" value="${layer.y}" />
          </div>
          <div class="ms-control-row">
            <span class="ms-label">Opacity <span class="ms-slider-val" id="ms-ctrl-op-val">${layer.opacity}</span></span>
            <input type="range" class="ms-range" id="ms-ctrl-op" min="0" max="1" step="0.05" value="${layer.opacity}" />
          </div>
          <div class="ms-control-row">
            <span class="ms-label">Blend mode</span>
            <select class="ms-select" id="ms-ctrl-blend">${blendOpts}</select>
          </div>
          <div class="ms-divider"></div>
          <button class="ms-btn danger" id="ms-del-layer">Delete layer</button>
        </div>`;
    }

    wireLayerControls(layer);
  }

  function wireLayerControls (layer) {
    function upd (key, val) {
      layer[key] = val;
      scheduleRender();
    }

    const bind = (id, key, parse) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', e => {
        const v = parse ? parse(e.target.value) : e.target.value;
        upd(key, v);
        const valEl = document.getElementById(id + '-val');
        if (valEl) valEl.textContent = typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(2)) : v;
        if (id === 'ms-ctrl-color') { const h = document.getElementById('ms-ctrl-color-hex'); if (h) h.textContent = v; }
      });
    };

    bind('ms-ctrl-text',         'text');
    bind('ms-ctrl-font',         'font');
    bind('ms-ctrl-size',         'size',         Number);
    bind('ms-ctrl-color',        'color');
    bind('ms-ctrl-ls',           'letterSpacing', Number);
    bind('ms-ctrl-lh',           'lineHeight',    parseFloat);
    bind('ms-ctrl-op',           'opacity',       parseFloat);
    bind('ms-ctrl-x',            'x',             parseFloat);
    bind('ms-ctrl-y',            'y',             parseFloat);
    bind('ms-ctrl-scale',        'scale',         parseFloat);
    bind('ms-ctrl-blend',        'blend');
    bind('ms-ctrl-shadow-color', 'shadowColor');
    bind('ms-ctrl-sblur',        'shadowBlur',    Number);

    // align buttons
    document.querySelectorAll('[data-ms-align]').forEach(btn => {
      btn.addEventListener('click', () => {
        upd('align', btn.dataset.msAlign);
        renderLayerControls();
      });
    });

    // toggle props (bold, italic, uppercase, shadow)
    document.querySelectorAll('[data-ms-toggle-prop]').forEach(btn => {
      btn.addEventListener('click', () => {
        const prop = btn.dataset.msToggleProp;
        upd(prop, !layer[prop]);
        renderLayerControls();
      });
    });

    // delete
    const delBtn = document.getElementById('ms-del-layer');
    if (delBtn) delBtn.addEventListener('click', () => {
      state.layers = state.layers.filter(l => l.id !== layer.id);
      state.selected = null;
      renderLayerList();
      renderLayerControls();
      scheduleRender();
    });

    // textarea live update
    const ta = document.getElementById('ms-ctrl-text');
    if (ta) ta.addEventListener('input', () => {
      renderLayerList(); // refresh label in list
    });
  }

  // ---- Area tabs rebuild -----------------------------------------------
  function rebuildAreaTabs () {
    const host = document.getElementById('ms-area-tabs');
    if (!host) return;
    const prod = PRODUCTS[state.product];
    // ensure area is valid for new product
    if (!prod.areas[state.area]) state.area = Object.keys(prod.areas)[0];
    host.innerHTML = Object.entries(prod.areas).map(([k, v]) =>
      `<button class="ms-area-tab${k === state.area ? ' active' : ''}" data-ms-area="${k}">${v.label}</button>`
    ).join('');
    prefillPODInputs();
  }

  function prefillPODInputs () {
    const prod = PRODUCTS[state.product];
    const bpEl = document.getElementById('ms-py-blueprint');
    const ppEl = document.getElementById('ms-py-provider');
    const pfEl = document.getElementById('ms-pf-catalog');
    if (bpEl && !bpEl.value) bpEl.value = (prod.printify && prod.printify.blueprint_id) || '';
    if (ppEl && !ppEl.value) ppEl.value = (prod.printify && prod.printify.print_provider_id) || '';
    if (pfEl && !pfEl.value) pfEl.value = (prod.printful && prod.printful.catalog_id) || '';
    const titleEl = document.getElementById('ms-py-title');
    const pfTitleEl = document.getElementById('ms-pf-title');
    const def = `ANARCHISM.AFRICA · ${prod.label}`;
    if (titleEl && !titleEl.value) titleEl.value = def;
    if (pfTitleEl && !pfTitleEl.value) pfTitleEl.value = def;
  }

  // ---- Slogan generator ------------------------------------------------
  async function generateSlogans () {
    const cat = (document.getElementById('ms-slogan-cat') || {}).value || 'revolution';
    const list = document.getElementById('ms-slogan-list');
    if (!list) return;
    list.innerHTML = '<span style="color:var(--muted);font-size:.78rem">Generating…</span>';
    setStatus('Generating slogans…', 0);
    try {
      const r = await fetch('/api/ai/generate-slogans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 10, categories: [cat] })
      });
      const data = await r.json();
      const slogans = Array.isArray(data.slogans) ? data.slogans
                    : Array.isArray(data)          ? data
                    : data.data || [];
      if (!slogans.length) {
        list.innerHTML = '<span style="color:var(--muted);font-size:.78rem">No slogans returned.</span>';
        setStatus('No slogans returned');
        return;
      }
      list.innerHTML = slogans.map(s => {
        const text = typeof s === 'string' ? s : (s.text || s.slogan || JSON.stringify(s));
        return `<button class="ms-slogan-chip" data-slogan="${escAttr(text)}">${escHtml(text)}</button>`;
      }).join('');
      setStatus('Slogans ready — click one to add as text layer');
    } catch (e) {
      list.innerHTML = `<span style="color:var(--red,#e74c3c);font-size:.78rem">Error: ${escHtml(e.message)}</span>`;
      setStatus('Error generating slogans');
    }
  }

  // ---- Vault picker ----------------------------------------------------
  let _vaultCallback = null;

  async function openVault (callback) {
    _vaultCallback = callback;
    const modal = document.getElementById('ms-vault-modal');
    const grid  = document.getElementById('ms-vault-grid');
    if (!modal || !grid) return;
    modal.classList.add('open');
    grid.innerHTML = '<p class="ms-vault-empty">Loading vault…</p>';
    try {
      const r = await fetch('/api/archive/list');
      const data = await r.json();
      const items = (data.items || []).filter(item => {
        const mt = (item.mimeType || item.mime || '').toLowerCase();
        return mt.startsWith('image/') ||
               /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(item.url || '');
      });
      if (!items.length) {
        grid.innerHTML = '<p class="ms-vault-empty">No images in vault yet. Upload some via the Archive section.</p>';
        return;
      }
      grid.innerHTML = items.map(item => `
        <div class="ms-vault-item" data-vault-url="${escAttr(item.url)}" title="${escAttr(item.title || '')}">
          <img src="${escAttr(item.url)}" alt="${escAttr(item.title || '')}" loading="lazy" />
        </div>`).join('');
    } catch (e) {
      grid.innerHTML = `<p class="ms-vault-empty" style="color:var(--red,#e74c3c)">Error: ${escHtml(e.message)}</p>`;
    }
  }

  function closeVault () {
    const modal = document.getElementById('ms-vault-modal');
    if (modal) modal.classList.remove('open');
    _vaultCallback = null;
  }

  // ---- POD push: Printify ----------------------------------------------
  async function pushToPrintify () {
    const token     = (document.getElementById('ms-py-token')     || {}).value || '';
    const blueprint = (document.getElementById('ms-py-blueprint') || {}).value || '';
    const provider  = (document.getElementById('ms-py-provider')  || {}).value || '';
    const title     = (document.getElementById('ms-py-title')     || {}).value || '';
    const statusEl  = document.getElementById('ms-py-status');

    function pyStatus (msg) {
      if (statusEl) statusEl.textContent = msg;
      setStatus(msg, 0);
    }

    if (!token) { pyStatus('Enter admin token first.'); return; }

    pyStatus('Rendering high-res canvas…');
    const prod     = PRODUCTS[state.product];
    const area     = prod.areas[state.area];
    const hiRes    = document.createElement('canvas');
    hiRes.width    = area.w;
    hiRes.height   = area.h;
    const savedCanvas = canvas, savedCtx = ctx;
    canvas = hiRes; ctx = hiRes.getContext('2d');
    await renderCanvas();
    canvas = savedCanvas; ctx = savedCtx;

    const b64 = hiRes.toDataURL('image/png').split(',')[1];

    pyStatus('Uploading to Printify…');
    try {
      const uploadR = await fetch('/api/pod/printify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-aa-admin-token': token },
        body: JSON.stringify({ op: 'upload', imageB64: b64, fileName: `aa-${state.product}-${state.area}-${Date.now()}.png` })
      });
      const uploadData = await uploadR.json();
      if (!uploadR.ok) throw new Error(uploadData.error || 'Upload failed');

      pyStatus('Creating product…');
      const bpId = parseInt(blueprint) || prod.printify.blueprint_id;
      const ppId = parseInt(provider)  || prod.printify.print_provider_id;
      const createR = await fetch('/api/pod/printify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-aa-admin-token': token },
        body: JSON.stringify({
          op: 'product',
          blueprintId: bpId,
          printProviderId: ppId,
          title: title || `ANARCHISM.AFRICA · ${prod.label}`,
          printAreas: [{ position: state.area === 'full' ? 'front' : state.area, imageId: uploadData.id, scale: 1, x: 0.5, y: 0.5 }],
          variants: state.variants || []
        })
      });
      const createData = await createR.json();
      if (!createR.ok) throw new Error(createData.error || 'Product creation failed');

      pyStatus(`Done! Product ID: ${createData.id || createData.product?.id || 'created'}`);
      setStatus('Product created on Printify!');
    } catch (e) {
      pyStatus('Error: ' + e.message);
      setStatus('Printify push failed');
    }
  }

  // ---- POD push: Printful ----------------------------------------------
  async function pushToPrintful () {
    const token    = (document.getElementById('ms-pf-token')   || {}).value || '';
    const storeId  = (document.getElementById('ms-pf-store')   || {}).value || '';
    const catalogId = (document.getElementById('ms-pf-catalog') || {}).value || '';
    const title    = (document.getElementById('ms-pf-title')   || {}).value || '';
    const statusEl = document.getElementById('ms-pf-status');

    function pfStatus (msg) {
      if (statusEl) statusEl.textContent = msg;
      setStatus(msg, 0);
    }

    if (!token) { pfStatus('Enter admin token first.'); return; }

    pfStatus('Rendering high-res canvas…');
    const prod  = PRODUCTS[state.product];
    const area  = prod.areas[state.area];
    const hiRes = document.createElement('canvas');
    hiRes.width  = area.w;
    hiRes.height = area.h;
    const savedCanvas = canvas, savedCtx = ctx;
    canvas = hiRes; ctx = hiRes.getContext('2d');
    await renderCanvas();
    canvas = savedCanvas; ctx = savedCtx;

    const b64 = hiRes.toDataURL('image/png').split(',')[1];

    pfStatus('Uploading to Printful…');
    try {
      const uploadR = await fetch('/api/pod/printful', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-aa-admin-token': token },
        body: JSON.stringify({ op: 'upload', imageB64: b64, fileName: `aa-${state.product}-${state.area}-${Date.now()}.png` })
      });
      const uploadData = await uploadR.json();
      if (!uploadR.ok) throw new Error(uploadData.error || 'Upload failed');

      pfStatus('Creating sync product…');
      const catId = parseInt(catalogId) || prod.printful.catalog_id;
      const bodyPayload = {
        op: 'product',
        storeId: storeId || undefined,
        syncProduct: {
          name: title || `ANARCHISM.AFRICA · ${prod.label}`,
          thumbnail: uploadData.preview_url || uploadData.url || '',
        },
        syncVariants: [{
          catalog_variant_id: catId,
          files: [{ type: 'default', id: uploadData.id }]
        }]
      };
      const createR = await fetch('/api/pod/printful', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-aa-admin-token': token },
        body: JSON.stringify(bodyPayload)
      });
      const createData = await createR.json();
      if (!createR.ok) throw new Error(createData.error || 'Product creation failed');

      pfStatus(`Done! Product ID: ${createData.id || 'created'}`);
      setStatus('Product created on Printful!');
    } catch (e) {
      pfStatus('Error: ' + e.message);
      setStatus('Printful push failed');
    }
  }

  // ---- Download helpers ------------------------------------------------
  function downloadCanvas (hi) {
    const prod  = PRODUCTS[state.product];
    const area  = prod.areas[state.area];
    const dl    = document.createElement('canvas');
    if (hi) {
      dl.width  = area.w;
      dl.height = area.h;
    } else {
      const { w, h } = getCanvasSize();
      dl.width = w * 2; dl.height = h * 2;
    }
    const savedCanvas = canvas, savedCtx = ctx;
    canvas = dl; ctx = dl.getContext('2d');
    renderCanvas().then(() => {
      canvas = savedCanvas; ctx = savedCtx;
      const a = document.createElement('a');
      a.download = `aa-${state.product}-${state.area}-${hi ? 'print' : 'web'}.png`;
      a.href = dl.toDataURL('image/png');
      a.click();
      setStatus('Downloading…');
    });
  }

  // ---- Canvas click → select layer ------------------------------------
  function handleCanvasClick (e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cw = canvas.width;
    const ch = canvas.height;
    const prod = PRODUCTS[state.product];
    const area = prod.areas[state.area];

    // Check layers in reverse (top-most first)
    for (let i = state.layers.length - 1; i >= 0; i--) {
      const l = state.layers[i];
      if (l.type === 'text') {
        const scale = cw / area.w;
        ctx.font = ((l.size || 320) * scale) + 'px ' + ((FONTS.find(f => f.id === l.font) || FONTS[0]).stack);
        const raw = l.uppercase ? (l.text || '').toUpperCase() : (l.text || '');
        const lines = raw.split('\n');
        const maxW = Math.max(...lines.map(ln => ctx.measureText(ln).width));
        const lh = (l.lineHeight || 1.1) * (l.size || 320) * scale;
        const totalH = lines.length * lh;
        const lx = (l.x ?? 0.5) * cw;
        const ly = (l.y ?? 0.3) * ch - totalH / 2;
        const offX = l.align === 'left' ? 0 : l.align === 'right' ? -maxW : -maxW / 2;
        if (mx >= lx + offX - 8 && mx <= lx + offX + maxW + 8 &&
            my >= ly - 8 && my <= ly + totalH + 8) {
          state.selected = l.id; renderLayerList(); renderLayerControls(); scheduleRender(); return;
        }
      } else if (l.type === 'image') {
        const drawW = (l.scale || 0.5) * cw;
        const cx2 = (l.x ?? 0.5) * cw;
        const cy2 = (l.y ?? 0.5) * ch;
        if (mx >= cx2 - drawW / 2 - 8 && mx <= cx2 + drawW / 2 + 8 &&
            my >= cy2 - drawW / 2 - 8 && my <= cy2 + drawW / 2 + 8) {
          state.selected = l.id; renderLayerList(); renderLayerControls(); scheduleRender(); return;
        }
      }
    }
    state.selected = null; renderLayerList(); renderLayerControls(); scheduleRender();
  }

  // ---- Wire up all events ---------------------------------------------
  function wireEvents () {
    const ov = document.getElementById('ms-overlay');
    if (!ov) return;

    // Close button
    document.getElementById('ms-close-btn')?.addEventListener('click', closeStudio);

    // Product tabs
    ov.addEventListener('click', e => {
      const pt = e.target.closest('[data-ms-product]');
      if (pt) {
        state.product = pt.dataset.msProduct;
        state.area = Object.keys(PRODUCTS[state.product].areas)[0];
        ov.querySelectorAll('.ms-product-tab').forEach(b => b.classList.toggle('active', b.dataset.msProduct === state.product));
        rebuildAreaTabs();
        scheduleRender();
        return;
      }

      const at = e.target.closest('[data-ms-area]');
      if (at) {
        state.area = at.dataset.msArea;
        ov.querySelectorAll('.ms-area-tab').forEach(b => b.classList.toggle('active', b.dataset.msArea === state.area));
        scheduleRender();
        return;
      }

      // Section toggle
      const st = e.target.closest('[data-ms-toggle]');
      if (st) {
        const sec = document.getElementById(st.dataset.msToggle);
        if (sec) sec.classList.toggle('collapsed');
        return;
      }

      // Layer click
      const lr = e.target.closest('[data-ms-layer]');
      if (lr) {
        state.selected = lr.dataset.msLayer;
        renderLayerList();
        renderLayerControls();
        scheduleRender();
        return;
      }

      // Move up/down
      const mu = e.target.closest('[data-ms-move-up]');
      if (mu) {
        const id = mu.dataset.msMoveUp;
        const idx = state.layers.findIndex(l => l.id === id);
        if (idx > 0) { [state.layers[idx-1], state.layers[idx]] = [state.layers[idx], state.layers[idx-1]]; }
        renderLayerList(); scheduleRender(); return;
      }
      const md = e.target.closest('[data-ms-move-down]');
      if (md) {
        const id = md.dataset.msMoveDown;
        const idx = state.layers.findIndex(l => l.id === id);
        if (idx < state.layers.length - 1) { [state.layers[idx+1], state.layers[idx]] = [state.layers[idx], state.layers[idx+1]]; }
        renderLayerList(); scheduleRender(); return;
      }

      // Slogan chip
      const chip = e.target.closest('.ms-slogan-chip');
      if (chip) {
        addTextLayer(chip.dataset.slogan || chip.textContent);
        return;
      }
    });

    // BG color
    document.getElementById('ms-bg-color')?.addEventListener('input', e => {
      state.bg = e.target.value;
      const hex = document.getElementById('ms-bg-hex');
      if (hex) hex.textContent = e.target.value;
      scheduleRender();
    });

    // BG clear
    document.getElementById('ms-bg-clear-btn')?.addEventListener('click', () => {
      state.bgImage = null;
      scheduleRender();
    });

    // BG from vault
    document.getElementById('ms-bg-vault-btn')?.addEventListener('click', () => {
      openVault(url => { state.bgImage = url; scheduleRender(); closeVault(); });
    });

    // Add text
    document.getElementById('ms-add-text')?.addEventListener('click', () => addTextLayer('NO GODS\nNO MASTERS'));

    // Add image from vault
    document.getElementById('ms-add-img-vault')?.addEventListener('click', () => {
      openVault(url => { addImageLayer(url); closeVault(); });
    });

    // Upload image
    document.getElementById('ms-upload-img')?.addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      const url = URL.createObjectURL(file);
      addImageLayer(url);
      e.target.value = '';
    });

    // Slogan generate
    document.getElementById('ms-slogan-gen')?.addEventListener('click', generateSlogans);

    // Download
    document.getElementById('ms-dl-png')?.addEventListener('click', () => downloadCanvas(true));
    document.getElementById('ms-dl-web')?.addEventListener('click', () => downloadCanvas(false));

    // POD push
    document.getElementById('ms-py-push')?.addEventListener('click', pushToPrintify);
    document.getElementById('ms-pf-push')?.addEventListener('click', pushToPrintful);

    // Canvas click
    canvas?.addEventListener('click', handleCanvasClick);

    // Vault
    document.getElementById('ms-vault-close')?.addEventListener('click', closeVault);
    document.getElementById('ms-vault-modal')?.addEventListener('click', e => {
      if (e.target.id === 'ms-vault-modal') closeVault();
      const vi = e.target.closest('[data-vault-url]');
      if (vi && _vaultCallback) { _vaultCallback(vi.dataset.vaultUrl); }
    });
  }

  // ---- Layer factories -------------------------------------------------
  function addTextLayer (text) {
    const layer = {
      id: uuid(), type: 'text',
      text: text || 'NO GODS\nNO MASTERS',
      font: 'bebas', size: 320, color: '#ffffff', align: 'center',
      bold: false, italic: false, uppercase: true,
      letterSpacing: 20, lineHeight: 1.1,
      x: 0.5, y: 0.3, opacity: 1,
      shadow: false, shadowColor: '#000000', shadowBlur: 20,
    };
    state.layers.push(layer);
    state.selected = layer.id;
    renderLayerList();
    renderLayerControls();
    scheduleRender();
  }

  function addImageLayer (url) {
    const layer = {
      id: uuid(), type: 'image',
      url, x: 0.5, y: 0.5, scale: 0.5, opacity: 1, blend: 'normal', fit: 'contain',
    };
    state.layers.push(layer);
    state.selected = layer.id;
    // preload
    loadImage(url).then(() => scheduleRender());
    renderLayerList();
    renderLayerControls();
  }

  // ---- Close / open studio ---------------------------------------------
  function closeStudio () {
    const ov = document.getElementById('ms-overlay');
    if (ov) ov.classList.remove('open');
    // Click the previous tab
    const fakeTab = document.querySelector(`.tabs .tab[data-tab="${state._prevTab}"]`);
    if (fakeTab) fakeTab.click();
  }

  // ---- Mount -----------------------------------------------------------
  function mount (prevTab) {
    if (prevTab) state._prevTab = prevTab;
    if (!state._mounted) {
      buildOverlay();
      canvas = document.getElementById('ms-canvas');
      ctx    = canvas.getContext('2d');
      wireEvents();
      prefillPODInputs();
      state._mounted = true;
    }
    const ov = document.getElementById('ms-overlay');
    if (ov) ov.classList.add('open');

    // Size canvas now
    const { w, h } = getCanvasSize();
    canvas.width  = w;
    canvas.height = h;

    renderLayerList();
    renderLayerControls();
    scheduleRender();
  }

  // ---- Helpers ---------------------------------------------------------
  function escHtml (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function escAttr (s) { return escHtml(s); }

  // ---- Public API ------------------------------------------------------
  window.MerchStudio = {
    render (opts) {
      const prevTab = (opts && opts.prevTab) || 'dashboard';
      mount(prevTab);
    },
    addText: addTextLayer,
    addImage: addImageLayer,
  };

})();
