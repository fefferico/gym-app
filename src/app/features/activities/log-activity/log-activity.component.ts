// src/app/features/activities/log-activity/log-activity.component.ts
import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { take } from 'rxjs/operators';

import { Activity } from '../../../core/models/activity.model';
import { ActivityService } from '../../../core/services/activity.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ActivityLog } from '../../../core/models/activity-log.model';
import { PremiumFeature, SubscriptionService } from '../../../core/services/subscription.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

export function timeOrderValidator(startTimeKey: string, endTimeKey: string): (group: AbstractControl) => ValidationErrors | null {
    return (group: AbstractControl): ValidationErrors | null => {
        const startTime = group.get(startTimeKey)?.value;
        const endTime = group.get(endTimeKey)?.value;
        if (startTime && endTime && startTime >= endTime) {
            return { timeInvalid: true };
        }
        return null;
    };
}

@Component({
    selector: 'app-log-activity',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, IconComponent, TranslateModule],
    templateUrl: './log-activity.component.html',
    styleUrls: ['./log-activity.component.scss']
})
export class LogActivityComponent implements OnInit {
    // --- Injected Services ---
    private fb = inject(FormBuilder);
    private activityService = inject(ActivityService);
    private toastService = inject(ToastService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    protected subscriptionService = inject(SubscriptionService);
    protected translate = inject(TranslateService);

    // --- Component State ---
    logActivityForm!: FormGroup;
    availableActivities$: Observable<Activity[]>;
    selectedActivity = signal<Activity | null>(null);
    isEditMode = signal(false);
    private editingLogId: string | null = null;

    constructor() {
        this.logActivityForm = this.fb.group({
            activityId: ['', [Validators.required]],
            date: [new Date().toISOString().split('T')[0], [Validators.required]],
            startTime: ['12:00', [Validators.required]],
            endTime: ['13:00', [Validators.required]],
            intensity: ['Medium', [Validators.required]],
            location: ['', []],
            distanceKm: [{ value: null, disabled: true }, [Validators.min(0)]],
            caloriesBurned: [{ value: null, disabled: true }, [Validators.min(0)]],
            notes: ['']
        }, { validators: timeOrderValidator('startTime', 'endTime') });

        this.availableActivities$ = this.activityService.getActivities();

        effect(() => {
            this.updateFormForSelectedActivity(this.selectedActivity());
        });
    }

    ngOnInit(): void {
        if (!this.subscriptionService.canAccess(PremiumFeature.ACTIVITY)) {
            this.subscriptionService.showUpgradeModal().then(() => {
                this.router.navigate(['profile']);
            });
        }

        this.route.paramMap.pipe(take(1)).subscribe(params => {
            const logId = params.get('id');
            if (logId) {
                this.isEditMode.set(true);
                this.editingLogId = logId;
                this.loadLogForEditing(logId);
            }
        });

        this.logActivityForm.get('activityId')?.valueChanges.subscribe(id => {
            this.activityService.getActivities().pipe(take(1)).subscribe(activities => {
                const activity = activities.find(a => a.id === id);
                this.selectedActivity.set(activity || null);
            });
        });
    }

    private loadLogForEditing(logId: string): void {
        // Use forkJoin to get both the log and the full activity list at the same time.
        forkJoin({
            log: this.activityService.getActivityLogById(logId).pipe(take(1)),
            activities: this.activityService.getActivities().pipe(take(1))
        }).subscribe(({ log, activities }) => {
            if (log && activities) {
                // 1. Find the full Activity object from the list.
                const loggedActivity = activities.find(activity => activity.id === log.activityId);

                // 2. Set the selectedActivity signal. This is the crucial step you discovered.
                if (loggedActivity) {
                    this.selectedActivity.set(loggedActivity);
                }

                // 3. Now, patch the form with all the data.
                const startDate = new Date(log.startTime);
                const endDate = log.endTime ? new Date(log.endTime) : new Date(log.startTime + log.durationMinutes * 60000);
                const formatTime = (date: Date) => date.toTimeString().substring(0, 5);

                this.logActivityForm.patchValue({
                    activityId: log.activityId,
                    date: log.date,
                    startTime: formatTime(startDate),
                    endTime: formatTime(endDate),
                    intensity: log.intensity,
                    location: log.location,
                    distanceKm: log.distanceKm,
                    caloriesBurned: log.caloriesBurned,
                    notes: log.notes
                });

                // The effect watching selectedActivity will run automatically
                // to enable/disable the correct fields. The updateValueAndValidity()
                // in that method will ensure the form state is correct.

            } else {
                this.toastService.error(this.translate.instant('logActivity.toasts.editError'), 0);
                this.router.navigate(['/history']);
            }
        });
    }

    /**
     * Dynamically enables/disables form controls based on the selected activity's
     * default tracking metrics.
     */
    private updateFormForSelectedActivity(activity: Activity | null): void {
        if (!activity) {
            // this.logActivityForm.get('location')?.disable();
            this.logActivityForm.get('distanceKm')?.disable();
            this.logActivityForm.get('caloriesBurned')?.disable();
            return;
        }
        this.logActivityForm.get('intensity')?.setValue(activity.intensity, { emitEvent: false });
        const metrics = activity.defaultTrackingMetrics;
        metrics.distance
            ? this.logActivityForm.get('distanceKm')?.enable()
            : this.logActivityForm.get('distanceKm')?.disable();
        metrics.calories
            ? this.logActivityForm.get('caloriesBurned')?.enable()
            : this.logActivityForm.get('caloriesBurned')?.disable();

        // +++ THE FIX: Manually trigger a validity update for the whole form. +++
        this.logActivityForm.updateValueAndValidity();
    }

    onSubmit(): void {
        if (this.logActivityForm.invalid) {
            this.toastService.error(this.translate.instant('logActivity.toasts.invalidForm'), 0, this.translate.instant('logActivity.toasts.invalidFormTitle'));
            Object.values(this.logActivityForm.controls).forEach(control => {
                control.markAsTouched();
            });
            return;
        }
        if (this.isEditMode()) {
            this.updateLog();
        } else {
            this.createLog();
        }
    }

    private createLog(): void {
        const newLog = this.prepareLogData();
        if (!newLog) return;

        this.activityService.addActivityLog(newLog);
        this.router.navigate(['/history']);
    }

    private updateLog(): void {
        if (!this.editingLogId) return;
        const newLogData = this.prepareLogData();
        if (!newLogData) return;

        const updatedLog: ActivityLog = { id: this.editingLogId, ...newLogData };
        this.activityService.updateActivityLog(updatedLog);
        this.router.navigate(['/activities/log', this.editingLogId]);
    }

    private prepareLogData(): Omit<ActivityLog, 'id'> | null {
        const formValue = this.logActivityForm.getRawValue();
        const activity = this.selectedActivity();
        if (!activity) return null;

        const dateString = formValue.date;
        const startTime = new Date(`${dateString}T${formValue.startTime}`).getTime();
        const endTime = new Date(`${dateString}T${formValue.endTime}`).getTime();
        const durationMinutes = Math.round((endTime - startTime) / 60000);

        return {
            activityId: activity.id,
            activityName: activity.name,
            date: formValue.date,
            startTime,
            endTime,
            durationMinutes,
            intensity: formValue.intensity,
            location: formValue.location,
            distanceKm: formValue.distanceKm,
            caloriesBurned: formValue.caloriesBurned,
            notes: formValue.notes
        };
    }

    get f() {
        return this.logActivityForm.controls;
    }
}