// src/app/features/activities/log-activity/log-activity.component.ts
import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router'; // Import ActivatedRoute
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

import { Activity } from '../../../core/models/activity.model';
import { ActivityService } from '../../../core/services/activity.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ActivityLog } from '../../../core/models/activity-log.model'; // Import ActivityLog

@Component({
    selector: 'app-log-activity',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, DatePipe, IconComponent],
    templateUrl: './log-activity.component.html',
    styleUrls: ['./log-activity.component.scss']
})
export class LogActivityComponent implements OnInit {
    // --- Injected Services ---
    private fb = inject(FormBuilder);
    private activityService = inject(ActivityService);
    private toastService = inject(ToastService);
    private router = inject(Router);
    private route = inject(ActivatedRoute); // +++ ADD

    // --- Component State ---
    logActivityForm!: FormGroup;
    availableActivities$: Observable<Activity[]>;
    selectedActivity = signal<Activity | null>(null);

    // +++ ADD State for Edit Mode +++
    isEditMode = signal(false);
    private editingLogId: string | null = null;

    constructor() {
        // Form initialization remains the same
        this.logActivityForm = this.fb.group({
            activityId: ['', [Validators.required]],
            date: [new Date().toISOString().split('T')[0], [Validators.required]],
            durationMinutes: [null, [Validators.required, Validators.min(1)]],
            intensity: ['Medium', [Validators.required]],
            distanceKm: [{ value: null, disabled: true }, [Validators.min(0)]],
            caloriesBurned: [{ value: null, disabled: true }, [Validators.min(0)]],
            notes: ['']
        });

        this.availableActivities$ = this.activityService.getActivities();

        effect(() => {
            this.updateFormForSelectedActivity(this.selectedActivity());
        });
    }

    ngOnInit(): void {
        // +++ UPDATE ngOnInit to handle both CREATE and EDIT modes +++
        this.route.paramMap.pipe(take(1)).subscribe(params => {
            const logId = params.get('id');
            if (logId) {
                // We are in EDIT mode
                this.isEditMode.set(true);
                this.editingLogId = logId;
                this.loadLogForEditing(logId);
            }
        });

        // This part remains the same
        this.logActivityForm.get('activityId')?.valueChanges.subscribe(id => {
            const activity = this.activityService.getActivityById(id);
            this.selectedActivity.set(activity || null);
        });
    }

    /**
     * +++ NEW METHOD to load and pre-fill the form for editing.
     */
    private loadLogForEditing(logId: string): void {
        this.activityService.getActivityLogById(logId).pipe(take(1)).subscribe(log => {
            if (log) {
                // Pre-fill the form with the existing log data
                this.logActivityForm.patchValue({
                    activityId: log.activityId,
                    date: log.date,
                    durationMinutes: log.durationMinutes,
                    intensity: log.intensity,
                    distanceKm: log.distanceKm,
                    caloriesBurned: log.caloriesBurned,
                    notes: log.notes
                });

                // The `valueChanges` subscription will automatically trigger
                // the `selectedActivity` signal to update, which in turn
                // correctly enables/disables the optional fields.
            } else {
                this.toastService.error('Could not find the activity log to edit.', 0);
                this.router.navigate(['/history']); // Redirect if log not found
            }
        });
    }

    /**
     * Dynamically enables/disables form controls based on the selected activity's
     * default tracking metrics.
     */
    private updateFormForSelectedActivity(activity: Activity | null): void {
        // ... (this method remains exactly the same)
        if (!activity) {
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
    }

    /**
     * Handles the form submission. Validates and calls either create or update.
     */
    onSubmit(): void {
        if (this.logActivityForm.invalid) {
            this.toastService.error('Please fill out all required fields.', 0, 'Invalid Form');
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

    /**
     * +++ NEW METHOD for creating a log.
     */
    private createLog(): void {
        const formValue = this.logActivityForm.getRawValue();
        const activity = this.selectedActivity();
        if (!activity) return;

        const newLog: Omit<ActivityLog, 'id'> = {
            activityId: activity.id,
            activityName: activity.name,
            date: formValue.date,
            startTime: new Date(formValue.date).getTime(),
            durationMinutes: formValue.durationMinutes,
            intensity: formValue.intensity,
            distanceKm: formValue.distanceKm,
            caloriesBurned: formValue.caloriesBurned,
            notes: formValue.notes
        };
        this.activityService.addActivityLog(newLog);
        this.router.navigate(['/history']); // Navigate to history to see the new log
    }

    /**
     * +++ NEW METHOD for updating a log.
     */
    private updateLog(): void {
        if (!this.editingLogId) return;

        const formValue = this.logActivityForm.getRawValue();
        const activity = this.selectedActivity();
        if (!activity) return;
        
        const updatedLog: ActivityLog = {
            id: this.editingLogId,
            activityId: activity.id,
            activityName: activity.name,
            date: formValue.date,
            startTime: new Date(formValue.date).getTime(),
            durationMinutes: formValue.durationMinutes,
            intensity: formValue.intensity,
            distanceKm: formValue.distanceKm,
            caloriesBurned: formValue.caloriesBurned,
            notes: formValue.notes
        };
        this.activityService.updateActivityLog(updatedLog);
        this.router.navigate(['/activities/log', this.editingLogId]); // Navigate back to the details page
    }

    get f() {
        return this.logActivityForm.controls;
    }
}