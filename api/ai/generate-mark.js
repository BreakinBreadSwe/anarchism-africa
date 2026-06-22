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
  // ── Graphic styles (output = the mark itself, screenprint-ready) ───────
  classic:     'bold, high-contrast, two-tone (black + gold), screenprint-ready, no text, centered on a square canvas, generous margin, clean vector look',
  kente:       'kente-cloth weaving pattern integrated into the negative space, pan-african red/gold/green/violet, ceremonial, sharp edges, no text',
  glitch:      'cyberpunk glitch aesthetic, RGB chromatic aberration, scanlines, neon teal and magenta, brutalist, no text',
  brutalist:   'extreme brutalism, ultra-thick strokes, 1-bit black-and-white, raw poster aesthetic, no gradients, no text',
  risograph:   'risograph print look, two ink layers misregistered, halftone dots, paper texture, muted gold + red on cream, no text',
  goldleaf:    'gold leaf, ornate, illuminated-manuscript flourishes around the silhouette, deep black background, no text',
  screenprint: 'four-color screenprint, halftone fills, slight ink-bleed, vintage poster, pan-african palette, no text',
  graffiti:    'spraypaint stencil, drips, masked sharpness, sprayed onto a concrete wall texture, two-tone, no text',
  woodcut:     'traditional woodcut/linocut, hand-carved chisel marks, single black ink on cream, high contrast, no text',
  // ── Tileable pattern (no central focal point — covers the canvas edge to edge) ─
  pattern:     'a TILEABLE seamless repeating pattern derived from the AA mark — many small copies of the mark interlocking on a grid, plus geometric kente / Adinkra motifs filling the spaces. Edge-to-edge coverage, no central focal point, no margin, deep saturated pan-african palette. Suitable for textile, wrapping paper, or background fill. No text.',
  // ── Product mockups (output = a photoreal product with the mark printed on it) ─
  poster:      'a large-format graphic POSTER hanging on a concrete or brick wall in soft directional light, the AA mark as the dominant central design, pan-african screenprint palette, slight paper texture and pinhole shadows, photoreal, no extra text beyond the mark itself',
  tshirt:      'a photoreal product mockup: an organic-cotton crew-neck T-SHIRT shot flat on a neutral muted background (or worn by a young African person against a coloured studio backdrop), the AA mark screenprinted centered on the chest at iconic poster scale, slight fabric weave visible, soft daylight, magazine-quality. No mannequin plastic look. No extra text.',
  hoodie:      'a photoreal product mockup: a heavyweight organic-cotton HOODIE in dark stone grey, worn by a young African person against a warm-lit concrete studio backdrop, the AA mark screenprinted large and centered on the chest, soft daylight, magazine-quality. No extra text.',
  mug:         'a photoreal product mockup: a matte ceramic MUG in deep black, the AA mark wrapped onto the front face at clean screenprint scale, sitting on a warm wood surface with a soft shadow, gentle directional light, no liquid, no extra text',
  tote:        'a photoreal product mockup: an undyed natural-cotton TOTE BAG hanging or lying flat against a neutral textured wall, the AA mark screenprinted at full chest scale in two ink colours, slight fabric weave visible, soft daylight, no extra text',
  towel:       'a photoreal product mockup: a large terry BEACH TOWEL laid out on warm sand or a wooden deck, the AA mark as a repeating pan-african pattern across the full surface, edge-to-edge coverage, soft warm sunlight, no extra text',
  blanket:     'a photoreal product mockup: a woven WOOL or COTTON BLANKET folded on a wooden bench or bed, kente-inspired pan-african colours, the AA mark integrated as one motif within a wider geometric weaving pattern that covers the whole blanket, warm interior lighting, magazine-quality, no extra text',
  sticker:     'a photoreal product mockup: a DIE-CUT VINYL STICKER of the AA mark, slight depth and white bleed border around the silhouette, peeling slightly off a paper backing on a wooden desk, glossy reflection, no extra text',

  // ── Typography eras + movements ─────────────────────────────────────────
  artdeco:     '1920s ART DECO poster aesthetic, symmetrical geometric ornament, gold + black + cream, fan motifs and sunburst rays radiating from the centre of the mark, sharp chamfered edges, machine-age elegance, Cassandre lineage, no text',
  bauhaus:     '1920s BAUHAUS poster, primary colours (red/yellow/blue) on cream, strict grid, geometric circle/square/triangle building blocks, Herbert Bayer Universal-typeface clean lines, modular construction, the mark deconstructed into primitives, no text',
  constructivist: '1920s SOVIET CONSTRUCTIVIST poster, diagonal compositions, red + black on cream, Rodchenko / El Lissitzky lineage, photomontage feel, urgent revolutionary energy, raw printed paper texture, no text',
  cubanrev:    '1960s-70s CUBAN REVOLUTIONARY POSTER (OSPAAAL lineage), flat saturated tropical colours (red, yellow, teal, hot pink), bold simplified shapes, Edel Rodríguez aesthetic, anti-imperial pan-Caribbean energy, no text',
  blackpanthers:'Emory Douglas / BLACK PANTHER PARTY newspaper-illustration style, black + red + bold yellow, woodcut-thick outlines, fist + sunburst iconography woven around the mark, raw 1970s mimeograph texture, no text',
  afrofuturist:'AFROFUTURIST poster, deep cosmic indigo + glowing gold + Mars red, Sun Ra Arkestra cosmic mythology lineage, geometric Adinkra symbols orbiting the mark, holographic foil sheen, Octavia Butler era-jump energy, no text',
  adinkra:     'traditional GHANAIAN ADINKRA stamp aesthetic, hand-carved stamp marks, the mark surrounded by Adinkra symbols (Gye Nyame, Sankofa, Adinkrahene), single black ink on hand-pressed brown paper, ancestral, no text',
  ndebele:     'SOUTHERN AFRICAN NDEBELE wall-painting style, sharp angular geometric outlines, saturated primaries (red, blue, yellow, green, black, white), bold zig-zag borders, the mark integrated as one geometric shape within the larger pattern, no text',
  swissintl:   '1950s SWISS INTERNATIONAL TYPOGRAPHIC poster, Akzidenz-Grotesk discipline, asymmetric grid, lots of white space, single accent colour, mathematically precise spacing, Müller-Brockmann lineage, no text',
  memphis:     '1980s MEMPHIS GROUP design, squiggles + dots + zigzags, hot pink + mint + lemon + electric blue + black, postmodern playful chaos, terrazzo texture, Ettore Sottsass lineage, no text',
  cuttest:     'PUNK ZINE / cut-and-paste aesthetic, photocopied black-and-white, ransom-note collage, torn paper edges, halftone bleed, safety-pin energy, late-70s Crass / Riot Grrrl lineage, no text',
  ukiyoe:      'Japanese UKIYO-E woodblock print aesthetic, flat fields of muted colour, fine outlining, kabuki composition, the mark rendered as if Hokusai had carved it, no text',
  islamicgeo:  'ISLAMIC GEOMETRIC PATTERN tradition, intricate tessellation around and inside the mark, gold leaf on deep indigo, the mark woven into infinite repeating ornament, North African / Moroccan / Andalusi lineage, no text',
  haitianvev:  'HAITIAN VÈVÈ / VODOU ceremonial symbol drawing, flour-on-floor ritual aesthetic, fine line work, cosmological geometry (Erzulie, Damballa motifs) around the mark, sacred + protective, no text',
  ethiopiancross:'ETHIOPIAN ORTHODOX manuscript illumination, intricate interlace crosses, ochre + deep red + indigo + gold leaf on parchment, Aksumite / Lalibela lineage, the mark framed by ornament, no text',
  taino:       'TAÍNO petroglyph aesthetic, simplified spiral + face motifs, carved into stone surface texture, ochre and umber, pre-Columbian Caribbean indigenous lineage, no text',
  riso:        'RISOGRAPH overprint, two saturated inks misregistered (fluoro pink + teal, or sunflower + black), halftone dot texture, slight tactile paper grain, contemporary indie-print aesthetic, no text',
  vaporwave:   '1990s VAPORWAVE aesthetic, pastel pink + cyan + white grid, Roman bust silhouette + palm shadows, CRT scanlines, MS Sans Serif type lockup, retrofuture melancholy, no text',
  cyberafro:   'cyberpunk AFRO-FUTURE aesthetic, neon magenta + cyan on jet black, circuit-trace geometry weaving through the mark, glitched holographic foil, Black Quantum Futurism lineage, no text',
  brutalconcrete:'BRUTALIST poster on raw concrete texture, ultra-thick sans-serif typography lockups around the mark, mono ink-stamp red on grey, 1970s architectural-school aesthetic, no text',
  zellige:     'MOROCCAN ZELLIGE tile aesthetic, hand-cut geometric mosaic, deep teal + ochre + cream + cobalt, the mark assembled out of individual tile pieces, fine grout lines, no text',
  ankara:      'WEST AFRICAN ANKARA / wax-print fabric pattern, bold high-contrast repeating motifs, saturated complementary colours (turquoise + orange, red + indigo), the mark woven into the larger textile pattern, no text',
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
  // Pollinations rate-limits per IP — Vercel functions share a small IP
  // pool so multi-user batches cluster onto the same source and hit
  // 'Queue full for IP: ...: 1 requests already queued (max: 1)'.
  // Mitigation: retry up to 3× with exponential backoff (3s, 6s, 12s)
  // before surfacing the error. Most 429s clear within ~10s. Optional
  // POLLINATIONS_TOKEN env var raises the per-IP cap if you sign up at
  // enter.pollinations.ai (free tier exists).
  const seed = Math.floor(Math.random() * 1e9);
  const params = new URLSearchParams({
    width: '1024', height: '1024',
    model: 'flux', nologo: 'true', enhance: 'true',
    seed: String(seed)
  });
  if (process.env.POLLINATIONS_TOKEN) params.set('token', process.env.POLLINATIONS_TOKEN);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;

  const DELAYS_MS = [3000, 6000, 12000];
  let lastErr = null;
  for (let attempt = 0; attempt <= DELAYS_MS.length; attempt++) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'ANARCHISM.AFRICA/1.0 (+image-gen fallback)' }
      });
      if (r.ok) {
        const buf = await r.arrayBuffer();
        if (!buf.byteLength) throw new Error('Pollinations returned empty body');
        const b64 = Buffer.from(buf).toString('base64');
        return { b64, mimeType: r.headers.get('content-type') || 'image/jpeg' };
      }
      // 429 / 5xx — retryable. 4xx other = give up immediately.
      const body = (await r.text()).slice(0, 200);
      if (r.status === 429 || r.status >= 500) {
        lastErr = new Error(`Pollinations ${r.status}: ${body}`);
        if (attempt < DELAYS_MS.length) {
          await new Promise(res => setTimeout(res, DELAYS_MS[attempt]));
          continue;
        }
      }
      throw new Error(`Pollinations ${r.status}: ${body}`);
    } catch (e) {
      // Network blip: retry. Real error: bail.
      if (/network|fetch|aborted/i.test(String(e.message)) && attempt < DELAYS_MS.length) {
        lastErr = e;
        await new Promise(res => setTimeout(res, DELAYS_MS[attempt]));
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('Pollinations failed after retries');
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
