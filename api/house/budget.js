// POST /api/house/budget
//   body: { plan, city: 'detroit', quality: 'basic'|'standard'|'premium', sweat_equity: 0-0.6, owner_equity, land_cost, index?, city_name? }
//   resp: { budget }
// GET  /api/house/budget → { cities: [...] }
//
// Pure computation — same code the browser runs offline (lib/house-estimator.js).
// Kept as an endpoint so other clients (Studio, a future mobile app) get the
// same numbers without shipping the library.
import estimator from '../../lib/house-estimator.js';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler (req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ cities: estimator.CITIES.map(c => ({ id: c.id, name: c.name, region: c.region, index: c.index, programs: c.programs.length })) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST' });
  const { plan, ...opts } = req.body || {};
  try {
    const normalized = estimator.normalizePlan(plan);
    const budget = estimator.estimateBudget(normalized, opts);
    res.status(200).json({ plan: normalized, budget });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
}
