import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { I18nService } from './i18n.service';
import { LANGUAGES, TRANSLATIONS } from './languages';

describe('I18nService', () => {
  let i18n: I18nService;

  beforeEach(() => {
    localStorage.removeItem('icr:lang.v1');
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    i18n = TestBed.inject(I18nService);
    i18n.use('en');
  });

  afterEach(() => localStorage.removeItem('icr:lang.v1'));

  it('offers English, Ukrainian, French, Spanish and German', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['en', 'uk', 'fr', 'es', 'de']);
  });

  it('has every key translated in every language', () => {
    const keys = Object.keys(TRANSLATIONS.en).sort();
    for (const { code } of LANGUAGES) {
      expect(Object.keys(TRANSLATIONS[code]).sort()).withContext(code).toEqual(keys);
    }
  });

  it('fills in parameters', () => {
    expect(i18n.t('continue.onPage', { page: 7 })).toBe('Continue on page 7');
  });

  it('uses the right plural form for each language', () => {
    expect(i18n.t('common.issues', { count: 1 })).toBe('1 issue');
    expect(i18n.t('common.issues', { count: 3 })).toBe('3 issues');

    i18n.use('uk');
    expect(i18n.t('common.issues', { count: 1 })).toBe('1 випуск');
    expect(i18n.t('common.issues', { count: 3 })).toBe('3 випуски');
    expect(i18n.t('common.issues', { count: 7 })).toBe('7 випусків');
  });

  it('switches language and updates the document', () => {
    i18n.use('de');
    TestBed.tick();
    expect(i18n.t('filter.all')).toBe('Alle');
    expect(document.documentElement.lang).toBe('de');
  });
});
