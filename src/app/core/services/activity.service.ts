// src/app/core/services/activity.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { Activity } from '../models/activity.model';
import { ActivityLog } from '../models/activity-log.model';
import { ACTIVITIES_DATA } from './activities-data';

@Injectable({
  providedIn: 'root'
})
export class ActivityService {
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);

  private readonly ACTIVITIES_LOGS_STORAGE_KEY = 'fitTrackPro_activityLogs';

  // --- Activity Log Management ---
  private activityLogsSubject = new BehaviorSubject<ActivityLog[]>(this._loadLogsFromStorage());
  public activityLogs$: Observable<ActivityLog[]> = this.activityLogsSubject.asObservable();

  constructor() { }

  /**
   * Loads saved activity logs from local storage.
   */
  private _loadLogsFromStorage(): ActivityLog[] {
    const logs = this.storageService.getItem<ActivityLog[]>(this.ACTIVITIES_LOGS_STORAGE_KEY);
    // Sort logs by start time, newest first, for consistent display.
    return logs ? logs.sort((a, b) => b.startTime - a.startTime) : [];
  }

  /**
   * Saves the complete list of activity logs to local storage.
   */
  private _saveLogsToStorage(logs: ActivityLog[]): void {
    this.storageService.setItem(this.ACTIVITIES_LOGS_STORAGE_KEY, logs);
    this.activityLogsSubject.next([...logs].sort((a, b) => b.startTime - a.startTime));
  }

  /**
   * Adds a new activity log to storage.
   * @param logData The data for the new log, without an ID.
   * @returns The newly created ActivityLog with its generated ID.
   */
  public addActivityLog(logData: Omit<ActivityLog, 'id'>): ActivityLog {
    const newLog: ActivityLog = {
      ...logData,
      id: uuidv4(),
    };

    const currentLogs = this.activityLogsSubject.getValue();
    const updatedLogs = [newLog, ...currentLogs];
    this._saveLogsToStorage(updatedLogs);

    this.toastService.success(`Logged "${newLog.activityName}" successfully!`, 3000, "Activity Logged");
    return newLog;
  }

  /**
   * Retrieves all logs for a specific date.
   * @param date The date in 'YYYY-MM-DD' format.
   * @returns An Observable emitting an array of ActivityLogs for that day.
   */
  public getLogsForDate(date: string): Observable<ActivityLog[]> {
    return this.activityLogs$.pipe(
      map(logs => logs.filter(log => log.date === date))
    );
  }

  // --- Static Activity Data Management ---

  /**
   * Returns the master list of all available activities.
   * @returns An Observable emitting the full array of Activity objects.
   */
  public getActivities(): Observable<Activity[]> {
    // Sorting alphabetically for display in lists
    return of([...ACTIVITIES_DATA].sort((a, b) => a.name.localeCompare(b.name)));
  }

  /**
   * Finds a single activity by its unique ID.
   * @param id The ID of the activity (e.g., 'football').
   * @returns The Activity object or undefined if not found.
   */
  public getActivityById(id: string): Activity | undefined {
    return ACTIVITIES_DATA.find(activity => activity.id === id);
  }

  /**
   * Retrieves a single activity log by its unique ID.
   * @param logId The ID of the log to retrieve.
   */
  public getActivityLogById(logId: string): Observable<ActivityLog | undefined> {
    return this.activityLogs$.pipe(
      map(logs => logs.find(log => log.id === logId))
    );
  }

  /**
   * Deletes a single activity log from storage.
   * @param logId The ID of the log to delete.
   */
  public deleteActivityLog(logId: string): void {
    const currentLogs = this.activityLogsSubject.getValue();
    const updatedLogs = currentLogs.filter(log => log.id !== logId);
    this._saveLogsToStorage(updatedLogs);
    this.toastService.info('Activity log deleted.', 3000, 'Deleted');
  }

  /**
   * Updates an existing activity log.
   * @param updatedLog The complete, updated log object.
   */
  public updateActivityLog(updatedLog: ActivityLog): void {
    const currentLogs = this.activityLogsSubject.getValue();
    const index = currentLogs.findIndex(log => log.id === updatedLog.id);
    if (index > -1) {
      const updatedLogsArray = [...currentLogs];
      updatedLogsArray[index] = updatedLog;
      this._saveLogsToStorage(updatedLogsArray);
      this.toastService.success(`Updated "${updatedLog.activityName}" successfully!`, 3000, "Activity Updated");
    }
  }

}