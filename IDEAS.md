# Ideas & Backlog — ANARCHISM.AFRICA

Running list of ideas not yet scheduled. Each entry: what, why, open questions, status.

---

## Connect the app to its developer company (LUVLAB.io / FairPlay)

**Status:** 💡 idea — captured 2026-06-16

**What.** Surface a clear, consistent connection from the app back to the company
that develops it: **LUVLAB.io** and **fairplayfoot.com**. Today LUVLAB / COOLHUNTPARIS
appear only in internal docs, role manifests, and code comments — there's no
user-facing "built by" link or shared identity in the live app.

**Why.** Attribution and trust. Visitors should be able to see who builds and
stewards the platform, and reach the developer/company sites. It also ties
ANARCHISM.AFRICA into the wider LUVLAB / FairPlay family.

**Possible scope (smallest → largest):**
1. **Footer / About credit** — "Built by [LUVLAB](https://luvlab.io) · [FairPlay](https://fairplayfoot.com)"
   in the global footer and the About section. Lowest effort, highest clarity.
2. **Shared branding** — consistent "part of the LUVLAB / FairPlay family" treatment
   across the sites (logo lockup, cross-links both directions).
3. **Deeper integration (future)** — shared sign-in (SSO) or shared content/commerce
   API across anarchism.africa, luvlab.io, and fairplayfoot.com.

**Open questions:**
- Which domain is the canonical developer/company link — `luvlab.io`, `fairplayfoot.com`,
  or both? (Live deploy is `fairplay-pearl.vercel.app`.)
- Where exactly should the credit appear — footer only, About, or both?
- Is COOLHUNTPARIS (curator/publisher) credited alongside, or is this dev-only?

**Next step:** confirm canonical link + placement, then ship the footer/About credit
(scope 1) as a quick first pass.

---

## "The Modern Colosseum" — financial/political anatomy of a France–Sénégal match

**Status:** 💡 idea + 🔬 research in progress — captured 2026-06-16

**What.** A data-driven long-read (article + possible interactive) that dissects a
France vs Sénégal men's football match as an economic and political machine. The
former colonizer meets the colonized in a stadium ringed by sponsors; the Senegalese
players lighting up the pitch were largely developed by, and earn inside, European
leagues. Who owns the spectacle, who profits, who is watched.

**Why.** Fits the platform's afro-anarchist lens exactly — football as the modern
colosseum. Names, numbers, sources; refuses to fabricate.

**Analysis layers (each measurable):**
1. **Airtime economics** — seconds of brand exposure per sponsor, per broadcaster
   (TF1/FR, RTS/SN, beIN, SuperSport…), modeled to ad-equivalent / media value.
2. **Air rights & reach** — who holds broadcast rights per market, what they paid,
   audience reach (viewers touched per territory).
3. **Player economics** — wages, appearance/scoring bonuses, and transfer-value
   swings before vs after scoring (one goal moving a valuation).
4. **Colosseum / political layer** — France–Sénégal colonial history, soft power &
   goodwill, football-as-diplomacy vs "sportswashing," prestige, and the cost of
   *hosting* (stadium debt, displacement).
5. **Society & nature** — labor behind the spectacle, gambling-ad saturation, and the
   carbon/water/waste footprint of a mega-event.

**Open questions:**
- Which specific fixture (World Cup 2026 group stage? friendly? AFCON?) — pins down
  the sponsor set and rights holders.
- Output format: standalone article via the AI article pipeline, or article + an
  interactive "where the money goes" graphic?

**Next step:** deep-research pass for real cited figures (rights deals, audience,
sponsorship media value, wages/bonuses), then draft via the article pipeline in house voice.

---

## The FairPlay Thermometer — a scale-invariant impact index for football

**Status:** 💡 idea (product concept) — captured 2026-06-16. Extends "The Modern Colosseum."
**Owner link:** FairPlay (fairplayfoot.com) / LUVLAB.

**What.** A single instrument — a "thermometer" — that reads the planetary and social
*heat* of any football event, at any caliber. Same metrics whether it's a World Cup
final watched by a billion or a Sunday youth match: the index is computed **per event
and per attendee**, so it's scale-invariant. The point is to make impact *legible*
down the whole pyramid, not just at the mega-event top — because even small leagues,
multiplied across thousands of fixtures, move the needle on the planet and on society.

**Why.** Turns the "modern colosseum" critique into a usable, repeatable measurement
that FairPlay can own. Lets a club, league, or organiser see their own number and
lower it. Connects the platform's analysis to a concrete tool.

**Reading dimensions (each scores per-event + per-attendee):**
1. **Planet** — carbon (the dominant line is travel), water, waste, energy. Footprint
   per spectator and per match, scalable from grassroots to World Cup.
2. **Spectator transportation** — how fans get there (car / coach / rail / air), the
   single biggest swing factor; local league = short car trips × thousands of fixtures,
   mega-event = long-haul flights.
3. **Youth & spectator health** — exposure of young spectators to gambling/alcohol/
   junk-food advertising, air quality, crowd safety, and the positive side (activity,
   belonging) — net health signal, not one-sided.
4. **Society** — labor behind the event, local economic benefit vs. cost, inclusion,
   and goodwill.

**Design questions:**
- Output: a 0–100 "temperature," a letter grade, or a multi-dial readout?
- Data inputs: what's the minimum an organiser must supply (attendance, distances,
  transport mix, sponsor categories) for a credible reading?
- Benchmarks: World Cup match vs. national-league match vs. grassroots youth match —
  publish reference values so any event can place itself on the scale.

**Next step:** extend the in-progress research to cover fan-travel emissions, youth-
spectator health, and grassroots/amateur cumulative footprint; from that, draft a
first methodology + reference benchmarks for the thermometer.
