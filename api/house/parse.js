// POST /api/house/parse
//   body: { images: [{ mime, data(base64) }], notes: "2 air conditioners back porch", units: 'ft'|'m' }
//   resp: { plan, source: 'ai'|'notes'|'default', provider, model, warnings[] }
//
// Reads Dad's sketches + notes and returns a normalized floor plan the 3D
// builder can render. Order of truth:
//   1. AI vision over the sketch images (+ notes as context) — if any vision
//      provider key is configured and the call succeeds.
//   2. Deterministic notes parser (lib/house-estimator.js parseNotes) — always
//      runs; fills anything the sketch didn't say ("back porch", "2 AC").
//   3. Default bungalow — so the model is never empty.
import estimator from '../../lib/house-estimator.js';
import ai from '../../lib/house-ai.js';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } }, maxDuration: 60 };

const MAX_IMAGES = 4;
const OK_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const SYSTEM = `You read hand-drawn house sketches and turn them into a floor plan as JSON. You are precise, you never invent rooms that are not drawn or written, and you estimate dimensions in feet from labels, grid squares, door widths (~3 ft) and typical room proportions. Reply with JSON only.`;

const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    name: { type: 'string' },
    stories: { type: 'integer' },
    wall_height: { type: 'number' },
    roof: { type: 'object', additionalProperties: false, properties: { type: { type: 'string', enum: ['gable', 'hip', 'flat', 'shed'] }, pitch: { type: 'number' } }, required: ['type', 'pitch'] },
    rooms: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { name: { type: 'string' }, type: { type: 'string', enum: estimator.ROOM_TYPES }, w: { type: 'number' }, d: { type: 'number' }, x: { type: 'number' }, y: { type: 'number' }, level: { type: 'integer' }, side: { type: 'string', enum: ['front', 'back', 'left', 'right'] } },
      required: ['name', 'type', 'w', 'd', 'x', 'y', 'level', 'side'] } },
    features: { type: 'object', additionalProperties: false, properties: {
      ac_units: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { count: { type: 'integer' }, type: { type: 'string', enum: ['window', 'split', 'central', 'portable'] }, location: { type: 'string' } }, required: ['count', 'type', 'location'] } },
      solar: { type: 'boolean' }, basement: { type: 'boolean' }, garage: { type: 'boolean' } }, required: ['ac_units', 'solar', 'basement', 'garage'] },
    labels_seen: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' }
  },
  required: ['name', 'stories', 'wall_height', 'roof', 'rooms', 'features', 'labels_seen', 'confidence']
};

function prompt (notes, units) {
  return `Turn the attached sketch(es) into a floor plan.

Rules:
- Units: return every dimension in FEET (convert if the sketch is in ${units === 'm' ? 'metres' : 'feet'}).
- Coordinates: x grows to the right, y grows toward the BACK of the house; (0,0) is the front-left corner of the main floor. Rooms are axis-aligned rectangles that should not overlap.
- "level" is 0 for the ground floor, 1 for the floor above.
- Porches, decks and garages are rooms too (type "porch"/"garage") with the "side" they attach to (front/back/left/right); for interior rooms set side to "back".
- Put anything written on the sketch or in the notes that is not a room (AC units, solar, basement) into "features". "2 air conditioners back porch" = features.ac_units:[{count:2,type:"window",location:"back porch"}] AND a back porch room.
- labels_seen: every word/number you could read on the sketch.
- confidence: 0-1, how sure you are the rooms and sizes match the drawing.
${notes ? `\nOwner's notes (treat as authoritative when the sketch is ambiguous):\n"""${notes.slice(0, 2000)}"""` : ''}

Return exactly one JSON object with keys: name, stories, wall_height, roof{type,pitch}, rooms[{name,type,w,d,x,y,level,side}], features{ac_units[],solar,basement,garage}, labels_seen[], confidence.`;
}

export default async function handler (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { images = [], notes = '', units = 'ft' } = req.body || {};
  const warnings = [];

  const imgs = (Array.isArray(images) ? images : []).slice(0, MAX_IMAGES).map(i => {
    let mime = String((i && i.mime) || 'image/jpeg').toLowerCase();
    let data = String((i && i.data) || '');
    const m = data.match(/^data:([^;]+);base64,(.*)$/s);
    if (m) { mime = m[1]; data = m[2]; }
    return OK_MIME.has(mime) && data.length > 100 ? { mime, data: data.replace(/\s+/g, '') } : null;
  }).filter(Boolean);
  if (images.length > MAX_IMAGES) warnings.push(`only the first ${MAX_IMAGES} images were read`);

  const notesPlan = estimator.parseNotes(notes);
  let aiPlan = null, provider = null, model = null;

  if (imgs.length) {
    try {
      const r = await ai.chat({ system: SYSTEM, prompt: prompt(notes, units), images: imgs, json: true, json_schema: PLAN_SCHEMA, effort: 'medium', max_tokens: 8000 });
      aiPlan = ai.extractJSON(r.text);
      provider = r.provider; model = r.model;
      if (aiPlan && aiPlan.units === 'm') aiPlan.units = 'm';
      aiPlan.source = 'ai';
    } catch (e) {
      warnings.push(e.code === 'NO_PROVIDER'
        ? 'No AI vision provider configured (set ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY or OPENROUTER_API_KEY in Vercel). Built the plan from your notes instead.'
        : 'Sketch reading failed (' + String(e.message || e).slice(0, 160) + '). Built the plan from your notes instead.');
    }
  } else if (!String(notes).trim()) {
    warnings.push('No sketch or notes given — showing the default bungalow. Edit rooms in the plan table.');
  }

  let merged = aiPlan ? estimator.mergePlans(aiPlan, notesPlan) : notesPlan;
  const source = aiPlan ? 'ai' : (notesPlan.rooms.length || notesPlan.features.ac_units.length ? 'notes' : 'default');
  if (source === 'notes' && !notesPlan.rooms.some(r => !['porch', 'garage'].includes(r.type))) {
    // Notes only mention extras (AC, porch) — attach them to the default house.
    merged = estimator.mergePlans(notesPlan, estimator.defaultPlan());
  }
  if (source === 'default') merged = estimator.defaultPlan();
  merged.source = source;
  if (!merged.notes || !merged.notes.length) merged.notes = notesPlan.notes;

  const plan = estimator.normalizePlan(merged);
  res.status(200).json({ plan, source, provider, model, warnings, found: notesPlan.found, labels_seen: (aiPlan && aiPlan.labels_seen) || [] });
}
