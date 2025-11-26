// src/app/features/activities/activity-log-details/activity-log-details.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap, tap } from 'rxjs/operators';

import { ActivityLog } from '../../../core/models/activity-log.model';
import { Activity } from '../../../core/models/activity.model';
import { ActivityService } from '../../../core/services/activity.service';
import { AlertService } from '../../../core/services/alert.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AlertButton } from '../../../core/models/alert.model';
// +++ ADD THESE IMPORTS +++
import { ActionMenuComponent } from '../../../shared/components/action-menu/action-menu';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LocationService } from '../../../core/services/location.service';


@Component({
  selector: 'app-activity-log-details',
  standalone: true,
  imports: [CommonModule, DatePipe, IconComponent, ActionMenuComponent, TranslateModule],
  templateUrl: './activity-log-details.component.html',
  styles: [`:host { display: block; }`]
})
export class ActivityLogDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private activityService = inject(ActivityService);
  private alertService = inject(AlertService);
  private translate = inject(TranslateService);
  private locationService = inject(LocationService);

  activityLog = signal<ActivityLog | null>(null);
  baseActivity = signal<Activity | null>(null);

  // +++ ADD STATE FOR ACTION MENU +++
  activeLogIdActions = signal<string | null>(null);

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap(params => {
        const logId = params.get('id');
        if (!logId) return [null];
        return this.activityService.getActivityLogById(logId);
      }),
      tap(log => {
        if (log) {
          this.activityLog.set(log);
          const base = this.activityService.getActivityById(log.activityId);
          if (base) this.baseActivity.set(base);
        } else {
          // Handle case where log is not found
          this.activityLog.set(null);
          this.baseActivity.set(null);
        }
      })
    ).subscribe();
  }

  // --- This method remains the same ---
  goBack(): void {
    this.router.navigate(['/history']);
  }

  // --- This method will now be called by the action menu handler ---
  editLog(logId: string): void {
    this.router.navigate(['/activities/log/edit', logId]);
  }

  // --- This method will now be called by the action menu handler ---
  async deleteLog(log: ActivityLog): Promise<void> {
    const confirm = await this.alertService.showConfirmationDialog(
      this.translate.instant('activityLogDetails.alerts.deleteTitle'),
      this.translate.instant('activityLogDetails.alerts.deleteMessage', { name: log.activityName }),
      [
        { text: this.translate.instant('activityLogDetails.alerts.cancel'), role: 'cancel', data: false },
        { text: this.translate.instant('activityLogDetails.alerts.deleteButton'), role: 'confirm', data: true, cssClass: 'bg-red-500' }
      ] as AlertButton[]
    );

    if (confirm && confirm.data) {
      this.activityService.deleteActivityLog(log.id);
      this.router.navigate(['/history']);
    }
  }

  // +++ ADD ACTION MENU LOGIC +++
  toggleActions(logId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeLogIdActions.update(current => (current === logId ? null : logId));
  }

  areActionsVisible(logId: string): boolean {
    return this.activeLogIdActions() === logId;
  }

  onCloseActionMenu() {
    this.activeLogIdActions.set(null);
  }

  getLogDropdownActionItems(log: ActivityLog): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100';
    const deleteBtnClass = 'rounded text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-white';

    return [
      {
        label: this.translate.instant('activityLogDetails.actions.edit'),
        actionKey: 'edit',
        iconSvg: 'asdasd',
        iconName: 'edit',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: 'w-full ' + defaultBtnClass,
        data: { log }
      },
      { isDivider: true },
      {
        label: this.translate.instant('activityLogDetails.actions.delete'),
        actionKey: 'delete',
        iconName: 'trash',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: 'w-full ' + deleteBtnClass,
        data: { log }
      }
    ];
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }): void {
    const log = event.data?.log as ActivityLog;
    if (!log) return;

    switch (event.actionKey) {
      case 'edit':
        this.editLog(log.id);
        break;
      case 'delete':
        this.deleteLog(log);
        break;
    }
    this.activeLogIdActions.set(null); // Close the menu
  }

  getActivityLocations(): string[] {
    return this.activityService.getActivityLocations();
  }

  getLocationById(locationId: string): string {
    return this.locationService.getHydratedLocationByLocationId(locationId);
  }
}