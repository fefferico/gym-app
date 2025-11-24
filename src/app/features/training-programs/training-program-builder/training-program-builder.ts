import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef, PLATFORM_ID, ViewChildren, QueryList } from '@angular/core';
import { CommonModule, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule, AbstractControl } from '@angular/forms';
import { Subscription, of, firstValueFrom } from 'rxjs';
import { switchMap, tap, take, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

import { TrainingProgram, ScheduledRoutineDay, TrainingProgramHistoryEntry, ProgramWeek } from '../../../core/models/training-program.model';
import { ExerciseTargetSetParams, METRIC, RepsTarget, RepsTargetType, RestTarget, RestTargetType, Routine, WeightTarget, WeightTargetType, WorkoutExercise } from '../../../core/models/workout.model';
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
import { addDays, differenceInDays, format, getDay, parseISO } from 'date-fns';
import { TrackingService } from '../../../core/services/tracking.service';
import { WorkoutLog } from '../../../core/models/workout-log.model';
import { MenuMode } from '../../../core/models/app-settings.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ExerciseSelectionModalComponent } from '../../../shared/components/exercise-selection-modal/exercise-selection-modal.component';
import { Exercise } from '../../../core/models/exercise.model';
import { ExerciseService } from '../../../core/services/exercise.service';
import { BuilderMode, WorkoutBuilderComponent } from '../../workout-tracker/workout-builder';
import { distanceToExact, durationToExact, genRepsTypeFromRepsNumber, repsToExact, restToExact, weightToExact } from '../../../core/services/workout-helper.service';
import { WorkoutFormService } from '../../../core/services/workout-form.service';
import { AlertInput } from '../../../core/models/alert.model';
import { WorkoutUtilsService } from '../../../core/services/workout-utils.service';
import { UnitsService } from '../../../core/services/units.service';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { ShatterableDirective } from '../../../animations/shatterable.directive';
import { EXERCISE_CATEGORY_TYPES } from '../../../core/models/exercise-category.model';

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
        IconComponent,
        TranslateModule,
        ExerciseSelectionModalComponent,
        WorkoutBuilderComponent,
        ShatterableDirective
    ],
    templateUrl: './training-program-builder.html',
    styleUrls: ['./training-program-builder.scss']
})
export class TrainingProgramBuilderComponent implements OnInit, OnDestroy {
    @ViewChildren(ShatterableDirective) shatterables!: QueryList<ShatterableDirective>;

    metricEnum = METRIC;
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private trainingProgramService = inject(TrainingProgramService);
    private workoutService = inject(WorkoutService);
    private exerciseService = inject(ExerciseService);
    private spinnerService = inject(SpinnerService);
    private alertService = inject(AlertService);
    private toastService = inject(ToastService);
    private cdr = inject(ChangeDetectorRef);
    private trackingService = inject(TrackingService);
    private translate = inject(TranslateService);
    private workoutFormService = inject(WorkoutFormService);
    protected workoutUtilService = inject(WorkoutUtilsService);
    protected unitsService = inject(UnitsService);
    private appSettingsService = inject(AppSettingsService);

    programForm!: FormGroup;
    submitted = false; // Add this flag

    isEditMode = false;
    isNewMode = false;
    isViewMode = false;
    isEditableMode = computed(() => this.isEditMode || this.isNewMode);
    currentProgramId: string | null = null;
    currentProgram = signal<TrainingProgram | null | undefined>(null);
    isCurrentProgramActive = signal<boolean>(false);
    private routeSub!: Subscription;

    private sanitizer = inject(DomSanitizer);
    public sanitizedDescription: SafeHtml = '';

    exerciseInfoTooltipString = this.translate.instant('workoutBuilder.exerciseInfoTooltip');
    infoTooltipString: string = this.translate.instant('programBuilder.form.cycleLengthHint');
    // For routine selection modal
    isRoutineModalOpen = signal(false);
    availableRoutines: Routine[] = [];
    modalSearchTerm = signal('');
    private targetScheduleIndexForRoutine: number | null = null; // To know which schedule day to update
    protected targetIndicesForRoutine: { weekIndex?: number, dayIndex: number } | null = null;

    // Day options for dropdown
    dayOfWeekOptions: DayOption[] = [
        { value: 1, label: this.translate.instant('dates.days.monday') },
        { value: 2, label: this.translate.instant('dates.days.tuesday') },
        { value: 3, label: this.translate.instant('dates.days.wednesday') },
        { value: 4, label: this.translate.instant('dates.days.thursday') },
        { value: 5, label: this.translate.instant('dates.days.friday') },
        { value: 6, label: this.translate.instant('dates.days.saturday') },
        { value: 0, label: this.translate.instant('dates.days.sunday') }
    ].sort((a, b) => {
        // Place Sunday (0) at the end
        if (a.value === 0) return 1;
        if (b.value === 0) return -1;
        return a.value - b.value;
    });

    // --- FIX 1: Create a signal to bridge RxJS valueChanges to the signal world ---
    cycleLengthSignal = signal<number | null>(null);

    cycleDayOptions = computed<DayOption[]>(() => {
        // --- FIX 2: Depend on the new signal ---
        const length = this.cycleLengthSignal();
        if (length && length > 0) {
            return Array.from({ length }, (_, i) => ({ value: i + 1, label: `Day ${i + 1}` }));
        }
        return [];
    });

    dayOptionsPerIndex: { [index: number]: DayOption[] } = {};
    private setupDayOptionsWatcher() {
        // Watch for changes in schedule or cycleLength
        this.programForm.get('cycleLength')?.valueChanges.subscribe(() => this.updateDayOptionsPerIndex());
        this.scheduleFormArray.valueChanges.subscribe(() => this.updateDayOptionsPerIndex());
        // Call once initially
        this.updateDayOptionsPerIndex();
    }

    private updateDayOptionsPerIndex() {
        this.dayOptionsPerIndex = {};
        this.scheduleFormArray.controls.forEach((ctrl, idx) => {
            this.dayOptionsPerIndex[idx] = this.getCurrentDayOptions(ctrl.get('dayOfWeek')?.value);
        });
    }
    getCurrentDayOptions(currentValue?: number): DayOption[] {
        const programType = this.programForm.get('programType')?.value;
        const cycleLength = Number(this.programForm.get('cycleLength')?.value);

        if (programType === 'cycled' && cycleLength && cycleLength > 0) {
            // Generate options for the current cycle length
            const usedDays = new Set(this.scheduleFormArray.controls.map(ctrl => ctrl.get('dayOfWeek')?.value));
            if (currentValue !== undefined && currentValue !== null) {
                usedDays.delete(currentValue);
            }
            // If cycleLength is 7, use standard week day labels
            if (cycleLength === 7) {
                return this.dayOfWeekOptions.filter(opt => !usedDays.has(opt.value));
            }
            // Otherwise, use generic "Day X" labels
            return Array.from({ length: cycleLength }, (_, i) => ({
                value: i + 1,
                label: `Day ${i + 1}`
            })).filter(opt => !usedDays.has(opt.value));
        }

        // Default: weekly schedule, filter out used days
        const usedDays = new Set(this.scheduleFormArray.controls.map(ctrl => ctrl.get('dayOfWeek')?.value));
        if (currentValue !== undefined && currentValue !== null) {
            usedDays.delete(currentValue);
        }
        return this.dayOfWeekOptions.filter(opt => !usedDays.has(opt.value));
    }

    getCurrentDayOptionsForWeek(weekIndex: number, currentValue?: number): DayOption[] {
        const weekSchedule = this.getWeekScheduleGroups(weekIndex);
        const usedDays = new Set(weekSchedule.map(ctrl => ctrl.get('dayOfWeek')?.value));
        // Remove the current value from the used set so it stays available
        if (currentValue !== undefined && currentValue !== null) {
            usedDays.delete(currentValue);
        }
        return this.dayOfWeekOptions.filter(opt => !usedDays.has(opt.value));
    }

    currentDayOptions = computed<DayOption[]>(() => {
        const programType = this.programForm.get('programType')?.value;
        const cycleLength = this.cycleLengthSignal();

        // For linear programs, this will be handled per week (see below)
        if (programType === 'linear') {
            // Return all dayOfWeekOptions by default; filter in the week context if needed
            return this.dayOfWeekOptions;
        }

        // For cycled programs
        if (cycleLength && cycleLength > 0) {
            // Get used days in the schedule
            const usedDays = new Set(this.scheduleFormArray.controls.map(ctrl => ctrl.get('dayOfWeek')?.value));
            // Only return unused days
            return Array.from({ length: cycleLength }, (_, i) => ({
                value: i + 1,
                label: `Day ${i + 1}`
            })).filter(opt => !usedDays.has(opt.value));
        }

        // Default: weekly schedule, filter out used days
        const usedDays = new Set(this.scheduleFormArray.controls.map(ctrl => ctrl.get('dayOfWeek')?.value));
        return this.dayOfWeekOptions.filter(opt => !usedDays.has(opt.value));
    });


    filteredAvailableRoutines = computed(() => {
        const term = this.modalSearchTerm().toLowerCase();
        // Combine availableRoutines and temporaryCustomRoutines (avoid duplicates by id)
        const tempRoutines = Array.from(this.temporaryCustomRoutines.values());
        const allRoutines = [
            ...this.availableRoutines,
            ...tempRoutines.filter(tr => !this.availableRoutines.some(r => r.id === tr.id))
        ];
        const filtered = !term ? allRoutines : allRoutines.filter(r => r.name.toLowerCase().includes(term));
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
    });


    selectedGoals = signal<string[]>([]);
    programGoals: ProgramGoal[] = [
        { value: 'hypertrophy', label: this.translate.instant('workoutBuilder.goals.hypertrophy') }, { value: 'strength', label: this.translate.instant('workoutBuilder.goals.strength') },
        { value: 'tabata', label: this.translate.instant('workoutBuilder.goals.tabata') },
        { value: 'muscular endurance', label: this.translate.instant('workoutBuilder.goals.muscularEndurance') }, { value: 'cardiovascular endurance', label: this.translate.instant('workoutBuilder.goals.cardiovascularEndurance') },
        { value: 'fat loss / body composition', label: this.translate.instant('workoutBuilder.goals.fatLoss') }, { value: 'mobility & flexibility', label: this.translate.instant('workoutBuilder.goals.mobility') },
        { value: 'power / explosiveness', label: this.translate.instant('workoutBuilder.goals.power') }, { value: 'speed & agility', label: this.translate.instant('workoutBuilder.goals.speed') },
        { value: 'balance & coordination', label: this.translate.instant('workoutBuilder.goals.balance') }, { value: 'skill acquisition', label: this.translate.instant('workoutBuilder.goals.skill') },
        { value: 'rehabilitation / injury prevention', label: this.translate.instant('workoutBuilder.goals.rehabilitation') }, { value: 'mental health / stress relief', label: this.translate.instant('workoutBuilder.goals.mentalHealth') },
        { value: 'general health & longevity', label: this.translate.instant('workoutBuilder.goals.generalHealth') }, { value: 'sport-specific performance', label: this.translate.instant('workoutBuilder.goals.sportSpecific') },
        { value: 'maintenance', label: this.translate.instant('workoutBuilder.goals.maintenance') }, { value: 'rest', label: this.translate.instant('workoutBuilder.goals.rest') }, { value: 'custom', label: this.translate.instant('workoutBuilder.goals.custom') }
    ];

