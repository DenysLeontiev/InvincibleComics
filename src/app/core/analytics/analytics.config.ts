import { InjectionToken } from '@angular/core';

export type TagKind = 'gtm' | 'gtag';

export interface GoogleTag {
  readonly id: string;
  readonly kind: TagKind;
}

export const GOOGLE_TAG_ID = new InjectionToken<string>('GOOGLE_TAG_ID', {
  providedIn: 'root',
  factory: () => document.querySelector<HTMLMetaElement>('meta[name="google-tag-id"]')?.content ?? '',
});

export function parseGoogleTag(raw: string): GoogleTag | null {
  const id = raw.trim().toUpperCase();
  if (/^GTM-[A-Z0-9]+$/.test(id)) return { id, kind: 'gtm' };
  if (/^(G|GT)-[A-Z0-9]+$/.test(id)) return { id, kind: 'gtag' };
  return null;
}

export const CONSENT_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV',
  'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH',
];
