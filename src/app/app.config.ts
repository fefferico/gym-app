// src/app/app.config.ts
import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core'; // Ensure provideZoneChangeDetection is imported
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { DBConfig, NgxIndexedDBModule } from 'ngx-indexed-db';

import { APP_ROUTES } from './app.routes';

import { HAMMER_GESTURE_CONFIG, HammerGestureConfig, HammerModule } from '@angular/platform-browser';
import * as Hammer from 'hammerjs';

export class CustomHammerConfig extends HammerGestureConfig {
  override overrides = {
    swipe: { direction: Hammer.DIRECTION_HORIZONTAL },
    pinch: { enable: false },
    rotate: { enable: false }
  };
}

const dbConfig: DBConfig = {
  name: 'FitTrackProDB',
  version: 1,
  objectStoresMeta: [{
    store: 'progress_photos',
    storeConfig: { keyPath: 'date', autoIncrement: false },
    storeSchema: [
      { name: 'date', keypath: 'date', options: { unique: true } },
      { name: 'image', keypath: 'image', options: { unique: false } }
    ]
  }]
};

export const appConfig: ApplicationConfig = {
  providers: [
    // This explicitly configures Angular to use Zone.js for change detection.
    // The `{ eventCoalescing: true }` is a performance optimization.
    provideZoneChangeDetection({ eventCoalescing: true }),

    provideRouter(APP_ROUTES, withComponentInputBinding()),
    provideAnimations(),
    provideHttpClient(withFetch()),
    importProvidersFrom(HammerModule), // <-- ADD THIS
    // --- START: ADD THE PROVIDER FOR THE CONFIG ---
    {
      provide: HAMMER_GESTURE_CONFIG,
      useClass: CustomHammerConfig
    },
    // ThemeService is providedIn: 'root', so it's available.
    importProvidersFrom(NgxIndexedDBModule.forRoot(dbConfig))
  ]
};