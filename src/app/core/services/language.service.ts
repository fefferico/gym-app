// src/app/core/services/language.service.ts
import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs'; // +++ IMPORT firstValueFrom

const LANG_STORAGE_KEY = 'app_language';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  
  currentLang = signal<string>('en');
  supportedLanguages = ['en', 'es', 'it', 'fr', 'de'];
  private platformId = inject(PLATFORM_ID);

  constructor(private translate: TranslateService) {}

  /**
   * Initializes the language service. Returns a Promise to be used with APP_INITIALIZER.
   */
   init(): Promise<void> {
    return new Promise((resolve) => {
      this.translate.setDefaultLang('en');
      
      const savedLang = isPlatformBrowser(this.platformId) ? localStorage.getItem(LANG_STORAGE_KEY) : null;
      const browserLang = this.translate.getBrowserLang();

      let langToUse: string;

      if (savedLang && this.supportedLanguages.includes(savedLang)) {
          langToUse = savedLang;
      } else if (browserLang && this.supportedLanguages.includes(browserLang)) {
          langToUse = browserLang;
      } else {
          langToUse = this.translate.getDefaultLang();
      }
      
      // Set the signal immediately
      this.currentLang.set(langToUse);

      // Use the language and wait for the translation file to be loaded
      firstValueFrom(this.translate.use(langToUse)).then(() => {
        resolve();
      }).catch(() => {
        // Even if it fails, resolve so the app can start
        resolve();
      });
    });
  }

  /**
   * Sets the application's language and reloads the page.
   * @param lang The language code (e.g., 'en', 'es').
   */
  setLanguage(lang: string): void {
    const current = this.currentLang();
    if (current === lang) return; // Do nothing if the language is already set

    localStorage.setItem(LANG_STORAGE_KEY, lang);

    if (isPlatformBrowser(this.platformId)) {
      // Reload is the most reliable way to ensure LOCALE_ID is correctly applied everywhere.
      window.location.reload();
    }
  }
}