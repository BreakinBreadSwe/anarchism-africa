/**
 * i18n setup. Every user-facing string in the app goes through these
 * translation files — no hardcoded copy in components.
 *
 * The language is user-chosen in Settings (persisted to AsyncStorage),
 * not locked to the device locale.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_STORAGE_KEY = '@grandma/language';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    fr: { translation: fr },
    de: { translation: de },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    // React already escapes output.
    escapeValue: false,
  },
});

/** Load the persisted language choice, if any. Call once at startup. */
export async function loadPersistedLanguage(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
      await i18n.changeLanguage(stored);
    }
  } catch {
    // Fall back to the default language silently.
  }
}

export async function setLanguage(language: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Non-fatal: the choice just won't persist across restarts.
  }
}

export default i18n;
