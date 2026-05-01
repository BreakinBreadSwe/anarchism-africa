# Engineering Audit — ANARCHISM.AFRICA

**Date:** 2026-05-01. **Scope:** all subsystems. **Reviewer:** internal pre-deploy audit.

Consolidates the eight engineering perspectives (architecture, code-review,
debug, deploy-checklist, documentation, incident-response, standup,
system-design, tech-debt) into a single readable artefact.

---

## §1 ARCHITECTURE — at a glance

Static-first + serverless on Vercel. Live state in Vercel Blob. Bundled
`data/seed.json` is a cold-start fixture. Every "live" capability is a
serverless function; nothing runs as a long-lived backend.

**Five accepted ADRs:**

| ADR | Decision | Why |
|---|---|---|
| 001 | Vercel Blob as live datastore | Lowest ops, free tier covers MVP, single vendor already |
| 002 | OpenRouter as default LLM gateway | Free-tier covers chat + Article Lab; one key, many models |
| 003 | Multi-provider image gen with rotation | Visual diversity; degrade gracefully when a key is missing |
| 004 | PIN auth for roles, Google OAuth for consumers | Demo-grade for ~10 internal users + real auth for public |
| 005 | RLHF-lite via prompt steering | Reject-reasons feed back as "avoid these" in next prompts; no fine-tuning |

**Open architectural questions:** full-text search, AfroWiki layer, radio /
TV / gallery views, real-time updates, funding scanner.

---

## §2 SYSTEM-DESIGN — components

| Tier | Module | Files |
|---|---|---|
| Client | Public site | `index.html` + `js/app.js` |
| Client | Item detail | `item.html` + `js/item-page.js` |
| Client | Role pages | `admin.html`, `publisher.html`, `editor.html`, `journalist.html`, `market.html`, `partner.html`, `anarchist.html` + `js/role-shared.js` |
| Client | Labs | `js/article-lab.js`, `js/mark-lab.js`, `js/merch-lab.js` |
| Client | Cross-cutting | `js/intro-popup.js`, `js/wishlist.js`, `js/feedback.js`, `js/role-switcher.js`, `js/system-check.js`, `js/admin-dashboard.js`, `js/mindmap.js` |
| Server | AI | `api/ai/chat.js`, `api/ai/article.js`, `api/ai/generate-mark.js` |
| Server | Storage | `api/blob/get.js`, `api/blob/put.js`, `api/blob/put-image.js`, `api/blob/seed.js` |
| Server | Pipelines | `api/cron/scan-content.js`, `api/cron/generate-logos.js` |
| Server | Editorial | `api/content/queue.js`, `api/feedback/log.js` |
| Server | Public | `api/events/submit.js`, `api/auth/google.js` |
| Server | Merch | `api/merch/generate-shirt.js`, `api/pod/printify.js` |
| Server | Ops | `api/system/health.js`, `api/system/metrics.js`, `api/graph/build.js` |

---

## §3 CODE-REVIEW — top findings

**🔴 Critical (block deploy):**

1. **No rate limiting on public endpoints.** `events/submit`, `feedback/log`,
   `ai/article`, `auth/google` accept unlimited POSTs from any IP. Add
   `@upstash/ratelimit` per-IP: 30/min on submit, 5/min on AI.
2. **`CRON_SECRET` is optional.** Cron triggers can be hit by anyone, burning
   AI credits. Make it required server-side.
3. **`item-page.js` doesn't validate `external_url` scheme.** A scraper can
   inject `javascript:` URLs. Whitelist `http(s):` only.
4. **`feedback/log` trusts `body.dataset.role` from the client.** Need real
   auth check before accepting writes.

**🟡 Major (this sprint):**

- `loadSeed()` re-fetches 7 blob keys on every call; cache for 30 s.
- `generate-mark` provider failures are silent in the UI; surface them.
- `merch/generate-shirt` reads `data/seed.json` via `fs` directly, bypassing
  the live overlay — newly approved quotes won't show. Migrate to fetch.
- RSS parser is regex-based and brittle on malformed feeds (per-source
  try/catch + record errors in the cron summary).