    historyEditForm!: FormGroup; // Form for editing a history entry
    editingHistoryEntryId = signal<string | null>(null); // ID of the entry being edited
    statusOptions = ['active', 'completed', 'archived', 'cancelled']; // For the status dropdown

    // --- NEW: Signals for expand/collapse state ---
    expandedWeekIds = signal(new Set<string>());
    expandedDayIds = signal(new Set<string>());

    constructor() {
        this.programForm = this.fb.group({
            name: ['', Validators.required],
            programType: [null, Validators.required], // Start with no selection
            goals: [''],
            description: [''],
            programNotes: [''],
            startDate: [null],
            cycleLength: [null, [Validators.min(1)]],
            iterationId: [null],
            isRepeating: [false], // NEW form control for the repeat toggle
            schedule: this.fb.array([]), // For 'cycled' programs
            weeks: this.fb.array([])      // For 'linear' programs
        });

        // Initialize the form for editing history entries
        this.historyEditForm = this.fb.group({
            id: [null],
            startDate: [null],
            endDate: [''],
            status: ['', Validators.required]
        });
    }

    private platformId = inject(PLATFORM_ID); // Inject PLATFORM_ID

    // --- NEW: Computed signal to calculate program progress ---
    programProgress = computed(() => {
        const program = this.currentProgram();
        const logs = this.allWorkoutLogs();

        // Guard clauses: We can't calculate progress without this essential info.
        if (!program || !program.isActive || !program.startDate) {
            return { completedCount: 0, totalCount: 0, percentage: 0 };
        }

        let completedCount = 0;
        let totalCount = 0;
        const startDate = parseISO(program.startDate);

        // --- Logic for LINEAR programs ---
        if (program.programType === 'linear' && program.weeks?.length) {
            // Total workouts is the sum of all scheduled days across all weeks.
            totalCount = program.weeks.reduce((sum, week) => sum + week.schedule.length, 0);

            // Get all logs for this program that occurred on or after the start date.
            const programLogs = logs.filter(log => log.programId === program.id && parseISO(log.date) >= startDate && program.iterationId === log.iterationId);

            // Count unique logged workouts to prevent counting multiple sessions on the same day as extra progress.
            const uniqueLogs = new Set(programLogs.map(log => `${log.date}-${log.routineId}`));
            completedCount = uniqueLogs.size;
        }
        // --- Logic for CYCLED programs ---
        else if (program.programType === 'cycled' && program.schedule.length > 0) {
            const cycleLength = program.cycleLength || 7;
            totalCount = program.schedule.length; // Total is the number of workouts in one cycle.

            const daysSinceStart = differenceInDays(new Date(), startDate);
            if (daysSinceStart >= 0) {
                // Calculate the start date of the CURRENT cycle.
                const completedCycles = Math.floor(daysSinceStart / cycleLength);
                const currentCycleStartDate = addDays(startDate, completedCycles * cycleLength);

                // Filter logs that belong to the current cycle.
                const cycleLogs = logs.filter(log => {
                    const logDate = parseISO(log.date);
                    return log.programId === program.id && logDate >= currentCycleStartDate;
                });

                const uniqueLogsInCycle = new Set(cycleLogs.map(log => `${log.date}-${log.routineId}`));
                completedCount = uniqueLogsInCycle.size;
            }
        }

        if (totalCount === 0) {
            return { completedCount: 0, totalCount: 0, percentage: 0 };
        }

        // Clamp completedCount so it doesn't exceed totalCount
        completedCount = Math.min(completedCount, totalCount);
        const percentage = Math.round((completedCount / totalCount) * 100);

        return { completedCount, totalCount, percentage };
    });

    // --- NEW: Signal for Overall Week-by-Week Progress Bar ---
    overallWeekProgress = computed(() => {
        const program = this.currentProgram();
        const logs = this.allWorkoutLogs();

        if (program?.programType !== 'linear' || !program.isActive || !program.startDate || !program.weeks?.length) {
            return []; // Return empty array if not applicable
        }

        const startDate = parseISO(program.startDate);
        // Create a fast-lookup Set of logged workouts, keyed by 'YYYY-MM-DD-routineId'
        const loggedWorkouts = new Set(
            logs.filter(log => log.programId === program.id && program.iterationId === log.iterationId).map(log => `${log.date}-${log.routineId}`)
        );

        return program.weeks.map(week => {
            // A week is considered "completed" if every single scheduled workout in it has been logged.
            const isCompleted = week.schedule.every(day => {
                // Calculate the exact date for this scheduled day
                const daysToAdd = ((week.weekNumber - 1) * 7) + (day.dayOfWeek - getDay(startDate) + 7) % 7;
                const targetDate = addDays(startDate, daysToAdd);
                const targetDateKey = format(targetDate, 'yyyy-MM-dd');

                // Check if a log exists for this routine on this specific date
                return loggedWorkouts.has(`${targetDateKey}-${day.routineId}`);
            });

            return {
                weekNumber: week.weekNumber,
                name: week.name,
                isCompleted: isCompleted
            };
        });
    });

    // --- NEW: Signal for Current Week's Workout-by-Workout Progress ---
    currentWeekProgress = computed(() => {
        const program = this.currentProgram();
        const logs = this.allWorkoutLogs();

        if (program?.programType !== 'linear' || !program.isActive || !program.startDate || !program.weeks?.length) {
            return null; // Not applicable
        }

        const today = new Date();
        const startDate = parseISO(program.startDate);

        if (today < startDate) return null; // Program hasn't started

        const daysSinceStart = differenceInDays(today, startDate);
        const currentWeekIndex = Math.floor(daysSinceStart / 7);
        const currentWeekData = program.weeks[currentWeekIndex];

        // If we are past the end of the program, don't show this bar
        if (!currentWeekData) return null;

        const totalCount = currentWeekData.schedule.length;
        if (totalCount === 0) return null;

        const weekStartDate = addDays(startDate, currentWeekIndex * 7);

        // Find logs that belong specifically to the current program and occurred during the current week
        const logsThisWeek = logs.filter(log => {
            if (log.programId !== program.id) return false;
            const logDate = parseISO(log.date);
            const daysFromWeekStart = differenceInDays(logDate, weekStartDate);
            return daysFromWeekStart >= 0 && daysFromWeekStart < 7 && program.iterationId === log.iterationId;
        });

        const completedRoutinesThisWeek = new Set(logsThisWeek.map(log => log.routineId));

        let completedCount = 0;
        const segments = currentWeekData.schedule.map(day => {
            const isCompleted = completedRoutinesThisWeek.has(day.routineId);
            if (isCompleted) completedCount++;
            return { isCompleted };
        });

        return {
            weekName: currentWeekData.name,
            completedCount,
            totalCount,
            segments
        };
    });

    protected allWorkoutLogs = signal<WorkoutLog[]>([]);
    private workoutLogsSubscription: Subscription | undefined;


    ngOnInit(): void {
        if (isPlatformBrowser(this.platformId)) { // Check if running in a browser
            window.scrollTo(0, 0);
        }
        this.loadAvailableRoutines();
        this.loadAvailableExercises();
        this.setupDayOptionsWatcher();

        this.workoutLogsSubscription = this.trackingService.workoutLogs$.subscribe(logs => this.allWorkoutLogs.set(logs));

        this.routeSub = this.route.data.pipe(
            switchMap(data => {
                const mode = data['mode'];
                this.currentProgramId = this.route.snapshot.paramMap.get('programId');
                this.submitted = false; // Reset submitted state when component initializes or route changes

                this.isNewMode = mode === 'new';
                this.isViewMode = mode === 'view' && !!this.currentProgramId;
                this.isEditMode = mode === 'edit' && !!this.currentProgramId;

                if (this.isNewMode) {
                    this.showCreationWizard();
                } else if (this.currentProgramId) {
                    return this.trainingProgramService.getProgramById(this.currentProgramId);
                }
                return of(null);
            }),
            tap(program => {
                if (program) {
                    this.currentProgram.set(program);
                    this.patchFormWithProgramData(program);
                } else if (!this.isNewMode && this.currentProgramId) {
                    this.toastService.error(`Program with ID ${this.currentProgramId} not found.`, 0, "Error");
                    this.router.navigate(['/training-programs']);
                }
                this.currentProgram.set(program);
                this.updateFormEnabledState();
                const isActive = program?.isActive ?? false;
                this.isCurrentProgramActive.set(isActive);
            })
        ).subscribe();

        // --- FIX 4: Update the signal on every value change ---
        this.programForm.get('cycleLength')?.valueChanges.subscribe(val => {
            const newCycleLength = parseInt(val, 10);
            this.cycleLengthSignal.set(isNaN(newCycleLength) ? null : newCycleLength);

            if (!isNaN(newCycleLength) && newCycleLength > 0) {
                this.scheduleFormArray.controls.forEach(control => {
                    const dayControl = (control as FormGroup).get('dayOfWeek');
                    if (dayControl && dayControl.value > newCycleLength) {
                        dayControl.setValue(1);
                    }
                });
            }
        });

        // --- NEW: Reset form based on program type ---
        this.programForm.get('programType')?.valueChanges.subscribe(type => {
            this.handleProgramTypeChange(type);
        });
    }

    private skipAutoAddWeek = false;
    handleProgramTypeChange(type: 'cycled' | 'linear'): void {
        const isRepeatingControl = this.programForm.get('isRepeating');
        if (type === 'linear') {
            this.scheduleFormArray.clear();
            this.programForm.get('cycleLength')?.setValue(null);
            this.programForm.get('cycleLength')?.disable();
            isRepeatingControl?.enable();
            if (this.weeksFormArray.length === 0 && !this.isViewMode && !this.skipAutoAddWeek) {
                this.addWeek();
            }
        } else {
            this.weeksFormArray.clear();
            this.programForm.get('cycleLength')?.enable();
            isRepeatingControl?.setValue(false);
            isRepeatingControl?.disable();
        }
    }


