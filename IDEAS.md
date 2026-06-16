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
