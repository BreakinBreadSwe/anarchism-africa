// node bin/house-test.mjs — HOUSE LAB unit tests (no network, no keys).
//   npm run test:house
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../lib/house-estimator.js');

test("Dad's note: 2 air conditioners back porch", () => {
  const p = E.parseNotes('2 air conditioners back porch');
  assert.equal(p.features.ac_units.length, 1);
  assert.deepEqual(p.features.ac_units[0], { count: 2, type: 'window', location: 'back porch' });
  assert.ok(p.rooms.some(r => r.type === 'porch' && r.side === 'back'), 'implies a back porch');
  const n = E.normalizePlan(E.mergePlans(p, E.defaultPlan()));
  assert.equal(n.totals.ac_units, 2);
  assert.equal(n.rooms.filter(r => r.type === 'porch').length, 1, 'default porch is not duplicated');
});

test('rich notes → beds, baths, stories, garage, roof, solar, footprint', () => {
  const p = E.parseNotes('3 bed 2 bath two story 24x36, front porch 20x8, 2 car garage, hip roof, mini split in master bedroom, central air, solar, basement');
  assert.equal(p.stories, 2);
  assert.equal(p.roof.type, 'hip');
  assert.deepEqual(p.found.footprint, { w: 24, d: 36 });
  const n = E.normalizePlan(p);
  assert.equal(n.totals.bedrooms, 3, 'master bedroom counts as one of the 3');
  assert.equal(n.totals.bathrooms, 2);
  assert.ok(n.totals.garage_sqft > 0);
  assert.equal(n.rooms.find(r => r.type === 'porch').side, 'front');
  assert.ok(n.features.ac_units.some(u => u.type === 'split') && n.features.ac_units.some(u => u.type === 'central'));
  assert.equal(n.features.solar, true); assert.equal(n.features.basement, true);
  assert.ok(Math.abs(n.totals.conditioned_sqft - 24 * 36 * 2) / (24 * 36 * 2) < 0.15, 'scaled to the stated footprint');
});

test('normalizePlan: rooms never overlap after auto-layout, everything is numeric', () => {
  const n = E.normalizePlan({ rooms: [{ name: 'Kitchen' }, { name: 'Living' }, { name: 'Bed' }, { name: 'Bed 2' }, { name: 'Bath' }, { name: 'Back porch' }] });
  const core = n.rooms.filter(r => r.type !== 'porch');
  for (const a of core) for (const b of core) {
    if (a === b) continue;
    const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
    assert.ok(!overlap, `${a.name} overlaps ${b.name}`);
  }
  for (const r of n.rooms) for (const k of ['w', 'd', 'x', 'y']) assert.equal(typeof r[k], 'number', `${r.name}.${k}`);
  assert.equal(n.units, 'ft');
});

test('normalizePlan: metres convert to feet, garbage is tolerated', () => {
  const n = E.normalizePlan({ units: 'm', rooms: [{ name: 'Kitchen', w: 3, d: 4, x: 'nope' }], stories: 'x', roof: { type: 'dome' } });
  assert.equal(n.rooms[0].w, 9.8); assert.equal(n.rooms[0].d, 13.1);
  assert.equal(n.stories, 1); assert.equal(n.roof.type, 'gable');
});

test('estimateBudget: Detroit vs Chicago index, AC lines, sweat equity, ask', () => {
  const plan = E.normalizePlan(E.mergePlans(E.parseNotes('2 air conditioners back porch'), E.defaultPlan()));
  const det = E.estimateBudget(plan, { city: 'detroit' });
  const chi = E.estimateBudget(plan, { city: 'chicago' });
  assert.ok(chi.total > det.total, 'Chicago costs more than Detroit');
  assert.ok(det.items.some(i => i.id === 'ac-window' && i.qty === 2), 'two window units are a budget line');
  const sweat = E.estimateBudget(plan, { city: 'detroit', sweat_equity: 0.4 });
  assert.ok(sweat.total < det.total, 'sweat equity lowers the total');
  const eq = E.estimateBudget(plan, { city: 'detroit', owner_equity: 50000, land_cost: 5000 });
  assert.equal(eq.ask, eq.total - 50000);
  assert.equal(Math.round(eq.phases.reduce((s, p) => s + p.cost, 0)), Math.round(eq.construction_total), 'phases sum to construction total');
  assert.ok(det.city.programs.length >= 3);
});

test('pitchTemplate: names the department, the ask and the AC units', () => {
  const plan = E.normalizePlan(E.mergePlans(E.parseNotes('2 air conditioners back porch'), E.defaultPlan()));
  const b = E.estimateBudget(plan, { city: 'detroit', owner_equity: 10000 });
  const md = E.pitchTemplate(plan, b, { applicant: 'The Lab family' });
  assert.match(md, /Housing & Revitalization Department, City of Detroit/);
  assert.match(md, /2 window AC units \(back porch\)/);
  assert.match(md, new RegExp(E.money(b.ask).replace(/[$,]/g, '\\$&')));
  assert.match(md, /Neighborhood Enterprise Zone/);
});
