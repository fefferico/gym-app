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

@Component({
  selector: 'app-activity-log-details',
  standalone: true,
  // +++ ADD ActionMenuComponent TO IMPORTS +++
  imports: [CommonModule, DatePipe, IconComponent, ActionMenuComponent],
  templateUrl: './activity-log-details.component.html',
  styles: [`:host { display: block; }`]
})
export class ActivityLogDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private activityService = inject(ActivityService);
  private alertService = inject(AlertService);

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
      'Delete Activity Log?',
      `Are you sure you want to delete this log for "${log.activityName}"? This cannot be undone.`,
      [
        { text: 'Cancel', role: 'cancel', data: false },
        { text: 'Delete', role: 'confirm', data: true, cssClass: 'bg-red-500' }
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
        label: 'EDIT',
        actionKey: 'edit',
        iconSvg: 'asdasd',
        iconName: 'edit',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: 'w-full ' + defaultBtnClass,
        data: { log }
      },
      { isDivider: true },
      {
        label: 'DELETE',
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
}