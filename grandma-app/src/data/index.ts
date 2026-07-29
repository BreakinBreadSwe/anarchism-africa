/**
 * Bundled content registry.
 *
 * All content is local JSON — no API calls — so the app works fully
 * offline. Content lives in src/data/content/<lang>/<category>.json.
 *
 * React Native's bundler requires static `require` calls, so each
 * language's files are listed here explicitly. To add a translated
 * content pack (e.g. Italian):
 *
 *   1. Copy src/data/content/en/ to src/data/content/it/ and translate
 *      the text values. Keep every `id`, `category` and `region` value
 *      unchanged — ids key bookmarks across languages, and `region` is a
 *      stable key whose display label is translated in src/i18n
 *      (a translated key would empty the list on a language switch).
 *   2. Add an `it` entry to `contentByLanguage` below.
 *   3. Run `npm run check:content` to confirm the pack matches English.
 *
 * Languages without a content pack fall back to English automatically,
 * so UI translation (src/i18n) and content translation can ship
 * independently.
 */
import type {
  CategoryFile,
  CategoryId,
  Remedy,
  StoriesFile,
  Story,
} from '../types/content';

interface ContentPack {
  categories: CategoryFile[];
  stories: StoriesFile;
}

const contentByLanguage: Record<string, ContentPack> = {
  en: {
    categories: [
      require('./content/en/home-remedies.json'),
      require('./content/en/herbs-roots.json'),
      require('./content/en/dietary-systems.json'),
      require('./content/en/fasting.json'),
    ],
    stories: require('./content/en/stories.json'),
  },
  es: {
    categories: [
      require('./content/es/home-remedies.json'),
      require('./content/es/herbs-roots.json'),
      require('./content/es/dietary-systems.json'),
      require('./content/es/fasting.json'),
    ],
    stories: require('./content/es/stories.json'),
  },
  fr: {
    categories: [
      require('./content/fr/home-remedies.json'),
      require('./content/fr/herbs-roots.json'),
      require('./content/fr/dietary-systems.json'),
      require('./content/fr/fasting.json'),
    ],
    stories: require('./content/fr/stories.json'),
  },
  de: {
    categories: [
      require('./content/de/home-remedies.json'),
      require('./content/de/herbs-roots.json'),
      require('./content/de/dietary-systems.json'),
      require('./content/de/fasting.json'),
    ],
    stories: require('./content/de/stories.json'),
  },
};

const FALLBACK_LANGUAGE = 'en';

function packFor(language: string): ContentPack {
  return contentByLanguage[language] ?? contentByLanguage[FALLBACK_LANGUAGE];
}

/** All remedies for a language, flattened with their category attached. */
export function getRemedies(language: string): Remedy[] {
  return packFor(language).categories.flatMap((file) =>
    file.remedies.map((entry) => ({ ...entry, category: file.category }))
  );
}

export function getRemedyById(language: string, id: string): Remedy | undefined {
  return getRemedies(language).find((remedy) => remedy.id === id);
}

export function getStories(language: string): Story[] {
  return packFor(language).stories.stories;
}

export function getStoryById(language: string, id: string): Story | undefined {
  return getStories(language).find((story) => story.id === id);
}

/** Distinct regions present in the content, for the region filter. */
export function getRegions(language: string): string[] {
  const regions = new Set(getRemedies(language).map((remedy) => remedy.region));
  return [...regions].sort();
}

export function getCategoryIds(): CategoryId[] {
  return packFor(FALLBACK_LANGUAGE).categories.map((file) => file.category);
}
