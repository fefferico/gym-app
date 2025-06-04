import { isPlatformBrowser } from "@angular/common";
import { DOCUMENT, effect, Inject, Injectable, PLATFORM_ID, signal } from "@angular/core";

@Injectable({
   providedIn: 'root',
 })
 export class ThemeService {
   private readonly THEME_KEY = 'fitTrackPro-theme';
   isDarkTheme = signal<boolean>(this.getInitialTheme());

   constructor(
     @Inject(DOCUMENT) private document: Document,
     @Inject(PLATFORM_ID) private platformId: Object
   ) {
     effect(() => {
       const isDark = this.isDarkTheme();
       if (isPlatformBrowser(this.platformId)) {
         localStorage.setItem(this.THEME_KEY, isDark ? 'dark' : 'light');
         if (isDark) {
           this.document.documentElement.classList.add('dark'); // Apply to <html>
         } else {
           this.document.documentElement.classList.remove('dark'); // Remove from <html>
         }
       }
     });
   }

   private getInitialTheme(): boolean {
     if (isPlatformBrowser(this.platformId)) {
       const storedPreference = localStorage.getItem(this.THEME_KEY);
       if (storedPreference) {
         return storedPreference === 'dark';
       }
       // Fallback to OS preference if no stored preference
       return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
     }
     return false; // Default for SSR or non-browser environments
   }

   toggleTheme(): void {
     this.isDarkTheme.update(isDark => !isDark);
   }
 }