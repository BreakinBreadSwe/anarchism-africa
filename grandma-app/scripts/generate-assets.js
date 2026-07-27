/**
 * Generates the app's launcher icon, adaptive icon, splash image and web
 * favicon into assets/.
 *
 * The mark is drawn procedurally rather than shipped as binary art so it stays
 * editable in review and regenerates deterministically:
 *
 *   node scripts/generate-assets.js
 *
 * Design: a mortar and pestle — the oldest tool in the kitchen-medicine
 * tradition the app documents — over the warm ground from src/theme.ts.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const OUT = path.join(__dirname, '..', 'assets');

// Pulled from src/theme.ts so the icon and the UI never drift apart.
const BACKGROUND = [253, 248, 242];
const PRIMARY = [140, 90, 60];
const PRIMARY_DARK = [107, 64, 40];
const ACCENT = [199, 123, 79];

/** Alpha-blend `src` over `dst` in place. */
function blend(dst, i, src, alpha) {
  dst[i] = Math.round(dst[i] * (1 - alpha) + src[0] * alpha);
  dst[i + 1] = Math.round(dst[i + 1] * (1 - alpha) + src[1] * alpha);
  dst[i + 2] = Math.round(dst[i + 2] * (1 - alpha) + src[2] * alpha);
  dst[i + 3] = 255;
}

/**
 * Signed distance to the mortar-and-pestle mark, in a -1..1 unit square.
 * Negative is inside. Returns the nearest shape's colour alongside it.
 */
function markSample(x, y) {
  const shapes = [];

  // Bowl: lower half of a disc, flattened into a rounded cup.
  const bowlY = (y - 0.18) / 0.62;
  const bowlX = x / 0.72;
  const bowlR = Math.sqrt(bowlX * bowlX + bowlY * bowlY);
  if (y > 0.16) {
    shapes.push({ d: bowlR - 1, color: PRIMARY });
  }

  // Rim: a flattened ellipse sitting across the top of the bowl.
  const rimX = x / 0.82;
  const rimY = (y - 0.16) / 0.15;
  shapes.push({ d: Math.sqrt(rimX * rimX + rimY * rimY) - 1, color: PRIMARY_DARK });

  // Pestle: a tilted capsule leaning out of the bowl to the upper right.
  const ax = -0.1;
  const ay = 0.16;
  const bx = 0.5;
  const by = -0.78;
  const pdx = bx - ax;
  const pdy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * pdx + (y - ay) * pdy) / (pdx * pdx + pdy * pdy)));
  const cx = ax + pdx * t;
  const cy = ay + pdy * t;
  // Taper: thicker at the grinding end, slimmer at the handle.
  const radius = 0.17 - 0.05 * t;
  shapes.push({ d: Math.hypot(x - cx, y - cy) - radius, color: ACCENT });

  let best = shapes[0];
  for (const s of shapes) if (s.d < best.d) best = s;
  return best;
}

/**
 * @param {number} size          output edge length in px
 * @param {number} markScale     mark size relative to the canvas
 * @param {boolean} transparent  transparent ground (Android adaptive layer)
 */
function render(size, markScale, transparent) {
  const png = new PNG({ width: size, height: size });
  const data = png.data;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = (py * size + px) * 4;
      if (transparent) {
        data[i] = data[i + 1] = data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        data[i] = BACKGROUND[0];
        data[i + 1] = BACKGROUND[1];
        data[i + 2] = BACKGROUND[2];
        data[i + 3] = 255;
      }
    }
  }

  // 3x3 supersampling keeps the curves clean without a rasteriser.
  const S = 3;
  const half = size / 2;
  const unit = half * markScale;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0;
      let r = 0;
      let g = 0;
      let b = 0;

      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const fx = (px + (sx + 0.5) / S - half) / unit;
          const fy = (py + (sy + 0.5) / S - half) / unit;
          const hit = markSample(fx, fy);
          if (hit.d <= 0) {
            hits++;
            r += hit.color[0];
            g += hit.color[1];
            b += hit.color[2];
          }
        }
      }

      if (hits > 0) {
        const alpha = hits / (S * S);
        blend(data, (py * size + px) * 4, [r / hits, g / hits, b / hits], alpha);
      }
    }
  }

  return png;
}

/** Splash is a wide canvas with the mark centred on the app background. */
function renderSplash(width, height) {
  const png = new PNG({ width, height });
  const data = png.data;
  const unit = Math.min(width, height) * 0.16;
  const cx = width / 2;
  const cy = height / 2;
  const S = 3;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4;
      data[i] = BACKGROUND[0];
      data[i + 1] = BACKGROUND[1];
      data[i + 2] = BACKGROUND[2];
      data[i + 3] = 255;

      let hits = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const fx = (px + (sx + 0.5) / S - cx) / unit;
          const fy = (py + (sy + 0.5) / S - cy) / unit;
          const hit = markSample(fx, fy);
          if (hit.d <= 0) {
            hits++;
            r += hit.color[0];
            g += hit.color[1];
            b += hit.color[2];
          }
        }
      }
      if (hits > 0) {
        blend(data, i, [r / hits, g / hits, b / hits], hits / (S * S));
      }
    }
  }
  return png;
}

function write(png, name) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, PNG.sync.write(png));
  const { size } = fs.statSync(file);
  console.log(`${name.padEnd(20)} ${png.width}x${png.height}  ${(size / 1024).toFixed(1)} kB`);
}

fs.mkdirSync(OUT, { recursive: true });
// Store icon: mark fills most of the tile.
write(render(1024, 0.62, false), 'icon.png');
// Adaptive icon: Android masks the outer ~28%, so the mark sits smaller.
write(render(1024, 0.44, true), 'adaptive-icon.png');
write(renderSplash(1284, 2778), 'splash.png');
write(render(48, 0.72, false), 'favicon.png');