    get scheduleFormArray(): FormArray {
        return this.programForm.get('schedule') as FormArray;
    }

    // --- NEW: Accessor for the weeks form array ---
    get weeksFormArray(): FormArray {
        return this.programForm.get('weeks') as FormArray;
    }

    // --- NEW: Accessor for schedule form groups within a week ---
    getWeekScheduleGroups(weekIndex: number): FormGroup[] {
        const week = this.weeksFormArray.at(weekIndex) as FormGroup;
        return (week.get('schedule') as FormArray).controls as FormGroup[];
    }

    // --- NEW: Create a FormGroup for a week ---
    createWeekGroup(week?: Partial<ProgramWeek>): FormGroup {
        const weekGroup = this.fb.group({
            id: [week?.id || uuidv4()],
            weekNumber: [week?.weekNumber ?? this.weeksFormArray.length + 1],
            name: [week?.name ?? `${this.translate.instant('programBuilder.weeks.weekLabel')}${this.weeksFormArray.length + 1}`, Validators.required],
            schedule: this.fb.array([])
        });

        // Populate the schedule for this week if data is provided
        week?.schedule?.forEach(day => {
            (weekGroup.get('schedule') as FormArray).push(this.createScheduledDayGroup(day));
        });
        return weekGroup;
    }

    // --- NEW: Add a new week to the form ---
    addWeek(): void {
        const newWeekGroup = this.createWeekGroup();
        this.weeksFormArray.push(newWeekGroup);
        // Expand the new week by default
        this.expandedWeekIds.update(currentSet => {
            const newSet = new Set(currentSet);
            newSet.add(newWeekGroup.get('id')?.value);
            return newSet;
        });
        setTimeout(() => {
            const weekIndex = this.weeksFormArray.controls.findIndex(week => week.get('id')?.value === newWeekGroup.get('id')?.value);
            if (weekIndex !== null && weekIndex !== undefined) {
                this.scrollToWeek(weekIndex);
            }
        }, 50);
    }

    // --- NEW: Remove a week from the form ---
    async removeWeek(weekIndex: number, event: Event): Promise<void> {
        event.stopPropagation();
        const confirm = await this.alertService.showConfirmationDialog(
            this.translate.instant('programBuilder.weeks.confirmRemoveTitle'),
            this.translate.instant('programBuilder.weeks.confirmRemoveMsg'),
            [
                { text: this.translate.instant('common.cancel'), role: 'cancel', cssClass: 'bg-gray-400 hover:bg-gray-600', icon: 'cancel' },
                { text: this.translate.instant('common.delete'), role: 'confirm', cssClass: 'bg-red-600 hover:bg-red-700', icon: 'trash' }
            ]
        );
        if (!confirm || confirm.role !== 'confirm') return;

        // Find the shatterable directive for this week
        const weekId = this.weeksFormArray.at(weekIndex).get('id')?.value;
        // Try to match the id used in your template (adjust if needed)
        const shatterable = this.shatterables.find(dir =>
            dir.el.nativeElement.id === 'week-header-' + weekIndex ||
            dir.el.nativeElement.id === 'week-header-' + weekId
        );
        if (shatterable) {
            shatterable.shatter();
            setTimeout(() => {
                this.weeksFormArray.removeAt(weekIndex);
            }, 150); // match the shatter animation duration
        } else {
            this.weeksFormArray.removeAt(weekIndex);
        }
    }

    private loadAvailableRoutines(): void {
        this.workoutService.routines$.pipe(take(1)).subscribe(routines => {
            this.availableRoutines = routines.sort((a, b) => a.name.localeCompare(b.name));
        });
    }

    patchFormWithProgramData(program: TrainingProgram): void {
        const programType = program.programType || 'cycled'; // Default old data to 'cycled'
        this.programForm.patchValue({
            name: program.name,
            description: program.description ? this.updateSanitizedDescription(program.description) : '',
            programNotes: program.programNotes,
            startDate: program.startDate ? new Date(program.startDate).toISOString().split('T')[0] : null,
            cycleLength: program.cycleLength ?? null,
            iterationId: program.iterationId ?? null,
            programType: program.programType || 'cycled', // Default to 'cycled' for old data
            isRepeating: program.isRepeating ?? false, // Patch the new value
        });

        this.cycleLengthSignal.set(program.cycleLength ?? null);

        // --- MODIFIED: Patch based on program type and set initial expansion state ---
        const initialWeekIds = new Set<string>();
        const initialDayIds = new Set<string>();

        if (programType === 'linear' && program.weeks) {
            this.weeksFormArray.clear();
            program.weeks.forEach(week => {
                const weekGroup = this.createWeekGroup(week);
                this.weeksFormArray.push(weekGroup);
                initialWeekIds.add(weekGroup.value.id); // Add week ID for expansion
                (weekGroup.get('schedule') as FormArray).controls.forEach(dayCtrl => {
                    initialDayIds.add(dayCtrl.value.id); // Add day ID for expansion
                });
            });
        } else { // 'cycled'
            this.scheduleFormArray.clear();
            program.schedule.forEach(scheduledDay => {
                const dayGroup = this.createScheduledDayGroup(scheduledDay);
                this.scheduleFormArray.push(dayGroup);
                initialDayIds.add(dayGroup.value.id); // Add day ID for expansion
            });
        }

        this.handleProgramTypeChange(programType);
        this.updateFormEnabledState();

        if (program.goals?.length) {
            const goalValuesToFind = new Set(
                program.goals.filter((g): g is string => g != null)
            );

            this.programGoals
                .filter(progGoal =>
                    progGoal.value != null && goalValuesToFind.has(progGoal.value)
                )
                .forEach(foundGoal => {
                    this.toggleGoal(foundGoal);
                });
        }

        this.expandedWeekIds.set(new Set()); // Collapse all weeks
        this.expandedDayIds.set(new Set());  // Collapse all days too
    }

    createScheduledDayGroup(day?: Partial<ScheduledRoutineDay>): FormGroup {
        const defaultDayValue = this.currentDayOptions()[0]?.value ?? 1;
        const dayOfWeek = day?.dayOfWeek ?? defaultDayValue;

        const programType = this.programForm.get('programType')?.value;
        const cycleLength = this.programForm.get('cycleLength')?.value;
        const isCustomCycle = programType === 'cycled' && cycleLength > 0;

        let defaultDayName = '';
        if (isCustomCycle) {
            defaultDayName = `Day ${dayOfWeek}`;
        } else {
            // This handles linear programs and weekly 'cycled' programs
            defaultDayName = this.dayOfWeekOptions.find(opt => opt.value === dayOfWeek)?.label || '';
        }

        const dayGroup = this.fb.group({
            id: [day?.id || uuidv4()],
            dayOfWeek: [dayOfWeek, Validators.required],
            dayName: [day?.dayName || defaultDayName, Validators.required],
            routineId: [day?.routineId ?? '', Validators.required],
            routineName: [day?.routineName ?? ''],
            notes: [day?.notes ?? ''],
            timeOfDay: [day?.timeOfDay ?? ''],
            programId: [day?.programId ?? this.currentProgramId],
            isUnscheduled: [day?.isUnscheduled || false]
        });

        // ==========================================================
        // START: NEW LOGIC FOR DAY NAME HINT
        // ==========================================================
        // Only add this listener in edit/new modes for 'cycled' programs.
        if (this.isEditableMode() && programType === 'cycled') {
            dayGroup.get('dayOfWeek')?.valueChanges.pipe(
                debounceTime(400),      // Wait for the user to stop selecting
                distinctUntilChanged()  // Only proceed if the value is truly different
            ).subscribe(newDayNumber => {
                const currentDayName = dayGroup.get('dayName')?.value;

                // Find the default label for the newly selected day number.
                const dayOption = this.currentDayOptions().find(opt => opt.value === newDayNumber);
                const expectedDayLabel = dayOption ? dayOption.label : `Day ${newDayNumber}`;

                // If the custom name is different from the new default label, show a hint.
                if (currentDayName !== expectedDayLabel) {
                    this.toastService.info(
                        `Reminder: Day name is "${currentDayName}". You might want to update it to match the new selection of "${expectedDayLabel} or to give it a proper name".`,
                        6000,
                        'Check Day Name', false
                    );
                }
            });
        }
        // ==========================================================
        // END: NEW LOGIC
        // ==========================================================

        return dayGroup;
    }

    // --- MODIFIED: Add a day to the correct schedule (cycled or linear) ---
    addScheduledDay(weekIndex?: number): void {
        if (this.isViewMode) return;

        const cycleLength = parseInt(this.programForm.get('cycleLength')?.value, 10);
        const isWeeklySchedule = !cycleLength || cycleLength === 7;
        const programType = this.programForm.get('programType')?.value;
        let newDayGroup: FormGroup | null = null;

        if (programType === 'linear' && weekIndex !== undefined) {
            const weekSchedule = this.weeksFormArray.at(weekIndex).get('schedule') as FormArray;
            if (weekSchedule.length >= 7) {
                this.toastService.info("All 7 days of this week have been scheduled.", 3000);
                return;
            }
            const usedDays = new Set(weekSchedule.controls.map(control => control.get('dayOfWeek')?.value));
            const weekSequence = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun
            let nextAvailableDay = 1;
            for (const day of weekSequence) {
                if (!usedDays.has(day)) {
                    nextAvailableDay = day;
                    break;
                }
            }
            newDayGroup = this.createScheduledDayGroup({ dayOfWeek: nextAvailableDay });
            weekSchedule.push(newDayGroup);
        } else { // Cycled program logic
            if (isWeeklySchedule) {
                if (this.scheduleFormArray.length >= 7) {
                    this.toastService.info("All 7 days of the week have been scheduled.", 3000);
                    return;
                }
                const usedDays = new Set(this.scheduleFormArray.controls.map(control => control.get('dayOfWeek')?.value));
                const weekSequence = [1, 2, 3, 4, 5, 6, 0];
                let nextAvailableDay = 1;
                for (const day of weekSequence) {
                    if (!usedDays.has(day)) { nextAvailableDay = day; break; }
                }
                newDayGroup = this.createScheduledDayGroup({ dayOfWeek: nextAvailableDay });
                this.scheduleFormArray.push(newDayGroup);
            } else { // N-Day Cycle
                if (this.scheduleFormArray.length >= cycleLength) {
                    this.toastService.info(`All ${cycleLength} days of the cycle have been scheduled.`, 3000);
                    return;
                }
                const usedDays = new Set(this.scheduleFormArray.controls.map(control => control.get('dayOfWeek')?.value));
                let nextAvailableDay = 1;
                for (let i = 1; i <= cycleLength; i++) {
                    if (!usedDays.has(i)) { nextAvailableDay = i; break; }
                }
                newDayGroup = this.createScheduledDayGroup({ dayOfWeek: nextAvailableDay });
                this.scheduleFormArray.push(newDayGroup);
            }
        }

        // Expand the newly created day card by default
        if (newDayGroup) {
            this.expandedDayIds.update(currentSet => {
                const newSet = new Set(currentSet);
                newSet.add(newDayGroup.get('id')?.value);
                return newSet;
            });
        }

        const dayId = newDayGroup?.get('id')?.value;
        setTimeout(() => {
            this.scrollToDayHeader(dayId);
        }, 50);
    }

