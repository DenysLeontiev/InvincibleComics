import { InjectionToken } from '@angular/core';

export const LIBRARY_BASE_URL = new InjectionToken<string>('LIBRARY_BASE_URL', {
  providedIn: 'root',
  factory: () => 'library/',
});

export function resolveUrl(path: string, base = document.baseURI): string {
  return new URL(path, base).href;
}
