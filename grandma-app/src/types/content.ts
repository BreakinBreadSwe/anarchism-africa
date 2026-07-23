/**
 * Content data model for the Grandma app.
 *
 * All core content ships bundled with the app as JSON — one file per
 * category, per language — so the app is fully usable offline and new
 * languages can be added by dropping in translated copies of the same
 * files (see src/data/index.ts).
 */

export type CategoryId =
  | 'homeRemedies'
  | 'dietarySystems'
  | 'fasting'
  | 'herbsRoots';

export const ALL_CATEGORIES: CategoryId[] = [
  'homeRemedies',
  'herbsRoots',
  'dietarySystems',
  'fasting',
];

/** Categories behind the one-time premium unlock. */
export const PREMIUM_CATEGORIES: CategoryId[] = ['dietarySystems', 'fasting'];

export interface Ingredient {
  name: string;
  quantity?: string;
}

/** Shape of a remedy entry as it appears inside a category JSON file. */
export interface RemedyEntry {
  id: string;
  title: string;
  /** Symptoms/conditions this remedy is traditionally used for (searchable). */
  ailments: string[];
  ingredients: Ingredient[];
  instructions: string[];
  /** Geographic/cultural region of origin, used for filtering. */
  region: string;
  /** Free-text background on the tradition the remedy comes from. */
  origin?: string;
  preparationTime?: string;
  /** Remedy-specific safety note, shown in addition to the app-wide disclaimer. */
  disclaimer?: string;
}

/** Shape of one category content file (e.g. home-remedies.json). */
export interface CategoryFile {
  category: CategoryId;
  remedies: RemedyEntry[];
}

/** A remedy as used by the app: entry + the category it was loaded from. */
export interface Remedy extends RemedyEntry {
  category: CategoryId;
}

/** A user testimonial. Read-only local data in v1 (no submission backend). */
export interface Story {
  id: string;
  title: string;
  body: string;
  ailment: string;
  outcome: string;
  author?: string;
  region?: string;
}

export interface StoriesFile {
  stories: Story[];
}
