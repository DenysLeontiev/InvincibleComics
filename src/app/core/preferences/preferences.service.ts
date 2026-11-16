import { computed, Injectable } from '@angular/core';

import { isRecord, persistedSignal } from '../storage/persisted-signal';

export type ReaderLayout = 'single' | 'double' | 'scroll';
export type ReaderFit = 'contain' | 'width';
export type LibraryFilter = 'all' | 'unread' | 'reading' | 'read';

export interface Preferences {
  readonly layout: ReaderLayout;
  readonly fit: ReaderFit;
  readonly libraryFilter: LibraryFilter;
  readonly hintsSeen: boolean;
}

const DEFAULTS: Preferences = {
  layout: 'single',
  fit: 'contain',
  libraryFilter: 'all',
  hintsSeen: false,
};

const LAYOUTS: readonly ReaderLayout[] = ['single', 'double', 'scroll'];
const FITS: readonly ReaderFit[] = ['contain', 'width'];
const FILTERS: readonly LibraryFilter[] = ['all', 'unread', 'reading', 'read'];

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function parsePreferences(raw: unknown): Preferences | null {
  if (!isRecord(raw)) return null;
  return {
    layout: pick(raw['layout'], LAYOUTS, DEFAULTS.layout),
    fit: pick(raw['fit'], FITS, DEFAULTS.fit),
    libraryFilter: pick(raw['libraryFilter'], FILTERS, DEFAULTS.libraryFilter),
    hintsSeen: raw['hintsSeen'] === true,
  };
}

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly state = persistedSignal<Preferences>('prefs.v1', DEFAULTS, parsePreferences);

  readonly layout = computed(() => this.state().layout);
  readonly fit = computed(() => this.state().fit);
  readonly libraryFilter = computed(() => this.state().libraryFilter);
  readonly hintsSeen = computed(() => this.state().hintsSeen);

  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    this.state.update((s) => (s[key] === value ? s : { ...s, [key]: value }));
  }
}
