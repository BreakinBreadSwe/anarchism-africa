# 🍞 BREAKIN BREAD — Free Cinema

**A free cinema of public-domain films and movies. No paywall. No login. No ads.**

Breakin Bread is a fast, mobile-first PWA for discovering and streaming films that
are in the **public domain** — every title is legally free to watch and is streamed
straight from the [Internet Archive](https://archive.org/details/feature_films).

Break bread, pass it on.

---

## What it does

- **Browse** a curated catalog of public-domain films, organised into genre rails
  (Horror, Noir, Comedy, Silent, Sci-Fi, Western, Animation…).
- **Watch free, in-app** — tap any film and the Internet Archive player streams the
  full movie inline. Nothing is pirated or rights-restricted.
- **Search** by title, director, genre, year, or tag.
- **My List** — save films for later (stored locally in the browser).
- **Continue Watching** — recently opened films float to the top.
- **Installable PWA** — add to home screen; browse the catalog and posters offline.
- **Zero backend** — pure static HTML/CSS/JS. No build step, no database, no tracking.

---

## Why "free copyright" films?

Films fall into the public domain when their copyright expires or was never properly
secured (e.g. a missing renewal or copyright notice). These are genuinely free for
anyone to watch, copy, and share. The Internet Archive hosts thousands of them and
permits embedding, which is what powers the player here.

Each film links to its **Internet Archive source page** and a **search fallback**, so
a title stays reachable even if an upstream identifier ever changes.

---

## Run it

It's static — serve the folder and open it:

```bash
# from the repo root
npx serve .
# then open http://localhost:3000/breakinbread/
```

Or open `breakinbread/index.html` through any static server. (Service-worker /
PWA features need `http(s)://`, not `file://`.)

Deployed under the existing Vercel project, it lives at **`/breakinbread/`**.

---

## Structure

```
breakinbread/
├── index.html              # app shell
├── css/app.css             # cinematic "oven & marquee" theme
├── js/
│   ├── catalog.js          # the film catalog (public-domain titles + archive.org ids)
│   └── app.js              # SPA: router, hero, rails, search, player, watchlist
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # service worker (offline shell + poster cache)
└── icons/favicon.svg       # Breakin Bread loaf-and-play mark
```

---

## Adding a film

Append an entry to `js/catalog.js`. The only field that drives playback is
`archive_id` — the Internet Archive item identifier (the bit after
`archive.org/details/…`). Poster, player, and source links are all derived from it.

```js
{
  id: "a-url-safe-slug",
  title: "Film Title",
  year: 1955,
  director: "Director Name",
  runtime: 92,                 // minutes
  genres: ["Noir", "Crime"],
  archive_id: "internet_archive_identifier",
  featured: true,              // optional — surfaces in hero + "Fresh from the Oven"
  blurb: "One or two sentences.",
  tags: ["noir", "1950s"]
}
```

Everything here is public domain — please keep it that way.

© Breakin Bread — free cinema for everyone.
