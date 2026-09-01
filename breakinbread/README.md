# 🍞 BREAKIN BREAD — Free Cinema

**A free cinema of public-domain & free-to-watch films from around the world — in every language. No paywall. No login. No ads.**

Breakin Bread is a fast, mobile-first PWA for discovering and streaming films that are
**free to watch** — public-domain world classics and freely available cinema, pulled
from the [Internet Archive](https://archive.org/details/feature_films), YouTube, and
national film archives.

Break bread, pass it on.

---

## What it does

- **Browse the world** — 40+ films across **21 languages and 20 countries**: French,
  German, Russian, Italian, Japanese, Mandarin, Korean, Hindi, Bengali, Telugu, Arabic,
  Persian, Spanish, Portuguese, Turkish, Indonesian, Urdu, Swedish, Danish, Cantonese,
  English… Organised into genre rails **and** language pages ("Around the World").
- **Multi-source player** — silent & early classics play **inline** from the Internet
  Archive; the player also embeds **YouTube** and **Vimeo**. Where an exact embed id
  isn't verified, the film is a clean **"Watch on YouTube ↗"** link-out (a real search
  URL) — so a title always resolves and nothing renders broken.
- **Search** by title, director, **language, country**, genre, year, or tag.
- **My List** + **Continue Watching** — saved locally in the browser.
- **Installable PWA** — add to home screen; browse the catalog and posters offline.
- **Zero backend** — pure static HTML/CSS/JS. No build step, no database, no tracking.

---

## Why "free copyright" films?

Films fall into the public domain when copyright expires or was never properly secured
(a missing renewal or notice). Many world classics are also made freely available by
national film archives and official channels. These are genuinely free to watch — the
Internet Archive alone hosts thousands and permits embedding, which powers inline
playback here.

Every film links to its **original source** (Archive item, YouTube video, or archive
page) and a **search fallback**, so a title stays reachable even if an upstream
identifier ever changes.

> **Note on source ids:** the catalog's Internet Archive ids and link-outs are curated
> from public-domain collections. Inline-embeddable entries (`archive`) carry verified
> item ids; sound-era world films are listed as `external` link-outs until a specific
> embed id is confirmed — dropping a verified `youtube`/`vimeo` id into an entry upgrades
> it to inline playback automatically.

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

Append an entry to `js/catalog.js`. The `source` object drives playback; poster, player,
and links are all derived from it.

```js
{
  id: "a-url-safe-slug",
  title: "Film Title",
  year: 1955,
  director: "Director Name",
  runtime: 92,                       // minutes
  language: "Japanese",              // primary language (parentheticals like "(silent)" are stripped for grouping)
  country: "Japan",
  genres: ["Noir", "Crime"],
  tags: ["noir", "1950s"],
  featured: true,                    // optional — surfaces in hero + "Fresh from the Oven"
  blurb: "One or two sentences.",

  // pick ONE source:
  source: { kind: "archive", id: "internet_archive_identifier" },   // inline, public domain
  // source: { kind: "youtube", id: "YT_VIDEO_ID" },                // inline YouTube embed
  // source: { kind: "vimeo",   id: "123456789", poster: "url" },   // inline Vimeo embed
  // source: find("YouTube", "Film Title 1955"),                    // clean link-out (always resolves)
}
```

`find(platform, query)` (top of `catalog.js`) builds a guaranteed-to-resolve link-out —
use it when you know a film is free to watch but haven't verified an exact embed id.

Everything here is free to watch — please keep it that way.

© Breakin Bread — free cinema for everyone.