    async removeScheduledDay(dayIndex: number, weekIndex?: number | undefined, event?: Event): Promise<void> {
        if (this.isViewMode) return;
        if (event) {
            event.stopPropagation();
        }

        const confirm = await this.alertService.showConfirmationDialog(
            this.translate.instant('trainingPrograms.weeks.confirmRemoveDayTitle'),
            this.translate.instant('trainingPrograms.weeks.confirmRemoveDayMsg'),
            [
                { text: this.translate.instant('common.cancel'), role: 'cancel', cssClass: 'bg-gray-400 hover:bg-gray-600', icon: 'cancel' },
                { text: this.translate.instant('common.delete'), role: 'confirm', cssClass: 'bg-red-600 hover:bg-red-700', icon: 'trash' }
            ]
        );
        if (!confirm || confirm.role !== 'confirm') return;

        const programType = this.programForm.get('programType')?.value;

        // Find the dayId of the previous or next day (for scrolling)
        let dayIdToScroll: string | undefined;

        if (programType === 'linear' && weekIndex !== undefined) {
            const weekSchedule = this.weeksFormArray.at(weekIndex).get('schedule') as FormArray;
            if (weekSchedule.length > 1) {
                if (dayIndex > 0) {
                    dayIdToScroll = weekSchedule.at(dayIndex - 1).get('id')?.value;
                } else if (weekSchedule.length > 1) {
                    dayIdToScroll = weekSchedule.at(1).get('id')?.value;
                }
            }
            // Find the shatterable directive for this day
            const dayId = weekSchedule.at(dayIndex).get('id')?.value;
            const shatterable = this.shatterables.find(dir =>
                dir.el.nativeElement.id === 'day-expanded-' + dayId
            );
            if (shatterable) {
                shatterable.shatter();
                setTimeout(() => {
                    weekSchedule.removeAt(dayIndex);
                }, 150); // match the shatter animation duration
            } else {
                weekSchedule.removeAt(dayIndex);
            }
        } else {
            if (this.scheduleFormArray.length > 1) {
                if (dayIndex > 0) {
                    dayIdToScroll = this.scheduleFormArray.at(dayIndex - 1).get('id')?.value;
                } else if (this.scheduleFormArray.length > 1) {
                    dayIdToScroll = this.scheduleFormArray.at(1).get('id')?.value;
                }
            }
            // Find the shatterable directive for this day
            const dayId = this.scheduleFormArray.at(dayIndex).get('id')?.value;
            const shatterable = this.shatterables.find(dir =>
                dir.el.nativeElement.id === 'day-expanded-' + dayId
            );
            if (shatterable) {
                shatterable.shatter();
                setTimeout(() => {
                    this.scheduleFormArray.removeAt(dayIndex);
                }, 150);
            } else {
                this.scheduleFormArray.removeAt(dayIndex);
            }
        }

        // Scroll to the appropriate day header after removal
        if (dayIdToScroll) {
            setTimeout(() => {
                this.scrollToDayHeader(dayIdToScroll!);
            }, 100);
        }
    }

    get scheduleFormGroups(): FormGroup[] {
        return this.scheduleFormArray.controls as FormGroup[];
    }

    onScheduleDrop(event: CdkDragDrop<FormGroup[]>): void {
        if (this.isViewMode) return;
        moveItemInArray(this.scheduleFormArray.controls, event.previousIndex, event.currentIndex);
        this.scheduleFormArray.updateValueAndValidity();
    }

    openRoutineSelectionModal(scheduleIndexOrWeekIndex: number, dayIndex?: number): void {
        if (this.isViewMode) return;
        if (dayIndex !== undefined) { // Linear mode
            this.targetIndicesForRoutine = { weekIndex: scheduleIndexOrWeekIndex, dayIndex: dayIndex };
        } else { // Cycled mode
            this.targetIndicesForRoutine = { dayIndex: scheduleIndexOrWeekIndex };
        }
        this.modalSearchTerm.set('');
        this.isRoutineModalOpen.set(true);
    }

    closeRoutineSelectionModal(): void {
        this.isRoutineModalOpen.set(false);
        this.targetScheduleIndexForRoutine = null;
    }

    selectRoutineForDay(routine: Routine): void {
        if (this.targetIndicesForRoutine) {
            let dayControl: FormGroup | undefined;
            const { weekIndex, dayIndex } = this.targetIndicesForRoutine;

            if (weekIndex !== undefined) { // Linear mode
                dayControl = this.getWeekScheduleDayControl(weekIndex, dayIndex);
            } else { // Cycled mode
                dayControl = this.scheduleFormArray.at(dayIndex) as FormGroup;
            }

            dayControl?.patchValue({
                routineId: routine.id,
                routineName: routine.name
            });
            this.triggerBounceOnExerciseList(dayControl.get('id')?.value);
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
        }
    }

    async onSubmit(): Promise<void> {
        this.submitted = true;
        if (this.isViewMode) return;

        const formValue = this.programForm.getRawValue();
        const programName = formValue.name;

        // --- NEW: Update custom routine names and references before persisting ---
        for (const [key, routine] of this.temporaryCustomRoutines.entries()) {
            // Only update if not already suffixed
            if (!routine.name.includes('[Program:')) {
                routine.name = `${routine.name} [Program: ${programName}]`;
            }
            // Update all references in schedule and weeks
            // Cycled
            this.scheduleFormArray.controls.forEach((dayCtrl: AbstractControl) => {
                if (dayCtrl.get('routineId')?.value === routine.id) {
                    dayCtrl.patchValue({
                        routineName: routine.name,
                        dayName: routine.name
                    });
                }
            });
            // Linear
            this.weeksFormArray.controls.forEach((weekCtrl: AbstractControl) => {
                const scheduleArray = (weekCtrl.get('schedule') as FormArray);
                scheduleArray.controls.forEach((dayCtrl: AbstractControl) => {
                    if (dayCtrl.get('routineId')?.value === routine.id) {
                        dayCtrl.patchValue({
                            routineName: routine.name,
                            dayName: routine.name
                        });
                    }
                });
            });
        }

        // --- NEW: Persist temporary custom routines to the database ---
        const persistencePromises: Promise<any>[] = [];
        for (const [key, routine] of this.temporaryCustomRoutines.entries()) {
            routine.isHidden = false;
            // Check if the routine already exists in availableRoutines (i.e., already persisted)
            const existing = this.availableRoutines.find(r => r.id === routine.id);
            let result: Promise<any> | Routine;
            if (existing) {
                // Update the existing routine
                result = this.workoutService.updateRoutine(routine);
            } else {
                // Add as new routine
                result = this.workoutService.addRoutine(routine);
            }
            if (result instanceof Promise) {
                persistencePromises.push(result);
            }
        }

        // Wait for all temporary routines to be persisted
        if (persistencePromises.length > 0) {
            try {
                await Promise.all(persistencePromises);
                this.toastService.success(`${persistencePromises.length} custom routine(s) saved.`, 2000, 'Success');
            } catch (error) {
                this.toastService.error('Failed to save custom routines.', 0, 'Save Error');
                return;
            }
        }

        // --- NEW: Custom structural validation ---
        if (formValue.programType === 'linear') {
            if (!formValue.weeks || formValue.weeks.length === 0) {
                this.toastService.error("Linear programs must have at least one week.", 0, "Validation Error");
                return;
            }
            const hasEmptyWeeks = formValue.weeks.some((week: any) => !week.schedule || week.schedule.length === 0);
            if (hasEmptyWeeks) {
                this.toastService.error("Please add routines to every week or remove any empty weeks.", 0, "Validation Error");
                return; // Stop submission
            }
        } else if (formValue.programType === 'cycled') {
            if (!formValue.schedule || formValue.schedule.length === 0) {
                this.toastService.error("Please add at least one scheduled day to the program.", 0, "Validation Error");
                return;
            }
        }

        if (this.programForm.invalid) {
            this.programForm.markAllAsTouched();
            this.toastService.error("Please fill all required fields, including selecting a routine for each scheduled day.", 0, "Validation Error");
            return;
        }

        const programId = this.currentProgramId || uuidv4();
        const programPayload: TrainingProgram = {
            id: programId,
            name: formValue.name,
            programType: formValue.programType,
            goals: this.selectedGoals(),
            description: formValue.description,
            programNotes: formValue.programNotes,
            startDate: formValue.startDate || null,
            iterationId: formValue.iterationId || null,
            cycleLength: formValue.programType === 'cycled' ? (formValue.cycleLength || null) : null,
            // Set isRepeating based on program type
            isRepeating: formValue.programType === 'linear' ? formValue.isRepeating : false,
            schedule: formValue.schedule.map((s: ScheduledRoutineDay) => ({
                id: s.id || uuidv4(),
                dayOfWeek: Number(s.dayOfWeek),
                dayName: s.dayName || '',
                routineId: s.routineId,
                routineName: s.routineName,
                programId: programId,
                notes: s.notes,
                timeOfDay: s.timeOfDay,
                isUnscheduled: s.isUnscheduled || false,
                iterationId: formValue.iterationId || null
            } as ScheduledRoutineDay)),
            weeks: formValue.programType === 'linear'
                ? formValue.weeks.map((w: any, index: number) => ({
                    ...w,
                    schedule: w.schedule.map((d: ScheduledRoutineDay) => ({
                        id: d.id || uuidv4(),
                        dayOfWeek: Number(d.dayOfWeek),
                        dayName: d.dayName || '',
                        routineId: d.routineId,
                        weekNumber: index + 1,
                        routineName: d.routineName,
                        programId: programId,
                        notes: d.notes,
                        timeOfDay: d.timeOfDay,
                        isUnscheduled: d.isUnscheduled || false,
                        iterationId: formValue.iterationId || null
                    } as ScheduledRoutineDay))
                }))
                : [],
            isActive: this.currentProgram()?.isActive ?? false
        };

        try {
            this.spinnerService.show("Saving program...");
            if (this.isNewMode) {
                const newProgram = await this.trainingProgramService.addProgram(programPayload as Omit<TrainingProgram, 'id' | 'isActive' | 'schedule'> & { schedule: Omit<ScheduledRoutineDay, 'id'>[] });
                this.isNewMode = false;
                this.isEditMode = true;
                this.currentProgramId = newProgram.id;
                this.toastService.success(`Program "${newProgram.name}" created.`, 3000, "Program Created");
                this.currentProgram.set(newProgram);
                this.router.navigate([`/training-programs/edit/${this.currentProgram()?.id}`]);
            } else if (this.isEditMode && this.currentProgramId) {
                const existingProgram = await firstValueFrom(this.trainingProgramService.getProgramById(this.currentProgramId).pipe(take(1)));
                programPayload.isActive = existingProgram?.isActive ?? false;
                await this.trainingProgramService.updateProgram(programPayload);
                this.toastService.success("Program saved successfully", 0, "Success", false);
                this.currentProgram.set(existingProgram);
            }
        } catch (error) {
            console.error("Error saving program:", error);
            this.toastService.error("Failed to save program", 0, "Save Error");
        } finally {
            this.spinnerService.hide();
        }
    }

