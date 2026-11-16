import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable } from '@angular/core';

import { persistedSignal } from '../storage/persisted-signal';
import { LanguageCode, TranslationKey, TranslationParams } from './i18n.types';
import { DEFAULT_LANGUAGE, isLanguageCode, LANGUAGES, TRANSLATIONS } from './languages';

function detectLanguage(): LanguageCode {
  const preferred = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language];
  for (const tag of preferred) {
    const code = tag?.toLowerCase().split('-')[0];
    if (isLanguageCode(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly current = persistedSignal<LanguageCode>('lang.v1', detectLanguage(), (raw) =>
    isLanguageCode(raw) ? raw : null,
  );

  readonly languages = LANGUAGES;
  readonly language = this.current.asReadonly();
  readonly languageInfo = computed(
    () => LANGUAGES.find((l) => l.code === this.current()) ?? LANGUAGES[0],
  );

  private readonly pluralRules = computed(() => new Intl.PluralRules(this.current()));

  constructor() {
    const document = inject(DOCUMENT);
    effect(() => {
      document.documentElement.lang = this.current();
    });
  }

  use(code: LanguageCode): void {
    this.current.set(code);
  }

  t(key: TranslationKey, params?: TranslationParams): string {
    const entry = TRANSLATIONS[this.current()][key] ?? TRANSLATIONS[DEFAULT_LANGUAGE][key];
    let text: string;
    if (typeof entry === 'string') {
      text = entry;
    } else {
      const count = Number(params?.['count'] ?? 0);
      text = entry[this.pluralRules().select(count)] ?? entry.other;
    }
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  }
}
