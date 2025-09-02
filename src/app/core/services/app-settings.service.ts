// src/app/core/services/app-settings.service.ts
import { Injectable, inject, signal, WritableSignal, effect, PLATFORM_ID } from '@angular/core';
import { StorageService } from './storage.service';
import { AppSettings, MenuMode } from '../models/app-settings.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

const DEFAULT_APP_SETTINGS: AppSettings = {
    enableTimerCountdownSound: true,
    enableProgressiveOverload: false,
    countdownSoundSeconds: 5,
    enablePresetTimer: false,        // NEW Default
    presetTimerDurationSeconds: 10,  // NEW Default (e.g., 10 seconds)
    weightStep: 1,
    playerMode: false,
    menuMode: 'modal' as MenuMode,
};

// 1. Define a type for the three menu modes for type safety.

@Injectable({
    providedIn: 'root'
})
export class AppSettingsService {

    private storageService = inject(StorageService);
    private platformId = inject(PLATFORM_ID);

    private readonly APP_SETTINGS_KEY = 'fitTrackPro_appSettings';
    private readonly MENU_MODE_KEY = 'fitTrackPro_menuMode'; // New key for storage


    private appSettingsSubject: BehaviorSubject<AppSettings>;
    public appSettings$: Observable<AppSettings>;

    // Individual signals
    public enableCompactModeSignal = signal<boolean>(DEFAULT_APP_SETTINGS.enableTimerCountdownSound);
    public enableTimerCountdownSound = signal<boolean>(DEFAULT_APP_SETTINGS.enableTimerCountdownSound);
    public countdownSoundSeconds = signal<number>(DEFAULT_APP_SETTINGS.countdownSoundSeconds);
    public enablePresetTimer = signal<boolean>(DEFAULT_APP_SETTINGS.enablePresetTimer);             // NEW
    public presetTimerDurationSeconds = signal<number>(DEFAULT_APP_SETTINGS.presetTimerDurationSeconds); // NEW
    menuMode = signal<MenuMode>('modal'); // Default to 'modal' mode


    constructor() {
        const storedSettings = this.storageService.getItem<AppSettings>(this.APP_SETTINGS_KEY);
        const initialSettings = { ...DEFAULT_APP_SETTINGS, ...storedSettings };
        this.appSettingsSubject = new BehaviorSubject<AppSettings>(initialSettings);
        this.appSettings$ = this.appSettingsSubject.asObservable();

        this.enableTimerCountdownSound.set(initialSettings.enableTimerCountdownSound);
        this.countdownSoundSeconds.set(initialSettings.countdownSoundSeconds);
        this.enablePresetTimer.set(initialSettings.enablePresetTimer);                 // NEW
        this.presetTimerDurationSeconds.set(initialSettings.presetTimerDurationSeconds); // NEW

        const storedMenuMode = this.storageService.getItem<MenuMode>(this.MENU_MODE_KEY);
        this.menuMode.set(storedMenuMode || 'modal'); // Set initial mode, default to 'modal'

        // Effect to apply changes to the DOM when signals change
        effect(() => {
            if (isPlatformBrowser(this.platformId)) {
                // Menu mode effect
                const mode = this.menuMode();
                document.documentElement.classList.remove('modal', 'compact', 'modal');
                document.documentElement.classList.add(`menu-${mode}`);
                this.storageService.setItem(this.MENU_MODE_KEY, mode);
            }
        });
    }

    getSettings(): AppSettings {
        return this.appSettingsSubject.getValue();
    }

    saveSettings(settings: Partial<AppSettings>): void {
        const currentSettings = this.getSettings();
        const updatedSettings = { ...currentSettings, ...settings };
        this.storageService.setItem(this.APP_SETTINGS_KEY, updatedSettings);
        this.appSettingsSubject.next(updatedSettings);

        // Update individual signals
        if (settings.playerMode !== undefined) this.enableCompactModeSignal.set(settings.playerMode);
        if (settings.menuMode !== undefined) this.menuMode.set(settings.menuMode);
        if (settings.enableTimerCountdownSound !== undefined) this.enableTimerCountdownSound.set(settings.enableTimerCountdownSound);
        if (settings.countdownSoundSeconds !== undefined) this.countdownSoundSeconds.set(settings.countdownSoundSeconds);
        if (settings.enablePresetTimer !== undefined) this.enablePresetTimer.set(settings.enablePresetTimer);             // NEW
        if (settings.presetTimerDurationSeconds !== undefined) this.presetTimerDurationSeconds.set(settings.presetTimerDurationSeconds); // NEW
    }

    // Example of updating a specific setting directly via signal and saving
    setEnableTimerCountdownSound(enabled: boolean): void {
        this.saveSettings({ enableTimerCountdownSound: enabled });
    }

    setCountdownSoundSeconds(seconds: number): void {
        this.saveSettings({ countdownSoundSeconds: seconds });
    }


    // Method to get settings data for backup (used by ProfileSettingsComponent)
    public getDataForBackup(): AppSettings {
        return this.getSettings();
    }

    // Method to replace settings data from backup
    public replaceData(newSettings: AppSettings | null): void { /* ... as before, ensure new fields are handled ... */
        const settingsToSave = newSettings ? { ...DEFAULT_APP_SETTINGS, ...newSettings } : { ...DEFAULT_APP_SETTINGS };
        this.storageService.setItem(this.APP_SETTINGS_KEY, settingsToSave);
        this.appSettingsSubject.next(settingsToSave);
        this.enableTimerCountdownSound.set(settingsToSave.enableTimerCountdownSound);
        this.countdownSoundSeconds.set(settingsToSave.countdownSoundSeconds);
        this.enablePresetTimer.set(settingsToSave.enablePresetTimer);
        this.presetTimerDurationSeconds.set(settingsToSave.presetTimerDurationSeconds);
        this.menuMode.set(settingsToSave.menuMode);
    }

    // Method to clear app settings (used by ProfileSettingsComponent)
    public clearAppSettings_DEV_ONLY(): void {
        this.replaceData(null); // Resets to default
        console.log('App settings reset to defaults.');
    }

    setEnablePresetTimer(enabled: boolean): void {
        this.saveSettings({ enablePresetTimer: enabled });
    }
    setPresetTimerDurationSeconds(seconds: number): void {
        this.saveSettings({ presetTimerDurationSeconds: seconds });
    }

    /**
 * Sets the menu mode to a specific value.
 * This replaces the old binary toggle.
 * @param mode The menu mode to activate.
 */
    setMenuMode(mode: MenuMode): void {
        this.menuMode.set(mode);
    }

    isMenuModeCompact(): boolean {
        return this.menuMode() && this.menuMode() === 'compact';
    }

    isMenuModeModal(): boolean {
        return this.menuMode() && this.menuMode() === 'modal';
    }

    isMenuModeDropdown(): boolean {
        return this.menuMode() && this.menuMode() === 'dropdown';
    }
}