    async deleteProgram(): Promise<void> {
        if (!this.currentProgramId) {
            this.toastService.error(this.translate.instant('programBuilder.toasts.deleteError'), 0, this.translate.instant('programBuilder.toasts.deleteErrorTitle'));
            return;
        }
        try {
            this.spinnerService.show(this.translate.instant('programBuilder.alerts.deleting'));
            await this.trainingProgramService.deleteProgram(this.currentProgramId);

            if (
                this.router.url.includes(`/training-programs/new`) ||
                this.router.url.includes(`/training-programs/edit/${this.currentProgramId}`) ||
                this.router.url.includes(`/training-programs/view/${this.currentProgramId}`)) {
                this.router.navigate(['/training-programs']);
            }
        } catch (error) {
            console.error("Error during program deletion process in component:", error);
            this.toastService.error(this.translate.instant('programBuilder.toasts.deleteUnexpectedError'), 0, this.translate.instant('programBuilder.toasts.deleteErrorTitle'));
        } finally {
            this.spinnerService.hide();
        }
    }

    ngOnDestroy(): void {
        if (this.routeSub) {
            this.routeSub.unsubscribe();
        }
        this.workoutLogsSubscription?.unsubscribe();
    }

    get f() { return this.programForm.controls; }
    getScheduleDayControl(index: number) {
        return this.scheduleFormArray.at(index) as FormGroup;
    }

    getWeekScheduleDayControl(weekIndex: number, dayIndex: number): FormGroup {
        return (this.weeksFormArray.at(weekIndex).get('schedule') as FormArray).at(dayIndex) as FormGroup;
    }

    async completeProgram(): Promise<void> {
        if (!this.currentProgramId) {
            return;
        }
        if (!this.isCurrentProgramActive()) {
            return
        }
        try {

            const confirm = await this.alertService.showConfirmationDialog(
                'Finish Program',
                'Are you sure you want to mark this program as completed?',
                [
                    { text: 'Cancel', role: 'cancel', cssClass: 'bg-gray-400 hover:bg-gray-600', icon: 'cancel' },
                    { text: 'Finish Program', role: 'confirm', cssClass: 'bg-primary hover:bg-primary-dark', icon: 'done' }
                ]
            );
            if (!confirm || confirm.role !== 'confirm') return;

            this.spinnerService.show("Completing program...");
            await this.trainingProgramService.toggleProgramActivation(this.currentProgramId, 'completed');
        } catch (error) {
            this.toastService.error("Failed to complete program", 0, "Error");
        } finally {
            this.spinnerService.hide();
        }
        return;
    }

    async toggleActiveProgram(): Promise<void> {
        if (!this.currentProgramId) {
            return;
        }
        if (this.isCurrentProgramActive()) {
            const choice = await this.alertService.showConfirmationDialog(
                "Program is currently active.",
                "What would you like to do?",
                [
                    { text: "Deactivate", role: "deactivate", data: "deactivate", icon: 'deactivate' },
                    { text: "Complete", role: "complete", data: "complete", icon: 'goal', cssClass: 'bg-green-500 hover:bg-green-600' },
                    { text: "Cancel", role: "cancel", data: "cancel", icon: 'cancel' },
                ]
            );

            if (!choice || !choice.data || choice.data === "cancel") {
                this.spinnerService.hide();
                return;
            }

            if (choice.data === "complete") {
                try {
                    this.spinnerService.show("Completing program...");
                    await this.trainingProgramService.toggleProgramActivation(this.currentProgramId, 'completed');
                    this.toastService.success(`Program is now completed`);
                } catch (error) {
                    this.toastService.error("Failed to complete program", 0, "Error");
                } finally {
                    this.spinnerService.hide();
                }
                return;
            } else {
                try {
                    this.spinnerService.show("Deactivating program...");
                    await this.trainingProgramService.deactivateProgram(this.currentProgramId, 'cancelled');
                    this.toastService.success(`Program is now deactivated`);
                } catch (error) { this.toastService.error("Failed to deactivate", 0, "Error"); }
                finally { this.spinnerService.hide(); }
            }
            return;
        }
        try {
            this.spinnerService.show("Setting active program...");
            await this.trainingProgramService.toggleProgramActivation(this.currentProgramId, 'active');
            this.toastService.success(`Program is now active`);
        } catch (error) { this.toastService.error("Failed to set active program", 0, "Error"); }
        finally { this.spinnerService.hide(); }
    }

    toggleProgramHistory(): void {
        const program = this.currentProgram() !== null && this.currentProgram() !== undefined ? this.currentProgram() : null;
        if (!program || !program.history || (program && program.history && program.history.length === 0)) {
            this.toastService.info("No history available for this program.", 3000);
            return;
        }
        this.isProgramHistoryModalOpen.set(true);
    }

    isProgramHistoryModalOpen = signal(false);

    closeProgramHistoryModal(): void {
        this.isProgramHistoryModalOpen.set(false);
        this.editingHistoryEntryId.set(null);
    }

    private updateSanitizedDescription(value: string): void {
        this.sanitizedDescription = this.sanitizer.bypassSecurityTrustHtml(value);
    }

    toggleGoal(goal: ProgramGoal): void {
        this.selectedGoals.update(current => {
            const newSelection = new Set(current);
            if (goal !== undefined && goal.value !== undefined) {
                if (newSelection.has(goal.value)) {
                    newSelection.delete(goal.value);
                } else {
                    newSelection.add(goal.value);
                }
            }
            return Array.from(newSelection);
        });
    }

    getProgramDropdownActionItems(programId: string, mode: MenuMode): ActionMenuItem[] {
        const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
        const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';
        const activateBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-green-600 flex items-center text-sm hover:text-gray-100';
        const deactivateBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-500 flex items-center text-sm hover:text-gray-100';

        const currentProgram = this.currentProgram;

        const editProgramButton =
        {
            label: 'trainingPrograms.actions.edit',
            actionKey: 'edit',
            iconName: `edit`,
            iconClass: 'w-8 h-8 mr-2',
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
            data: { programId: programId }
        };

        const activateProgramBtn = {
            label: 'trainingPrograms.actions.activate',
            actionKey: 'activate',
            iconName: 'activate',
            iconClass: 'w-8 h-8 mr-2',
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + activateBtnClass,
            data: { programId: programId }
        };

        const historyProgramBtn = {
            label: 'trainingPrograms.actions.history',
            actionKey: 'history',
            iconName: 'clock',
            iconClass: 'w-8 h-8 mr-2',
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
            data: { programId: programId }
        };

        const finishProgramBtn = {
            label: 'trainingPrograms.actions.finish',
            actionKey: 'finish',
            iconName: 'goal',
            iconClass: 'w-8 h-8 mr-2',
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
            data: { programId: programId }
        };

        const deactivateProgramBtn =
        {
            label: 'trainingPrograms.actions.deactivate',
            actionKey: 'deactivate',
            iconName: `deactivate`,
            iconClass: 'w-7 h-7 mr-2',
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deactivateBtnClass,
            data: { programId: programId }
        };

        let actionsArray = [] as ActionMenuItem[];

        if (this.currentProgram()?.isActive) {
            actionsArray.push(finishProgramBtn);
            actionsArray.push(deactivateProgramBtn);
        } else {
            actionsArray.push(activateProgramBtn);
        }

        actionsArray.push(historyProgramBtn);
        // }

        if (this.isViewMode) {
            actionsArray.push(editProgramButton);
        }

        actionsArray.push({ isDivider: true });
        actionsArray.push({
            label: 'trainingPrograms.actions.delete',
            actionKey: 'delete',
            iconName: `trash`,
            iconClass: 'w-8 h-8 mr-2',
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
            data: { programId: programId }
        });

        return actionsArray;
    }


    handleActionMenuItemClick(event: { actionKey: string, data?: any }, originalMouseEvent?: MouseEvent): void {
        const programId = event.data?.programId;
        if (!programId) return;

        switch (event.actionKey) {
            case 'activate': this.toggleActiveProgram(); break;
            case 'deactivate': this.toggleActiveProgram(); break;
            case 'finish': this.completeProgram(); break;
            case 'history': this.toggleProgramHistory(); break;
            case 'edit': this.enableEditModeFromView(); break;
            case 'delete': this.deleteProgram(); break;
        }
    }

    activeProgramIdActions = signal<string | null>(null);

    toggleActions(programId: string, event: MouseEvent): void {
        event.stopPropagation();
        this.activeProgramIdActions.update(current => (current === programId ? null : programId));
    }

    areActionsVisible(programId: string): boolean {
        return this.activeProgramIdActions() === programId;
    }

    onCloseActionMenu() {
        this.activeProgramIdActions.set(null);
    }

    navigateToPrograms(): void {
        this.router.navigate(['/training-programs']);
    }

    async removeProgramHistoryEntry(historyId: string): Promise<void> {
        if (!this.currentProgramId || !historyId) {
            this.toastService.error("Missing program or history entry ID.", 0, "Error");
            return;
        }
        try {
            this.spinnerService.show("Removing history entry...");
            await this.trainingProgramService.removeProgramHistoryEntry(this.currentProgramId, historyId);
            this.toastService.success("History entry removed.", 0, "Success");
            const updatedProgram = await firstValueFrom(this.trainingProgramService.getProgramById(this.currentProgramId).pipe(take(1)));
            this.currentProgram.set(updatedProgram);
            if (updatedProgram) {
                this.patchFormWithProgramData(updatedProgram);
            }
        } catch (error) {
            this.toastService.error("Failed to remove history entry.", 0, "Error");
        } finally {
            this.spinnerService.hide();
        }
    }

