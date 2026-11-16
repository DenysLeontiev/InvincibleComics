import type { en } from './translations/en';

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { readonly other: string };
export type TranslationValue = string | PluralForms;
export type TranslationKey = keyof typeof en;
export type Translations = Readonly<Record<TranslationKey, TranslationValue>>;
export type TranslationParams = Readonly<Record<string, string | number>>;

export type LanguageCode = 'en' | 'uk' | 'fr' | 'es' | 'de';

export interface Language {
  readonly code: LanguageCode;
  readonly name: string;
  readonly flag: string;
}
