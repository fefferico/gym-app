// src/app/app.config.ts
import { APP_INITIALIZER, ApplicationConfig, DOCUMENT, importProvidersFrom, inject, Injectable, LOCALE_ID, PLATFORM_ID, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, HttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { DBConfig, NgxIndexedDBModule } from 'ngx-indexed-db';

import { APP_ROUTES } from './app.routes';

import { HAMMER_GESTURE_CONFIG, HammerGestureConfig, HammerModule } from '@angular/platform-browser';
import * as Hammer from 'hammerjs';

// ngx-translate imports
import { TranslateModule, TranslateLoader, TranslateService } from '@ngx-translate/core';
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
import localePt from '@angular/common/locales/pt';
import localeAr from '@angular/common/locales/ar';
import { isPlatformBrowser, registerLocaleData } from '@angular/common';
import { LanguageService } from './core/services/language.service';
import { MultiHttpLoader } from './core/services/multi-http-loader';
import { firstValueFrom } from 'rxjs';

// Register the locale data
registerLocaleData(localeEn, 'en'); // Register with explicit locale id
registerLocaleData(localeEs);
registerLocaleData(localeIt);
registerLocaleData(localeFr);
registerLocaleData(localeDe);
registerLocaleData(localeRu);
registerLocaleData(localeJa);
registerLocaleData(localeZh);
registerLocaleData(localePt);
registerLocaleData(localeAr);

@Injectable()
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

// --- APP_INITIALIZER FACTORY ---
// This factory must ensure the LanguageService has determined the initial language
// AND that ngx-translate has loaded its translations before the app starts.
export function appInitializerFactory(languageService: LanguageService, translate: TranslateService): () => Promise<void> {
  return () => {
    // 1. Initialize the language service to determine the starting language
    languageService.initializeLanguage();
    
    // 2. Get the language that was determined by the language service
    const langToUse = languageService.currentLang();
    
    // 3. Use ngx-translate to load the translation files for this language
    //    and return a Promise so APP_INITIALIZER waits for it.
    // console.log(`APP_INITIALIZER: Using language: ${langToUse}`); // For debugging
    return firstValueFrom(translate.use(langToUse));
  };
}

// Theme initializer factory - runs before app starts
export function themeInitializerFactory(platformId: Object, document: Document): () => void {
  return () => {
    if (isPlatformBrowser(platformId)) {
      const storedTheme = localStorage.getItem('fitTrackPro-theme');
      const isDark = storedTheme === 'dark' || 
                     (!storedTheme && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
      
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };
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
    {
      provide: APP_INITIALIZER,
      useFactory: themeInitializerFactory,
      deps: [PLATFORM_ID, DOCUMENT],
      multi: true
    },
    // ==========================================================
    // START: CORRECTED PROVIDER ORDER
    // (LanguageService MUST be provided before APP_INITIALIZER and LOCALE_ID)
    // ==========================================================
    LanguageService, // Provide LanguageService first
    {
      provide: APP_INITIALIZER,
      useFactory: appInitializerFactory,
      // APP_INITIALIZER needs LanguageService and TranslateService
      deps: [LanguageService, TranslateService], 
      multi: true
    },
    importProvidersFrom(
      TranslateModule.forRoot({
        loader: {
          provide: TranslateLoader,
          useFactory: (http: HttpClient) => {
            return new MultiHttpLoader(http, [
              { prefix: './assets/i18n/', suffix: '.json' },
              { prefix: './assets/i18n/', suffix: '.exercises.json' },
              { prefix: './assets/i18n/', suffix: '.equipments.json' },
              { prefix: './assets/i18n/', suffix: '.categories.json' },
              { prefix: './assets/i18n/', suffix: '.workout-categories.json' },
              { prefix: './assets/i18n/', suffix: '.locations.json' },
              { prefix: './assets/i18n/', suffix: '.muscles.json' },
            ]);
          },
          deps: [HttpClient]
        }
      })
    ),
    {
      provide: LOCALE_ID,
      deps: [LanguageService], // LOCALE_ID depends on LanguageService
      useFactory: (languageService: LanguageService) => languageService.currentLang() 
      // This factory will now read the correctly initialized signal value from LanguageService
    },
    // ==========================================================
    // END: CORRECTED PROVIDER ORDER
    // ==========================================================
  ]
};