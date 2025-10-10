import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AlertService } from './alert.service';
import { PausedWorkoutState } from '../models/workout.model';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private isBrowser: boolean;
  private alertService = inject(AlertService);
  private translate = inject(TranslateService);

  private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';
  private readonly PAUSED_STATE_VERSION = '1.2';
  private version = '1.1.1'; // Version of the storage service

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (!this.isBrowser) {
      console.warn('StorageService: localStorage is not available in this environment. Operations will be no-op.');
    }
  }

  setItem<T>(key: string, value: T): void {
    if (this.isBrowser) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error(`Error saving item "${key}" to localStorage:`, e);
      }
    }
  }

  getItem<T>(key: string): T | null {
    if (this.isBrowser) {
      try {
        const item = localStorage.getItem(key);
        return item ? (JSON.parse(item) as T) : null;
      } catch (e) {
        console.error(`Error getting item "${key}" from localStorage:`, e);
        return null;
      }
    }
    return null;
  }

  removeItem(key: string): void {
    if (this.isBrowser) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error(`Error removing item "${key}" from localStorage:`, e);
      }
    }
  }

  clearAllApplicationData(knownKeys: string[]): void {
    if (this.isBrowser) {
      console.warn('Clearing specified application data from localStorage for keys:', knownKeys);
      knownKeys.forEach(key => this.removeItem(key));
    }
  }

  clearEntireLocalStorage_USE_WITH_CAUTION(): void {
    if (this.isBrowser) {
      const title = this.translate.instant('storageService.clearAllWarning.title');
      const message = this.translate.instant('storageService.clearAllWarning.message');
      this.alertService.showConfirm(title, message).then((result) => {
        if (result && (result.data)) {
          try {
            localStorage.clear();
            console.log('Entire localStorage has been cleared.');
          } catch (e) {
            console.error('Error clearing entire localStorage:', e);
          }
        }
      });
    }
  }

  getVersion(): string {
    return this.version;
  }

  checkForPausedWorkout(): boolean {
    const pausedState = this.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);
    return pausedState !== null && pausedState.version !== null && pausedState.version === this.PAUSED_STATE_VERSION;
  }

  removePausedWorkout(): void {
    if (this.checkForPausedWorkout()) {
      this.removeItem(this.PAUSED_WORKOUT_KEY);
    }
  }
}