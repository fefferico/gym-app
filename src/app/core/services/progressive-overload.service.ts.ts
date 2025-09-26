
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
import { WorkoutExercise } from '../models/workout.model';

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
    const storedSettings = this.storageService.getItem<ProgressiveOverloadSettings>(this.SETTINGS_KEY);
    this.settingsSubject = new BehaviorSubject<ProgressiveOverloadSettings>(storedSettings || this.defaultSettings);
    this.settings$ = this.settingsSubject.asObservable();
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


  /**
   * Applies the progressive overload increments to a given exercise's sets.
   * This method mutates the exercise object passed to it.
   * @param exercise The WorkoutExercise to modify.
   * @param settings The progressive overload settings to apply.
   */
  applyOverloadToExercise(exercise: WorkoutExercise, settings: ProgressiveOverloadSettings): void {
    if (!settings.enabled || !settings.strategy) return;

    exercise.sets.forEach(set => {
      // Do not apply overload to warm-up sets
      if (set.type === 'warmup') return;

      if (settings.strategy === ProgressiveOverloadStrategy.WEIGHT && settings.weightIncrement) {
        set.targetWeight = (set.targetWeight ?? 0) + settings.weightIncrement;
      } else if (settings.strategy === ProgressiveOverloadStrategy.REPS && settings.repsIncrement) {
        set.targetReps = (set.targetReps ?? 0) + settings.repsIncrement;
      }
    });
  }
}