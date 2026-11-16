import { DestroyRef, effect, inject, signal, WritableSignal } from '@angular/core';

const PREFIX = 'icr:';

function storage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    const probe = `${PREFIX}probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function persistedSignal<T>(
  key: string,
  fallback: T,
  parse: (raw: unknown) => T | null,
): WritableSignal<T> {
  const store = storage();
  const fullKey = PREFIX + key;

  const read = (): T => {
    try {
      const raw = store?.getItem(fullKey);
      return raw == null ? fallback : (parse(JSON.parse(raw)) ?? fallback);
    } catch {
      return fallback;
    }
  };

  const state = signal<T>(read());

  effect(() => {
    const value = state();
    try {
      store?.setItem(fullKey, JSON.stringify(value));
    } catch {}
  });

  if (store && typeof window !== 'undefined') {
    const onStorage = (event: StorageEvent) => {
      if (event.key === fullKey) state.set(read());
    };
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
  }

  return state;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
