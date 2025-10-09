// src/app/app.config.ts
import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, HttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { DBConfig, NgxIndexedDBModule } from 'ngx-indexed-db';

import { APP_ROUTES } from './app.routes';

import { HAMMER_GESTURE_CONFIG, HammerGestureConfig, HammerModule } from '@angular/platform-browser';
import * as Hammer from 'hammerjs';

// ngx-translate imports
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

// =========================================================================================
//  ** THIS IS THE CORRECT PLACEMENT FOR THE LOADER FUNCTION **
//  It must be an exported function at the top level of this file.
// =========================================================================================
export function createTranslateLoader(http: HttpClient) {
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}
// =========================================================================================



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
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(APP_ROUTES, withComponentInputBinding()),
    provideAnimations(),
    provideHttpClient(withFetch()),
    importProvidersFrom(HammerModule),
    {
      provide: HAMMER_GESTURE_CONFIG,
      useClass: CustomHammerConfig
    },
    importProvidersFrom(NgxIndexedDBModule.forRoot(dbConfig)),
    // ngx-translate configuration
    importProvidersFrom(
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: createTranslateLoader,
          deps: [HttpClient]
        }
      })
    )
  ]
};