- `3d-force-graph` CDN load is unpinned-by-hash (no SRI).
- Auth session cookie is base64+HMAC, not encrypted — profile readable to
  anyone with the cookie. Switch to AES-256-GCM.
- Article Lab "publish" writes without optimistic-concurrency; two
  concurrent approvals race and one wins silently.
- **Zero tests** — start with the data-layer overlay and the cron parser.

**🟢 Minor (track):** inconsistent error envelopes, MutationObserver scope,
inline styles, magic numbers in Merch Lab (`blueprintId: 5`, `price: 2900`),
Wikimedia portrait URL fragility, hard-coded UTC cron schedules, no CI lint.

**Tech-debt register kept in the same review doc as TD-001 through TD-017.**

---

## §4 DEBUG — known recurring issues

| Symptom | Cause | Fix |
|---|---|---|
| Public site reads stale content for 24 h | SW caches `/data/seed.json` aggressively | Network-first for that path |
| Mark Lab generates blanks | One provider's key missing/invalid | UI now surfaces per-provider errors via `items[].error` (after MJ-2 fix) |
| Cron `stuck` for > 24 h | A source feed returns malformed XML, parser throws | Per-source try/catch (MJ-4); comment out the bad source |
| Sign-in returns "audience mismatch" | `js/config.js` `googleClientId` ≠ Vercel env `GOOGLE_CLIENT_ID` | Sync both, redeploy |
| Printify push 422 "blueprint not found" | Blueprint ID rotated upstream | Browse `?op=blueprints`, update default in `js/merch-lab.js` |
| Local terminal: "permission denied" on `.git/` | Cowork mount permissions | Run from native macOS terminal, not the sandbox |

---

## §5 DEPLOY CHECKLIST — pre-push gates

Hard gates (must pass):

