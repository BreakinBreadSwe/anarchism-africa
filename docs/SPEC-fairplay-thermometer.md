# SPEC — FairPlay Thermometer

**Owner:** FairPlay (fairplayfoot.com) / LUVLAB · **Status:** v0.1 draft · **Date:** 2026-06-16
**Companion research:** [`docs/RESEARCH-modern-colosseum.md`](RESEARCH-modern-colosseum.md)
**First implementation:** [`/thermometer.html`](../thermometer.html) + [`js/thermometer.js`](../js/thermometer.js)

---

## 1. What it is

A single, **scale-invariant** reading of the planetary and social *heat* of any
football event — from a World Cup final to a Sunday youth match. Same instrument,
any caliber, because every score is computed **per event and per attendee**. The
output is a **0–100 "temperature"** plus a four-dial breakdown, so an organiser,
club, or league can see their number and lower it.

Design principle: **make impact legible down the whole pyramid, not just at the top.**
A grassroots match looks tiny next to a World Cup — until you multiply it by thousands
of weekly fixtures. The per-attendee basis surfaces that.

## 2. The four dials

Each dial returns 0–100 (0 = cool/low harm, 100 = scorching). The headline temperature
is a weighted blend (default weights in brackets; tunable).

| # | Dial | What it reads | Primary inputs |
|---|------|---------------|----------------|
| 1 | **Planet** (0.40) | Carbon per attendee, dominated by travel; plus water/waste/energy | attendance, travel distances + mode mix |
| 2 | **Transport** (0.25) | Fan-travel mode quality (share on rail/coach/public vs car/air) | mode split %, avg one-way distance |
| 3 | **Youth & health** (0.20) | Young-spectator exposure to gambling/alcohol/junk ads; air quality; offset by participation benefit | gambling-ad density, alcohol-ad %, % youth crowd, grassroots-participation flag |
| 4 | **Society** (0.15) | Labor conditions, local benefit vs. cost, inclusion | new-build vs reuse, local-vendor access, accessible-pricing flag |

> Weights are config, not law. A youth-football organiser may zero the gambling axis
> if no betting ads run; an organiser hosting in a new-build stadium will feel the
> Society dial bite. Document any reweighting in the output.

## 3. The carbon spine (Dial 1 + 2)

Carbon is the most defensible axis, so it anchors the index.

**Per-attendee travel carbon** = Σ over modes of
`(share_mode × avg_distance_km × 2 × emission_factor_mode)`.

Emission factors (DEFRA-style, g CO₂e per passenger-km — confirm against current-year
DEFRA before publishing):

| Mode | g/pax-km |
|------|----------|
| International rail | 6 |
| Coach | 30 |
| National rail | 40 |
| Car (4 occupants) | 60 |
| Bus | 89 |
| Short-haul flight | ~250 (swing factor — pin exact current value) |

**Reference per-attendee benchmarks** (from peer-reviewed studies, see dossier):
- Domestic league match: **~6–8 kg CO₂e/spectator** (Austrian/German football).
- Mega-event: **~260 kg CO₂e/person** (≈30–40× a domestic match).

This **30–40× spread is the whole point** of a per-attendee number — and the calibration
anchor for mapping kg → 0–100. Default mapping (log-ish, tunable):

```
planetScore(kgPerAttendee):
  ≤ 5 kg   → 0–20    (grassroots / public-transport local)
  5–15 kg  → 20–45   (typical domestic match)
  15–60 kg → 45–70   (regional travel / some flights)
  60–200kg → 70–90   (national-team / continental travel)
  ≥ 200 kg → 90–100  (mega-event, flight-heavy)
```

**Audited anchor:** UEFA EURO 2024 = 316,912 t CO₂e, ~80% transport, 81% of ticket-holders
on free public transport. The 2026 World Cup modelled at ~87% fan-travel. Use EURO 2024
as the one *audited* calibration point; treat tournament projections (7.8–15 Mt) as a range.

## 4. Inputs an organiser supplies

Minimum viable input set (everything else defaults to benchmark averages):

- **Attendance** (number) — required; the per-attendee divisor.
- **Average one-way travel distance** (km) — required.
- **Transport mode mix** (% car / coach / bus / national rail / intl rail / flight) —
  required; defaults to a domestic-football average if unknown.
- **Caliber preset** — grassroots / amateur league / national league / continental /
  World Cup — pre-fills sensible defaults so a casual user gets a reading in 3 fields.
- *Optional:* gambling-ad density (ads/match or none), alcohol-ad % of broadcast,
  % of crowd under 18, new-build vs existing venue, local-vendor access (y/n),
  accessible pricing (y/n).

## 5. Output

- **Temperature 0–100** with a colour ramp (cool blue → hot red) and a one-line verdict.
- **Four dials** with their sub-scores and the single biggest lever ("83% of your heat
  is fan flights — a rail-share shift of 20% drops you ~12°").
- **Per-attendee carbon** in kg, plus total.
- **Uncertainty note** — which inputs were user-supplied vs. benchmark-defaulted.
- Shareable summary (for the article and for FairPlay's own use).

## 6. Scope-invariance test (must pass)

The same formula, fed three real-world calibers, must land in the right bands:

| Event | Inputs | Expected temperature |
|-------|--------|----------------------|
| Sunday youth match | 60 fans, 8 km, 90% car/walk, no ads | **cool** (~10–20) |
| National-league match | 20k fans, 30 km, mixed transit | **warm** (~35–50) |
| World Cup match | 60k fans, 2,000 km, 70% flight, heavy gambling ads | **hot** (~85–95) |

The v0 page (`/thermometer.html`) ships these three as one-tap presets.

## 7. Roadmap

- **v0 (now):** client-side calculator, presets, four dials, carbon spine. No backend.
- **v1:** persist readings; reuse the existing POD CO₂-tracking plumbing in `market.html`
  (Gelato Eco etc.) so merch and events report on the same scale.
- **v2:** public benchmark library (publish reference values so any event can place itself);
  embeddable badge ("This match: 41° — FairPlay verified").
- **v3:** organiser API + the optional social dials backed by real ad-density measurement.

## 8. Open decisions

- [ ] Final dial weights (0.40 / 0.25 / 0.20 / 0.15 is a starting point).
- [ ] kg→score mapping curve (linear vs log) — calibrate against the benchmark table.
- [ ] Confirm current-year DEFRA flight factor before any public figure.
- [ ] Letter grade (A–F) in addition to the 0–100 temperature?
- [ ] How hard the youth/society dials should bite when inputs are unknown (default to
      neutral, not worst-case, to stay fair).
