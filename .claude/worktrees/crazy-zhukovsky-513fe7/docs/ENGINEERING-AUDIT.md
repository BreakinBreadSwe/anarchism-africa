# Engineering Audit — ANARCHISM.AFRICA

**Date:** 2026-05-01 (last refresh: 2026-05-05 — see Appendix A). **Scope:** all subsystems. **Reviewer:** internal pre-deploy audit.

Consolidates the eight engineering perspectives (architecture, code-review,
debug, deploy-checklist, documentation, incident-response, standup,
system-design, tech-debt) into a single readable artefact.

> **Major change since first publication:** ADR-001 was *superseded* by the
> Blob → Supabase Postgres migration on 2026-05-04 (commit `dfbb732`). The
> live-datastore claim in §1 is no longer accurate. See ADR-006 and the
> findings in Appendix A.

---

## §1 ARCHITECTURE — at a glance

Static-first + serverless on Vercel. Live state in **Supabase Postgres**
(see ADR-006). Bundled `data/seed.json` is a cold-start fixture. Every
"live" capability is a serverless function; nothing runs as a long-lived
backend.

**Six accepted ADRs:**

| ADR | Decision | Why |
|---|---|---|
| 001 | ~~Vercel Blob as live datastore~~ — superseded by ADR-006 | (See ADR-006) |
| 002 | OpenRouter as default LLM gateway with Gemini fallback | Free-tier covers chat + Article Lab; auto-fallback ships zero-downtime when OpenRouter rate-limits (commit `aa30a89`) |
| 003 | Multi-provider image gen with rotation | Visual diversity; degrade gracefully when a key is missing |
| 004 | PIN auth for roles, Google OAuth for consumers | Demo-grade for ~10 internal users + real auth for public |
| 005 | RLHF-lite via prompt steering | Reject-reasons feed back as "avoid these" in next prompts; no fine-tuning |
| 006 | Supabase Postgres as live datastore (replaces Blob) | Need for relational queries (link health views, content_queue → content promotion, autopilot_log indexing), proper schema migrations, RLS, and a unified content table across kinds. Free tier still sufficient for MVP. Blob endpoints kept as legacy read-only paths during cutover. |

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

---

## Appendix A — Post-Supabase-migration audit (2026-05-05)

A focused re-audit after commits `dfbb732` (Supabase migration), `bb58726`
(link verifier), `aa30a89` (OpenRouter→Gemini fallback), and `a511fee`
(playable-songs filter). Findings new to this pass — items already in §3 or
§9 are not repeated.

**🔴 Critical, fixed in this pass:**

- **A1. Open-by-default cron auth** — `api/cron/verify-links.js` returned
  `true` from `authed()` when neither `ADMIN_TOKEN` nor `CRON_SECRET` was
  configured. Fixed to fail closed; Vercel's own `x-vercel-cron-signature`
  is still accepted so platform-managed schedules work.
- **A2. SSRF in link verifier** — `verifyUrl()` accepted any
  `^https?:` URL pulled from the DB and fetched it. A malicious admin or
  poisoned scrape could store `http://169.254.169.254/...` (AWS IMDS) or
  `http://localhost:3000`. Fixed via the new `lib/url-safety.js`
  (`isSafeToFetch`) — checked both before the fetch and on the post-redirect
  URL.
- **A3. Stored-XSS via `external_url`** — `api/content/save.js` accepted any
  string in `external_url` / `source_url` / `audio` etc. and `item.html`
  renders them as `href`. Fixed: `dropUnsafeUrls()` strips non-http(s)
  before insert. Mirrored guard in `api/content/queue.js` enqueue path
  rejects `javascript:`/`data:` payloads up front (HTTP 400).
- **A4. Empty Gemini responses masquerading as success** — the safety
  filter returns 200 OK with `finishReason=SAFETY` and empty parts. The
  fallback chain in `api/ai/chat.js` accepted the empty string as success
  and never advanced. Fixed: `gemini()` now throws when no text is
  returned, so the chain advances to the next provider.

**🟡 Important, mitigated:**

- **A5. Verifier function-timeout risk** — sequential 6 s HEADs over up to
  1000 rows would blow Vercel Hobby's 60 s function limit. Mitigated by
  reducing default `limit` to 120 (cap 250) and parallelising 8-at-a-time.
  For true durability the next step is Vercel Workflow (paginated, retry-
  safe, durable) — flagged but not taken without a product call.
- **A6. Redirect-rewrite loop** — A→B→A redirect chains would oscillate
  the stored `external_url` every cron run. Added a per-row guard
  (`link_final_url` history check + per-invocation `seen` set) so we only
  rewrite when the canonical is stably new.

**🟢 Open / next:**

- **A7. AI Gateway / Workflow migration** — the validation hooks in this
  repo recommend routing all model calls through Vercel AI Gateway and
  long-running crons through Vercel Workflow. Both are good ideas but
  substantial: Gateway changes the auth model and cost surface, Workflow
  changes the cron deployment shape. Defer to an explicit decision point.
- **A8. Orphaned Blob endpoints** — `api/blob/{get,put,put-image,seed}.js`
  still exist and read from Vercel Blob. They aren't on the read path
  anymore (the front-end goes through `/api/content/list` per ADR-006) but
  they remain reachable. Plan: deprecate with HTTP 410 + a redirect note,
  or delete in the next sprint if no fallback path still depends on them.
- **A9. KV table for marks/slogans** — `api/system/health.js` still reads
  marks and slogans from the `kv` table (`content/marks/queue`,
  `content/merch/slogans`). They should migrate to dedicated `marks` and
  `slogans` tables for indexing + foreign-key integrity. Low-impact debt;
  defer until the second wave of generation features ships.
- **A10. ADR-001 stale references** — README, CLAUDE.md, OPS.md and
  `docs/ARCHITECTURE.md` (if present) likely still reference Vercel Blob
  as the live datastore. Sweep for "Vercel Blob" / "@vercel/blob" mentions
  and refresh.
- **A11. `package.json` still depends on `@vercel/blob`** — once the
  legacy endpoints in A8 are removed, drop the dep too.
- **A12. Test seeds for `lib/url-safety.js`** — pure function, easy to
  unit-test, high-leverage (it gates every URL on the platform). Highest-
  ROI test target.

**One-day plan (post-migration):**

1. A8 — deprecate Blob endpoints (1 h)
2. A10/A11 — sweep stale Blob references + drop dep (1 h)
3. A12 — unit tests for `lib/url-safety.js` (1 h)
4. A9 — marks/slogans → dedicated tables (3 h)
5. A7 — write up the AI Gateway / Workflow decision as ADR-007 + ADR-008
   for review (1 h, no code)

Total: 7 hours. Project goes from "post-migration with rough edges" to
"clean migration with documented next architectural decisions."
