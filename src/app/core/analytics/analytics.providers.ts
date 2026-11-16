import {
  afterNextRender,
  effect,
  EffectRef,
  EnvironmentProviders,
  ErrorHandler,
  inject,
  Injectable,
  Injector,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { LibraryService } from '../library/library.service';
import { AnalyticsService } from './analytics.service';

@Injectable()
class TrackingErrorHandler extends ErrorHandler {
  private readonly injector = inject(Injector);

  override handleError(error: unknown): void {
    super.handleError(error);
    const message = error instanceof Error ? error.message : String(error);
    this.injector.get(AnalyticsService).event('app_error', { option: message.slice(0, 100) });
  }
}

function trackPageViews(): void {
  const analytics = inject(AnalyticsService);
  if (!analytics.enabled) return;
  analytics.start();

  const library = inject(LibraryService);
  const injector = inject(Injector);
  let pending: EffectRef | undefined;

  inject(Router)
    .events.pipe(filter((event) => event instanceof NavigationEnd))
    .subscribe(() => {
      pending?.destroy();
      pending = effect(
        () => {
          if (!library.isReady() && !library.error()) return;
          pending?.destroy();
          afterNextRender(() => analytics.pageView(), { injector });
        },
        { injector },
      );
    });
}

export function provideAnalytics(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ErrorHandler, useClass: TrackingErrorHandler },
    provideAppInitializer(trackPageViews),
  ]);
}
