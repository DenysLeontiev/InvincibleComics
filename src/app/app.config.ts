import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withPreloading,
  PreloadAllModules,
  withViewTransitions,
} from '@angular/router';

import { routes } from './app.routes';
import { provideAnalytics } from './core/analytics/analytics.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({ skipInitialTransition: true }),
      withPreloading(PreloadAllModules),
    ),
    provideAnalytics(),
  ],
};