- [ ] `/api/system/health` returns `ok: true` on the latest preview deploy.
- [ ] Required env vars set: `BLOB_READ_WRITE_TOKEN`, `OPENROUTER_API_KEY`,
      `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `AUTH_SECRET`.
- [ ] All JSON parses: `node -e "require('./data/seed.json')"`,
      `require('./data/afro-anarchist-quotes.json')`,
      `require('./data/african-languages.json')`.
- [ ] No `console.error` on first paint of `/`, `/admin.html`,
      `/publisher.html`, `/item.html?type=article&id=a1`.
- [ ] Public site renders < 3 s on Slow 3G.

Database integrity:

- [ ] `/api/content/queue` returns `{items:[…]}`.
- [ ] At least one approved item from yesterday shows on the public site.
- [ ] No dup IDs across content kinds.

Editorial cleanliness:

- [ ] No pending items > 14 days old.
- [ ] No Article Lab drafts > 30 days old.
- [ ] At least one Merch Lab push live this week.

Rollback triggers (define BEFORE deploy):

- 5xx rate on any `/api/**` > 5% within 1 h → rollback.
- Sign-in returns "audience mismatch" → rollback.
- Cron triggers return 401 unexpectedly → rollback.

---

## §6 INCIDENT RESPONSE — on-call playbook

Severity scale:
- **SEV-1**: public site down OR sign-in broken OR money burning → page LUVLAB
- **SEV-2**: a Lab broken OR cron stuck > 24 h → Slack #ops, fix today
- **SEV-3**: cosmetic regression OR one feed dead → tech debt, this week

Triage:
1. Hit `/api/system/health` — read advisories
2. Vercel → Functions → filter `cron/` for cron issues
3. Vercel → Deployments → rollback if previous green deploy is recent
4. Status banner on public site if user-facing; Slack publisher otherwise

Specific runbooks live in `docs/RUNBOOKS.md` (IR-1 through IR-7) covering:
public site down, cron stuck, Mark Lab blanks, Article Lab gibberish, Google
sign-in failure, Printify push 422, local disk full.

Postmortem template (blameless): TL;DR, impact, timeline, root cause,
went-well/went-poorly, action items with owner+due+severity, lessons.

---

## §7 STANDUP — daily template

```
**Date:** YYYY-MM-DD
**Role:** admin | publisher | editor | journalist

### Yesterday
- Approved N items from pending queue
- Published N articles via Article Lab
- Pushed N products to Printify
- Generated + saved N marks

### Today
- <single most important thing>
- <stretch>

### Blockers
- <env var? cron? prompt drift? approval needed?>

### One observation
<something you noticed about reader behavior, content quality, or autopilot>
```

Quality cues worth flagging in standup:
- Same author / quote pushed multiple Merch Lab products → drop limit needed
- Mark style preset rejected > 80% → adjust `STYLE_PROMPTS`
- Scraper item approved + read + wishlisted within 24 h → tag the prompt

---

## §8 DOCUMENTATION — where things live

| Need | File |
|---|---|
| System overview + ADRs | `docs/ARCHITECTURE.md` |
| Code review + tech debt | `docs/CODE-REVIEW.md` |
| WCAG 2.1 AA audit | `docs/ACCESSIBILITY-AUDIT.md` |
| Pre-deploy + incident + standup | `docs/RUNBOOKS.md` |
| Design system tokens | `docs/DESIGN-SYSTEM.md` |
| Visual + UX-copy + responsive critique | `docs/DESIGN-CRITIQUE.md` |
| Data + analytics + queries | `docs/DATA-ANALYTICS.md` |
| **This file (consolidated audit)** | `docs/ENGINEERING-AUDIT.md` |
| Day-to-day playbook | `OPS.md` |
| Manual integration steps | `INTEGRATION-NOTES.md` |
| Required env vars | `OPS.md` § "Required Vercel env vars" |
| Cron schedule | `vercel.json` `crons` |
| Scraper sources | `api/cron/scan-content.js` `SOURCES` |
| Mark style presets | `api/ai/generate-mark.js` `STYLE_PROMPTS` |
| Editorial voice | `api/ai/article.js` `SYSTEM` + `VOICE` |
| Curated quotes | `data/afro-anarchist-quotes.json` |
| African languages | `data/african-languages.json` |

---

## §9 TECH-DEBT REGISTER

| ID | Item | Effort | Status |
|---|---|---|---|
| TD-001 | Replace PIN-based role auth with Auth.js / Supabase | 2 days | Deferred |
| TD-002 | Add per-IP rate limiting | 1 day | **Block deploy** |
| TD-003 | Add CSP + SRI headers in `vercel.json` | 2 hours | Open |
| TD-004 | Move all inline styles to external stylesheets | 1 day | Open |
| TD-005 | Pin all CDN scripts with SRI hashes | 2 hours | Open |
| TD-006 | Unit tests: data-layer + RSS parser | 1 day | Open |
| TD-007 | CI lint step (JSON validity + ESLint) | 3 hours | Open |
| TD-008 | Network-first SW caching for `data/seed.json` | 1 hour | Open |
| TD-009 | Encrypted session cookies (AES-256-GCM) | 3 hours | Open |
| TD-010 | Optimistic-concurrency on Blob writes | 4 hours | Open |
| TD-011 | Server-side SVG → PNG via `@resvg/resvg-js` | 3 hours | Open |
| TD-012 | Per-blueprint POD pricing | 2 hours | Open |
| TD-013 | Index-page cards link to `/item.html` | 30 min | Pending |
| TD-014 | Move all inline `<script>` boot code into modules | 4 hours | Open |
| TD-015 | Replace MutationObserver with delegated events | 2 hours | Open |
| TD-016 | Mirror Wikimedia portrait URLs to Blob | 1 hour | Open |
| TD-017 | Audit unused script tags | 1 hour | Open |

---

## §10 If I had one day of focused work

1. CR-2 (cron secret required) — 30 min, kills a class of cost-attack
2. CR-1 (rate limiting) — 2 h with `@upstash/ratelimit`
3. CR-3 (URL scheme whitelist) — 30 min defensive coding
4. CR-4 (feedback auth check) — 1 h
5. MJ-3 (merch generator → live overlay) — 1 h
6. MJ-7 (publish race protection) — 2 h

Total: 7 hours. Project goes from "demo" to "okay-to-ship-publicly."
