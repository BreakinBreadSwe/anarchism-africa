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
//
// Model fallback chain — Google retires image-gen model slugs without
// notice (the original 'gemini-2.5-flash-image-preview' returned 404 in
// 2026: "is not found for API version v1beta"). We try the requested
// model first, then a list of known-stable image-gen slugs. To pin a
// working model permanently, set GEMINI_IMAGE_MODEL in Vercel env.

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

// Vercel function config — image gen can take 10-30s per image × 4 = up to 2min.
export const config = { maxDuration: 300 };

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;

  const body  = req.body || {};
  const MODEL_CHAIN = [
    body.model,
    process.env.GEMINI_IMAGE_MODEL,
    'gemini-3.1-flash-image-preview',
    'gemini-3.1-flash-image',
    'gemini-2.5-flash-image-preview',
    'gemini-2.5-flash-image',
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash-exp'
  ].filter(Boolean);
  const count = Math.min(4, Math.max(1, parseInt(body.count, 10) || 1));

  // PROVIDER CASCADE. Image-gen has even more brittle providers than text:
  // Gemini's prepay tier exhausts, model slugs deprecate without notice,
  // and there's no equivalent free fallback inside Google. So we chain
  // independent providers, with Pollinations (no key, no billing, Flux
  // under the hood) as the always-on safety net so the Mark Lab never
  // returns blank when Google's down.
  //   1. Gemini  — quality leader, requires GEMINI_API_KEY + paid credits
  //   2. Pollinations.ai — Flux model, free, no key, no billing
  //                       https://image.pollinations.ai (CC0 outputs)
  // Provider advances on 429/402/RESOURCE_EXHAUSTED (billing/quota),
  // 401/403 (auth), or hard 5xx. 404 stays inside the Gemini model chain.
  let workingModel = null;
  let workingProvider = null;
  let lastErr = null;
  const tried = [];

  const tryGeminiOnce = async (prompt) => {
    if (!key) throw new Error('GEMINI_API_KEY missing');
    if (workingModel) return await callGemini(workingModel, key, prompt);
    for (const m of MODEL_CHAIN) {
      try {
        const r = await callGemini(m, key, prompt);
        workingModel = m;
        return r;
      } catch (e) {
        lastErr = e;
        const msg = String(e.message || e);
        // 404 = model slug dead, try next slug. Anything else (429 quota,
        // 401 auth, 5xx infra) = provider dead, abort the Gemini chain.
        if (!msg.includes('404')) throw e;
      }
    }
    throw lastErr || new Error('No Gemini image model worked');
  };

  const tryProviderChain = async (prompt) => {
    if (workingProvider === 'pollinations') return { ...(await callPollinations(prompt)), provider: 'pollinations' };
    if (workingProvider === 'gemini')       return { ...(await tryGeminiOnce(prompt)),    provider: 'gemini' };
    // Probe Gemini first; fall through to Pollinations on quota/auth/5xx.
    try {
      const r = await tryGeminiOnce(prompt);
      workingProvider = 'gemini';
      tried.push({ provider: 'gemini', ok: true, model: workingModel });
      return { ...r, provider: 'gemini' };
    } catch (e) {
      tried.push({ provider: 'gemini', ok: false, error: String(e.message || e).slice(0, 200) });
      const r = await callPollinations(prompt);
      workingProvider = 'pollinations';
      tried.push({ provider: 'pollinations', ok: true });
      return { ...r, provider: 'pollinations' };
    }
  };

  try {
    const items = [];
    for (let i = 0; i < count; i++) {
      const style  = pickStyle(body.style);
      const prompt = composePrompt({ subject: body.subject, style, prompt: body.prompt });
      const result = await tryProviderChain(prompt);
      items.push({ ...result, prompt, style });
    }
    return res.status(200).json({ items, model: workingModel, provider: workingProvider, tried });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e), tried });
  }
}

/* Pollinations.ai image generator — free, no API key, Flux model.
   Endpoint: https://image.pollinations.ai/prompt/{encoded prompt}
            ?width=1024&height=1024&model=flux&nologo=true&seed=...
   Returns image bytes directly. We fetch, convert to base64, and match
   the existing API contract { b64, mimeType }. */
async function callPollinations (prompt) {
  const seed = Math.floor(Math.random() * 1e9);
  const params = new URLSearchParams({
    width: '1024', height: '1024',
    model: 'flux', nologo: 'true', enhance: 'true',
    seed: String(seed)
  });
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'ANARCHISM.AFRICA/1.0 (+image-gen fallback)' }
  });
  if (!r.ok) throw new Error(`Pollinations ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const buf = await r.arrayBuffer();
  if (!buf.byteLength) throw new Error('Pollinations returned empty body');
  // Convert ArrayBuffer → base64. Node 18+ has Buffer.from(...).toString('base64').
  const b64 = Buffer.from(buf).toString('base64');
  return { b64, mimeType: r.headers.get('content-type') || 'image/jpeg' };
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