    editHistoryEntry(entry: TrainingProgramHistoryEntry): void {
        this.editingHistoryEntryId.set(entry.id);
        this.historyEditForm.patchValue({
            id: entry.id,
            startDate: entry.startDate && entry.startDate !== '-' ? new Date(entry.startDate).toISOString().split('T')[0] : '',
            endDate: entry.endDate && entry.endDate !== '-' ? new Date(entry.endDate).toISOString().split('T')[0] : '',
            status: entry.status
        });
    }

    cancelEditHistoryEntry(): void {
        this.editingHistoryEntryId.set(null);
    }

    async saveHistoryEntry(): Promise<void> {
        if (this.historyEditForm.invalid) {
            this.toastService.error("Please ensure all fields are valid.", 0, "Validation Error");
            return;
        }
        if (!this.currentProgramId) return;

        const formValue = this.historyEditForm.getRawValue();
        const updatedEntry: TrainingProgramHistoryEntry = {
            ...formValue,
            programId: this.currentProgramId,
            endDate: formValue.endDate || '-',
            date: new Date().toISOString()
        };

        try {
            this.spinnerService.show("Updating history...");
            await this.trainingProgramService.updateProgramHistory(this.currentProgramId, updatedEntry);

            const updatedProgram = await firstValueFrom(this.trainingProgramService.getProgramById(this.currentProgramId).pipe(take(1)));
            this.currentProgram.set(updatedProgram);

            this.editingHistoryEntryId.set(null);
        } catch (error) {
            this.toastService.error("Failed to save history entry.", 0, "Save Error");
        } finally {
            this.spinnerService.hide();
        }
    }

    forceEndDateToNull(): void {
        this.historyEditForm.get('endDate')?.setValue(null);
        this.historyEditForm.get('endDate')?.disable();
    }
    enableEndDate(): void {
        this.historyEditForm.get('endDate')?.enable();
    }

    onWeekDrop(event: CdkDragDrop<FormGroup[]>): void {
        if (this.isViewMode) return;
        moveItemInArray(this.weeksFormArray.controls, event.previousIndex, event.currentIndex);

        this.weeksFormArray.controls.forEach((group, index) => {
            group.get('weekNumber')?.setValue(index + 1);

            const nameControl = group.get('name');
            const currentName = nameControl?.value;
            if (currentName) {
                // Find the first number in the week name
                const match = currentName.match(/(\d+)/);
                if (match) {
                    const foundNumber = parseInt(match[1], 10);
                    // Only update if the found number matches the previous (1-based) index
                    // Find the previous index of this group in the array before move
                    const previousIndex = event.previousIndex === index ? event.currentIndex : event.previousIndex;
                    if (foundNumber === previousIndex + 1) {
                        // Replace only the first occurrence of the number with the new (index+1)
                        const newName = currentName.replace(/(\d+)/, `${index + 1}`);
                        nameControl?.setValue(newName);
                    }
                }
            }
        });
        this.weeksFormArray.updateValueAndValidity();
    }

    // --- NEW ---
    onDayDropInWeek(event: CdkDragDrop<FormGroup[]>, weekIndex: number): void {
        if (this.isViewMode) return;
        const weekScheduleArray = this.weeksFormArray.at(weekIndex).get('schedule') as FormArray;
        moveItemInArray(weekScheduleArray.controls, event.previousIndex, event.currentIndex);
        weekScheduleArray.updateValueAndValidity();
    }

