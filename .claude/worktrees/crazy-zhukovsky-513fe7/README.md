# ANARCHISM.AFRICA

**An afrofuturist 360° on afro-anarchism — Africa & diaspora.**
Stewarded by **LUVLAB**, curated by **COOLHUNTPARIS**.

A library + magazine + expo + giftshop + community, mobile-first, database-driven, model-agnostic AI, sustainable POD merch.

---

## What's in here

```
.
├── index.html          # Public site — single-page, tabbed
├── admin.html          # Studio backend — CMS, themes, AI, grants, ambassadors
├── css/styles.css      # Afrofuturist mobile-first system, all theme tokens are CSS vars
├── js/
│   ├── config.js       # Backend + AI provider config (overridable via Studio)
│   ├── api.js          # Data layer: local JSON / Supabase / Neon
│   ├── ai-chat.js      # Model-agnostic A.A.AI client (Gemini default)
│   ├── app.js          # Public SPA controller
│   └── admin.js        # Studio controller
├── data/seed.json      # Demo content seed
├── db/schema.sql       # Postgres schema (Supabase / Neon)
└── api/
    ├── ai/chat.js      # AI proxy — Gemini, Qwen, DeepSeek, Kimi, GLM, Yi, Claude, OpenAI
    ├── pod/order.js    # POD order proxy — Stanley/Stella, Teemill, Gelato Eco
    └── mailing/subscribe.js
```

---

## Run the demo locally

The simplest way:

```bash
cd ANARACHISM.AFRICA
npx serve .
# open http://localhost:3000
```

Or open `index.html` directly in a browser — everything works offline, reading `data/seed.json`. Note: `file://` may block fetch of seed.json in some browsers; `npx serve .` is the reliable path.

The Studio is at **/admin.html**.

---

## Roles

| Role | Who | Powers |
|---|---|---|
| `admin` | LUVLAB | Everything |
| `publisher` | COOLHUNTPARIS | All content (films, articles, events, music, books), promotions, grants, expo curation, ambassador approvals |
| `merch` | Staff | Merch SKUs, POD providers, inventory, fulfilment |
| `partner` | Collaborators | Read content, propose projects, post in community |
| `consumer` | Clients | Read all, post in community, subscribe, pledge, **apply to be ambassador** |
| `ambassador` | Approved consumers | Host local events, run reading circles, translate |

The role strip on the public site (Sign in button) flips between roles for the demo.

---

## Deploy — GitHub → Vercel (one click)

**Just double-click `deploy.command`** in Finder.

It does everything:
1. Creates the GitHub repo (`anarchism-africa`) and pushes
2. Links the project to Vercel
3. Pushes any AI / POD env vars present in your shell
4. Enables Vercel Blob storage
5. Deploys to production
6. Seeds Blob with the bundled content

Prereqs (Homebrew install line in parentheses):
- `gh` (`brew install gh`) — `gh auth login` once
- `vercel` (auto-installs via `npm i -g vercel` if missing) — `vercel login` once

After the first run, **Vercel's GitHub integration auto-deploys on every push** — so subsequent updates only need:

```bash
git push
```

To push your AI key the first time:

```bash
GEMINI_API_KEY=AIzaSy... bash deploy.command
```

### Storage: Vercel Blob (chosen) vs Supabase / Neon

This build defaults to **Vercel Blob** for content + mailing-list/community/pledge data — single dashboard, single bill, no separate database to manage. Schema-as-code lives in `db/schema.sql` if you ever migrate to Postgres later (Supabase / Neon connectors stay wired in `js/api.js`).

### Domain

Vercel → Settings → Domains → add `anarchism.africa`.

---

## AI — model-agnostic

A.A.AI is the on-site assistant. The browser never sees an API key — it talks to **`/api/ai/chat`**, which dispatches to the configured provider:

- **Gemini** (default) — `gemini-1.5-flash`, `gemini-1.5-pro`
- **Qwen** (Alibaba) — `qwen-turbo`, `qwen-max`, `qwen-3` (via DashScope OpenAI-compat endpoint)
- **DeepSeek** — `deepseek-chat`, `deepseek-coder`, `deepseek-v3`
- **Moonshot Kimi** — `moonshot-v1-8k`, `kimi-k2`
- **Zhipu GLM** — `glm-4`, `glm-4-air`
- **01.ai Yi** — `yi-large`, `yi-medium`
- **Claude** — `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-6`
- **OpenAI** — `gpt-4o`, `gpt-4o-mini`

To switch: open Studio → AI assistant → pick provider + model → Save. Or call `AA.setConfig({ ai: { provider: 'qwen', model: 'qwen-3' } })` from the console.

If no key is set, A.A.AI falls back to a local "library oracle" so the demo still responds.

---

## Sustainable POD merch

The giftshop only ships from certified eco providers. The connector list in `js/config.js`:

| Provider | Cert | Eco score |
|---|---|---|
| Teemill (Rapanui) | B-Corp · Climate-Neutral · Circular | 95 |
| Stanley/Stella (via Printful) | GOTS · Fair Wear | 92 |
| FairShare Print | GOTS · SA8000 | 88 |
| Ohh Deer (FSC paper goods) | FSC · Recycled | 85 |
| Gelato (Eco line) | Climate-Neutral · GRS | 80 |

Carbon estimates per item are tracked and displayed in the giftshop.

---

## Hero slideshow

The home-page hero is a unified, autoplaying stream of every content type — film clip, article cover, event poster, song with audio, book, merch object — pulled from the `content_items` table where `featured = true`. Tapping a slide opens the thing.

Configurable in Studio → Site & CSS, or via `AA_CONFIG.hero` (`autoplay`, `interval_ms`, `shuffle`).

---

## Site & CSS control from the back end

Studio → Site & CSS gives the admin two levers:

1. **Theme tokens** — every colour the design uses is a CSS variable (`--bg`, `--accent`, `--red`, …). Edit live, save to localStorage (and `site_settings` table in production).
2. **Free-form CSS overrides** — paste raw CSS, it's injected on the public site. For seasonal themes, expo takeovers, or partner skins.

---

## Roadmap (post-demo)

- Real Supabase auth + RLS policies for the 5 roles
- POD wiring (Printful, Teemill, Gelato)
- Stripe Connect for crowdfund pledges & merch
- Newsletter pipeline (Resend or Listmonk)
- Push notifications for ambassador events
- AI-powered grant scout (cron → /api/grants/scout → email curators)
- Translation layer (Twi, Yoruba, Swahili, Wolof, Lingala, Darija, French, Portuguese)
- Offline-first PWA + share targets

---

© 2026 — open archive · pan-african · anti-state · pro-people
