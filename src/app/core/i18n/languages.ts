import { Language, LanguageCode, Translations } from './i18n.types';
import { de } from './translations/de';
import { en } from './translations/en';
import { es } from './translations/es';
import { fr } from './translations/fr';
import { uk } from './translations/uk';

export const LANGUAGES: readonly Language[] = [
  { code: 'en', name: 'English', flag: 'flags/gb.svg' },
  { code: 'uk', name: 'Українська', flag: 'flags/ua.svg' },
  { code: 'fr', name: 'Français', flag: 'flags/fr.svg' },
  { code: 'es', name: 'Español', flag: 'flags/es.svg' },
  { code: 'de', name: 'Deutsch', flag: 'flags/de.svg' },
];

export const TRANSLATIONS: Readonly<Record<LanguageCode, Translations>> = { en, uk, fr, es, de };

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value);
}
