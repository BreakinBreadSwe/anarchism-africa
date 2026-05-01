// Vercel serverless — Merch Generator (T-shirt + poster + zine layouts)
//
// Composes high-resolution SVG designs from a quote in
// data/afro-anarchist-quotes.json:
//   FRONT → big-type quote, attribution, AA mark
//   BACK  → portrait, name, dates, bio, source, QR linking to merch URL
//
// SVG output: 4500×5400 px (12.5×15" @ 300 DPI), Printify standard.
// QR via QuickChart (no key needed); fails-soft if unreachable.
//
// POST /api/merch/generate-shirt
//   body: { quoteId, side?:'front'|'back', both?:true, storeUrl? }
//   resp: { svg, mimeType:'image/svg+xml', size:{w,h} }
//      OR: { front:{svg,...}, back:{svg,...} } when both:true

import fs from 'node:fs/promises';
import path from 'node:path';

const W = 4500, H = 5400, PAD = 280;

async function loadQuotes () {
  const p = path.join(process.cwd(), 'data', 'afro-anarchist-quotes.json');
  return JSON.parse(await fs.readFile(p, 'utf8')).quotes || [];
}

function escapeXML (s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function wrapLines (text, maxChars) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

function aaMark (x, y, size) {
  const s = size / 192;
  return `<g transform="translate(${x},${y}) scale(${s})">
    <path d="M 78 28 Q 100 22 124 28 Q 146 36 156 54 Q 162 70 158 84 Q 154 96 144 104 Q 142 116 138 130 Q 134 144 126 154 Q 116 162 106 158 Q 98 150 92 138 Q 84 122 76 108 Q 66 92 58 78 Q 52 64 56 50 Q 64 34 78 28 Z" fill="none" stroke="#fff" stroke-width="3"/>
    <polygon points="62,160 96,30 110,30 84,160" fill="#fff"/>
    <polygon points="98,30 112,30 142,160 128,160" fill="#fff"/>
    <rect x="40" y="100" width="120" height="14" fill="#fff"/>
    <polygon points="92,100 116,100 110,114 96,114" fill="#000"/>
  </g>`;
}

function frontSVG (q) {
  const text = q.text || '';
  const author = q.author || '';
  const shortQuote = text.length < 120;
  const fontSize = shortQuote ? 360 : (text.length < 220 ? 270 : 200);
  const maxChars = shortQuote ? 22 : (text.length < 220 ? 26 : 32);
  const lines = wrapLines(text, maxChars);
  const lineHeight = fontSize * 1.05;
  const blockH = lines.length * lineHeight;
  const startY = (H - blockH) / 2 + fontSize - lineHeight / 4;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#000000"/>
  <g font-family="'Bebas Neue','Anton','Impact',sans-serif" fill="#ffffff" text-anchor="middle">
    <text x="${W/2}" y="${startY}" font-size="${fontSize}" font-weight="800" letter-spacing="${fontSize*0.02}">
      ${lines.map((l, i) => `<tspan x="${W/2}" dy="${i === 0 ? 0 : lineHeight}">${escapeXML(l.toUpperCase())}</tspan>`).join('')}
    </text>
    <line x1="${W*0.3}" y1="${startY + blockH + 80}" x2="${W*0.7}" y2="${startY + blockH + 80}" stroke="#ffffff" stroke-width="6"/>
    <text x="${W/2}" y="${startY + blockH + 220}" font-size="120" font-weight="600" letter-spacing="20" font-family="'Space Grotesk','Helvetica',sans-serif">— ${escapeXML(author.toUpperCase())}${q.year ? '  ·  ' + q.year : ''}</text>
  </g>
  ${aaMark(PAD, H - PAD - 200, 200)}
</svg>`;
}

function backSVG (q, storeUrl) {
  const url = storeUrl || `https://anarchism.africa/merch/quote/${encodeURIComponent(q.id || '')}`;
  const qrSrc = `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=600&dark=ffffff&light=000000&margin=2`;
  const lines = wrapLines(q.bio || '', 56);
  const lineHt = 78;
  const bioStartY = 1900;
  const bioMaxLines = 14;
  const shownLines = lines.slice(0, bioMaxLines);
  const portraitX = W/2 - 600;
  const portraitY = 600;
  const portraitW = 1200;
  const portraitH = 1200;
  const lifespan = (q.born ? q.born : '') + (q.died ? '–' + q.died : (q.born ? '–present' : ''));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#000000"/>
  ${q.portrait_url ? `<clipPath id="portrait-clip"><rect x="${portraitX}" y="${portraitY}" width="${portraitW}" height="${portraitH}" rx="40"/></clipPath>
    <image href="${escapeXML(q.portrait_url)}" x="${portraitX}" y="${portraitY}" width="${portraitW}" height="${portraitH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#portrait-clip)" />
    <rect x="${portraitX}" y="${portraitY}" width="${portraitW}" height="${portraitH}" rx="40" fill="none" stroke="#ffffff" stroke-width="6"/>` : `
    <rect x="${portraitX}" y="${portraitY}" width="${portraitW}" height="${portraitH}" rx="40" fill="none" stroke="#ffffff" stroke-width="6"/>
    <text x="${W/2}" y="${portraitY + portraitH/2 + 80}" font-family="'Bebas Neue',sans-serif" font-size="200" fill="#ffffff" text-anchor="middle" font-weight="800" letter-spacing="14">${escapeXML((q.author||'').split(' ').map(p => p[0]).join('').slice(0,3).toUpperCase())}</text>`}
  <text x="${W/2}" y="${portraitY + portraitH + 180}" font-family="'Bebas Neue',sans-serif" font-size="200" fill="#ffffff" text-anchor="middle" font-weight="800" letter-spacing="10">${escapeXML((q.author||'').toUpperCase())}</text>
  ${lifespan ? `<text x="${W/2}" y="${portraitY + portraitH + 290}" font-family="'JetBrains Mono','Courier',monospace" font-size="80" fill="#ffffff" text-anchor="middle" letter-spacing="6" opacity=".75">${escapeXML(lifespan)}${q.nationality ? '  ·  ' + escapeXML(q.nationality) : ''}</text>` : ''}
  <g font-family="'Space Grotesk','Helvetica',sans-serif" fill="#ffffff">
    ${shownLines.map((l, i) => `<text x="${PAD}" y="${bioStartY + i * lineHt}" font-size="68" letter-spacing="1.2">${escapeXML(l)}</text>`).join('')}
  </g>
  ${q.source ? `<text x="${PAD}" y="${bioStartY + shownLines.length * lineHt + 120}" font-family="'JetBrains Mono','Courier',monospace" font-size="58" fill="#ffffff" opacity=".7" letter-spacing="3">Source: ${escapeXML(q.source)}${q.year ? ' · ' + q.year : ''}</text>` : ''}
  <g transform="translate(${W - 880}, ${H - 880})">
    <rect x="0" y="0" width="600" height="600" fill="#ffffff" rx="20"/>
    <image href="${qrSrc}" x="0" y="0" width="600" height="600"/>
  </g>
  <text x="${W - 580}" y="${H - 200}" font-family="'JetBrains Mono','Courier',monospace" font-size="46" fill="#ffffff" text-anchor="middle" opacity=".75" letter-spacing="2">${escapeXML(url.replace(/^https?:\/\//, ''))}</text>
  ${aaMark(PAD, H - PAD - 260, 260)}
  <text x="${PAD + 140}" y="${H - PAD - 60}" font-family="'JetBrains Mono','Courier',monospace" font-size="50" fill="#ffffff" letter-spacing="6" opacity=".75">ANARCHISM.AFRICA</text>
</svg>`;
}

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { quoteId, side = 'front', both = false, storeUrl } = req.body || {};
  if (!quoteId) return res.status(400).json({ error: 'quoteId required' });
  try {
    const quotes = await loadQuotes();
    const q = quotes.find(x => x.id === quoteId);
    if (!q) return res.status(404).json({ error: 'quote not found: ' + quoteId });
    if (both) {
      return res.status(200).json({
        quote: q,
        front: { svg: frontSVG(q),         mimeType: 'image/svg+xml', size: { w: W, h: H } },
        back:  { svg: backSVG(q, storeUrl),mimeType: 'image/svg+xml', size: { w: W, h: H } }
      });
    }
    const svg = side === 'back' ? backSVG(q, storeUrl) : frontSVG(q);
    return res.status(200).json({ quote: q, svg, mimeType: 'image/svg+xml', size: { w: W, h: H } });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
