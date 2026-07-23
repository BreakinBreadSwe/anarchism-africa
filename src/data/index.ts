/**
 * Bundled content registry.
 *
 * All content is local JSON — no API calls — so the app works fully
 * offline. Content lives in src/data/content/<lang>/<category>.json.
 *
 * React Native's bundler requires static `require` calls, so each
 * language's files are listed here explicitly. To add a translated
 * content pack (e.g. Spanish):
 *
 *   1. Copy src/data/content/en/ to src/data/content/es/ and translate
 *      the text values. Keep every `id`, `category` and `region` value
 *      unchanged (ids key bookmarks; regions key the filter).
 *   2. Add an `es` entry to `contentByLanguage` below.
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
