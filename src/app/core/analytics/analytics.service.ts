import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable } from '@angular/core';

import { persistedSignal } from '../storage/persisted-signal';
import { CONSENT_REGIONS, GOOGLE_TAG_ID, parseGoogleTag } from './analytics.config';
import { AnalyticsEvent, AnalyticsParams, ConsentChoice } from './analytics.models';

interface AnalyticsWindow {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

const DENIED_ADS = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly document = inject(DOCUMENT);
  private readonly tag = parseGoogleTag(inject(GOOGLE_TAG_ID));
  private readonly choice = persistedSignal<ConsentChoice | null>('consent.v1', null, (raw) =>
    raw === 'granted' || raw === 'denied' ? raw : null,
  );
  private started = false;
  private sentChoice: ConsentChoice | null = null;

  readonly enabled = this.tag !== null;
  readonly consent = this.choice.asReadonly();
  readonly askConsent = computed(() => this.enabled && this.choice() === null);

  constructor() {
    effect(() => this.updateConsent(this.choice()));
  }

  start(): void {
    if (!this.tag || this.started) return;
    this.started = true;
    const win = this.window();
    win.dataLayer ??= [];
    win.gtag ??= function gtag() {
      win.dataLayer!.push(arguments);
    };

    this.gtag('consent', 'default', { ...DENIED_ADS, analytics_storage: 'denied', region: CONSENT_REGIONS, wait_for_update: 500 });
    this.gtag('consent', 'default', { ...DENIED_ADS, analytics_storage: 'granted' });
    this.updateConsent(this.choice());

    if (this.tag.kind === 'gtm') {
      win.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      this.load(`https://www.googletagmanager.com/gtm.js?id=${this.tag.id}`);
    } else {
      this.gtag('js', new Date());
      this.gtag('config', this.tag.id, { send_page_view: false });
      this.load(`https://www.googletagmanager.com/gtag/js?id=${this.tag.id}`);
    }
  }

  setConsent(choice: ConsentChoice): void {
    this.choice.set(choice);
  }

  event(name: AnalyticsEvent, params: AnalyticsParams = {}): void {
    if (!this.started || !this.tag) return;
    if (this.tag.kind === 'gtm') this.window().dataLayer!.push({ event: name, ...params });
    else this.gtag('event', name, params);
  }

  pageView(): void {
    const { location, title } = this.document;
    const path = location.pathname;
    this.event('page_view', {
      page_location: location.href,
      page_path: path,
      page_title: title,
      page_type: /\/read\//.test(path) ? 'reader' : 'library',
    });
  }

  private updateConsent(choice: ConsentChoice | null): void {
    if (!this.started || !choice || choice === this.sentChoice) return;
    this.sentChoice = choice;
    this.gtag('consent', 'update', { analytics_storage: choice });
  }

  private gtag(...args: unknown[]): void {
    this.window().gtag?.(...args);
  }

  private window(): AnalyticsWindow {
    return this.document.defaultView as unknown as AnalyticsWindow;
  }

  private load(src: string): void {
    const script = this.document.createElement('script');
    script.async = true;
    script.src = src;
    this.document.head.appendChild(script);
  }
}
