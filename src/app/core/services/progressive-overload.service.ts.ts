
export enum ProgressiveOverloadStrategy {
  WEIGHT = 'weight',
  REPS = 'reps',
}

export interface ProgressiveOverloadSettings {
  enabled: boolean;
  strategy: ProgressiveOverloadStrategy | null;
  weightIncrement: number | null;
  repsIncrement: number | null;
  sessionsToIncrement: number | null;
}

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class ProgressiveOverloadService {
  private storageService = inject(StorageService);
  private readonly SETTINGS_KEY = 'fitTrackPro_progressiveOverloadSettings';

  private defaultSettings: ProgressiveOverloadSettings = {
    enabled: false,
    strategy: null,
    weightIncrement: null,
    repsIncrement: null,
    sessionsToIncrement: 1,
  };

  private settingsSubject: BehaviorSubject<ProgressiveOverloadSettings>;
  public settings$: Observable<ProgressiveOverloadSettings>;

  constructor() {
    // 1. Initialize with default settings immediately. This ensures the app always has a valid state.
    this.settingsSubject = new BehaviorSubject<ProgressiveOverloadSettings>(this.defaultSettings);
    this.settings$ = this.settingsSubject.asObservable();

    // 2. Call the new async method to load saved settings from storage.
    this._initializeSettings();
  }

  /**
 * Asynchronously loads progressive overload settings from storage and updates the BehaviorSubject.
 */
  private async _initializeSettings(): Promise<void> {
    // 'await' pauses here until the settings are loaded from IndexedDB.
    const storedSettings = await this.storageService.getItem<ProgressiveOverloadSettings>(this.SETTINGS_KEY);

    // If we found settings in storage, update the subject with them.
    // Otherwise, it will just keep the default settings from the constructor.
    if (storedSettings) {
      this.settingsSubject.next(storedSettings);
    }
  }

  /**
   * Gets the current progressive overload settings from the BehaviorSubject.
   */
  getSettings(): ProgressiveOverloadSettings {
    return this.settingsSubject.getValue();
  }

  /**
   * Saves the provided settings to local storage and updates the BehaviorSubject.
   * @param settings A partial object of the settings to update.
   */
  saveSettings(settings: Partial<ProgressiveOverloadSettings>): void {
    const currentSettings = this.getSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    this.storageService.setItem(this.SETTINGS_KEY, updatedSettings);
    this.settingsSubject.next(updatedSettings);
  }

  /**
   * Returns the settings data for backup purposes.
   */
  getDataForBackup(): ProgressiveOverloadSettings {
    return this.getSettings();
  }

  /**
   * Replaces the current settings with new data, typically from a backup.
   * @param newSettings The new settings object to apply.
   */
  replaceData(newSettings: ProgressiveOverloadSettings | null): void {
    const settingsToSet = newSettings || this.defaultSettings;
    this.storageService.setItem(this.SETTINGS_KEY, settingsToSet);
    this.settingsSubject.next(settingsToSet);
  }

  /**
   * Clears all progressive overload settings from storage (for development/testing).
   */
  clearSettings_DEV_ONLY(): void {
    this.replaceData(null);
    console.log('Progressive Overload settings cleared.');
  }
}