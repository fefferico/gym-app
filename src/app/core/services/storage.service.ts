import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { openDB, IDBPDatabase } from 'idb';
import { AlertService } from './alert.service';

const DB_NAME = 'FitTrackPro-Data';
const STORE_NAME = 'keyval-store';
const DB_VERSION = 1;

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private isBrowser: boolean;
  private dbPromise: Promise<IDBPDatabase<any>>;

  // The version is part of the service's code, not stored data.
  private version = '1.0.3'; 

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private alertService: AlertService // Keep using DI for AlertService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (!this.isBrowser) {
      console.warn('StorageService: IndexedDB is not available in this environment.');
      // Create a dummy promise to prevent errors in non-browser environments
      this.dbPromise = new Promise(() => {}); 
    } else {
      // Initialize the database connection when the service is created.
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Create an object store to function as a key-value pair store.
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        },
      });
    }
  }

  /**
   * Saves an item to IndexedDB.
   * @param key The key under which to store the value.
   * @param value The value to store.
   */
  async setItem<T>(key: string, value: T): Promise<void> {
    if (!this.isBrowser) return;
    try {
      const db = await this.dbPromise;
      await db.put(STORE_NAME, value, key);
    } catch (e) {
      console.error(`Error saving item "${key}" to IndexedDB:`, e);
    }
  }

  /**
   * Retrieves an item from IndexedDB.
   * @param key The key of the item to retrieve.
   * @returns A Promise resolving to the item, or null if not found.
   */
  async getItem<T>(key: string): Promise<T | null> {
    if (!this.isBrowser) return null;
    try {
      const db = await this.dbPromise;
      const value = await db.get(STORE_NAME, key);
      // idb returns undefined for non-existent keys
      return value !== undefined ? (value as T) : null;
    } catch (e) {
      console.error(`Error getting item "${key}" from IndexedDB:`, e);
      return null;
    }
  }

  /**
   * Removes an item from IndexedDB.
   * @param key The key of the item to remove.
   */
  async removeItem(key: string): Promise<void> {
    if (!this.isBrowser) return;
    try {
      const db = await this.dbPromise;
      await db.delete(STORE_NAME, key);
    } catch (e) {
      console.error(`Error removing item "${key}" from IndexedDB:`, e);
    }
  }

  /**
   * Clears specified items from IndexedDB.
   * @param knownKeys An array of keys to remove.
   */
  async clearAllApplicationData(knownKeys: string[]): Promise<void> {
    if (!this.isBrowser) return;
    console.warn('Clearing specified application data from IndexedDB for keys:', knownKeys);
    try {
        const db = await this.dbPromise;
        // Use a transaction for efficiency when deleting multiple items
        const tx = db.transaction(STORE_NAME, 'readwrite');
        await Promise.all(knownKeys.map(key => tx.store.delete(key)));
        await tx.done;
    } catch(e) {
        console.error('Error clearing application data from IndexedDB:', e);
    }
  }

  /**
   * Clears all items from the application's object store in IndexedDB.
   */
  async clearEntireLocalStorage_USE_WITH_CAUTION(): Promise<void> {
    if (!this.isBrowser) return;

    const result = await this.alertService.showConfirmationDialog(
      'WARNING',
      'This will clear ALL locally stored application data. Are you sure you want to proceed?',
      [
          { text: 'Cancel', role: 'cancel', data: false },
          { text: 'Clear Data', role: 'confirm', data: true, cssClass: 'bg-red-600' }
      ]
    );

    if (result && result.data) {
      try {
        const db = await this.dbPromise;
        await db.clear(STORE_NAME);
        console.log('Application IndexedDB store has been cleared.');
      } catch (e) {
        console.error('Error clearing IndexedDB store:', e);
      }
    }
  }

  getVersion(): string {
    return this.version;
  }
}