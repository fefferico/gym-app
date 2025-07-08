import { isPlatformBrowser } from "@angular/common";
import { DOCUMENT, effect, Inject, Injectable, PLATFORM_ID, signal } from "@angular/core";

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly THEME_KEY = 'fitTrackPro-theme';
  private readonly MENU_MODE_KEY = 'fitTrackPro-menuMode';

  // Initialize with a safe default (e.g., false for light theme)
  // The actual theme will be determined and applied in the constructor/effect if on browser
  isDarkTheme = signal<boolean>(false);
  isMenuModeCompact = signal<boolean>(false);

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      // Determine initial theme ONLY if in browser context
      this.isDarkTheme.set(this.getInitialThemeFromBrowser());
      this.isMenuModeCompact.set(this.getInitialMenuModeFromBrowser());
    }
    // Else, on server, it remains the default 'false' (light), which is fine as
    // the server doesn't apply CSS classes to document.documentElement anyway.

    // Effect runs on both server and client, but DOM manipulation is guarded
    effect(() => {
      const isDark = this.isDarkTheme();
      const isMenuModeCompact = this.isMenuModeCompact();
      if (isPlatformBrowser(this.platformId)) {
        // console.log(`ThemeService Effect: Setting theme to ${isDark ? 'dark' : 'light'}`);
        localStorage.setItem(this.THEME_KEY, isDark ? 'dark' : 'light');
        localStorage.setItem(this.MENU_MODE_KEY, isMenuModeCompact ? 'true' : 'false');
        if (isDark) {
          this.document.documentElement.classList.add('dark');
        } else {
          this.document.documentElement.classList.remove('dark');
        }
      }
    });
  }

  // Renamed to be explicit that it's browser-only logic
  private getInitialThemeFromBrowser(): boolean {
    // This method assumes isPlatformBrowser(this.platformId) has already been checked by the caller
    const storedPreference = localStorage.getItem(this.THEME_KEY);
    if (storedPreference) {
      return storedPreference === 'dark';
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false; // Default to false (light) if media query fails
  }

  private getInitialMenuModeFromBrowser(): boolean {
    // This method assumes isPlatformBrowser(this.platformId) has already been checked by the caller
    const storedPreference = localStorage.getItem(this.MENU_MODE_KEY);
    if (storedPreference) {
      return storedPreference === 'true';
    }
    return false;
  }

  toggleTheme(): void {
    if (isPlatformBrowser(this.platformId)) { // Guard toggle as well, though it usually implies user interaction
      this.isDarkTheme.update(isDark => !isDark);
    } else {
      console.warn("ThemeService: toggleTheme called in non-browser environment. No action taken");
    }
  }

  toggleMenuMode(): void {
    if (isPlatformBrowser(this.platformId)) { // Guard toggle as well, though it usually implies user interaction
      this.isMenuModeCompact.update(isMenuModeCompact => !isMenuModeCompact);
    } else {
      console.warn("ThemeService: toggleMenuMode called in non-browser environment. No action taken");
    }
  }
}