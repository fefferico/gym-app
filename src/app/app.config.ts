// src/app/app.config.ts
import { APP_INITIALIZER, ApplicationConfig, importProvidersFrom, LOCALE_ID, PLATFORM_ID, provideZoneChangeDetection } from '@angular/core';
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


// Import locale data for each language
import localeEn from '@angular/common/locales/en';
import localeEs from '@angular/common/locales/es';
import localeIt from '@angular/common/locales/it';
import localeFr from '@angular/common/locales/fr';
import localeDe from '@angular/common/locales/de';
import localeRu from '@angular/common/locales/ru';
import localeJa from '@angular/common/locales/ja';
import localeZh from '@angular/common/locales/zh';
import localePr from '@angular/common/locales/pt';
import localeAr from '@angular/common/locales/ar';
import { isPlatformBrowser, registerLocaleData } from '@angular/common';
import { LanguageService } from './core/services/language.service';
import { MultiHttpLoader } from './core/services/multi-http-loader';

// Register the locale data
registerLocaleData(localeEn);
registerLocaleData(localeEs);
registerLocaleData(localeIt);
registerLocaleData(localeFr);
registerLocaleData(localeDe);
registerLocaleData(localeRu);
registerLocaleData(localeJa);
registerLocaleData(localeZh);
registerLocaleData(localePr);
registerLocaleData(localeAr);

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

export function appInitializerFactory(languageService: LanguageService) {
  return () => languageService.init();
}

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
    
    // ==========================================================
    // START: CORRECTED PROVIDER ORDER
    // ==========================================================
    {
      provide: APP_INITIALIZER,
      useFactory: appInitializerFactory,
      deps: [LanguageService],
      multi: true
    },
    importProvidersFrom(
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          // useFactory: createTranslateLoader,
          useFactory: (http: HttpClient) => {
            // 3. Provide the paths to ALL your translation files
            return new MultiHttpLoader(http, [
              { prefix: './assets/i18n/', suffix: '.json' },
              { prefix: './assets/i18n/', suffix: '.exercises.json' },
            ]);
          },
          deps: [HttpClient]
        }
      })
    ),
    {
      provide: LOCALE_ID,
      deps: [LanguageService], // Now this depends on the already-initialized service
      useFactory: (languageService: LanguageService) => languageService.currentLang()
    },
    // ==========================================================
    // END: CORRECTED PROVIDER ORDER
    // ==========================================================
  ]
};