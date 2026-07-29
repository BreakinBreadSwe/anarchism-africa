# Grandma (working title)

A cross-platform (iOS/Android) traditional home-remedies and wellness
reference app, built with **Expo (React Native) + TypeScript** from a single
codebase.

> **Disclaimer:** Traditional practices, not medical advice. Consult a doctor
> for serious conditions. This banner is shown persistently inside the app.

## Getting started

```bash
cd grandma-app
npm install
npm start          # Expo dev server — scan the QR with Expo Go
npm run typecheck  # tsc --noEmit
```

Note: the premium unlock uses `react-native-iap`, a native module that is not
available in Expo Go. In Expo Go / on web the IAP service falls back to a mock
that "succeeds" so the whole flow can be exercised; real store purchases need
an EAS dev/production build with the product `io.luvlab.grandma.premium`
configured in App Store Connect / Google Play Console.

## Features (v1)

- **Remedies Library** — searchable and filterable list across four
  categories: Home Remedies, Herbs & Roots, Dietary Systems, Fasting.
  Search matches remedy name, ailment/symptom tags, and ingredients;
  filters narrow by category and region.
- **Stories** — read-only, locally bundled testimonials (no backend in v1).
- **Bookmarks** — stored locally in AsyncStorage, no account required.
- **Offline-first** — all content ships as bundled JSON; the app makes no
  network calls for core content.
- **Localization** — every UI string goes through i18next (`src/i18n`),
  shipped in English, Spanish, French, and German. The language is chosen in
  Settings and persisted — not locked to the device locale.
- **Monetization** — one-time IAP unlock (react-native-iap) gating the
  Dietary Systems and Fasting categories. Home Remedies, Herbs & Roots, and
  Stories are free.

## Project structure

```
grandma-app/
├── App.tsx                     # Providers + persistent disclaimer banner + navigator
├── index.ts                    # Expo entry point
└── src/
    ├── components/             # DisclaimerBanner, SearchBar, FilterChips, RemedyCard
    ├── data/
    │   ├── index.ts            # Content registry with language fallback
    │   └── content/en/         # One JSON file per category + stories
    ├── i18n/
    │   ├── index.ts            # i18next setup + persisted language switcher
    │   └── locales/            # en / es / fr / de UI strings
    ├── navigation/             # Root stack (tabs, detail screens, paywall modal)
    ├── screens/                # Remedies, RemedyDetail, Stories, StoryDetail,
    │                           # Bookmarks, Settings, Paywall
    ├── services/iap.ts         # react-native-iap wrapper (mock fallback)
    ├── state/                  # BookmarksContext, PremiumContext (AsyncStorage-backed)
    ├── theme.ts                # Shared colors/spacing tokens
    └── types/content.ts        # Content data model (remedy JSON shape)
```

## Content model

Each category is a standalone JSON file (`src/data/content/<lang>/`):

```jsonc
{
  "category": "homeRemedies",
  "remedies": [
    {
      "id": "honey-lemon-tea",          // stable — keys bookmarks across languages
      "title": "Honey & Lemon Tea",
      "ailments": ["sore throat"],       // searchable symptom tags
      "ingredients": [{ "name": "honey", "quantity": "1 tbsp" }],
      "instructions": ["step 1", "step 2"],
      "region": "Global",                // powers the region filter
      "origin": "background text",
      "preparationTime": "5 min",
      "disclaimer": "entry-specific safety note"
    }
  ]
}
```

To add a content language, copy `content/en/` to `content/<lang>/`, translate
the text values (keeping `id`, `category`, and `region` unchanged), and
register the pack in `src/data/index.ts`. Languages without a content pack
fall back to English while keeping a translated UI.

## Content safety policy

Seed content is screened: no remedies involving fecal matter, blood products,
or practices carrying real infection/safety risk are included, and entries
carry entry-specific safety notes (e.g. no honey for infants, fasting
contraindications) on top of the app-wide disclaimer.
