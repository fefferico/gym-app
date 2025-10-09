// src/app/core/services/language.service.ts
import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

const LANG_STORAGE_KEY = 'app_language';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  
  currentLang = signal<string>('en');
  supportedLanguages = ['en', 'es', 'it', 'fr', 'de'];

  constructor(private translate: TranslateService) {}

  /**
   * Initializes the language service.
   * Should be called once from the root AppComponent when the application starts.
   */
   init(): void {
    // 1. Set a guaranteed default language for the service.
    this.translate.setDefaultLang('en');
    
    // 2. Get the language from storage.
    const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
    
    // 3. Get the browser's preferred language.
    const browserLang = this.translate.getBrowserLang();

    let langToUse: string;

    // 4. Determine which language to use based on priority:
    //    a) Language saved in local storage.
    //    b) Browser's language, if it's supported by the app.
    //    c) The guaranteed default language ('en').
    if (savedLang && this.supportedLanguages.includes(savedLang)) {
        langToUse = savedLang;
    } else if (browserLang && this.supportedLanguages.includes(browserLang)) {
        langToUse = browserLang;
    } else {
        langToUse = this.translate.getDefaultLang();
    }
    
    // 5. Set the determined language for the application.
    this.setLanguage(langToUse);
  }

  /**
   * Sets the application's language.
   * @param lang The language code (e.g., 'en', 'es').
   */
  setLanguage(lang: string): void {
    // Use the translate service to set the language
    this.translate.use(lang);
    // Save the preference to local storage for future sessions
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    // Update the signal to notify any listening components of the change
    this.currentLang.set(lang);
  }
}