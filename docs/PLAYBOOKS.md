# ANARCHISM.AFRICA — Playbooks

**Date:** 2026-05-01. **Stewards:** LUVLAB · COOLHUNTPARIS.

This file is the project's full operational playbook, applied through the afro-anarchist lens. Each plugin requested has a section. The conversion runs through three rules:

1. **No bosses, no funnels.** "Sales pipeline" becomes "solidarity pipeline." "Customer success" becomes "reader-organiser growth." "Vendor check" becomes "alliance check."
2. **Open books.** Where the corporate playbook says "audit," we say "transparency log." The numbers are public.
3. **The state is not our peer.** Compliance with extractive law is treated as a constraint, never a goal. The goal is community consent.

---

# 1. Brand voice (`brand-voice:*`)

### `brand-voice:guideline-generation` — house guidelines

**Voice in one paragraph.** Plain-spoken, present-tense, sparing on metaphor. The platform tells you what it is, not what it can do for you. We name people, places, dates, page numbers. We refuse to fabricate. We use English, French, Portuguese, Wolof, Swahili, Yoruba, Twi, Amharic, Lingala, Arabic where it lands. We refuse: "stay woke," "good vibes," "Africa rising," "mama Africa," exclamation marks, corporate-feminism empowerment frames, false intimacy.

**Voice in three nouns:** `library · soundsystem · workshop`. **Three verbs:** `read · save · ship`.

### `brand-voice:discover-brand` — what's already on disk

The voice and visual system live in concrete files, not slide decks:

| Where the voice lives | File |
|---|---|
| Editorial voice for AI-written articles | `api/ai/article.js` (`SYSTEM` + `VOICE` constants) |
| Slogan-writer voice for Merch Lab | `api/ai/generate-slogans.js` (`SYSTEM` constant) |
| Style presets for Mark Lab generated logos | `api/ai/generate-mark.js` (`STYLE_PROMPTS`) |
| Curated quotes (the lineage we write within) | `data/afro-anarchist-quotes.json` |
| Reference catalog (the canon we cite from) | `data/afro-books.json` |
| Token-driven design system | `docs/DESIGN-SYSTEM.md` (in this folder) |

### `brand-voice:brand-voice-enforcement` — automated checks

Every time AI generates an article or slogan, the prompt prepends the latest editor-rejection notes from `content/feedback/<kind>.json`. So a slogan that gets rejected for being "too generic" twice never produces another like it. The reject-loop **is** the enforcement.

---

# 2. Marketing (`marketing:*`)

### `marketing:campaign-plan` — current quarterly campaign

**Q3 2026: "Sankofa is a Strategy."** Four-week rolling campaign keyed off Sankara assassination anniversary (Oct 15) + African Liberation Day (May 25).

| Week | Channel | Anchor content |
|---|---|---|
| 1 | newsletter + public site | Walter Rodney revisited, anchored on `data/afro-books.json#b-rodney-how-europe` |
| 2 | merch drop | Sankara "We must dare to invent the future." tee — the Merch Lab pushes Tuesday at 17:00 UTC |
| 3 | reading circle | Hosted livestream + .ics download from any event card |
| 4 | newsletter recap + community | Round-up + member-submitted events |

### `marketing:content-creation` — the daily pipeline

Two crons + one human:

```
06:00 UTC   /api/cron/scan-content       (12 sources scraped)
09:00 UTC   /api/cron/generate-articles  (top trend → editor draft)
weekly      /api/cron/generate-slogans   (8 slogans → Merch Lab queue)
every 6h    /api/cron/generate-logos     (4 marks → Mark Lab queue)
```

**Publisher's daily 15 minutes**: `Pending → review → approve / edit / reject with reason`. The reject-reason is the training signal.

### `marketing:email-sequence` — onboarding drip

Six emails over three weeks for new mailing-list subscribers. Each writes only when something real ships:

