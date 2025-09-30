
export enum ProgressiveOverloadStrategy {
  WEIGHT = 'weight',
  REPS = 'reps',
  DISTANCE = 'distance',
  DURATION = 'duration',
}

export interface ProgressiveOverloadSettings {
  enabled: boolean;
  strategies: ProgressiveOverloadStrategy[];
  weightIncrement: number | null;
  repsIncrement: number | null;
  distanceIncrement: number | null;
  durationIncrement: number | null;
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
    strategies: [],
    weightIncrement: null,
    repsIncrement: null,
    distanceIncrement: null,
    durationIncrement: null,
    sessionsToIncrement: 1,
  };

  private settingsSubject: BehaviorSubject<ProgressiveOverloadSettings>;
  public settings$: Observable<ProgressiveOverloadSettings>;

  constructor() {
    const storedSettings = this.storageService.getItem<ProgressiveOverloadSettings>(this.SETTINGS_KEY);
    // Ensure that if old settings are loaded, `strategies` is an array and new fields exist
    const initialSettings = storedSettings ?
      {
        ...this.defaultSettings, // Start with defaults to ensure all fields are present
        ...storedSettings,
        strategies: storedSettings.strategies || [] // Ensure strategies is an array
      } : this.defaultSettings;

    this.settingsSubject = new BehaviorSubject<ProgressiveOverloadSettings>(initialSettings);
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
    // Ensure newSettings has all properties, using default values if missing
    const settingsToSet: ProgressiveOverloadSettings = newSettings ?
      {
        ...this.defaultSettings,
        ...newSettings,
        strategies: newSettings.strategies || [] // Ensure strategies is an array on import
      } : this.defaultSettings;

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
    if (!settings.enabled || !settings.strategies || settings.strategies.length === 0) return;

    exercise.sets.forEach(set => {
      // Do not apply overload to warm-up sets
      if (set.type === 'warmup') return;

      // MODIFIED: Iterate through all selected strategies
      settings.strategies.forEach(strategy => {
        switch (strategy) {
          case ProgressiveOverloadStrategy.WEIGHT:
            if (settings.weightIncrement) {
              const originalSetWeight = set.targetWeight;
              set.targetWeight = (originalSetWeight ?? 0) + settings.weightIncrement;
              if (set.targetWeightMin) {
                set.targetWeightMin = (set.targetWeightMin ?? originalSetWeight ?? 0) + settings.weightIncrement;
                if (set.targetWeightMax && set.targetWeightMin > set.targetWeightMax){
                  set.targetWeightMax = set.targetWeightMin + settings.weightIncrement;
                }
              }
            }
            break;
          case ProgressiveOverloadStrategy.REPS:
            if (settings.repsIncrement) {
              const originalSetReps = set.targetReps;
              set.targetReps = (originalSetReps ?? 0) + settings.repsIncrement;
              if (set.targetRepsMin) {
                set.targetRepsMin = (set.targetRepsMin ?? originalSetReps ?? 0) + settings.repsIncrement;
                if (set.targetRepsMax && set.targetRepsMin > set.targetRepsMax){
                  set.targetRepsMax = set.targetRepsMin + settings.repsIncrement;
                }
              }
            }
            break;
          // +++ NEW: Apply distance increment
          case ProgressiveOverloadStrategy.DISTANCE:
            if (settings.distanceIncrement) {
              const originalSetDistance = set.targetDistance;
              set.targetDistance = (originalSetDistance ?? 0) + settings.distanceIncrement;
              if (set.targetDistanceMin) {
                set.targetDistanceMin = (set.targetDistanceMin ?? originalSetDistance ?? 0) + settings.distanceIncrement;
                if (set.targetDistanceMax && set.targetDistanceMin > set.targetDistanceMax){
                  set.targetDistanceMax = set.targetDistanceMin + settings.distanceIncrement;
                }
              }
            }
            break;
          // +++ NEW: Apply duration increment
          case ProgressiveOverloadStrategy.DURATION:
            if (settings.durationIncrement) {
              // Assuming duration is stored in `set.durationSeconds`
              const originalSetDuration = set.targetDuration;
              set.targetDuration = (originalSetDuration ?? 0) + settings.durationIncrement;
              if (set.targetDurationMin) {
                set.targetDurationMin = (set.targetDurationMin ?? originalSetDuration ?? 0) + settings.durationIncrement;
                if (set.targetDurationMax && set.targetDurationMin > set.targetDurationMax){
                  set.targetDurationMax = set.targetDurationMin + settings.durationIncrement;
                }
              }
            }
            break;
          default:
            break;
        }
      });
    });
  }
}