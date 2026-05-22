# Deploy ANARCHISM.AFRICA

Three steps. ~15 minutes total.

---

## 1 · Push to GitHub

From the project folder:

```bash
git init
git add .
git commit -m "ANARCHISM.AFRICA — initial"

# create + push (requires gh CLI; or do it in the GitHub UI)
gh repo create anarchism-africa --public --source=. --remote=origin --push
```

If you don't have `gh`, create the repo at github.com/new (name it `anarchism-africa`), then:

```bash
git remote add origin git@github.com:<you>/anarchism-africa.git
git branch -M main
git push -u origin main
```

---

## 2 · Database

### Supabase (recommended — has auth, storage, realtime, RLS)

1. https://supabase.com → **New project**
2. Name: `anarchism-africa` · Region: closest to your audience (Frankfurt or Cape Town)
3. SQL Editor → paste `db/schema.sql` → **Run**
4. Project Settings → API → copy:
   - `Project URL` → `SUPABASE_URL`
   - `anon` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE` (server only — never expose)

### OR Neon (Postgres only — cheaper, serverless cold-starts)

1. https://neon.tech → **New project**
2. SQL Editor → paste `db/schema.sql`
3. Copy the **pooled** connection string → `NEON_DATABASE_URL`

You'll need to add auth separately if you go Neon-only — Supabase is faster to get rolling.

---

## 3 · Vercel

1. https://vercel.com → **Add New** → **Project** → import the GitHub repo
2. Framework: **Other**. Build command: empty. Output directory: `.`
3. Environment variables (Settings → Environment Variables) — copy `.env.example`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE`
   - `GEMINI_API_KEY` ← get from https://aistudio.google.com/apikey
   - (optional) any other AI keys you want
   - (optional) `PRINTFUL_API_KEY`, `TEEMILL_API_KEY` for live merch
4. **Deploy**.
5. After first deploy, point the public site at the database. Either:
   - **Build-time injection** — add to `index.html` *before* `<script src="js/config.js">`:
     ```html
     <script>
       window.AA_SUPABASE_URL  = "https://xxx.supabase.co";
       window.AA_SUPABASE_ANON = "ey...";
     </script>
     ```
     Then in Studio → Site & CSS, switch `backend` to `supabase`.
   - **Or** open Studio (admin.html) and paste them in the AI/Settings tab.

---

## 4 · Domain

Vercel → Settings → Domains → **Add** → `anarchism.africa`. It will give you the DNS records to set on your registrar.

---

## Going live checklist

- [ ] Replace seed images (Unsplash placeholders) with your own
- [ ] Wire Stripe Connect for crowdfund (or stay with Open Collective)
- [ ] Connect Printful or Teemill account → first real merch SKU
- [ ] Set up Resend (or Listmonk) for the newsletter
- [ ] Configure Supabase Auth providers (Email, Google, Apple)
- [ ] Add RLS policies on all tables (`role` checks per the schema comments)
- [ ] Lock down `service_role` — server only, never in browser

---

## Local dev

```bash
npx serve .
# http://localhost:3000
```

For local serverless functions:

```bash
npm i -g vercel
vercel dev
# http://localhost:3000 — /api routes will run too
```
