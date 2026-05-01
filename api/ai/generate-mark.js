// Vercel serverless — Gemini image generation for AA brand marks.
//
// POST /api/ai/generate-mark
//   body: {
//     prompt?:    string,                // optional override; otherwise we compose one
//     style?:     'classic'|'kente'|'glitch'|'brutalist'|'risograph'|'goldleaf'
//                 |'screenprint'|'graffiti'|'woodcut'|'photoreal'|'random',
//     model?:     string,                // override Gemini image model
//     subject?:   string,                // default: "circle-A anarchist symbol over African continent outline"
//     count?:     number                 // 1..4 (default 1)
//   }
//   resp: { items: [{ b64, mimeType, prompt, style }], model }
//
// Reads GEMINI_API_KEY from env (already used by /api/ai/chat.js).
// Default model: gemini-2.5-flash-image-preview (Gemini's image model).

const SUBJECT_DEFAULT =
  "the anarchist circle-A symbol overlaid on the silhouette of the African continent, with the horizontal crossbar of the A extending past the continent's outline on both sides — a single iconic mark";

const STYLE_PROMPTS = {
  classic:     'bold, high-contrast, two-tone (black + gold), screenprint-ready, no text, centered on a square canvas, generous margin, clean vector look',
  kente:       'kente-cloth weaving pattern integrated into the negative space, pan-african red/gold/green/violet, ceremonial, sharp edges, no text',
  glitch:      'cyberpunk glitch aesthetic, RGB chromatic aberration, scanlines, neon teal and magenta, brutalist, no text',
  brutalist:   'extreme brutalism, ultra-thick strokes, 1-bit black-and-white, raw poster aesthetic, no gradients, no text',
  risograph:   'risograph print look, two ink layers misregistered, halftone dots, paper texture, muted gold + red on cream, no text',
  goldleaf:    'gold leaf, ornate, illuminated-manuscript flourishes around the silhouette, deep black background, no text',
  screenprint: 'four-color screenprint, halftone fills, slight ink-bleed, vintage poster, pan-african palette, no text',
  graffiti:    'spraypaint stencil, drips, masked sharpness, sprayed onto a concrete wall texture, two-tone, no text',
  woodcut:     'traditional woodcut/linocut, hand-carved chisel marks, single black ink on cream, high contrast, no text',
  photoreal:   'photoreal physical object: an embossed brass medallion of the mark on a black velvet, soft studio lighting, macro detail, no text'
};

const STYLE_KEYS = Object.keys(STYLE_PROMPTS);

function pickStyle (style) {
  if (!style || style === 'random') return STYLE_KEYS[Math.floor(Math.random() * STYLE_KEYS.length)];
  if (STYLE_PROMPTS[style]) return style;
  return 'classic';
}

function composePrompt ({ subject, style, prompt }) {
  if (prompt && prompt.trim()) return prompt.trim();
  const s = pickStyle(style);
  const stylePrompt = STYLE_PROMPTS[s];
  return [
    `Generate a single graphic mark suitable for printing on T-shirts, posters, book covers and merchandise.`,
    `Subject: ${subject || SUBJECT_DEFAULT}.`,
    `Style: ${stylePrompt}.`,
    `Composition: square, the mark centered with consistent margins, the African continent silhouette geographically recognizable (Mediterranean coast, West Africa bulge, Horn of Africa, Cape, Madagascar), the anarchist A clearly readable inside, the crossbar extending past the silhouette.`,
    `Critical: do NOT include any text, letters or words other than the single capital letter A inside the silhouette. No watermarks. No signatures. High resolution, sharp edges, print-ready.`
  ].join(' ');
}

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY missing — set it in Vercel project env vars' });

  const body  = req.body || {};
  const model = body.model || 'gemini-2.5-flash-image-preview';
  const count = Math.min(4, Math.max(1, parseInt(body.count, 10) || 1));

  try {
    const items = [];
    for (let i = 0; i < count; i++) {
      const style  = pickStyle(body.style);
      const prompt = composePrompt({ subject: body.subject, style, prompt: body.prompt });
      const result = await callGemini(model, key, prompt);
      items.push({ ...result, prompt, style });
    }
    return res.status(200).json({ items, model });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}

async function callGemini (model, key, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Gemini ${r.status}: ${txt.slice(0, 400)}`);
  }
  const data = await r.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData && p.inlineData.data);
  if (!imagePart) {
    throw new Error('Gemini returned no image — first part: ' + JSON.stringify(parts[0] || {}).slice(0, 200));
  }
  return {
    b64:      imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || 'image/png'
  };
}