    // --- NEW: Methods to manage expand/collapse state ---
    toggleWeek(weekId: string, event?: Event): void {
        if (event) {
            const target = event.target as HTMLElement;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
                return;
            }
        }
        this.expandedWeekIds.update(currentSet => {
            const newSet = new Set(currentSet);
            const weekIndex = this.weeksFormArray.controls.findIndex(w => w.get('id')?.value === weekId);
            const weekDays = weekIndex !== -1 ? this.getWeekScheduleGroups(weekIndex) : [];

            if (newSet.has(weekId)) {
                // Collapsing: also collapse all days in this week
                this.expandedDayIds.update(daySet => {
                    const newDaySet = new Set(daySet);
                    weekDays.forEach(dayCtrl => {
                        newDaySet.delete(dayCtrl.get('id')?.value);
                    });
                    return newDaySet;
                });
                newSet.delete(weekId);
            } else {
                // Expanding: also expand all days in this week
                this.expandedDayIds.update(daySet => {
                    const newDaySet = new Set(daySet);
                    weekDays.forEach(dayCtrl => {
                        newDaySet.add(dayCtrl.get('id')?.value);
                    });
                    return newDaySet;
                });
                newSet.add(weekId);
            }
            return newSet;
        });
        const weekIndex = this.weeksFormArray.controls.findIndex(week => week.get('id')?.value === weekId);
        if (weekIndex !== null && weekIndex !== undefined) {
            this.scrollToWeek(weekIndex);
        }
    }

    isWeekExpanded(weekId: string): boolean {
        return this.expandedWeekIds().has(weekId);
    }

    toggleDayExpansion(dayId: string): void {
        this.expandedDayIds.update(currentSet => {
            const newSet = new Set(currentSet);
            if (newSet.has(dayId)) {
                newSet.delete(dayId);
            } else {
                newSet.add(dayId);
            }
            return newSet;
        });
        this.scrollToDayHeader(dayId);
    }

    isDayExpanded(dayId: string): boolean {
        return this.expandedDayIds().has(dayId);
    }


    isExerciseModalOpen = signal(false);
    exerciseModalTarget: { weekIndex?: number, dayIndex: number } | null = null;
    selectedExercisesForModal: WorkoutExercise[] = [];

    // --- NEW: Custom Workout Modal State ---
    isCustomWorkoutModalOpen = signal(false);
    customRoutineToEdit: Routine | null = null;
    customWorkoutModalTarget: { weekIndex?: number, dayIndex: number } | null = null;
    temporaryCustomRoutines = new Map<string, Routine>(); // Key: 'weekIndex-dayIndex' or 'dayIndex'

    openExerciseSelectionModal(dayIndex: number, weekIndex?: number) {
        this.exerciseModalTarget = { weekIndex, dayIndex };
        this.selectedExercisesForModal = [];
        this.isExerciseModalOpen.set(true);
    }

    closeExerciseSelectionModal() {
        this.isExerciseModalOpen.set(false);
        this.exerciseModalTarget = null;
        this.selectedExercisesForModal = [];
    }

    builderMode = BuilderMode;

    openCustomWorkoutModal(dayIndex: number, weekIndex?: number) {
        this.customRoutineToEdit = null;
        this.customWorkoutModalTarget = { weekIndex, dayIndex };
        this.isCustomWorkoutModalOpen.set(true);
    }

    closeCustomWorkoutModal() {
        this.isCustomWorkoutModalOpen.set(false);
        this.customWorkoutModalTarget = null;
    }

    handleCustomRoutineConfirmed(routine: Routine) {
        if (!this.customWorkoutModalTarget) return;
        const { weekIndex, dayIndex } = this.customWorkoutModalTarget;
        const cacheKey = weekIndex !== undefined ? `${weekIndex}-${dayIndex}` : `${dayIndex}`;

        // Store the temporary routine
        this.temporaryCustomRoutines.set(cacheKey, routine);
        this.updateRoutineNameInSchedule(routine);
        // Get the day control and update it
        let dayControl: FormGroup | undefined;
        if (weekIndex !== undefined) {
            dayControl = this.getWeekScheduleDayControl(weekIndex, dayIndex);
        } else {
            dayControl = this.scheduleFormArray.at(dayIndex) as FormGroup;
        }

        if (dayControl) {
            dayControl.patchValue({
                routineId: routine.id,
                routineName: routine.name
            });
            this.triggerBounceOnExerciseList(dayControl.get('id')?.value);
        }

        // Add to custom routines list for reference
        if (!this.customRoutines.find(r => r.id === routine.id)) {
            this.customRoutines.push(routine);
        }

        this.toastService.success(`Custom routine "${routine.name}" created!`, 3000, 'Success');
        this.closeCustomWorkoutModal();
    }

    async selectExercisesForDay(selectedExercises: Exercise[]) {
        if (!this.exerciseModalTarget) return;
        const { weekIndex, dayIndex } = this.exerciseModalTarget;

        // 1. Find the day control
        let dayControl: FormGroup | undefined;
        if (weekIndex !== undefined) {
            dayControl = this.getWeekScheduleDayControl(weekIndex, dayIndex);
        } else {
            dayControl = this.scheduleFormArray.at(dayIndex) as FormGroup;
        }
        if (!dayControl) return;

        const routineId = dayControl.get('routineId')?.value;
        let routine: Routine | undefined = routineId && this.isCustomRoutine(routineId)
            ? this.availableRoutines.find(r => r.id === routineId)
            : undefined;

        // 2. Convert selected Exercise[] to WorkoutExercise[]
        const workoutExercises: WorkoutExercise[] = selectedExercises.map(exerciseFromLibrary => {
            const isCardio = this.isExerciseCardioOnly(exerciseFromLibrary.id);

            let fieldOrder = [];
            if (isCardio) {
                fieldOrder = [METRIC.duration, METRIC.distance, METRIC.rest];
            } else {
                fieldOrder = [METRIC.reps, METRIC.weight, METRIC.rest];
            }

            const baseSet = {
                id: this.workoutService.generateExerciseSetId(),
                type: 'standard',
                fieldOrder: fieldOrder,
                targetReps: isCardio ? undefined : repsToExact(8),
                targetWeight: isCardio ? undefined : weightToExact(10),
                targetRest: restToExact(60),
                targetDuration: isCardio ? durationToExact(60) : undefined,
                targetDistance: isCardio ? distanceToExact(1) : undefined,
                targetTempo: undefined,
                notes: undefined
            } as ExerciseTargetSetParams;

            return {
                id: this.workoutService.generateWorkoutExerciseId(),
                exerciseId: exerciseFromLibrary.id,
                exerciseName: exerciseFromLibrary.name,
                sets: [baseSet],
                type: 'standard',
                supersetId: null,
                supersetOrder: null,
            };
        });

        if (routine) {
            // 3a. Append to existing custom routine
            routine.exercises.push(...workoutExercises);
        } else {
            // 3b. Create a new fake routine
            const fakeRoutine: Routine = {
                id: 'custom-' + uuidv4(),
                name: 'Custom Day',
                exercises: workoutExercises,
                isHidden: true
            };
            this.customRoutines.push(fakeRoutine);
            this.availableRoutines.push(fakeRoutine);
            dayControl.patchValue({
                routineId: fakeRoutine.id,
                routineName: fakeRoutine.name
            });
        }

        this.closeExerciseSelectionModal();
    }

    isCustomRoutine(routineId: string): boolean {
        return Array.from(this.temporaryCustomRoutines.values()).some(r => r.id === routineId);
    }

    editCustomRoutine(routineId: string, dayIndex: number, weekIndex?: number): void {
        const routine = Array.from(this.temporaryCustomRoutines.values()).find(r => r.id === routineId);
        if (!routine) return;

        this.customWorkoutModalTarget = { weekIndex, dayIndex };
        this.customRoutineToEdit = routine; // Store for passing to modal
        this.isCustomWorkoutModalOpen.set(true);
    }

    getExercisesForDay(routineId: string): WorkoutExercise[] {
        let routine = this.availableRoutines.find(r => r.id === routineId)
            || Array.from(this.temporaryCustomRoutines.values()).find(r => r.id === routineId);
        return routine?.exercises || [];
    }


    customRoutines: Routine[] = [];
    availableExercises: Exercise[] = [];
    modalExerciseSearchTerm = signal('');
    filteredAvailableExercises = computed(() => {
        let term = this.modalExerciseSearchTerm().toLowerCase();
        if (!term) {
            return this.availableExercises;
        }
        term = this.exerciseService.normalizeExerciseNameForSearch(term);
        return this.availableExercises.filter(ex =>
            ex.name.toLowerCase().includes(term) ||
            (ex.categories && ex.categories.map(cat => cat.toString().toLowerCase()).join(', ').includes(term)) ||
            (ex.description && ex.description.toLowerCase().includes(term)) ||
            (ex.primaryMuscleGroup && ex.primaryMuscleGroup.toLowerCase().includes(term))
        );
    });

    isExerciseCardioOnly(exerciseId: string): boolean {
        // This method should be async or use a callback to handle the Observable.
        // Here's a synchronous fallback using availableExercises if possible:
        if (!exerciseId) return false;
        const exerciseDetails = this.availableExercises.find(e => e.id === exerciseId);
        if (exerciseDetails && exerciseDetails.categories) {
            return exerciseDetails.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.cardio) !== undefined;
        }
        return false;
    }

    // generate fake routine for selected exercises
    private generateFakeRoutineForSelectedExercises(exercises: Exercise[]): Routine {
        const workoutExercises: WorkoutExercise[] = exercises.map(exerciseFromLibrary => {
            return {
                id: this.workoutService.generateWorkoutExerciseId(),
                exerciseId: exerciseFromLibrary.id,
                exerciseName: exerciseFromLibrary.name,
                sets: [],
                type: 'standard',
                supersetId: null,
                supersetOrder: null,
            };
        });
        return {
            id: 'custom-' + uuidv4(),
            name: 'Fake Routine',
            exercises: workoutExercises
        };
    }

    async handleTrulyCustomExerciseEntry(showError: boolean = false): Promise<void> {
        const inputs: AlertInput[] = [
            { name: 'exerciseName', type: 'text', placeholder: this.translate.instant('workoutBuilder.exercise.newCustomExerciseName'), value: '', attributes: { required: true }, label: this.translate.instant('workoutBuilder.exercise.newCustomExerciseName'), },
            { name: 'numSets', type: 'number', placeholder: this.translate.instant('workoutBuilder.exercise.newCustomExerciseSets'), value: '3', attributes: { min: '1', required: true }, label: this.translate.instant('workoutBuilder.exercise.newCustomExerciseSets') },
            { name: 'equipmentNeeded', type: 'text', placeholder: this.translate.instant('workoutBuilder.exercise.newCustomExerciseEquipment'), value: '', attributes: { required: false }, label: this.translate.instant('workoutBuilder.exercise.newCustomExerciseEquipment') },
            { name: 'description', type: 'textarea', placeholder: this.translate.instant('workoutBuilder.exercise.newCustomExerciseDescription'), value: '', attributes: { required: false }, label: this.translate.instant('workoutBuilder.exercise.newCustomExerciseDescription') },
        ];

        if (showError) {
            this.toastService.error(this.translate.instant('newCustomExerciseInvalidInput'), 0, this.translate.instant('common.error'));
        }
        const result = await this.alertService.showPromptDialog(this.translate.instant('workoutBuilder.exercise.newCustomExerciseTitle'), this.translate.instant('workoutBuilder.exercise.newCustomExerciseMsg'), inputs, this.translate.instant('workoutBuilder.exercise.newCustomExerciseBtn'));

        if (result && result['exerciseName']) {
            const exerciseName = String(result['exerciseName']).trim();
            const description = String(result['description']).trim();
            const numSets = result['numSets'] ? parseInt(String(result['numSets']), 10) : 3;
            if (!exerciseName || numSets <= 0) {
                this.toastService.error(this.translate.instant('newCustomExerciseInvalidInput'), 0, this.translate.instant('common.error')); return;
            }
            const newExerciseSets: ExerciseTargetSetParams[] = Array.from({ length: numSets }, () => ({
                id: `custom-adhoc-set-${uuidv4()}`,
                fieldOrder: [METRIC.reps, METRIC.weight, METRIC.rest],
                targetReps: genRepsTypeFromRepsNumber(8),
                targetWeight: weightToExact(10),
                targetDuration: undefined,
                targetRest: restToExact(60), type:
                    'standard',
                notes: '',
            }));
            const slug = exerciseName.trim().toLowerCase().replace(/\s+/g, '-');
            const newExercise: Exercise = {
                id: `custom-adhoc-ex-${slug}-${uuidv4()}`,
                name: exerciseName,
                description: description,
                categories: [EXERCISE_CATEGORY_TYPES.custom],
                muscleGroups: [],
                primaryMuscleGroup: undefined,
                imageUrls: []
            };

            this.closeExerciseSelectionModal();
            this.exerciseService.addExercise(newExercise);

            const workoutExercise: WorkoutExercise = {
                id: this.workoutService.generateWorkoutExerciseId(),
                exerciseId: newExercise.id,
                exerciseName: newExercise.name,
                sets: newExerciseSets,
                supersetId: null,
                supersetOrder: null,
            };
            const newExerciseFormGroup = this.workoutFormService.createExerciseFormGroup(workoutExercise, true, false);
        } else {
            if (!result) {
                return
            }
            this.handleTrulyCustomExerciseEntry(true);
            return;
        }
    }


    private loadAvailableExercises(): void {
        this.exerciseService.getExercises().pipe(
            take(1),
            // Use switchMap to chain the call to the translation service
            switchMap(untranslatedExercises => {
                if (!untranslatedExercises || untranslatedExercises.length === 0) {
                    return of([]); // Return empty if there's nothing to translate
                }
                return this.exerciseService.getTranslatedExerciseList(untranslatedExercises);
            })
        ).subscribe(translatedExercises => {
            // The component's master list of exercises is now translated
            this.availableExercises = translatedExercises;
            this.updateRoutineExerciseNames();
        });
    }

    private updateRoutineNameInSchedule(routine: Routine): void {
        // Update cycled program days
        this.scheduleFormArray.controls.forEach((dayCtrl: AbstractControl) => {
            if (dayCtrl.get('routineId')?.value === routine.id) {
                dayCtrl.patchValue({ routineName: routine.name });
            }
        });

        // Update linear program weeks/days
        this.weeksFormArray.controls.forEach((weekCtrl: AbstractControl) => {
            const scheduleArray = (weekCtrl.get('schedule') as FormArray);
            scheduleArray.controls.forEach((dayCtrl: AbstractControl) => {
                if (dayCtrl.get('routineId')?.value === routine.id) {
                    dayCtrl.patchValue({ routineName: routine.name });
                }
            });
        });
    }
    public expandedExerciseLists: { [dayId: string]: boolean } = {};

    toggleExerciseList(dayId: string) {
        this.expandedExerciseLists[dayId] = !this.expandedExerciseLists[dayId];
        setTimeout(() => {
            if (this.expandedExerciseLists[dayId]) {
                // Just expanded: scroll to the exercise list
                this.scrollToExerciseList(dayId);
            } else {
                // Just collapsed: scroll to the day header/card
                this.scrollToDayHeader(dayId);
            }
        }, 100);
    }

    scrollToWeek(weekIndex: number): void {
        const header = document.getElementById(`week-header-${weekIndex}`);
        if (header) {
            const y = header.getBoundingClientRect().top + window.scrollY - 40; // 40px above
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }

    // generate snippet for scrolling into day-expanded-${dayId} when expandedExerciseLists[dayId] is toggled
    scrollToDayHeader(dayId: string) {
        const header = document.getElementById(`day-expanded-${dayId}`);
        if (header) {
            const y = header.getBoundingClientRect().top + window.scrollY - 60; // 40px above
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }

    scrollToExerciseList(dayId: string): void {
        const element = document.getElementById(`exercise-list-${dayId}`);
        if (element) {
            const y = element.getBoundingClientRect().top + window.scrollY - 40; // 40px above
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }

    private updateRoutineExerciseNames(): void {
        // Update availableRoutines
        this.availableRoutines.forEach(routine => {
            routine.exercises.forEach(ex => {
                const translated = this.availableExercises.find(e => e.id === ex.exerciseId);
                if (translated) {
                    ex.exerciseName = translated.name;
                }
            });
        });

        // Update temporaryCustomRoutines
        Array.from(this.temporaryCustomRoutines.values()).forEach(routine => {
            routine.exercises.forEach(ex => {
                const translated = this.availableExercises.find(e => e.id === ex.exerciseId);
                if (translated) {
                    ex.exerciseName = translated.name;
                }
            });
        });
    }

    protected targetExists(target: any) {
        return target !== undefined && target !== null;
    }

    async showCreationWizard(): Promise<void> {
        // Step 0: Template or Blank
        const templateResult = await this.alertService.showPromptDialog(
            this.translate.instant('programBuilder.wizard.templateOrBlankTitle'),
            this.translate.instant('programBuilder.wizard.templateOrBlankMsg'),
            [
                {
                    name: 'routineTemplate',
                    type: 'radio',
                    label: this.translate.instant('programBuilder.wizard.templateOrBlankLabel'),
                    value: 'blank',
                    options: [
                        { label: 'Blank (Custom)', value: 'blank' },
                        { label: '3x3', value: '3x3' },
                        { label: '5x5', value: '5x5' },
                        { label: 'Push/Pull/Legs', value: 'ppl' },
                        { label: '5/3/1', value: '531' }
                    ],
                    required: true
                }
            ],
            this.translate.instant('alertService.buttons.ok')
        );
        if (!templateResult || !templateResult['routineTemplate']) return;

        const routineTemplate = String(templateResult['routineTemplate']);
        // If a template is chosen, generate the program and return
        if (routineTemplate !== 'blank') {
            await this.createProgramFromTemplate(routineTemplate);
            return;
        }

        // Step 1: Program Name
        const nameResult = await this.alertService.showPromptDialog(
            this.translate.instant('programBuilder.form.nameLabel'),
            this.translate.instant('programBuilder.form.nameWizardMsg'),
            [
                {
                    name: 'programName',
                    type: 'text',
                    label: this.translate.instant('programBuilder.form.nameLabel'),
                    placeholder: this.translate.instant('programBuilder.form.namePlaceholder'),
                    required: true,
                    autofocus: true
                }
            ],
            this.translate.instant('alertService.buttons.ok')
        );
        if (!nameResult || !nameResult['programName']) return;

        // Step 2: Program Type
        const typeResult = await this.alertService.showPromptDialog(
            this.translate.instant('programBuilder.form.structureLabel'),
            this.translate.instant('programBuilder.form.structureWizardMsg'),
            [
                {
                    name: 'programType',
                    type: 'radio',
                    label: this.translate.instant('programBuilder.form.structureLabel'),
                    value: 'cycled', // default
                    options: [
                        { label: this.translate.instant('programBuilder.form.repeatingCycle'), value: 'cycled' },
                        { label: this.translate.instant('programBuilder.form.weekByWeek'), value: 'linear' }
                    ],
                    required: true
                }
            ],
            this.translate.instant('alertService.buttons.ok')
        );
        if (!typeResult || !typeResult['programType']) return;

        const programType = typeResult['programType'];

        let cycleLength = 7;
        let numWeeks = 1;
        let daysPerWeek: number[][] = [];

        if (programType === 'cycled') {
            // Step 3a: Cycle Length
            const cycleResult = await this.alertService.showPromptDialog(
                this.translate.instant('programBuilder.form.cycleLengthLabel'),
                this.translate.instant('programBuilder.form.cycleLengthWizardMsg'),
                [
                    {
                        name: 'cycleLength',
                        type: 'number',
                        label: this.translate.instant('programBuilder.form.cycleLengthLabel'),
                        placeholder: '7',
                        value: 7,
                        min: 1,
                        required: true,
                        attributes: { min: 1 }
                    }
                ],
                this.translate.instant('alertService.buttons.ok')
            );
            if (!cycleResult || !cycleResult['cycleLength']) return;
            cycleLength = Number(cycleResult['cycleLength']);
        } else {
            // Step 3b: Number of Weeks
            const weekResult = await this.alertService.showPromptDialog(
                this.translate.instant('programBuilder.weeks.numWeeksLabel'),
                this.translate.instant('programBuilder.weeks.numWeeksWizardMsg'),
                [
                    {
                        name: 'numWeeks',
                        type: 'number',
                        label: this.translate.instant('programBuilder.weeks.numWeeksLabel'),
                        placeholder: '4',
                        value: 4,
                        min: 1,
                        required: true,
                        attributes: { min: 1 }
                    }
                ],
                this.translate.instant('alertService.buttons.ok')
            );
            if (!weekResult || !weekResult['numWeeks']) return;
            numWeeks = Number(weekResult['numWeeks']);

            // Step 3c: Days per week (checkboxes)
            // Weekday values: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
            const weekDayOptions = [
                { label: this.translate.instant('dates.days.monday'), value: 1 },
                { label: this.translate.instant('dates.days.tuesday'), value: 2 },
                { label: this.translate.instant('dates.days.wednesday'), value: 3 },
                { label: this.translate.instant('dates.days.thursday'), value: 4 },
                { label: this.translate.instant('dates.days.friday'), value: 5 },
                { label: this.translate.instant('dates.days.saturday'), value: 6 },
                { label: this.translate.instant('dates.days.sunday'), value: 0 }
            ];
            const defaultDays = [1, 3, 5]; // Mon, Wed, Fri

            for (let i = 0; i < numWeeks; i++) {

                const weekDaysInputs: AlertInput[] = weekDayOptions.map(day => ({
                    label: day.label,
                    name: 'day-' + day.value,
                    type: 'checkbox',
                    value: defaultDays.includes(day.value) ? 1 : 0,
                }));

                const daysResult = await this.alertService.showPromptDialog(
                    this.translate.instant('programBuilder.weeks.daysInWeekLabel', { week: i + 1 }),
                    this.translate.instant('programBuilder.weeks.daysInWeekWizardMsg', { week: i + 1 }),
                    weekDaysInputs,
                    this.translate.instant('alertService.buttons.ok')
                );
                if (!daysResult || this.areAllPropertiesFalsy(daysResult)) {
                    return; // User cancelled
                }

                // Convert daysResult object to an array of selected day values (numbers)
                const selectedDays: number[] = Object.entries(daysResult)
                    .filter(([key, value]) => key.startsWith('day-') && value)
                    .map(([key]) => Number(key.replace('day-', '')));

                if (selectedDays.length === 0) return; // Require at least one day
                daysPerWeek.push(selectedDays);



            }
        }

        // Patch the form and create controls
        this.programForm.patchValue({
            name: nameResult['programName'],
            programType,
            cycleLength: programType === 'cycled' ? cycleLength : null
        });

        if (programType === 'cycled') {
            this.scheduleFormArray.clear();
            for (let i = 1; i <= cycleLength; i++) {
                this.scheduleFormArray.push(this.createScheduledDayGroup({ dayOfWeek: i }));
            }
        } else {
            this.weeksFormArray.clear();
            for (let w = 0; w < numWeeks; w++) {
                const weekGroup = this.createWeekGroup({ weekNumber: w + 1 });
                const scheduleArray = weekGroup.get('schedule') as FormArray;
                // Use the selected days for this week, sorted Mon-Sun
                const weekDayOrder = [1, 2, 3, 4, 5, 6, 0];
                daysPerWeek[w]
                    .slice()
                    .sort((a, b) => weekDayOrder.indexOf(a) - weekDayOrder.indexOf(b))
                    .forEach(dayOfWeek => {
                        scheduleArray.push(this.createScheduledDayGroup({ dayOfWeek }));
                    });
                this.weeksFormArray.push(weekGroup);
            }
        }
    }

    private async createProgramFromTemplate(template: string) {
        this.skipAutoAddWeek = true;
        this.weeksFormArray.clear();

        // Use the shared service method
        const routines = this.workoutService.generateRoutineFromTemplate(template, this.availableExercises);


        // Patch the form
        this.programForm.patchValue({
            name: this.getTemplateProgramName(template),
            programType: 'linear',
            cycleLength: null
        });

        // For a training program, assign routines to days as usual
        const week = this.createWeekGroup({ weekNumber: 1 });
        const schedule = week.get('schedule') as FormArray;

        // Example: assign routines to days (adjust as needed for your template logic)
        if (template === 'ppl') {
            // Push, Pull, Legs: Mon, Wed, Fri
            [1, 3, 5].forEach((dayOfWeek, i) => {
                this.assignRoutineToDay(schedule, routines, dayOfWeek, i, template);
            });
        } else if (template === '531') {
            // 5/3/1: 4 days/week
            [1, 3, 5, 0].forEach((dayOfWeek, i) => {
                this.assignRoutineToDay(schedule, routines, dayOfWeek, i, template);

            });
        } else {
            // Default: assign each routine to a day (Mon, Wed, Fri)
            [1, 3, 5].forEach((dayOfWeek, i) => {
                this.assignRoutineToDay(schedule, routines, dayOfWeek, i, template);

            });
        }

        this.weeksFormArray.push(week);

        setTimeout(() => this.scrollToWeek(0), 200);
        this.toastService.success(this.translate.instant('programBuilder.wizard.templateCreated'), 3000);
        this.skipAutoAddWeek = false;
    }

    // Helper to get a display name for the template
    private getTemplateProgramName(template: string): string {
        switch (template) {
            case '3x3': return '3x3 Strength';
            case '5x5': return '5x5 Strength';
            case 'ppl': return 'Push/Pull/Legs';
            case '531': return '5/3/1';
            default: return 'Custom Program';
        }
    }

    protected getProgramType(): string {
        return this.programForm?.get('programType')?.value;
    }

    protected getProgramName(): string {
        return this.programForm?.get('name')?.value;
    }

    public bouncedExerciseListId: string | null = null;

    triggerBounceOnExerciseList(dayId: string) {
        this.bouncedExerciseListId = dayId;
        setTimeout(() => {
            if (this.bouncedExerciseListId === dayId) {
                this.bouncedExerciseListId = null;
            }
        }, 700); // slightly longer than animation
    }

    areAllPropertiesFalsy(obj: any): boolean {
        return Object.values(obj).every(value => !value);
    }

    /**
 * Assigns a routine to a day in the schedule FormArray.
 * If the routine is missing, logs a warning and optionally shows a toast.
 */
    private assignRoutineToDay(
        schedule: FormArray,
        routines: Routine[],
        dayOfWeek: number,
        routineIndex: number,
        template: string
    ): void {
        const routine = routines[routineIndex % routines.length];
        if (!routine) {
            const msg = `No routine found for index ${routineIndex} in template ${template}`;
            console.warn(msg);
            this.toastService.warning(msg, 4000, 'Template Warning');
            // Optionally, you could assign a placeholder routine or skip
            return;
        }
        const dayGroup = this.createScheduledDayGroup({ dayOfWeek });
        // use the weekDay name from dayOfWeekOptions instead of the number
        const dayName = this.dayOfWeekOptions.find(option => option.value === dayOfWeek)?.label || '';
        const routineName = routine.name + ' ' + this.translate.instant('trainingPrograms.calendar.day') + ' ' + (dayName);
        dayGroup.patchValue({
            routineId: routine.id,
            routineName: routineName,
            dayName: routineName
        });
        schedule.push(dayGroup);
        // Add to temporaryCustomRoutines for editing/persistence
        const cacheKey = `0-${routineIndex}`;
        this.temporaryCustomRoutines.set(cacheKey, routines[routineIndex % routines.length]);
    }

    get chosenRoutineForModal(): Routine | null {
        // For cycled: use targetScheduleIndexForRoutine, for linear: use targetIndicesForRoutine
        if (this.targetIndicesForRoutine) {
            const { weekIndex, dayIndex } = this.targetIndicesForRoutine;
            let routineId: string | undefined;
            if (weekIndex !== undefined) {
                routineId = this.getWeekScheduleDayControl(weekIndex, dayIndex).get('routineId')?.value;
            } else {
                routineId = this.scheduleFormArray.at(dayIndex).get('routineId')?.value;
            }
            return this.availableRoutines.find(r => r.id === routineId) || null;
        }
        return null;
    }

    // Add this property to your component
    routineModalDayContext: { weekIndex?: number, dayIndex: number } | null = null;
}



