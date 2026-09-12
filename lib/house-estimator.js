/* lib/house-estimator.js — HOUSE LAB shared core (browser + server, no deps)
 *
 * One file, three jobs:
 *   1. normalizePlan()   — takes a loose plan (from AI vision, from the
 *                          heuristic note parser, or from the editor) and
 *                          returns a clean, fully-numeric plan the 3D builder
 *                          and the estimator can trust. Auto-lays-out rooms
 *                          that have no x/y.
 *   2. parseNotes()      — deterministic parser for hand-written notes like
 *                          "2 air conditioners back porch" — the zero-API-key
 *                          fallback, and the merge partner for AI output.
 *   3. estimateBudget()  — line-item construction budget for a city, using a
 *                          per-city cost index + incentive leads. Numbers are
 *                          planning-grade ballparks (USD, 2026), clearly not
 *                          quotes — the UI says so.
 *
 * Loaded in the browser via <script src="lib/house-estimator.js"> (exposes
 * window.HouseEstimator) and on the server via
 * `import est from '../../lib/house-estimator.js'` (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.HouseEstimator = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {

  /* ──────────────────────────────────────────────────────────────────────
     CITIES — cost index (1.00 = US national average, new residential
     construction, 2026 planning numbers), a $/sqft baseline for a modest
     stick-built house, and incentive/partner leads a pitch can name.
     Program names are real public programs as of this writing; the pitch
     tells the reader to verify current terms.
     ────────────────────────────────────────────────────────────────────── */
  const CITIES = [
    {
      id: 'detroit', name: 'Detroit', region: 'Michigan, USA', currency: 'USD', index: 0.94,
      base_sqft: 165, land_hint: 'Detroit Land Bank side lots and vacant structures often sell for $100–$25,000.',
      dept: 'Housing & Revitalization Department, City of Detroit',
      programs: [
        { name: 'Detroit Land Bank Authority — Own It Now / Side Lot', what: 'Discounted city-owned lots and homes for owner-occupants.' },
        { name: 'Neighborhood Enterprise Zone (NEZ) tax abatement', what: 'Reduced property taxes for new construction or rehab in designated zones (up to 15 years).' },
        { name: 'Detroit 0% Home Repair Loan', what: 'Interest-free loans for repairs on owner-occupied homes.' },
        { name: 'Motor City Match / Motor City Re-Store', what: 'Grants for small businesses — relevant if part of the build is a workshop, studio or storefront.' },
        { name: 'MSHDA (Michigan State Housing Development Authority)', what: 'State housing loans, down-payment assistance, and neighborhood grants.' }
      ]
    },
    { id: 'cleveland',  name: 'Cleveland',  region: 'Ohio, USA',         currency: 'USD', index: 0.96, base_sqft: 170, dept: 'Department of Community Development, City of Cleveland',
      programs: [{ name: 'Cleveland Residential Tax Abatement', what: '15-year abatement on new residential construction.' }, { name: 'Cuyahoga Land Bank', what: 'Discounted lots and structures for rehab.' }] },
    { id: 'baltimore',  name: 'Baltimore',  region: 'Maryland, USA',     currency: 'USD', index: 1.00, base_sqft: 180, dept: 'Department of Housing & Community Development, Baltimore City',
      programs: [{ name: 'Vacants to Value', what: 'City-owned vacant houses sold for rehab, with buyer incentives.' }, { name: 'Baltimore Homeownership Incentive Program', what: 'Down-payment and closing-cost help.' }] },
    { id: 'pittsburgh', name: 'Pittsburgh', region: 'Pennsylvania, USA', currency: 'USD', index: 1.02, base_sqft: 185, dept: 'Urban Redevelopment Authority of Pittsburgh',
      programs: [{ name: 'URA Housing Recovery Program', what: 'Rehab loans and land for infill housing.' }] },
    { id: 'stlouis',    name: 'St. Louis',  region: 'Missouri, USA',      currency: 'USD', index: 0.95, base_sqft: 165, dept: 'St. Louis Development Corporation (SLDC)',
      programs: [{ name: 'LRA (Land Reutilization Authority)', what: 'City land bank — lots from a few hundred dollars for approved plans.' }, { name: 'Tax abatement (Chapter 99 / 353)', what: 'Property-tax abatement for new residential construction.' }] },
    { id: 'atlanta',    name: 'Atlanta',    region: 'Georgia, USA',       currency: 'USD', index: 0.98, base_sqft: 185, dept: 'Department of City Planning / Atlanta Housing',
      programs: [{ name: 'Invest Atlanta — Homeownership programs', what: 'Down-payment assistance and neighborhood grants.' }, { name: 'Atlanta Land Trust', what: 'Permanently affordable homeownership on trust land.' }] },
    { id: 'chicago',    name: 'Chicago',    region: 'Illinois, USA',      currency: 'USD', index: 1.12, base_sqft: 215, dept: 'Department of Housing, City of Chicago',
      programs: [{ name: 'ChiBlockBuilder', what: 'City-owned vacant lots for sale for new housing.' }, { name: 'Chicago Community Land Trust', what: 'Affordable homeownership program.' }] },
    { id: 'houston',    name: 'Houston',    region: 'Texas, USA',         currency: 'USD', index: 0.92, base_sqft: 160, dept: 'Housing & Community Development Department, City of Houston',
      programs: [{ name: 'Houston Land Bank', what: 'Discounted lots for affordable new construction.' }] },
    { id: 'losangeles', name: 'Los Angeles', region: 'California, USA',   currency: 'USD', index: 1.32, base_sqft: 320, dept: 'Los Angeles Housing Department (LAHD)',
      programs: [{ name: 'ADU Accelerator / ADU standard plans', what: 'Pre-approved accessory dwelling plans and fee reductions.' }] },
    { id: 'newyork',    name: 'New York',   region: 'New York, USA',      currency: 'USD', index: 1.45, base_sqft: 380, dept: 'NYC Department of Housing Preservation & Development (HPD)',
      programs: [{ name: 'HPD Open Door / NIHOP', what: 'Subsidized new one- to three-family homes on city land.' }] },
    { id: 'kingston',   name: 'Kingston',   region: 'Jamaica',            currency: 'USD', index: 0.72, base_sqft: 110, dept: 'National Housing Trust (NHT) / KSAMC',
      programs: [{ name: 'National Housing Trust (NHT) benefits', what: 'Low-interest home-building loans for contributors.' }] },
    { id: 'accra',      name: 'Accra',      region: 'Ghana',              currency: 'USD', index: 0.62, base_sqft: 85,  dept: 'Ministry of Works & Housing / Accra Metropolitan Assembly',
      programs: [{ name: 'National Affordable Housing Programme', what: 'Government affordable-housing schemes and serviced plots.' }] },
    { id: 'lagos',      name: 'Lagos',      region: 'Nigeria',            currency: 'USD', index: 0.60, base_sqft: 80,  dept: 'Lagos State Ministry of Housing',
      programs: [{ name: 'Lagos HOMS (Home Ownership Mortgage Scheme)', what: 'State mortgage scheme for first-time owners.' }] },
    { id: 'nairobi',    name: 'Nairobi',    region: 'Kenya',              currency: 'USD', index: 0.58, base_sqft: 75,  dept: 'Nairobi City County — Lands, Urban Planning & Housing',
      programs: [{ name: 'Affordable Housing Programme (Boma Yangu)', what: 'National affordable-housing registration and financing.' }] },
    { id: 'johannesburg', name: 'Johannesburg', region: 'South Africa',   currency: 'USD', index: 0.55, base_sqft: 70,  dept: 'City of Johannesburg — Human Settlements',
      programs: [{ name: 'FLISP (First Home Finance)', what: 'Government subsidy for first-time buyers in the gap market.' }] },
    { id: 'custom',     name: 'Custom city', region: 'set your own index', currency: 'USD', index: 1.00, base_sqft: 180, dept: 'City housing department', programs: [] }
  ];

  const ROOM_TYPES = ['living', 'kitchen', 'dining', 'bedroom', 'bath', 'office', 'laundry', 'hall', 'closet', 'porch', 'garage', 'workshop', 'other'];
  const NON_CONDITIONED = new Set(['porch', 'garage']);

  // Typical sizes (ft) used when a room has a name but no dimensions.
  const DEFAULT_ROOM_SIZE = {
    living: [16, 14], kitchen: [12, 12], dining: [12, 10], bedroom: [12, 11], bath: [8, 6],
    office: [10, 10], laundry: [7, 6], hall: [10, 4], closet: [6, 3], porch: [20, 8],
    garage: [22, 22], workshop: [16, 12], other: [10, 10]
  };

  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
  const round = (n, p = 0) => { const m = Math.pow(10, p); return Math.round(n * m) / m; };
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  function guessType (name) {
    const n = String(name || '').toLowerCase();
    if (/porch|patio|deck|veranda|stoop/.test(n)) return 'porch';
    if (/garage|carport/.test(n)) return 'garage';
    if (/bed|master|guest|nursery/.test(n)) return 'bedroom';
    if (/bath|toilet|wc|shower|powder/.test(n)) return 'bath';
    if (/kitchen|pantry/.test(n)) return 'kitchen';
    if (/dining/.test(n)) return 'dining';
    if (/living|family|lounge|great|sitting|den/.test(n)) return 'living';
    if (/office|study|library/.test(n)) return 'office';
    if (/laundry|utility|mud/.test(n)) return 'laundry';
    if (/hall|entry|foyer|corridor|stair/.test(n)) return 'hall';
    if (/closet|storage|wardrobe/.test(n)) return 'closet';
    if (/shop|studio|workshop/.test(n)) return 'workshop';
    return 'other';
  }

  /* ──────────────────────────────────────────────────────────────────────
     DEFAULT PLAN — a modest 2-bed Detroit-style bungalow with a back porch.
     Used when nothing else is known so the 3D view is never empty.
     ────────────────────────────────────────────────────────────────────── */
  function defaultPlan () {
    return {
      name: "Dad's house",
      units: 'ft',
      stories: 1,
      wall_height: 9,
      roof: { type: 'gable', pitch: 6 },
      rooms: [
        { name: 'Living room', type: 'living',  w: 16, d: 14, level: 0 },
        { name: 'Kitchen',     type: 'kitchen', w: 12, d: 12, level: 0 },
        { name: 'Bedroom 1',   type: 'bedroom', w: 12, d: 12, level: 0 },
        { name: 'Bedroom 2',   type: 'bedroom', w: 11, d: 11, level: 0 },
        { name: 'Bathroom',    type: 'bath',    w: 8,  d: 6,  level: 0 },
        { name: 'Back porch',  type: 'porch',   w: 20, d: 8,  level: 0, side: 'back' }
      ],
      features: { ac_units: [], solar: false, basement: false, garage: false },
      notes: [],
      source: 'default'
    };
  }

  /* ──────────────────────────────────────────────────────────────────────
     AUTO-LAYOUT — rooms without coordinates get packed into rows so the
     footprint is roughly square. Porches go outside the box on their side;
     garages get attached to the left. Good enough for a massing model.
     ────────────────────────────────────────────────────────────────────── */
  function autoLayout (rooms) {
    const byLevel = {};
    for (const r of rooms) (byLevel[r.level] ||= []).push(r);
    const out = [];
    for (const level of Object.keys(byLevel).map(Number).sort()) {
      const all = byLevel[level];
      const core   = all.filter(r => !NON_CONDITIONED.has(r.type));
      const porches = all.filter(r => r.type === 'porch');
      const garages = all.filter(r => r.type === 'garage');

      const placed = core.filter(r => r.x != null && r.y != null);
      const loose  = core.filter(r => r.x == null || r.y == null);
      const totalArea = core.reduce((s, r) => s + r.w * r.d, 0);
      const targetW = Math.max(20, Math.ceil(Math.sqrt(totalArea) * 1.15));

      let x = 0, y = 0, rowH = 0;
      if (placed.length) y = Math.max(...placed.map(r => r.y + r.d));
      for (const r of loose) {
        if (x > 0 && x + r.w > targetW) { x = 0; y += rowH; rowH = 0; }
        r.x = x; r.y = y; x += r.w; rowH = Math.max(rowH, r.d);
      }
      const coreAll = [...placed, ...loose];
      const bbox = bounds(coreAll);

      // Porches hug the requested side of the core.
      for (const p of porches) {
        if (p.x != null && p.y != null) continue;
        const side = p.side || 'back';
        if (side === 'back')  { p.x = bbox.minX + (bbox.w - p.w) / 2; p.y = bbox.maxY; }
        if (side === 'front') { p.x = bbox.minX + (bbox.w - p.w) / 2; p.y = bbox.minY - p.d; }
        if (side === 'left')  { p.x = bbox.minX - p.w; p.y = bbox.minY + (bbox.d - p.d) / 2; }
        if (side === 'right') { p.x = bbox.maxX; p.y = bbox.minY + (bbox.d - p.d) / 2; }
        p.side = side;
      }
      for (const g of garages) {
        if (g.x != null && g.y != null) continue;
        g.x = bbox.minX - g.w; g.y = bbox.minY; g.side = g.side || 'left';
      }
      out.push(...coreAll, ...porches, ...garages);
    }
    return out;
  }

  function bounds (rooms) {
    if (!rooms.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, d: 0 };
    const minX = Math.min(...rooms.map(r => r.x)), minY = Math.min(...rooms.map(r => r.y));
    const maxX = Math.max(...rooms.map(r => r.x + r.w)), maxY = Math.max(...rooms.map(r => r.y + r.d));
    return { minX, minY, maxX, maxY, w: maxX - minX, d: maxY - minY };
  }

  /* ──────────────────────────────────────────────────────────────────────
     NORMALIZE — the contract every consumer relies on.
     ────────────────────────────────────────────────────────────────────── */
  function normalizePlan (input) {
    const p = Object.assign(defaultPlan(), { rooms: [], notes: [] }, input || {});
    const units = p.units === 'm' ? 'm' : 'ft';
    const toFt = v => units === 'm' ? v * 3.28084 : v;

    let rooms = Array.isArray(p.rooms) ? p.rooms : [];
    rooms = rooms.filter(r => r && (r.name || r.type)).map((r, i) => {
      const type = ROOM_TYPES.includes(r.type) ? r.type : guessType(r.name || r.type);
      const dflt = DEFAULT_ROOM_SIZE[type] || DEFAULT_ROOM_SIZE.other;
      const w = round(toFt(num(r.w ?? r.width, dflt[0])), 1);
      const d = round(toFt(num(r.d ?? r.depth ?? r.length, dflt[1])), 1);
      const room = {
        id: r.id || slug(r.name || type) + '-' + i,
        name: r.name || (type[0].toUpperCase() + type.slice(1)),
        type, w, d,
        level: Math.max(0, Math.min(3, Math.floor(num(r.level, 0) || 0))),
        x: Number.isFinite(Number(r.x)) ? round(toFt(Number(r.x)), 1) : null,
        y: Number.isFinite(Number(r.y)) ? round(toFt(Number(r.y)), 1) : null,
        side: r.side || null
      };
      return room;
    });
    if (!rooms.length) rooms = defaultPlan().rooms.map((r, i) => ({ ...r, id: slug(r.name) + '-' + i, x: null, y: null, side: r.side || null }));

    rooms = autoLayout(rooms);
    // Shift everything so min corner sits at 0,0 (nice for the grid).
    const all = bounds(rooms);
    for (const r of rooms) { r.x = round(r.x - all.minX, 1); r.y = round(r.y - all.minY, 1); }

    const stories = Math.max(1, Math.min(4, Math.round(num(p.stories, 1)) || 1));
    const maxLevel = Math.max(...rooms.map(r => r.level));
    const storiesFinal = Math.max(stories, maxLevel + 1);

    const f = Object.assign({ ac_units: [], solar: false, basement: false, garage: false }, p.features || {});
    let ac = Array.isArray(f.ac_units) ? f.ac_units : [];
    ac = ac.map(u => ({
      count: Math.max(1, Math.round(num(u && u.count, 1))),
      type: ['window', 'split', 'central', 'portable'].includes(u && u.type) ? u.type : 'window',
      location: (u && u.location) || 'back porch'
    }));
    f.ac_units = ac;
    f.garage = !!f.garage || rooms.some(r => r.type === 'garage');

    const roofTypes = ['gable', 'hip', 'flat', 'shed'];
    const roof = { type: roofTypes.includes(p.roof && p.roof.type) ? p.roof.type : 'gable', pitch: round(num(p.roof && p.roof.pitch, 6), 1) };

    const core = rooms.filter(r => !NON_CONDITIONED.has(r.type));
    const conditioned = round(core.reduce((s, r) => s + r.w * r.d, 0));
    const porch = round(rooms.filter(r => r.type === 'porch').reduce((s, r) => s + r.w * r.d, 0));
    const garage = round(rooms.filter(r => r.type === 'garage').reduce((s, r) => s + r.w * r.d, 0));
    const fp = bounds(core);

    return {
      name: String(p.name || "Dad's house").slice(0, 120),
      units: 'ft',
      stories: storiesFinal,
      wall_height: round(num(p.wall_height, 9), 1),
      roof,
      rooms,
      features: f,
      notes: Array.isArray(p.notes) ? p.notes.map(String).slice(0, 40) : (p.notes ? [String(p.notes)] : []),
      source: p.source || 'editor',
      confidence: Math.max(0, Math.min(1, Number(p.confidence) || 0)),
      totals: {
        conditioned_sqft: conditioned,
        porch_sqft: porch,
        garage_sqft: garage,
        footprint: { w: round(fp.w, 1), d: round(fp.d, 1) },
        bedrooms: rooms.filter(r => r.type === 'bedroom').length,
        bathrooms: rooms.filter(r => r.type === 'bath').length,
        ac_units: ac.reduce((s, u) => s + u.count, 0)
      }
    };
  }

  /* ──────────────────────────────────────────────────────────────────────
     NOTES PARSER — deterministic. Understands the kind of shorthand that
     ends up on the back of an envelope:
       "2 air conditioners back porch"     → ac_units [{count:2, location:'back porch'}] + a back porch room
       "3 bed 2 bath", "3br/2ba"           → bedrooms/baths
       "24x36", "24 x 36 ft", "1200 sqft"  → footprint / target area
       "two story", "2 floors", "1.5 story" → stories
       "garage", "2 car garage"            → garage
       "flat roof", "hip roof"             → roof
       "front porch 20x8"                  → porch with dims
       "solar", "basement"                 → flags
     Returns a *partial* plan (only what it found) plus the raw lines.
     ────────────────────────────────────────────────────────────────────── */
  const WORDNUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5 };
  function wordToNum (s) { if (s == null) return null; const t = String(s).toLowerCase(); if (WORDNUM[t] != null) return WORDNUM[t]; const n = parseFloat(t); return Number.isFinite(n) ? n : null; }
  const NUM = '(\\d+(?:\\.\\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)';

  function parseNotes (text) {
    const raw = String(text || '');
    const lines = raw.split(/\r?\n|;|\.(?=\s|$)/).map(s => s.trim()).filter(Boolean);
    const plan = { rooms: [], features: { ac_units: [] }, notes: lines, source: 'notes' };
    const found = { rooms: 0 };
    const lower = raw.toLowerCase();

    // Stories
    let m = lower.match(new RegExp(NUM + '(?:\\.5)?\\s*-?\\s*(?:story|storey|stories|storeys|floors?|levels?)\\b'));
    if (m) plan.stories = Math.max(1, Math.ceil(wordToNum(m[1]) || 1));
    if (/\b(single|one)[- ]?(story|storey|level)\b|\bbungalow\b|\branch\b/.test(lower)) plan.stories = 1;
    if (/\bsplit[- ]level\b/.test(lower)) plan.stories = 2;

    // Roof
    m = lower.match(/\b(gable|hip|hipped|flat|shed|mansard|gambrel)\s*roof\b/);
    if (m) plan.roof = { type: m[1] === 'hipped' ? 'hip' : (['gable', 'hip', 'flat', 'shed'].includes(m[1]) ? m[1] : 'gable') };
    m = lower.match(/(\d+)\s*(?:\/|:|in|on)\s*12\s*(?:pitch|roof)?/);
    if (m) plan.roof = Object.assign(plan.roof || { type: 'gable' }, { pitch: Number(m[1]) });

    // Footprint "24x36" / "24 by 36" (ft) or "1200 sqft"
    m = lower.match(/(\d{2,3})\s*(?:x|by|×)\s*(\d{2,3})\s*(?:ft|feet|')?\b/);
    let footprint = m ? { w: Number(m[1]), d: Number(m[2]) } : null;
    m = lower.match(/(\d{3,5})\s*(?:sq\.?\s*ft|sqft|square\s*feet|sf)\b/);
    const targetArea = m ? Number(m[1]) : null;

    // Bedrooms / baths
    m = lower.match(new RegExp(NUM + '\\s*-?\\s*(?:bed(?:room)?s?|br)\\b'));
    const beds = m ? Math.round(wordToNum(m[1])) : null;
    m = lower.match(/(\d+(?:\.\d+)?)\s*-?\s*(?:bath(?:room)?s?|ba)\b/);
    const baths = m ? Number(m[1]) : null;

    // AC units: "2 air conditioners back porch", "two ac units on the back porch", "mini split in bedroom"
    const acRe = new RegExp(NUM + '?\\s*(?:mini[- ]?splits?|split\\s*units?|window\\s*(?:ac|units?|air\\s*conditioners?)|air\\s*conditioners?|air\\s*con(?:ditioning)?|a\\/?c\\s*units?|ac\\s*units?|acs?\\b|hvac)(?:\\s*(?:units?|on|at|in|for|,)?\\s*(?:the\\s+)?([a-z ]{3,40}?))?(?=$|[.,;\\n]|\\s+(?:and|with|plus)\\b)', 'g');
    let am;
    while ((am = acRe.exec(lower))) {
      const whole = am[0];
      const count = wordToNum(am[1]) || 1;
      const type = /split/.test(whole) ? 'split' : /hvac|central/.test(whole) ? 'central' : 'window';
      let location = (am[2] || '').trim().replace(/\s+/g, ' ');
      location = location.replace(/^(units?|unit)\s*/, '').trim();
      if (!location || /^(units?|the)$/.test(location)) location = /porch/.test(lower) ? (lower.match(/(front|back|side|rear)\s*porch/) || [, 'back'])[1] + ' porch' : 'unspecified';
      if (location === 'rear porch') location = 'back porch';
      plan.features.ac_units.push({ count: Math.round(count), type, location });
    }
    if (/\bcentral\s*(?:air|ac|hvac)\b/.test(lower) && !plan.features.ac_units.some(u => u.type === 'central')) {
      plan.features.ac_units.push({ count: 1, type: 'central', location: 'whole house' });
    }

    // Porches: "back porch", "front porch 20x8", "screened porch", "deck"
    const porchRe = /\b(front|back|rear|side|wrap[- ]?around|screened(?:-in)?)?\s*(porch|deck|patio|veranda|stoop)\b(?:\s*(\d{1,2})\s*(?:x|by|×)\s*(\d{1,2}))?/g;
    let pm; const porchSides = new Set();
    while ((pm = porchRe.exec(lower))) {
      let side = (pm[1] || 'back').replace('rear', 'back').replace(/screened(-in)?/, 'back').replace(/wrap[- ]?around/, 'front');
      if (porchSides.has(side)) continue;
      porchSides.add(side);
      plan.rooms.push({ name: `${side[0].toUpperCase() + side.slice(1)} ${pm[2]}`, type: 'porch', side, w: pm[3] ? Number(pm[3]) : 20, d: pm[4] ? Number(pm[4]) : 8, level: 0 });
    }
    // An AC "on the back porch" implies a back porch even if the porch itself wasn't listed.
    for (const u of plan.features.ac_units) {
      const s = (u.location.match(/(front|back|side)\s*porch/) || [])[1];
      if (s && !porchSides.has(s)) { porchSides.add(s); plan.rooms.push({ name: `${s[0].toUpperCase() + s.slice(1)} porch`, type: 'porch', side: s, w: 20, d: 8, level: 0 }); }
    }

    // Garage
    m = lower.match(new RegExp(NUM + '?\\s*-?\\s*car\\s*garage|\\bgarage\\b'));
    if (m) {
      const cars = wordToNum(m[1]) || 1;
      plan.rooms.push({ name: `${cars}-car garage`, type: 'garage', w: cars >= 2 ? 22 : 12, d: 22, level: 0 });
      plan.features.garage = true;
    }

    // Named rooms with optional dims: "kitchen 12x14", "office", "workshop 16 x 20"
    const roomRe = /\b(living\s*room|family\s*room|great\s*room|kitchen|dining(?:\s*room)?|office|study|laundry|mud\s*room|workshop|studio|pantry|master\s*(?:bed(?:room)?|suite)|nursery|den|foyer|entry)\b(?:\s*(?:of\s*)?(\d{1,2})\s*(?:x|by|×)\s*(\d{1,2}))?/g;
    let rm; const seen = new Set();
    while ((rm = roomRe.exec(lower))) {
      const name = rm[1].replace(/\s+/g, ' ');
      if (seen.has(name)) continue; seen.add(name);
      const r = { name: name[0].toUpperCase() + name.slice(1), type: guessType(name), level: 0 };
      if (rm[2]) { r.w = Number(rm[2]); r.d = Number(rm[3]); }
      plan.rooms.push(r); found.rooms++;
    }
    // Bedrooms / baths as counted rooms — a named "master bedroom" counts as one of the N.
    const namedBeds = plan.rooms.filter(r => r.type === 'bedroom').length;
    if (beds) for (let i = 1; i <= Math.min(beds - namedBeds, 8); i++) plan.rooms.push({ name: 'Bedroom ' + (i + namedBeds), type: 'bedroom', level: plan.stories > 1 ? 1 : 0 });
    if (baths) { const full = Math.floor(baths), half = baths - full > 0; for (let i = 1; i <= Math.min(full, 6); i++) plan.rooms.push({ name: 'Bathroom ' + i, type: 'bath', level: plan.stories > 1 && i > 1 ? 1 : 0 }); if (half) plan.rooms.push({ name: 'Half bath', type: 'bath', w: 5, d: 5, level: 0 }); }
    // If we have beds but nobody mentioned a living room / kitchen, add them — a house needs them.
    if ((beds || targetArea || footprint) && !plan.rooms.some(r => r.type === 'living'))  plan.rooms.push({ name: 'Living room', type: 'living', level: 0 });
    if ((beds || targetArea || footprint) && !plan.rooms.some(r => r.type === 'kitchen')) plan.rooms.push({ name: 'Kitchen', type: 'kitchen', level: 0 });

    // Scale rooms to hit a stated footprint / area.
    const core = plan.rooms.filter(r => !NON_CONDITIONED.has(r.type));
    const target = targetArea || (footprint ? footprint.w * footprint.d * (plan.stories || 1) : null);
    if (target && core.length) {
      for (const r of core) { const dflt = DEFAULT_ROOM_SIZE[r.type] || DEFAULT_ROOM_SIZE.other; r.w = r.w || dflt[0]; r.d = r.d || dflt[1]; }
      const cur = core.reduce((s, r) => s + r.w * r.d, 0);
      const k = Math.sqrt(target / cur);
      if (k > 0.5 && k < 2.5) for (const r of core) { r.w = round(r.w * k, 1); r.d = round(r.d * k, 1); }
    }
    if (footprint) plan.footprint_hint = footprint;

    if (/\bsolar\b/.test(lower)) plan.features.solar = true;
    if (/\bbasement\b/.test(lower)) plan.features.basement = true;
    m = raw.match(/(?:^|\n)\s*(?:name|project|house)\s*[:\-]\s*(.+)/i);
    if (m) plan.name = m[1].trim();

    plan.found = { beds, baths, stories: plan.stories || null, ac: plan.features.ac_units.length, porches: porchSides.size, footprint, targetArea, rooms: plan.rooms.length };
    return plan;
  }

  // Merge two partial plans; `primary` wins on conflicts, secondary fills gaps.
  function mergePlans (primary, secondary) {
    const a = primary || {}, b = secondary || {};
    const out = { ...b, ...a };
    out.features = { ...(b.features || {}), ...(a.features || {}) };
    const acA = (a.features && a.features.ac_units) || [], acB = (b.features && b.features.ac_units) || [];
    out.features.ac_units = acA.length ? acA : acB;
    const roomsA = a.rooms || [], roomsB = b.rooms || [];
    if (!roomsA.length) out.rooms = roomsB;
    else {
      // Add secondary rooms whose type isn't represented at all (e.g. notes say "back porch", sketch didn't show it).
      const types = new Set(roomsA.map(r => r.type || guessType(r.name)));
      out.rooms = roomsA.concat(roomsB.filter(r => !types.has(r.type || guessType(r.name))));
    }
    out.notes = [...new Set([...(a.notes || []), ...(b.notes || [])])];
    return out;
  }

  /* ──────────────────────────────────────────────────────────────────────
     BUDGET — line items × city index. $/sqft figures are 2026 planning
     ballparks for modest owner-built or small-contractor construction in
     the US Midwest at index 1.00; the city index scales them.
     ────────────────────────────────────────────────────────────────────── */
  const AC_COST = { window: 650, portable: 500, split: 4200, central: 9500 };

  function cityById (id) { return CITIES.find(c => c.id === id) || CITIES[0]; }

  function estimateBudget (planIn, opts = {}) {
    const plan = planIn && planIn.totals ? planIn : normalizePlan(planIn);
    const city = { ...cityById(opts.city || 'detroit') };
    if (opts.index) city.index = num(opts.index, city.index);
    if (opts.city_name && city.id === 'custom') city.name = String(opts.city_name).slice(0, 60);
    const quality = ['basic', 'standard', 'premium'].includes(opts.quality) ? opts.quality : 'standard';
    const qMul = { basic: 0.82, standard: 1.0, premium: 1.35 }[quality];
    const sweat = Math.max(0, Math.min(0.6, Number(opts.sweat_equity) || 0));   // share of labor done by family
    const ownerEquity = Math.max(0, Number(opts.owner_equity) || 0);
    const landCost = Math.max(0, Number(opts.land_cost) || 0);

    const T = plan.totals;
    const sf = Math.max(T.conditioned_sqft, 200);
    const fp = plan.rooms.filter(r => !NON_CONDITIONED.has(r.type) && r.level === 0).reduce((s, r) => s + r.w * r.d, 0) || sf / plan.stories;
    const k = city.index * qMul;

    const items = [];
    const add = (id, label, qty, unit, rate, laborShare, note) => {
      const base = qty * rate * k;
      const cost = base * (1 - laborShare * sweat);
      items.push({ id, label, qty: round(qty, 1), unit, rate: round(rate * k, 2), labor_share: laborShare, cost: round(cost), note: note || '' });
    };

    add('site',      'Site prep, survey, permits & utility hookups', 1, 'lot', 9500, 0.2, 'Permits + tap fees vary a lot by city.');
    add('found',     plan.features.basement ? 'Foundation — full basement' : 'Foundation — slab / crawlspace', fp, 'sqft footprint', plan.features.basement ? 38 : 14, 0.35);
    add('frame',     'Framing & sheathing (walls, floors, roof structure)', sf, 'sqft', 32, 0.5);
    const roofMul = { flat: 0.85, shed: 0.9, gable: 1.0, hip: 1.15 }[plan.roof.type];
    add('roof',      `Roofing — ${plan.roof.type} (${plan.roof.pitch}/12)`, fp * 1.25 * roofMul, 'sqft roof', 7.5, 0.4);
    add('ext',       'Exterior — siding, windows, doors', sf, 'sqft', 21, 0.4);
    add('plumb',     `Plumbing — ${T.bathrooms} bath, kitchen, laundry`, Math.max(1, T.bathrooms) + 1, 'wet rooms', 7800, 0.25);
    add('elec',      'Electrical — service, wiring, fixtures', sf, 'sqft', 8.5, 0.3);
    add('hvac',      'Heating — furnace / boiler + ducts', sf, 'sqft', 7, 0.25);
    for (const u of plan.features.ac_units) {
      add('ac-' + u.type, `Air conditioning — ${u.count}× ${u.type} unit${u.count > 1 ? 's' : ''} (${u.location})`, u.count, 'unit', AC_COST[u.type], u.type === 'window' ? 0.1 : 0.3);
    }
    add('insul',     'Insulation & drywall', sf, 'sqft', 12, 0.5);
    add('interior',  'Interior finishes — floors, paint, trim, doors', sf, 'sqft', 18, 0.55);
    add('kitchen',   'Kitchen — cabinets, counters, appliances', 1, 'kitchen', 14000, 0.3);
    add('bath',      'Bathroom fixtures & tile', Math.max(1, T.bathrooms), 'bath', 6500, 0.35);
    if (T.porch_sqft)  add('porch',  `Porch / deck (${T.porch_sqft} sqft)`, T.porch_sqft, 'sqft', 38, 0.5);
    if (T.garage_sqft) add('garage', `Garage (${T.garage_sqft} sqft)`, T.garage_sqft, 'sqft', 55, 0.4);
    if (plan.features.solar) add('solar', 'Rooftop solar (approx. 5 kW)', 5, 'kW', 2600, 0.1, 'Before federal/state credits.');

    const hard = items.reduce((s, i) => s + i.cost, 0);
    const soft = round(hard * 0.08);
    const contingency = round(hard * 0.10);
    items.push({ id: 'soft', label: 'Soft costs — drawings, engineering, inspections (8%)', qty: 1, unit: 'project', rate: soft, labor_share: 0, cost: soft });
    items.push({ id: 'cont', label: 'Contingency (10%)', qty: 1, unit: 'project', rate: contingency, labor_share: 0, cost: contingency });
    const construction = hard + soft + contingency;
    const total = construction + landCost;
    const ask = Math.max(0, round(total - ownerEquity));

    // Phasing: what a city or lender sees as fundable stages.
    const phaseOf = { site: 1, found: 1, frame: 1, roof: 1, ext: 1, plumb: 2, elec: 2, hvac: 2, insul: 2, interior: 3, kitchen: 3, bath: 3, porch: 3, garage: 3, solar: 3, soft: 1, cont: 3 };
    const phases = [
      { n: 1, name: 'Dry shell — site, foundation, frame, roof, exterior', cost: 0 },
      { n: 2, name: 'Systems — plumbing, electrical, HVAC, insulation, drywall', cost: 0 },
      { n: 3, name: 'Finishes — interiors, kitchen, baths, porch, extras', cost: 0 }
    ];
    for (const i of items) phases[(phaseOf[i.id] || (i.id.startsWith('ac-') ? 2 : 3)) - 1].cost += i.cost;
    for (const p of phases) p.cost = round(p.cost);

    return {
      city: { id: city.id, name: city.name, region: city.region, index: city.index, dept: city.dept, programs: city.programs, land_hint: city.land_hint || '' },
      inputs: { quality, sweat_equity: sweat, owner_equity: ownerEquity, land_cost: landCost },
      sqft: { conditioned: T.conditioned_sqft, porch: T.porch_sqft, garage: T.garage_sqft, footprint: round(fp) },
      items,
      hard_cost: round(hard), soft_cost: soft, contingency, land_cost: landCost,
      construction_total: round(construction), total: round(total),
      per_sqft: round(construction / sf),
      owner_equity: ownerEquity, ask,
      phases,
      currency: 'USD',
      disclaimer: 'Planning-grade estimate (±25%). Not a contractor quote. Verify program terms with the city.'
    };
  }

  /* ──────────────────────────────────────────────────────────────────────
     PITCH TEMPLATE — the no-AI fallback (and the skeleton the AI improves).
     ────────────────────────────────────────────────────────────────────── */
  function money (n, cur = 'USD') { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n || 0); }

  function pitchTemplate (plan, budget, opts = {}) {
    const c = budget.city;
    const who = opts.applicant || 'the applicant family';
    const site = opts.site || `a lot in ${c.name}`;
    const T = plan.totals;
    const ac = plan.features.ac_units.map(u => `${u.count} ${u.type} AC unit${u.count > 1 ? 's' : ''} (${u.location})`).join(', ');
    const lines = [];
    lines.push(`# ${plan.name} — a self-built home in ${c.name}`);
    lines.push('');
    lines.push(`**To:** ${c.dept}`);
    lines.push(`**From:** ${who}`);
    lines.push(`**Re:** Request for ${money(budget.ask)} in site, gap financing and/or abatement support for an owner-built ${T.bedrooms}-bedroom home`);
    lines.push('');
    lines.push('## The ask, in one line');
    lines.push(`We will build a ${T.conditioned_sqft.toLocaleString()} sq ft, ${plan.stories}-story home on ${site}. Total project cost is ${money(budget.total)}; we bring ${money(budget.owner_equity)} in cash and labor and ask the city for ${money(budget.ask)} in land, gap financing, fee waivers or tax abatement.`);
    lines.push('');
    lines.push('## What gets built');
    lines.push(`- ${T.bedrooms} bedrooms, ${T.bathrooms} bathroom${T.bathrooms === 1 ? '' : 's'}, ${plan.roof.type} roof`);
    for (const r of plan.rooms) lines.push(`- ${r.name}: ${r.w} × ${r.d} ft (${round(r.w * r.d)} sq ft)${r.level ? `, level ${r.level + 1}` : ''}`);
    if (ac) lines.push(`- Cooling: ${ac}`);
    if (plan.features.solar) lines.push('- Rooftop solar');
    if (plan.notes.length) { lines.push(''); lines.push('Owner notes: ' + plan.notes.join('; ')); }
    lines.push('');
    lines.push('## Budget');
    lines.push('| Line | Cost |'); lines.push('|---|---:|');
    for (const i of budget.items) lines.push(`| ${i.label} | ${money(i.cost)} |`);
    lines.push(`| **Construction total** | **${money(budget.construction_total)}** |`);
    if (budget.land_cost) lines.push(`| Land | ${money(budget.land_cost)} |`);
    lines.push(`| **Total** | **${money(budget.total)}** |`);
    lines.push('');
    lines.push(`About ${money(budget.per_sqft)}/sq ft at a ${c.name} cost index of ${c.index}. ${budget.disclaimer}`);
    lines.push('');
    lines.push('## Phasing');
    for (const p of budget.phases) lines.push(`${p.n}. ${p.name} — ${money(p.cost)}`);
    lines.push('');
    lines.push('## Why this is a good deal for the city');
    lines.push('- Puts a vacant lot back on the tax roll as an owner-occupied home, built by a family that intends to stay.');
    lines.push('- Owner-built with local trades for the licensed work: money stays in the neighborhood.');
    lines.push('- Modest footprint, efficient systems, and a porch that faces the block — the kind of infill that stabilises a street.');
    if (budget.inputs.sweat_equity) lines.push(`- ${Math.round(budget.inputs.sweat_equity * 100)}% of labor is family sweat equity, which the budget already reflects.`);
    lines.push('');
    lines.push('## Programs we are applying to');
    for (const p of c.programs) lines.push(`- **${p.name}** — ${p.what}`);
    if (c.land_hint) lines.push(`- Land: ${c.land_hint}`);
    lines.push('');
    lines.push('## Timeline');
    lines.push('- Months 0–2: site acquisition, drawings, permits');
    lines.push('- Months 3–6: dry shell');
    lines.push('- Months 7–9: systems');
    lines.push('- Months 10–12: finishes, inspections, occupancy');
    lines.push('');
    lines.push('We would welcome a meeting to walk through the drawings and the 3D model.');
    return lines.join('\n');
  }

  return { CITIES, ROOM_TYPES, DEFAULT_ROOM_SIZE, AC_COST, defaultPlan, normalizePlan, parseNotes, mergePlans, estimateBudget, pitchTemplate, cityById, guessType, money };
});
