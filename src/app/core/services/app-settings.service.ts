// src/app/core/services/app-settings.service.ts
import { Injectable, inject, signal, WritableSignal, effect, PLATFORM_ID } from '@angular/core';
import { StorageService } from './storage.service';
import { AppSettings, MenuMode, PlayerMode, RestTimerMode, SummaryDisplayMode } from '../models/app-settings.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

const DEFAULT_APP_SETTINGS: AppSettings = {
    enableTimerCountdownSound: true,
    enableProgressiveOverload: false,
    countdownSoundSeconds: 5,
    enablePresetTimer: false,
    presetTimerDurationSeconds: 10,
    weightStep: 1,
    playerMode: 'compact' as PlayerMode,
    menuMode: 'modal' as MenuMode,
    enableTrueGymMode: true,
    showMetricTarget: false,
    durationStep: 5,
    distanceStep: 0.1,
    restStep: 5,
    restTimerMode: 'fullscreen' as RestTimerMode,
    summaryDisplayMode: 'icons' as SummaryDisplayMode,
};

// 1. Define a type for the three menu modes for type safety.

@Injectable({
    providedIn: 'root'
})
export class AppSettingsService {

    private storageService = inject(StorageService);
    private platformId = inject(PLATFORM_ID);

    private readonly APP_SETTINGS_KEY = 'fitTrackPro_appSettings';
    private readonly MENU_MODE_KEY = 'fitTrackPro_menuMode';


    private appSettingsSubject: BehaviorSubject<AppSettings>;
    public appSettings$: Observable<AppSettings>;

    // Individual signals
    public playerModeSignal = signal<PlayerMode>(DEFAULT_APP_SETTINGS.playerMode);
    public enableTimerCountdownSound = signal<boolean>(DEFAULT_APP_SETTINGS.enableTimerCountdownSound);
    public countdownSoundSeconds = signal<number>(DEFAULT_APP_SETTINGS.countdownSoundSeconds);
    public enablePresetTimer = signal<boolean>(DEFAULT_APP_SETTINGS.enablePresetTimer);
    public presetTimerDurationSeconds = signal<number>(DEFAULT_APP_SETTINGS.presetTimerDurationSeconds);
    public menuMode = signal<MenuMode>(DEFAULT_APP_SETTINGS.menuMode);
    public enableTrueGymMode = signal<boolean>(DEFAULT_APP_SETTINGS.enableTrueGymMode);
    public showMetricTarget = signal<boolean>(DEFAULT_APP_SETTINGS.showMetricTarget);
    public durationStep = signal<number>(DEFAULT_APP_SETTINGS.durationStep);
    public distanceStep = signal<number>(DEFAULT_APP_SETTINGS.distanceStep);
    public restStep = signal<number>(DEFAULT_APP_SETTINGS.restStep);
    public restTimerMode = signal<RestTimerMode>(DEFAULT_APP_SETTINGS.restTimerMode!);
    public summaryDisplayMode = signal<SummaryDisplayMode>(DEFAULT_APP_SETTINGS.summaryDisplayMode!);

    constructor() {
        const storedSettings = this.storageService.getItem<AppSettings>(this.APP_SETTINGS_KEY);
        const initialSettings = { ...DEFAULT_APP_SETTINGS, ...storedSettings };
        this.appSettingsSubject = new BehaviorSubject<AppSettings>(initialSettings);
        this.appSettings$ = this.appSettingsSubject.asObservable();

        // Update all signals from initial settings
        this.playerModeSignal.set(initialSettings.playerMode);
        this.enableTimerCountdownSound.set(initialSettings.enableTimerCountdownSound);
        this.countdownSoundSeconds.set(initialSettings.countdownSoundSeconds);
        this.enablePresetTimer.set(initialSettings.enablePresetTimer);
        this.presetTimerDurationSeconds.set(initialSettings.presetTimerDurationSeconds);
        this.enableTrueGymMode.set(initialSettings.enableTrueGymMode);
        this.durationStep.set(initialSettings.durationStep);
        this.distanceStep.set(initialSettings.distanceStep);
        this.restStep.set(initialSettings.restStep);
        const storedMenuMode = this.storageService.getItem<MenuMode>(this.MENU_MODE_KEY);
        this.menuMode.set(storedMenuMode || 'dropdown');

        this.restTimerMode.set(initialSettings.restTimerMode || RestTimerMode.Fullscreen);
        this.summaryDisplayMode.set(initialSettings.summaryDisplayMode || SummaryDisplayMode.Icons);

        effect(() => {
            if (isPlatformBrowser(this.platformId)) {
                const mode = this.menuMode();
                document.documentElement.classList.remove('dropdown', 'compact', 'modal');
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
        if (settings.playerMode !== undefined) this.playerModeSignal.set(settings.playerMode);
        if (settings.menuMode !== undefined) this.menuMode.set(settings.menuMode);
        if (settings.enableTimerCountdownSound !== undefined) this.enableTimerCountdownSound.set(settings.enableTimerCountdownSound);
        if (settings.countdownSoundSeconds !== undefined) this.countdownSoundSeconds.set(settings.countdownSoundSeconds);
        if (settings.enablePresetTimer !== undefined) this.enablePresetTimer.set(settings.enablePresetTimer);
        if (settings.presetTimerDurationSeconds !== undefined) this.presetTimerDurationSeconds.set(settings.presetTimerDurationSeconds);
        if (settings.enableTrueGymMode !== undefined) this.enableTrueGymMode.set(settings.enableTrueGymMode);
        if (settings.showMetricTarget !== undefined) this.showMetricTarget.set(settings.showMetricTarget);
        if (settings.durationStep !== undefined) this.durationStep.set(settings.durationStep);
        if (settings.distanceStep !== undefined) this.distanceStep.set(settings.distanceStep);
        if (settings.restStep !== undefined) this.restStep.set(settings.restStep);
        if (settings.restTimerMode !== undefined) this.restTimerMode.set(settings.restTimerMode);
        if (settings.summaryDisplayMode !== undefined) this.summaryDisplayMode.set(settings.summaryDisplayMode);
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
        this.enableTrueGymMode.set(settingsToSave.enableTrueGymMode);
        this.durationStep.set(settingsToSave.durationStep);
        this.distanceStep.set(settingsToSave.distanceStep);
        this.restStep.set(settingsToSave.restStep);
        this.restTimerMode.set(settingsToSave.restTimerMode || RestTimerMode.Fullscreen);
        this.summaryDisplayMode.set(settingsToSave.summaryDisplayMode || SummaryDisplayMode.Icons);
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

    getMenuMode(): MenuMode {
        return this.menuMode();
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

    isPlayerCompactMode(): boolean {
        return this.playerModeSignal() && this.playerModeSignal() === 'compact';
    }

    isPlayerFocusMode(): boolean {
        return this.playerModeSignal() && this.playerModeSignal() === 'focus';
    }

    isTrueGymMode(): boolean {
        return this.enableTrueGymMode() && this.enableTrueGymMode() === true;
    }

    isShowMetricTarget(): boolean {
        return this.showMetricTarget() && this.showMetricTarget() === true;
    }

    setRestTimerMode(mode: RestTimerMode) {
        this.saveSettings({ restTimerMode: mode });
    }
    getRestTimerMode(): RestTimerMode {
        return this.restTimerMode();
    }

    setSummaryDisplayMode(mode: SummaryDisplayMode) {
        this.saveSettings({ summaryDisplayMode: mode });
    }
    getSummaryDisplayMode(): SummaryDisplayMode {
        return this.summaryDisplayMode();
    }
}