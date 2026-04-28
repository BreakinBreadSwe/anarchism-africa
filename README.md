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

## Deploy — GitHub → Vercel → Supabase

### 1. Push to GitHub

```bash
cd ANARACHISM.AFRICA
git init
git add .
git commit -m "ANARCHISM.AFRICA — first cut"
gh repo create anarchism-africa --public --source=. --remote=origin --push
# or use the GitHub UI to create the repo + push
```

### 2. Provision the database

**Option A — Supabase (recommended).**
1. Create a new project at supabase.com
2. SQL Editor → paste `db/schema.sql` → Run
3. Settings → API → copy `URL`, `anon key`, `service_role key`

**Option B — Neon.**
1. Create a project at neon.tech
2. SQL Editor → paste `db/schema.sql`
3. Copy the pooled connection string

### 3. Deploy on Vercel

1. vercel.com → New Project → Import the GitHub repo
2. Framework preset: **Other** (it's static + serverless)
3. Environment variables — paste from `.env.example`:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE` (or `NEON_DATABASE_URL`)
   - `GEMINI_API_KEY` (default AI provider)
   - Optional: `QWEN_API_KEY`, `DEEPSEEK_API_KEY`, `KIMI_API_KEY`, `GLM_API_KEY`, `YI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
   - Optional POD: `PRINTFUL_API_KEY`, `TEEMILL_API_KEY`, `GELATO_API_KEY`
4. Deploy.
5. In the Studio (admin.html), Settings → switch `backend` to `supabase` and paste the URL/anon key, or set them at build-time as `window.AA_SUPABASE_URL` / `window.AA_SUPABASE_ANON`.

### 4. Domain

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
