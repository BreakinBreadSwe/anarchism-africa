/* ANARCHISM.AFRICA — never-empty, never-duplicate thumbnails
 *
 * Procedural SVG thumbnail generator. Every content item gets a UNIQUE
 * monochrome geometric thumbnail derived deterministically from its id +
 * kind + title. Two roles:
 *
 *   1. Fallback — when an item has no image (scraper output, AI drafts,
 *      manual entries that forgot the field), generate a proper one.
 *   2. Dedupe — when the same image URL is reused across cards in a render
 *      cycle, replace later occurrences with procedural ones so no two
 *      thumbnails ever look the same on screen.
 *
 * Auto-mounts via MutationObserver — scans every `.thumb` and `.hero-bg`
 * element with a background-image style; if missing or duplicate, swaps in
 * a procedural SVG data-URL.
 *
 * Public API: window.AA.thumb(seed, kind, title?)
 *   → returns a data: URL ready for `background-image:url(...)`.
 */
(function () {
  'use strict';

  // ------- deterministic seed -------------------------------------------
  function hash (str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function rng (seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
  }

  // ------- pattern library (8 distinct on-brand looks) ------------------
  const PATTERNS = ['continent', 'rings', 'kente', 'waves', 'starburst', 'grid', 'tessellation', 'sankofa'];

  function patternContinent (r, label, accent) {
    // Simplified Africa silhouette with a big A inside
    return `
      <path d="M120 60 Q170 50 220 60 Q260 75 270 100 Q278 122 268 145 Q260 170 252 195 Q244 220 232 240 Q210 252 195 240 Q175 220 160 195 Q140 165 130 138 Q120 110 120 60 Z" fill="${accent}"/>
      <text x="200" y="180" text-anchor="middle" font-family="'Bebas Neue',Impact,sans-serif" font-size="120" font-weight="900" fill="#000">A</text>
      <text x="380" y="285" text-anchor="end" font-family="'JetBrains Mono',monospace" font-size="14" fill="${accent}" opacity=".7" letter-spacing="2">${label}</text>`;
  }
  function patternRings (r, label, accent) {
    const cx = 80 + Math.floor(r() * 240), cy = 80 + Math.floor(r() * 140);
    let rings = '';
    const n = 4 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) {
      rings += `<circle cx="${cx}" cy="${cy}" r="${20 + i * (15 + r() * 12)}" fill="none" stroke="${accent}" stroke-width="${1 + r() * 3}" opacity="${0.2 + r() * 0.7}"/>`;
    }
    return rings + `<circle cx="${cx}" cy="${cy}" r="6" fill="${accent}"/>
      <text x="20" y="285" font-family="'Bebas Neue',sans-serif" font-size="48" fill="${accent}" letter-spacing="2">${label}</text>`;
  }
  function patternKente (r, label, accent) {
    let bands = '';
    let y = 0;
    while (y < 300) {
      const h = 4 + Math.floor(r() * 22);
      const op = 0.15 + r() * 0.85;
      bands += `<rect x="0" y="${y}" width="400" height="${h}" fill="${accent}" opacity="${op.toFixed(2)}"/>`;
      y += h + 2;
    }
    return bands + `<rect x="40" y="120" width="60" height="60" fill="#000"/>
      <text x="70" y="160" text-anchor="middle" font-family="'Bebas Neue',sans-serif" font-size="42" font-weight="900" fill="${accent}" letter-spacing="0">${label}</text>`;
  }
  function patternWaves (r, label, accent) {
    let waves = '';
    const n = 5 + Math.floor(r() * 5);
    const amp = 14 + r() * 18;
    for (let i = 0; i < n; i++) {
      const y = 30 + i * (240 / n);
      let d = `M0 ${y}`;
      const seg = 6 + Math.floor(r() * 6);
      const w = 400 / seg;
      for (let s = 0; s <= seg; s++) {
        const dy = (s % 2 === 0 ? -amp : amp);
        d += ` Q${s * w + w/2} ${y + dy} ${(s+1) * w} ${y}`;
      }
      waves += `<path d="${d}" fill="none" stroke="${accent}" stroke-width="${1 + r()*2.5}" opacity="${0.3 + r()*0.6}"/>`;
    }
    return waves + `<text x="200" y="170" text-anchor="middle" font-family="'Bebas Neue',sans-serif" font-size="120" font-weight="900" fill="${accent}" opacity=".95" letter-spacing="0">${label}</text>`;
  }
  function patternStarburst (r, label, accent) {
    const cx = 200, cy = 150;
    let rays = '';
    const n = 12 + Math.floor(r() * 16);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + r() * 0.15;
      const len = 60 + r() * 120;
      const x2 = cx + Math.cos(ang) * len;
      const y2 = cy + Math.sin(ang) * len;
      rays += `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${accent}" stroke-width="${1 + r()*3}" opacity="${0.2 + r()*0.7}"/>`;
    }
    return rays + `<circle cx="${cx}" cy="${cy}" r="${18 + r()*10}" fill="${accent}"/>
      <text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="'Bebas Neue',sans-serif" font-size="22" fill="#000" font-weight="900">${label}</text>`;
  }
  function patternGrid (r, label, accent) {
    let grid = '';
    const cell = 12 + Math.floor(r() * 18);
    for (let x = 0; x < 400; x += cell) {
      for (let y = 0; y < 300; y += cell) {
        if (r() > 0.45) {
          const sz = cell * (0.3 + r() * 0.7);
          grid += `<rect x="${x + (cell - sz)/2}" y="${y + (cell - sz)/2}" width="${sz.toFixed(0)}" height="${sz.toFixed(0)}" fill="${accent}" opacity="${(0.2 + r()*0.8).toFixed(2)}"/>`;
        }
      }
    }
    return grid + `<rect x="120" y="100" width="160" height="100" fill="#000" opacity=".85"/>
      <text x="200" y="170" text-anchor="middle" font-family="'Bebas Neue',sans-serif" font-size="84" fill="${accent}" font-weight="900">${label}</text>`;
  }
  function patternTessellation (r, label, accent) {
    let tris = '';
    const cols = 10 + Math.floor(r() * 8);
    const rows = 8;
    const w = 400 / cols, h = 300 / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (r() > 0.55) {
          const x = i * w, y = j * h;
          const flip = r() > 0.5;
          const pts = flip ? `${x},${y} ${x+w},${y} ${x},${y+h}` : `${x+w},${y} ${x+w},${y+h} ${x},${y+h}`;
          tris += `<polygon points="${pts}" fill="${accent}" opacity="${(0.15 + r()*0.7).toFixed(2)}"/>`;
        }
      }
    }
    return tris + `<text x="200" y="180" text-anchor="middle" font-family="'Bebas Neue',sans-serif" font-size="120" font-weight="900" fill="${accent}">${label}</text>`;
  }
  function patternSankofa (r, label, accent) {
    // Spiral + heart-ish curl, abstract-Adinkra inspired
    const cx = 200, cy = 150;
    let spiral = '';
    let prev = { x: cx, y: cy };
    for (let t = 0; t < 8 * Math.PI; t += 0.15) {
      const rad = 4 + t * 5;
      const x = cx + Math.cos(t + r()) * rad;
      const y = cy + Math.sin(t + r()) * rad;
      spiral += `<line x1="${prev.x.toFixed(1)}" y1="${prev.y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${accent}" stroke-width="2" opacity="${(0.3 + Math.min(t/24, 0.7)).toFixed(2)}"/>`;
      prev = { x, y };
    }
    return spiral + `<text x="20" y="290" font-family="'Bebas Neue',sans-serif" font-size="48" fill="${accent}">${label}</text>`;
  }

  const RENDERERS = { continent: patternContinent, rings: patternRings, kente: patternKente, waves: patternWaves, starburst: patternStarburst, grid: patternGrid, tessellation: patternTessellation, sankofa: patternSankofa };

  function pickAccent (kind) {
    // brand monochrome by default; specific kinds get a subtle pan-african tint
    const map = { film: '#ffffff', article: '#ffffff', event: '#ffffff', song: '#ffffff', book: '#ffffff', merch: '#ffffff', grant: '#ffffff' };
    return map[kind] || '#ffffff';
  }

  // ------- public generator ---------------------------------------------
  function generate (seed, kind = '', title = '') {
    const seedStr = String(seed || title || Math.random());
    const h = hash(seedStr);
    const random = rng(h);
    const pattern = PATTERNS[h % PATTERNS.length];
    const accent = pickAccent(kind);
    const initials = (title || kind || seedStr).toString()
      .replace(/[^A-Za-z]/g, ' ')
      .split(/\s+/).filter(Boolean)
      .map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'AA';
    const inner = (RENDERERS[pattern] || patternContinent)(random, initials, accent);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><rect width="400" height="300" fill="#000"/>${inner}</svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // ------- DOM auto-fix --------------------------------------------------
  // Scan elements that present background images. If empty or duplicate,
  // replace with a procedural SVG keyed on the parent's data-wish-id (which
  // the card factory already stamps) or a hash of nearby text.
  const usedUrls = new Set();
  const FALLBACK_TARGETS = '.thumb, .item-related-thumb, .ml-thumb, .wish-thumb, .hero-bg, .hero .slide';

  function styleUrl (el) {
    const m = (el.style.backgroundImage || '').match(/url\(["']?(.*?)["']?\)/);
    return m ? m[1].trim() : '';
  }
  function setUrl (el, url) {
    el.style.backgroundImage = `url("${url}")`;
  }
  function deriveSeed (el) {
    const card = el.closest('[data-wish-id]');
    if (card) return (card.dataset.wishType || '') + ':' + card.dataset.wishId;
    const h3 = el.parentElement?.querySelector('h1, h2, h3, h4, .title');
    if (h3) return (el.parentElement.dataset?.kind || '') + ':' + h3.textContent.trim();
    return el.outerHTML;
  }
  function deriveKindTitle (el) {
    const card = el.closest('[data-wish-id]');
    if (card) return { kind: card.dataset.wishType, title: card.querySelector('h3,h2,h4')?.textContent?.trim() || '' };
    const h = el.parentElement?.querySelector('h1, h2, h3, h4, .title');
    return { kind: '', title: h?.textContent?.trim() || '' };
  }

  function fixOne (el) {
    if (el.dataset.thumbFixed === '1') return;
    const url = styleUrl(el);
    let needFallback = false;
    if (!url || url === 'undefined' || url === 'null' || url === '#' || url === 'about:blank') {
      needFallback = true;
    } else if (usedUrls.has(url)) {
      // duplicate — substitute
      needFallback = true;
    } else {
      // unique real image — register it
      usedUrls.add(url);
    }
    if (needFallback) {
      const seed = deriveSeed(el);
      const meta = deriveKindTitle(el);
      const fallback = generate(seed, meta.kind, meta.title);
      setUrl(el, fallback);
    }
    el.dataset.thumbFixed = '1';
  }
  function scan (root) {
    (root || document).querySelectorAll(FALLBACK_TARGETS).forEach(fixOne);
  }

  function init () {
    scan(document);
    new MutationObserver(muts => {
      let touched = false;
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.matches?.(FALLBACK_TARGETS) || n.querySelector?.(FALLBACK_TARGETS)) { touched = true; break; }
        }
        if (touched) break;
      }
      if (touched) scan(document);
    }).observe(document.body, { childList: true, subtree: true });

    // Re-run when the user navigates tabs (cards re-render but used set stays consistent)
    window.addEventListener('hashchange', () => setTimeout(() => scan(document), 100));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.AA = window.AA || {};
  window.AA.thumb = generate;
  window.AA.thumb.scan = scan;
  window.AA.thumb.reset = () => usedUrls.clear();
})();
