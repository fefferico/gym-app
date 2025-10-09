import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

const LANG_STORAGE_KEY = 'app_language';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  
  // A signal to hold the current language, easily consumable by components
  currentLang = signal<string>('en');
  
  // List of languages your app supports
  supportedLanguages = ['en', 'es', 'it', 'fr'];

  constructor(private translate: TranslateService) {}

  /**
   * Initializes the language service.
   * Should be called once when the application starts.
   */
   init(): void {
    // 1. Set a guaranteed default language for the service.
    this.translate.setDefaultLang('en');
    
    // 2. Get the language from storage, which might be null.
    const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
    
    let langToUse: string;

    // 3. Explicitly check if the saved language is a valid, supported string.
    if (savedLang && this.supportedLanguages.includes(savedLang)) {
        langToUse = savedLang;
    } else {
        // 4. If not, fall back to the guaranteed default language.
        langToUse = this.translate.getDefaultLang();
    }
    
    // 5. Now, langToUse is GUARANTEED to be a string, and this call is safe.
    this.setLanguage(langToUse);
  }

  /**
   * Sets the application's language.
   * @param lang The language code (e.g., 'en', 'es').
   */
  setLanguage(lang: string): void {
    this.translate.use(lang);
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    this.currentLang.set(lang);
  }
}