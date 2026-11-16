import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { GOOGLE_TAG_ID, parseGoogleTag } from './analytics.config';
import { AnalyticsService } from './analytics.service';

type TestWindow = Window & { dataLayer?: unknown[]; gtag?: unknown };

describe('AnalyticsService', () => {
  const win = window as TestWindow;

  function setup(tagId: string): AnalyticsService {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: GOOGLE_TAG_ID, useValue: tagId }],
    });
    return TestBed.inject(AnalyticsService);
  }

  function commands(): unknown[][] {
    return (win.dataLayer ?? []).filter((e) => !Array.isArray(e) && typeof e === 'object' && e && 'length' in e).map((e) => Array.from(e as ArrayLike<unknown>));
  }

  beforeEach(() => {
    localStorage.removeItem('icr:consent.v1');
    delete win.dataLayer;
    delete win.gtag;
  });

  afterEach(() => {
    document.head.querySelectorAll('script[src*="googletagmanager"]').forEach((s) => s.remove());
    delete win.dataLayer;
    delete win.gtag;
  });

  it('parses tag ids', () => {
    expect(parseGoogleTag(' gtm-abc123 ')).toEqual({ id: 'GTM-ABC123', kind: 'gtm' });
    expect(parseGoogleTag('G-XYZ')).toEqual({ id: 'G-XYZ', kind: 'gtag' });
    expect(parseGoogleTag('')).toBeNull();
    expect(parseGoogleTag('UA-1234')).toBeNull();
  });

  it('does nothing without a tag id', () => {
    const analytics = setup('');
    analytics.start();
    analytics.event('open_issue', { issue_number: 1 });
    expect(analytics.enabled).toBeFalse();
    expect(analytics.askConsent()).toBeFalse();
    expect(win.dataLayer).toBeUndefined();
  });

  it('loads Tag Manager and pushes events as data layer objects', () => {
    const analytics = setup('GTM-TEST1');
    analytics.start();
    analytics.event('comic_page', { issue_number: 7, page_number: 3 });

    expect(document.head.querySelector('script[src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST1"]')).toBeTruthy();
    expect(win.dataLayer).toContain(jasmine.objectContaining({ event: 'gtm.js' }));
    expect(win.dataLayer).toContain({ event: 'comic_page', issue_number: 7, page_number: 3 });
    expect(commands()[0]).toEqual(['consent', 'default', jasmine.objectContaining({ analytics_storage: 'denied' })]);
  });

  it('uses gtag commands for a measurement id', () => {
    const analytics = setup('G-TEST1');
    analytics.start();
    analytics.event('issue_complete', { issue_number: 12 });

    expect(document.head.querySelector('script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST1"]')).toBeTruthy();
    expect(commands()).toContain(['config', 'G-TEST1', { send_page_view: false }]);
    expect(commands()).toContain(['event', 'issue_complete', { issue_number: 12 }]);
  });

  it('asks for consent once and forwards the choice', () => {
    const analytics = setup('G-TEST2');
    analytics.start();
    expect(analytics.askConsent()).toBeTrue();

    analytics.setConsent('denied');
    TestBed.tick();

    expect(analytics.askConsent()).toBeFalse();
    expect(commands()).toContain(['consent', 'update', { analytics_storage: 'denied' }]);
  });
});
