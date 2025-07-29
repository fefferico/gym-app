// src/app/core/services/app-settings.service.ts
import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { StorageService } from './storage.service';
import { AppSettings } from '../models/app-settings.model';
import { BehaviorSubject, Observable } from 'rxjs';

const DEFAULT_APP_SETTINGS: AppSettings = {
    enableTimerCountdownSound: true,
    countdownSoundSeconds: 5,
    enablePresetTimer: false,        // NEW Default
    presetTimerDurationSeconds: 10,  // NEW Default (e.g., 10 seconds)
    weightStep: 1
};

@Injectable({
    providedIn: 'root'
})
export class AppSettingsService {
    private storageService = inject(StorageService);
    private readonly APP_SETTINGS_KEY = 'fitTrackPro_appSettings';

    private appSettingsSubject: BehaviorSubject<AppSettings>;
    public appSettings$: Observable<AppSettings>;

    // Individual signals
    public enableTimerCountdownSound = signal<boolean>(DEFAULT_APP_SETTINGS.enableTimerCountdownSound);
    public countdownSoundSeconds = signal<number>(DEFAULT_APP_SETTINGS.countdownSoundSeconds);
    public enablePresetTimer = signal<boolean>(DEFAULT_APP_SETTINGS.enablePresetTimer);             // NEW
    public presetTimerDurationSeconds = signal<number>(DEFAULT_APP_SETTINGS.presetTimerDurationSeconds); // NEW


    constructor() {
        const storedSettings = this.storageService.getItem<AppSettings>(this.APP_SETTINGS_KEY);
        const initialSettings = { ...DEFAULT_APP_SETTINGS, ...storedSettings };
        this.appSettingsSubject = new BehaviorSubject<AppSettings>(initialSettings);
        this.appSettings$ = this.appSettingsSubject.asObservable();

        this.enableTimerCountdownSound.set(initialSettings.enableTimerCountdownSound);
        this.countdownSoundSeconds.set(initialSettings.countdownSoundSeconds);
        this.enablePresetTimer.set(initialSettings.enablePresetTimer);                 // NEW
        this.presetTimerDurationSeconds.set(initialSettings.presetTimerDurationSeconds); // NEW
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
        this.enablePresetTimer.set(settingsToSave.enablePresetTimer);                 // NEW
        this.presetTimerDurationSeconds.set(settingsToSave.presetTimerDurationSeconds); // NEW
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
}