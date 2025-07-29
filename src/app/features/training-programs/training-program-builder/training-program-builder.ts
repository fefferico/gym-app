// src/app/features/training-programs/training-program-builder/training-program-builder.component.ts
import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subscription, of, firstValueFrom } from 'rxjs';
import { switchMap, tap, take } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

import { TrainingProgram, ScheduledRoutineDay } from '../../../core/models/training-program.model';
import { Routine } from '../../../core/models/workout.model';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { WorkoutService } from '../../../core/services/workout.service';
import { SpinnerService } from '../../../core/services/spinner.service';
import { AlertService } from '../../../core/services/alert.service';
import { ToastService } from '../../../core/services/toast.service';
import { DayOfWeekPipe } from '../../../shared/pipes/day-of-week-pipe';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { ActionMenuComponent } from '../../../shared/components/action-menu/action-menu';
import { PressDirective } from '../../../shared/directives/press.directive';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { IconComponent } from "../../../shared/components/icon/icon.component";

interface DayOption {
    value: number;
    label: string;
}

interface ProgramGoal { value: Routine['goal'], label: string }

@Component({
    selector: 'app-training-program-builder',
    standalone: true,
    imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TitleCasePipe,
    DragDropModule,
    DayOfWeekPipe,
    FormsModule,
    ActionMenuComponent,
    PressDirective,
    TooltipDirective,
    IconComponent
],
    templateUrl: './training-program-builder.html',
    styleUrls: ['./training-program-builder.scss']
})
export class TrainingProgramBuilderComponent implements OnInit, OnDestroy {
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private trainingProgramService = inject(TrainingProgramService);
    private workoutService = inject(WorkoutService);
    private spinnerService = inject(SpinnerService);
    private alertService = inject(AlertService);
    private toastService = inject(ToastService);
    private cdr = inject(ChangeDetectorRef);

    programForm!: FormGroup;
    submitted = false; // Add this flag

    isEditMode = false;
    isNewMode = false;
    isViewMode = false;
    currentProgramId: string | null = null;
    currentProgram: TrainingProgram | null | undefined = null;
    isCurrentProgramActive = signal<boolean>(false);
    private routeSub!: Subscription;

    private sanitizer = inject(DomSanitizer);
    public sanitizedDescription: SafeHtml = '';

    infoTooltipString: string = 'Leave blank for a weekly (7-day) schedule. Enter a number (e.g., 3) for a custom N-day cycle. \'Day of Week\' selectors will update accordingly.';

    // For routine selection modal
    isRoutineModalOpen = signal(false);
    availableRoutines: Routine[] = [];
    modalSearchTerm = signal('');
    private targetScheduleIndexForRoutine: number | null = null; // To know which schedule day to update