1. **Day 0** — confirmation. Single sentence. "You're on the list. Tap any ♥ on the public site to start a wishlist."
2. **Day 3** — one piece of content (whichever's most-wishlisted that week).
3. **Day 7** — one event (next live session or .ics file).
4. **Day 14** — one merch drop with full story behind the quote.
5. **Day 21** — invite to submit (event, draft, or local ambassador application).
6. **Day 30** — handoff to the regular weekly digest.

Templates live in `api/mailing/templates/` (to be added when an email API key lands).

### `marketing:seo-audit` — current posture

Title pattern: `{item.title} — ANARCHISM.AFRICA`. Description = item summary or first 160 chars of body. og:image = item image; falls back to `/icons/icon-512.svg`. Twitter `summary_large_image` everywhere. Each `item.html?type=X&id=Y` is its own indexable page. The Mindmap and AfroWiki layers (when shipped) become structured-data goldmines.

**To-do:** sitemap.xml generated from blob overlays + `robots.txt` allowing everything but `/api/`.

### `marketing:competitive-brief` — landscape

| Project | Strength | Where AA sits |
|---|---|---|
| Africa Is a Country | editorial depth | we cite, we don't compete; cross-link |
| Chimurenga | archival + book-art | we link; eventual collaboration |
| AfroPunk Festival | events + merch IRL | we list events; offer crowd-sourced submissions |
| The Continent (newsletter) | weekly long-form | different cadence; we run daily |
| OkayAfrica | mainstream music/film | we frame in liberation context, not lifestyle |

**Differentiator**: the autopilot + the cross-reference mindmap + open POD merch funnel. Nobody else does all three.

### `marketing:performance-report` — what to read weekly

Three numbers from `/api/system/metrics`:

1. **Approval rate (30d)** — target 30–70%. Too high → publisher rubber-stamping; too low → sources misaligned.
2. **Mark approval rate (30d)** — target 5–15%.
3. **Mailing list growth** — target 5–50/week.

Anything else is editorial polish.

### `marketing:brand-review` — content gate

Before any AI output ships:

- Voice ≠ corporate? (`stay woke`, `good vibes`, `Africa rising` → reject)
- Names a person? (verify the quote — never invent attributions)
- Cites a source? (verify the source exists)
- Visible `[verify]` markers? (resolve before publish)

The Article Lab pipeline emits `[verify]` markers automatically; the editor resolves them.

---

# 3. Legal & commitments (`legal:*`)

### `legal:legal-risk-assessment` — current posture

| Severity | Likelihood | Mitigation |
|---|---|---|
| 🟢 Quote attribution wrong | Medium | Curated dataset only; cron pulls from feedback log; editor verifies before publish |
| 🟢 Portrait copyright | Low | Public domain or CC; PNG-based for living people only with their license |
| 🟡 Defamation in AI output | Low–Medium | `[verify]` markers; system prompt forbids quoting real people verbatim |
| 🟡 GDPR (EU consumer signups) | Medium | Mailing-list double-opt-in needed before EU launch; Google sign-in handles the rest |
| 🔴 POD product copyright | Medium | Only AA-original quotes from `data/afro-anarchist-quotes.json`; no third-party logos on tees |
| 🟢 State surveillance interest in radical content | Low for hosting; Higher for organisers | Tor-aware, no IP logging, sign-up optional, contributor anonymity respected |

### `legal:triage-nda` — NDA policy

**Default position: we don't sign NDAs unless a real reason exists.** Open-source ethic + hostile-state risk. When asked:

- 🟢 **GREEN** (auto-sign via standard reciprocal NDA): vendor onboarding for hosting, payment, POD where the secrecy is bilateral and time-bound (≤ 18 months).
- 🟡 **YELLOW** (LUVLAB review): partner content collaboration with embargoed details; needs a carve-out for editorial independence.
- 🔴 **RED** (refuse): broad confidentiality covering "all communications" or any clause restricting future advocacy or speech.

### `legal:review-contract` — vendor agreements

Every vendor agreement must:

1. Allow account export at any time (no data lock-in).
2. Refuse arbitration clauses; jurisdiction in seat city or by mutual choice.
3. Cap liability ≤ 12 months of fees paid.
4. Permit cancellation with 30 days' notice.
5. **Allow the autopilot to run uninterrupted by acquisition events** (no kill-switches in M&A clauses).

### `legal:vendor-check` (alliance check) — current connections

| Vendor | Used for | Aligned? | Notes |
|---|---|---|---|
| Vercel | hosting + Blob | ⚠️ Mixed | Free tier is generous; consider self-host alternative when scale demands |
| OpenRouter | LLM gateway | ✅ Independent, transparent pricing |
| Google (Gemini, OAuth) | image gen + sign-in | ⚠️ Surveillance capital | Acceptable for non-sensitive flows; sign-in is opt-in |
| Printify / Printful | POD merch | ⚠️ Standard | Push for Stanley/Stella + Teemill (B-Corp / Climate-Neutral) where blueprints exist |
| Wikimedia Commons | portrait images | ✅ | Free, attributable |

### `legal:compliance-check` — pre-launch checklist

Before any new feature touching consumer data:

- [ ] Data minimisation — collect only what's necessary
- [ ] Cookie banner unless we strictly only use first-party + functional cookies (we currently do — banner not required)
- [ ] Privacy policy at `/privacy` covering Blob storage + Gemini text relay + Google sign-in
- [ ] DPA in place with each subprocessor (Vercel ✓, OpenRouter ✓, Google ✓)
- [ ] Right-to-delete: `/api/auth/delete` removes the user's blob entries on request

### `legal:legal-response` — common requests

| Request | Default response |
|---|---|
| Subpoena / law-enforcement data request | Acknowledge receipt; require court order; LUVLAB notifies user where legally allowed; transparency report quarterly. |
| DMCA / copyright takedown | Pull immediately while reviewing; restore if claim invalid within 14 days; counter-notice template ready. |
| Right-to-be-forgotten (GDPR Art. 17) | Process within 30 days; remove from blob + mailing list + scraper feedback log. |
| Press inquiry | LUVLAB only. Reply within 5 working days. |

### `legal:vendor-check` + `legal:signature-request` — process

Lives in `api/legal/` (TBD): GET `/api/legal/agreements/<id>` returns the agreement PDF; POST sends a HelloSign / DocuSign envelope (when keys present).

### `legal:meeting-briefing` + `legal:brief` — usage

Each board / partner / strategic meeting opens with a one-page briefing generated from `/api/ai/article` with `step:'outline'` constrained to the meeting topic + the latest relevant entries from the AA library. Output stored at `content/briefings/<date>.json`.

---

# 4. Design (`design:*`)

Existing on disk: `docs/DESIGN-SYSTEM.md`, `docs/DESIGN-CRITIQUE.md`, `docs/ACCESSIBILITY-AUDIT.md` (some lost in earlier sync gap; ENGINEERING-AUDIT.md is the canonical merge).

### `design:user-research` + `design:research-synthesis` — current cohorts

The platform has three user types worth interviewing:

1. **Reader-only** (consumer who saves to wishlist, never submits) — what brings them back?
2. **Reader-organiser** (consumer who also submits events / pledges) — what activates the second action?
3. **Editorial team** (publisher + editor + journalist) — where does the autopilot drift from house voice?

A short interview guide for each lives in `docs/RESEARCH-PLANS.md` (TBD next pass).

### `design:design-handoff` — current spec

The token system in `docs/DESIGN-SYSTEM.md` IS the handoff. Every component reads from CSS variables; the user-settings panel can override any of them at runtime.

### `design:ux-copy` — voice rules cross-link

See **§1 Brand voice** above. Concrete copy review for the existing surfaces lives in the previous-session `docs/DESIGN-CRITIQUE.md` (sync-gap victim; rebuild on next pass).

### `design:accessibility-review` — quick scorecard

| WCAG criterion | Status |
|---|---|
| 1.4.3 contrast | ✅ across BLACKOUT + WHITEOUT presets |
| 2.1.1 keyboard nav | 🟡 mindmap canvas missing keyboard fallback |
| 2.4.7 focus visible | ✅ via `css/responsive-fixes.css` `:focus-visible` outline |
| 2.5.5 touch targets | ✅ 44 × 44 enforced |
| 4.1.2 ARIA name/role | 🟡 some `.tab` divs should be `<button>` |
| `prefers-reduced-motion` | ✅ honored |

Open items go to TD-013 in `docs/ENGINEERING-AUDIT.md`.

### `design:design-system` — see file

`docs/DESIGN-SYSTEM.md` (sync-gap victim; ENGINEERING-AUDIT.md §2 is the live summary).

### `design:design-critique` — current biggest issues

1. Cards 220 px wide → too dense at 360 px viewport. Force single-column < 420 px (already in `responsive-fixes.css`).
2. Hero auto-rotates without pause control on mobile — fix pending.
3. Mark Lab card actions stack three-deep — drop "Copy" on < 480 px (already in CSS).

---

# 5. Product (`product-management:*`)

### `product-management:roadmap-update` — Now / Next / Later

**Now (this sprint):**
- Move BETA pill + sign-in into the rail menu (this turn)
- Multi-POD secrets store + LUVLAB admin keys panel
- Item.html replacing modals for all card clicks (shipped)
- Slogan generator cron live (shipped)
- Push and verify production parity

**Next (4 weeks):**
- AfroWiki entity pages (people, places, movements) auto-generated from approved content
- Search across all content + books with AI-assisted ranking ("afro-anarchist Google" v1)
- Real-time event ticker on the home tab via Vercel SSE
- Editor-side draft inbox (auto-articles waiting for editor sign-off)
- POD: Printful + Gelato + Teemill providers behind the unified dispatcher

**Later (next quarter):**
- Radio (audio player + scheduled streams)
- TV (curated video grid with embedded `embed`)
- Gallery (artist portfolios with merch tie-in)
- Funding scanner (the "afro-anarchist Google for grants")
- Native iOS/Android via Capacitor

### `product-management:write-spec` — template

Every new feature spec uses this skeleton (lives at `docs/templates/SPEC-template.md`):

```
# Spec: <one-line>

## Why now
<3 sentences max>

## Won't do (non-goals)
<list>

## Will do (goals)
<list with acceptance criteria>

## Dependencies / risks
<list>

## Success metric (numerical, weekly)
<one number>

## Trade-offs we accepted
<list>
```

### `product-management:sprint-planning` — current

2-week sprint cadence. Capacity: 1 admin (LUVLAB) + 1 publisher (COOLHUNTPARIS) ≈ 12 hours/week of focused work. P0 = autopilot health; P1 = next user-facing feature; P2 = polish.

### `product-management:metrics-review` — see Marketing §2.

### `product-management:brainstorm` — ongoing

Rough log lives at `docs/IDEAS.md` (TBD). Items include: zine generator, sound-archive uploader, federated comment threads, anti-censorship Tor-onion mirror, soundsystem locator map.

### `product-management:stakeholder-update` — cadence

Monthly to LUVLAB + COOLHUNTPARIS. Format = standup template from `docs/RUNBOOKS.md` § 3, scaled to a month. Public quarterly transparency post on the home tab.

### `product-management:synthesize-research` — when

Quarterly. Pull from: signed-up role distribution (consumer/event/agency mix), wishlist heat map, reject-reason histogram, ambassador applications. Output → next quarter's roadmap.

---

# 6. Engineering (`engineering:*`)

**Canonical doc on disk: `docs/ENGINEERING-AUDIT.md`.** It already covers `architecture`, `code-review`, `debug`, `deploy-checklist`, `documentation`, `incident-response`, `standup`, `system-design`, `tech-debt` in one consolidated artefact.

### `engineering:testing-strategy` — current truth

Zero tests as of this writing. **Test triangle ahead** (in priority order):

1. **JSON schema tests** for `data/seed.json`, `data/afro-anarchist-quotes.json`, `data/afro-books.json`, `data/african-languages.json`. CI lint on push.
2. **Cron parser tests** for `api/cron/scan-content.js` against fixture RSS feeds — the parser is regex-based and fragile; needs >12 source-shape fixtures.
3. **Data-layer overlay tests** — `AA.loadSeed` overlay logic; the most central code; should be tested.
4. **Smoke E2E** for: card click → item.html renders, intro popup → theme picker → applies, BETA pill open.

Stack pick: **Vitest + Playwright** when we add tests. CI: GitHub Actions on push. Estimate: ~1 day to set up + 2 days to write tier 1+2.

---

# 7. Finance (`finance:*`)

The corporate playbook doesn't quite map. Translation:

| Corporate | AA equivalent |
|---|---|
| `financial-statements` | quarterly transparency post: income / spend / member count |
| `variance-analysis` | "what did we spend on AI calls vs. budgeted?" |
| `reconciliation` | match POD platform reports against our DB |
| `journal-entry` | append-only ledger in blob `content/ledger.json` |
| `audit-support` | open-books log of every transaction, public |
| `sox-testing` | not applicable; we're not publicly traded |
| `close-management` | weekly: book the week's POD orders + AI spend |

### Current sustainability budget (annualised)

| Line | Annual estimate |
|---|---|
| Vercel Pro (when we outgrow Hobby) | $240 |
| OpenRouter spend (text gen) | $0–$60 (mostly free tier) |
| Gemini image-gen API | $0–$100 |
| Domain + DNS | $20 |
| Email (Resend / Listmonk) | $0–$20 |
| Backup hosting (S3-compatible) | $30 |
| **Total operating** | **~$300–$500/year** |
| Plus per-merch fulfillment | pass-through to buyer |

The platform is built to operate at $0 in the first year (free tiers + manual approvals) and scales linearly with merch revenue.

### Public ledger pattern

Every spend ≥ €5 lands in `content/ledger.json` with `{date, amount, currency, vendor, why, approved_by}`. The `/about/finances` page renders it as a public table. Members can pledge through `/api/pledges` to specific line items.

---

# 8. Data (`data:*`)

**Canonical doc on disk: `docs/DATA-ANALYTICS.md`** (sync-gap victim from earlier; rebuild via the same content from §1 of this file when needed).

### Current data sources (all live)

- `data/seed.json` — bundled fixture, cold-start only
- `content/<kind>.json` (Blob) — per-kind overlays from publisher approvals
- `content/pending.json` — scraper review queue
- `content/marks/queue.json` — auto-logo stream
- `content/merch/slogans.json` — auto-slogan stream
- `content/feedback/<kind>.json` — RLHF reject log (also drives prompts)
- `mailing_list.json` — newsletter signups

### `data:analyze` + `data:explore-data` — three queries to run weekly

```bash
# 1. Pending count by kind
curl -s https://anarchism.africa/api/content/queue \
  | jq '.items | group_by(.kind) | map({kind:.[0].kind, n:length})'

# 2. Approval rate, last 30 days
curl -s https://anarchism.africa/api/system/metrics | jq '.funnel'

# 3. Top reject reasons (marks)
curl -s https://anarchism.africa/api/system/metrics | jq '.marks.top_reject_reasons'
```

### `data:build-dashboard` — see existing module

`js/admin-dashboard.js` (sync-gap victim; rebuild on next pass) renders the metrics in admin Studio with sparkline-style bars.

### `data:create-viz` — what we have without a chart library

Pure SVG / CSS bar charts in the system-check + admin-dashboard modules. No external charting JS — keeps page weight under 50 KB total.

### `data:sql-queries` — N/A

No SQL. Blob is keyed-blob storage. All "queries" are full-list scans on the client or in functions, JSON-shape. Acceptable while items < 10 K per kind.

### `data:validate-data` — checks

Listed in `docs/ENGINEERING-AUDIT.md` § 5 (deploy checklist). Pre-deploy gate.

### `data:statistical-analysis` — applied

The reject-feedback loop is the platform's only ML signal. Conceptually:
- Each reject is a labeled negative example.
- Each approve is a labeled positive example.
- The prompt prepends the latest 10 negatives.
- Convergence = rejection rate trending down over weeks.

If rejection rate is flat after 4 weeks, the prompts aren't reading the feedback (bug) or the editorial bar moved (recalibrate).

---

# 9. Operations (`operations:*`)

**Canonical doc on disk: `OPS.md`** at repo root + `docs/RUNBOOKS.md` (sync-gap victim; rebuild on next pass).

### `operations:process-doc` — daily flow

```
06:00 UTC   scraper writes pending queue
09:00 UTC   article cron writes editor-review draft
            publisher's 15-min triage → approves / edits / rejects
14:00 UTC   editor reviews any auto-articles + journalist drafts
            new content visible on public site within minutes via blob overlay
17:00 UTC   merch lab pushes the day's drop (if any)
every 6h    logo cron generates 4 marks → publisher reviews next morning
weekly Mon  newsletter goes out
```

### `operations:runbook` — see RUNBOOKS.md

Includes IR-1 through IR-7 covering: site down, cron stuck, mark gen blanks, article gibberish, sign-in fails, Printify 422, local disk full.

### `operations:status-report` — weekly format

```markdown
# Status — week of <date>
## Numbers
- approvals: N (rate X%)
- new articles published: N (auto / hand-written)
- merch drops: N
- newsletter subs: +N (total N)
## Wins
- <bullet>
## Risks (G/Y/R)
- <bullet>
## Decisions needed
- <bullet>
```

### `operations:risk-assessment` — top 5 right now

| # | Risk | Severity × Likelihood | Mitigation |
|---|---|---|---|
| 1 | Cron eating AI credits if `CRON_SECRET` rotated incorrectly | High × Low | Set + verify; alert on 401 spike |
| 2 | Bad scraper item slips past publisher review | Med × Med | Reject-feedback loop catches patterns over time |
| 3 | POD provider API change breaks merch push | Med × Med | Multi-provider dispatcher + monitoring |
| 4 | State subpoena targeting community member data | Med × Low | Data minimization + transparency report |
| 5 | Vercel Hobby cron quota cap hit | Low × Med | Move to Pro at $20/mo when the day comes |

### `operations:vendor-review` — see Legal §3.

### `operations:change-request` — what counts

Any change that touches: `vercel.json`, `data/*.json` schema, env vars, cron schedule, public-facing URL routes. Other changes ship freely.

### `operations:capacity-plan` — current

LUVLAB ≈ 2 hours/week + COOLHUNTPARIS ≈ 6 hours/week + 0–N volunteer journalists. The autopilot replaces ≈ 80% of the publish-pipeline grunt-work, so the team stays under 10 hours/week unless an event week (Sankara week, ALD, tour) doubles output briefly.

### `operations:compliance-tracking` — see Legal §3 (`compliance-check`).

---

# 10. Plugin → artefact index

| Plugin | Where it lives in this project |
|---|---|
| `legal:brief` | this file §3 + `api/ai/article` step:`outline` for meeting briefings |
| `legal:compliance-check` | this file §3 |
| `legal:legal-risk-assessment` | this file §3 |
| `legal:legal-response` | this file §3 |
| `legal:meeting-briefing` | this file §3 |
| `legal:review-contract` | this file §3 |
| `legal:signature-request` | placeholder; `api/legal/` (TBD) |
| `legal:triage-nda` | this file §3 |
| `legal:vendor-check` | this file §3 |
| `marketing:campaign-plan` | this file §2 |
| `marketing:competitive-brief` | this file §2 |
| `marketing:content-creation` | `api/cron/{scan-content,generate-articles}.js` + this file §2 |
| `marketing:email-sequence` | this file §2; templates pending in `api/mailing/templates/` |
| `marketing:performance-report` | `api/system/metrics.js` + `js/admin-dashboard.js` + this file §2 |
| `marketing:seo-audit` | this file §2 |
| `marketing:brand-review` | this file §2 |
| `design:accessibility-review` | this file §4 + `docs/ACCESSIBILITY-AUDIT.md` |
| `design:design-critique` | this file §4 |
| `design:design-handoff` | this file §4 + `docs/DESIGN-SYSTEM.md` |
| `design:design-system` | `docs/DESIGN-SYSTEM.md` |
| `design:research-synthesis` | this file §4 |
| `design:user-research` | this file §4 |
| `design:ux-copy` | this file §1 + §4 |
| `product-management:brainstorm` | `docs/IDEAS.md` (TBD) |
| `product-management:metrics-review` | `api/system/metrics.js` |
| `product-management:roadmap-update` | this file §5 |
| `product-management:sprint-planning` | this file §5 |
| `product-management:stakeholder-update` | this file §5 |
| `product-management:synthesize-research` | this file §5 |
| `product-management:write-spec` | `docs/templates/SPEC-template.md` (template in this file §5) |
| `engineering:architecture` | `docs/ENGINEERING-AUDIT.md` § 1 |
| `engineering:code-review` | `docs/ENGINEERING-AUDIT.md` § 3 |
| `engineering:debug` | `docs/ENGINEERING-AUDIT.md` § 4 |
| `engineering:deploy-checklist` | `docs/ENGINEERING-AUDIT.md` § 5 |
| `engineering:documentation` | this file + `docs/ENGINEERING-AUDIT.md` § 8 |
| `engineering:incident-response` | `docs/ENGINEERING-AUDIT.md` § 6 |
| `engineering:standup` | `docs/ENGINEERING-AUDIT.md` § 7 |
| `engineering:system-design` | `docs/ENGINEERING-AUDIT.md` § 2 |
| `engineering:tech-debt` | `docs/ENGINEERING-AUDIT.md` § 9 |
| `engineering:testing-strategy` | this file §6 |
| `finance:audit-support` | this file §7 (open-books log) |
| `finance:close-management` | this file §7 |
| `finance:financial-statements` | this file §7 (quarterly transparency post) |
| `finance:journal-entry` | this file §7 (append-only ledger) |
| `finance:reconciliation` | this file §7 |
| `finance:sox-testing` | n/a |
| `finance:variance-analysis` | this file §7 |
| `data:analyze` | this file §8 + `api/system/metrics.js` |
| `data:build-dashboard` | `js/admin-dashboard.js` (rebuild after sync gap) |
| `data:create-viz` | this file §8 (pure SVG/CSS bar charts) |
| `data:explore-data` | this file §8 (CLI recipes) |
| `data:sql-queries` | n/a (Blob storage) |
| `data:statistical-analysis` | this file §8 (RLHF feedback loop) |
| `data:validate-data` | `docs/ENGINEERING-AUDIT.md` § 5 |
| `operations:capacity-plan` | this file §9 |
| `operations:change-request` | this file §9 |
| `operations:compliance-tracking` | this file §3 + §9 |
| `operations:process-doc` | this file §9 |
| `operations:risk-assessment` | this file §9 |
| `operations:runbook` | `OPS.md` + `docs/RUNBOOKS.md` (rebuild) |
| `operations:status-report` | this file §9 |
| `operations:vendor-review` | this file §3 + §9 |
| `brand-voice:brand-voice-enforcement` | this file §1 + reject-feedback loop |
| `brand-voice:discover-brand` | this file §1 |
| `brand-voice:guideline-generation` | this file §1 |

---

**End of playbooks.** When something on this list moves from idea to running code, that section gets a one-line "shipped: see `<file>`" link instead of a placeholder.
