// src/app/app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core'; // Ensure provideZoneChangeDetection is imported
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { APP_ROUTES } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // This explicitly configures Angular to use Zone.js for change detection.
    // The `{ eventCoalescing: true }` is a performance optimization.
    provideZoneChangeDetection({ eventCoalescing: true }),

    provideRouter(APP_ROUTES, withComponentInputBinding()),
    provideAnimations(),
    provideHttpClient(withFetch()),
    // ThemeService is providedIn: 'root', so it's available.
  ]
};