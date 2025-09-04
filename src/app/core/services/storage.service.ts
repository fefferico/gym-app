import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AlertService } from './alert.service';
import { PausedWorkoutState } from '../models/workout.model';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private isBrowser: boolean;
  private alertService = inject(AlertService);

  private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';
  private readonly PAUSED_STATE_VERSION = '1.2';
  private version = '1.1.1'; // Version of the storage service

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (!this.isBrowser) {
      console.warn('StorageService: localStorage is not available in this environment. Operations will be no-op.');
    }
  }

  /**
   * Saves an item to localStorage.
   * @param key The key under which to store the value.
   * @param value The value to store. Can be any JSON-serializable type.
   */
  setItem<T>(key: string, value: T): void {
    if (this.isBrowser) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error(`Error saving item "${key}" to localStorage:`, e);
        // Optionally, you could throw the error or handle it based on app requirements
        // For example, if localStorage is full (QuotaExceededError)
      }
    }
  }

  /**
   * Retrieves an item from localStorage.
   * @param key The key of the item to retrieve.
   * @returns The retrieved item, or null if the key is not found or an error occurs.
   */
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

  /**
   * Removes an item from localStorage.
   * @param key The key of the item to remove.
   */
  removeItem(key: string): void {
    if (this.isBrowser) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error(`Error removing item "${key}" from localStorage:`, e);
      }
    }
  }

  /**
   * Clears all items from localStorage managed by this application.
   * Be cautious with this method if other parts of the domain use localStorage.
   * A more targeted approach might be to remove specific known keys.
   */
  clearAllApplicationData(knownKeys: string[]): void {
    if (this.isBrowser) {
      console.warn('Clearing specified application data from localStorage for keys:', knownKeys);
      knownKeys.forEach(key => this.removeItem(key));
    }
  }

  /**
   * Clears all items from localStorage. USE WITH EXTREME CAUTION.
   * This will remove data for the entire domain, not just your app.
   */
  clearEntireLocalStorage_USE_WITH_CAUTION(): void {
    if (this.isBrowser) {
      this.alertService.showConfirm("WARNING", "This will clear ALL data in localStorage for this domain, potentially affecting other applications or settings. Are you sure you want to proceed?").then((result) => {
        if (result && (result.data)) {
          // --- Import Data ---
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