    // Day options for dropdown
    dayOfWeekOptions: DayOption[] = [
        { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' },
        { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' },
        { value: 0, label: 'Sunday' }
    ];
    cycleDayOptions = computed<DayOption[]>(() => {
        const length = this.programForm.get('cycleLength')?.value;
        if (typeof length === 'number' && length > 0) {
            return Array.from({ length }, (_, i) => ({ value: i + 1, label: `Day ${i + 1}` }));
        }
        return [];
    });
    currentDayOptions = computed<DayOption[]>(() => {
        return (this.programForm.get('cycleLength')?.value > 0) ? this.cycleDayOptions() : this.dayOfWeekOptions;
    });


    filteredAvailableRoutines = computed(() => {
        const term = this.modalSearchTerm().toLowerCase();
        if (!term) return this.availableRoutines;
        return this.availableRoutines.filter(r => r.name.toLowerCase().includes(term));
    });


    selectedGoals = signal<string[]>([]);
    programGoals: ProgramGoal[] = [
        { value: 'hypertrophy', label: 'Hypertrophy' }, { value: 'strength', label: 'Strength' },
        { value: 'tabata', label: 'Tabata' },
        { value: 'muscular endurance', label: 'Muscular endurance' }, { value: 'cardiovascular endurance', label: 'Cardiovascular endurance' },
        { value: 'fat loss / body composition', label: 'Fat loss / body composition' }, { value: 'mobility & flexibility', label: 'Mobility & flexibility' },
        { value: 'power / explosiveness', label: 'Power / explosiveness' }, { value: 'speed & agility', label: 'Speed & agility' },
        { value: 'balance & coordination', label: 'Balance & coordination' }, { value: 'skill acquisition', label: 'Skill acquisition' },
        { value: 'rehabilitation / injury prevention', label: 'Rehabilitation / injury prevention' }, { value: 'mental health / stress relief', label: 'Mental health' },
        { value: 'general health & longevity', label: 'General health & longevity' }, { value: 'sport-specific performance', label: 'Sport-specific performance' },
        { value: 'maintenance', label: 'Maintenance' }, { value: 'rest', label: 'Rest' }, { value: 'custom', label: 'Custom' }
    ];

    constructor() {
        this.programForm = this.fb.group({
            name: ['', Validators.required],
            goals: [''],
            description: [''],
            programNotes: [''],
            startDate: ['', Validators.required], // Store as YYYY-MM-DD string
            cycleLength: [null, [Validators.min(1)]], // Default to weekly (null or 0)
            schedule: this.fb.array([])
        });
    }

    private platformId = inject(PLATFORM_ID); // Inject PLATFORM_ID

    ngOnInit(): void {
        if (isPlatformBrowser(this.platformId)) { // Check if running in a browser
            window.scrollTo(0, 0);
        }
        this.loadAvailableRoutines();

        this.routeSub = this.route.data.pipe(
            switchMap(data => {
                const mode = data['mode'];
                this.currentProgramId = this.route.snapshot.paramMap.get('programId');
                this.submitted = false; // Reset submitted state when component initializes or route changes

                this.isNewMode = mode === 'new';
                this.isViewMode = mode === 'view' && !!this.currentProgramId;
                this.isEditMode = mode === 'edit' && !!this.currentProgramId;

                if (this.isNewMode) {
                    this.programForm.reset({ cycleLength: null, schedule: [] });
                    this.updateFormEnabledState();
                    return of(null);
                } else if (this.currentProgramId) {
                    return this.trainingProgramService.getProgramById(this.currentProgramId);
                }
                return of(null);
            }),
            tap(program => {
                if (program) {
                    this.patchFormWithProgramData(program);
                } else if (!this.isNewMode && this.currentProgramId) {
                    this.toastService.error(`Program with ID ${this.currentProgramId} not found.`, 0, "Error");
                    this.router.navigate(['/training-programs']);
                }
                this.currentProgram = program;
                this.updateFormEnabledState();
                const isActive = program?.isActive ?? false;
                this.isCurrentProgramActive.set(isActive);
            })
        ).subscribe();

        this.programForm.get('cycleLength')?.valueChanges.subscribe(val => {
            this.scheduleFormArray.controls.forEach(control => {
                (control as FormGroup).get('dayOfWeek')?.setValue(this.currentDayOptions()[0]?.value || 1);
            });
        });
    }

    get scheduleFormArray(): FormArray {
        return this.programForm.get('schedule') as FormArray;
    }

    private loadAvailableRoutines(): void {
        this.workoutService.routines$.pipe(take(1)).subscribe(routines => {
            this.availableRoutines = routines.sort((a, b) => a.name.localeCompare(b.name));
        });
    }

    patchFormWithProgramData(program: TrainingProgram): void {
        this.programForm.patchValue({
            name: program.name,
            description: program.description ? this.updateSanitizedDescription(program.description) : '',
            programNotes: program.programNotes,
            startDate: program.startDate ? new Date(program.startDate).toISOString().split('T')[0] : null,
            cycleLength: program.cycleLength ?? null,
        });

        this.scheduleFormArray.clear();
        program.schedule.forEach(scheduledDay => {
            this.scheduleFormArray.push(this.createScheduledDayGroup(scheduledDay));
        });
        this.updateFormEnabledState();

        if (program.goals?.length) {
            // 1. Create a Set of valid goal values for O(1) lookups.
            // We filter out any null/undefined values from the source array first for robustness.
            const goalValuesToFind = new Set(
                program.goals.filter((g): g is string => g != null)
            );

            // 2. Chain filter and forEach on this.programGoals.
            this.programGoals
                .filter(progGoal =>
                    // The value must not be null/undefined AND it must exist in our Set.
                    progGoal.value != null && goalValuesToFind.has(progGoal.value)
                )
                .forEach(foundGoal => {
                    // Because of the filter, TypeScript now knows `foundGoal.value` is a `string`.
                    // The `foundGoal` object itself is valid and can be passed safely.
                    this.toggleGoal(foundGoal);
                });
        }

    }

    createScheduledDayGroup(day?: ScheduledRoutineDay): FormGroup {
        const defaultDayValue = this.currentDayOptions()[0]?.value || 1;
        return this.fb.group({
            id: [day?.id || uuidv4()], // Keep existing ID or generate new
            dayOfWeek: [day?.dayOfWeek ?? defaultDayValue, Validators.required],
            routineId: [day?.routineId ?? '', Validators.required],
            routineName: [day?.routineName ?? ''], // For display
            notes: [day?.notes ?? ''],
            timeOfDay: [day?.timeOfDay ?? '']
        });
    }

    addScheduledDay(): void {
        if (this.isViewMode) return;
        this.scheduleFormArray.push(this.createScheduledDayGroup());
        this.cdr.detectChanges(); // Ensure the new element is in the DOM for scrolling
        // Scroll to the newly added day
        setTimeout(() => {
            const elements = document.querySelectorAll('.scheduled-day-card');
            if (elements.length > 0) {
                elements[elements.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 0);
    }

    removeScheduledDay(index: number): void {
        if (this.isViewMode) return;
        this.scheduleFormArray.removeAt(index);
    }

    // In training-program-builder.component.ts
    get scheduleFormGroups(): FormGroup[] {
        return this.scheduleFormArray.controls as FormGroup[];
    }

    onScheduleDrop(event: CdkDragDrop<FormGroup[]>): void { // <--- Change AbstractControl[] to FormGroup[] here
        if (this.isViewMode) return;
        // No need to cast event.container.data or event.previousContainer.data if the event type is correct
        moveItemInArray(this.scheduleFormArray.controls, event.previousIndex, event.currentIndex);
        this.scheduleFormArray.updateValueAndValidity();
    }

    openRoutineSelectionModal(scheduleIndex: number): void {
        if (this.isViewMode) return;
        this.targetScheduleIndexForRoutine = scheduleIndex;
        this.modalSearchTerm.set(''); // Reset search
        this.isRoutineModalOpen.set(true);
    }

    closeRoutineSelectionModal(): void {
        this.isRoutineModalOpen.set(false);
        this.targetScheduleIndexForRoutine = null;
    }

    selectRoutineForDay(routine: Routine): void {
        if (this.targetScheduleIndexForRoutine !== null) {
            const dayControl = this.scheduleFormArray.at(this.targetScheduleIndexForRoutine);
            dayControl.patchValue({
                routineId: routine.id,
                routineName: routine.name
            });
        }
        this.closeRoutineSelectionModal();
    }

    updateFormEnabledState(): void {
        if (this.isViewMode) {
            this.programForm.disable();
        } else {
            this.programForm.enable();
        }
    }

    enableEditModeFromView(): void {
        if (this.isViewMode && this.currentProgramId) {
            this.router.navigate(['/training-programs/edit', this.currentProgramId]);
            // The ngOnInit will handle re-enabling the form due to route change.
        }
    }

    async onSubmit(): Promise<void> {
        this.submitted = true; // Set to true on submit attempt
        if (this.isViewMode) return

        if (this.programForm.invalid) {
            this.programForm.markAllAsTouched();
            this.toastService.error("Please fill all required fields and ensure each scheduled day has a routine selected", 0, "Validation Error");
            console.log("Form errors:", this.programForm.errors, this.scheduleFormArray.errors);
            this.scheduleFormArray.controls.forEach((ctrl, i) => {
                if (ctrl.invalid) console.log(`Schedule Day ${i + 1} errors:`, ctrl.errors);
            });
            return;
        }

        const formValue = this.programForm.getRawValue();
        const programId = this.currentProgramId || uuidv4();
        const programPayload: TrainingProgram = {
            id: programId, // Use existing ID for edit, new for new
            name: formValue.name,
            goals: this.selectedGoals(),
            description: formValue.description,
            programNotes: formValue.programNotes,
            startDate: formValue.startDate || new Date(), // Ensure null if empty
            cycleLength: formValue.cycleLength || null, // Ensure null if 0 or empty
            schedule: formValue.schedule.map((s: ScheduledRoutineDay) => ({ // Ensure 'any' or proper type for s
                id: s.id || uuidv4(),
                dayOfWeek: Number(s.dayOfWeek),
                routineId: s.routineId,
                routineName: s.routineName, // This should ideally be updated from WorkoutService if routine name changes
                programId: programId,
                notes: s.notes,
                timeOfDay: s.timeOfDay
            })),
            isActive: false // isActive is handled by setActiveProgram or on update
        };

        try {
            this.spinnerService.show("Saving program...");
            if (this.isNewMode) {
                await this.trainingProgramService.addProgram(programPayload as Omit<TrainingProgram, 'id' | 'isActive' | 'schedule'> & { schedule: Omit<ScheduledRoutineDay, 'id'>[] });
            } else if (this.isEditMode && this.currentProgramId) {
                // Preserve isActive state if editing an existing program
                const existingProgram = await firstValueFrom(this.trainingProgramService.getProgramById(this.currentProgramId).pipe(take(1)));
                programPayload.isActive = existingProgram?.isActive ?? false;
                await this.trainingProgramService.updateProgram(programPayload);
            }
            this.router.navigate(['/training-programs']);
        } catch (error) {
            console.error("Error saving program:", error);
            this.toastService.error("Failed to save program", 0, "Save Error");
        } finally {
            this.spinnerService.hide();
        }
    }

    async deleteProgram(): Promise<void> {
        if (!this.currentProgramId) {
            this.toastService.error("No program selected for deletion", 0, "Deletion Error");
            return;
        }
        // Confirmation and actual deletion logic is now fully in the service.
        // The service's deleteProgram method returns a Promise<void> which resolves
        // after the alert confirmation and deletion attempt.
        try {
            this.spinnerService.show("Deleting program...");
            // Call the service method which includes confirmation
            await this.trainingProgramService.deleteProgram(this.currentProgramId);
            // If deleteProgram resolves without throwing, it means the user confirmed and deletion was attempted.
            // The service itself will show success/error toasts for the deletion operation.

            // Check if we are still on the page of the deleted program
            if (this.router.url.includes(`/training-programs/edit/${this.currentProgramId}`) ||
                this.router.url.includes(`/training-programs/view/${this.currentProgramId}`)) {
                this.router.navigate(['/training-programs']);
            }
        } catch (error) {
            // This catch block might not be strictly necessary if the service handles all errors with toasts.
            // However, it can catch unexpected issues from the service call itself.
            console.error("Error during program deletion process in component:", error);
            this.toastService.error("An unexpected error occurred while deleting the program", 0, "Deletion Error");
        } finally {
            this.spinnerService.hide();
        }
    }

    ngOnDestroy(): void {
        if (this.routeSub) {
            this.routeSub.unsubscribe();
        }
    }

    // Helper for template to get control
    get f() { return this.programForm.controls; }
    getScheduleDayControl(index: number) {
        return this.scheduleFormArray.at(index) as FormGroup;
    }

    async toggleActiveProgram(): Promise<void> {
        if (!this.currentProgramId) {
            return;
        }
        if (this.isCurrentProgramActive()) {
            // Option to deactivate
            const confirmDeactivate = await this.alertService.showConfirm("Deactivate Program?", "Do you want to deactivate this program? No program will be active", "Deactivate");
            if (confirmDeactivate && confirmDeactivate.data) {
                try {
                    this.spinnerService.show("Deactivating program...");
                    await this.trainingProgramService.deactivateProgram(this.currentProgramId); // Assumes service has this
                    // Service emits updated list
                } catch (error) { this.toastService.error("Failed to deactivate", 0, "Error"); }
                finally { this.spinnerService.hide(); }
            }
            return;
        }
        // Activate new program
        try {
            this.spinnerService.show("Setting active program...");
            // The service method should handle setting the new active program,
            // updating isActive flags on all programs, and emitting the updated list.
            await this.trainingProgramService.toggleProgramActivation(this.currentProgramId);
        } catch (error) { this.toastService.error("Failed to set active program", 0, "Error"); }
        finally { this.spinnerService.hide(); }
    }

    private updateSanitizedDescription(value: string): void {
        // This tells Angular to trust this HTML string and render it as is.
        this.sanitizedDescription = this.sanitizer.bypassSecurityTrustHtml(value);
    }

    toggleGoal(goal: ProgramGoal): void {
        this.selectedGoals.update(current => {
            const newSelection = new Set(current);
            if (goal !== undefined && goal.value !== undefined) {
                if (newSelection.has(goal.value)) {
                    newSelection.delete(goal.value); // If it exists, remove it
                } else {
                    newSelection.add(goal.value); // If it doesn't exist, add it
                }
            }

            return Array.from(newSelection);
        });
    }



    getProgramDropdownActionItems(programId: string, mode: 'dropdown' | 'compact-bar'): ActionMenuItem[] {
        const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
        const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';
        const activateBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-green-600 flex items-center text-sm hover:text-gray-100';;
        const deactivateBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-500 flex items-center text-sm hover:text-gray-100';;

        const currentProgram = this.currentProgram;

        const editProgramButton =
        {
            label: 'EDIT',
            actionKey: 'edit',
            iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>`,
            iconClass: 'w-8 h-8 mr-2',
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
            data: { programId: programId }
        };

        const activateProgramBtn = {
            label: 'ACTIVATE',
            actionKey: 'activate',
            iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
                        fill="currentColor" class="w-8 h-8 mr-1">
                        <path fill-rule="evenodd"
                          d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75Zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5Z"
                          clip-rule="evenodd" />
                      </svg>`,
            iconClass: 'w-8 h-8 mr-2',
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + activateBtnClass,
            data: { programId: programId }
        };

        const deactivateProgramBtn =
        {
            label: 'DEACTIVATE',
            actionKey: 'deactivate',
            iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
                        fill="currentColor" class="text-red-500">
                        <path fill-rule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16Zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5Z"
                          clip-rule="evenodd" />
                      </svg>`,
            iconClass: 'w-8 h-8 mr-2',
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deactivateBtnClass,
            data: { programId: programId }
        };

        let actionsArray = [] as ActionMenuItem[];

        if (currentProgram?.isActive) {
            actionsArray.push(deactivateProgramBtn);
        } else {
            actionsArray.push(activateProgramBtn);
        }

        if (this.isViewMode) {
            actionsArray.push(editProgramButton);
        }
        return actionsArray;
    }


    handleActionMenuItemClick(event: { actionKey: string, data?: any }, originalMouseEvent?: MouseEvent): void {
        // originalMouseEvent.stopPropagation(); // Stop original event that opened the menu
        const programId = event.data?.programId;
        if (!programId) return;

        switch (event.actionKey) {
            case 'activate':
                this.toggleActiveProgram();
                break;
            case 'deactivate':
                this.toggleActiveProgram();
                break;
            case 'edit':
                this.enableEditModeFromView();
                break;
        }
    }

    // Your existing toggleActions, areActionsVisible, viewRoutineDetails, etc. methods
    // The toggleActions will now just control a signal like `activeRoutineIdActions`
    // which is used to show/hide the <app-action-menu>
    activeRoutineIdActions = signal<string | null>(null); // Store ID of routine whose actions are open

    toggleActions(routineId: string, event: MouseEvent): void {
        event.stopPropagation();
        this.activeRoutineIdActions.update(current => (current === routineId ? null : routineId));
    }

    areActionsVisible(routineId: string): boolean {
        return this.activeRoutineIdActions() === routineId;
    }

    // When closing menu from the component's output
    onCloseActionMenu() {
        this.activeRoutineIdActions.set(null);
    }

    navigateToPrograms(): void {
        this.router.navigate(['/training-programs']);
    }


}