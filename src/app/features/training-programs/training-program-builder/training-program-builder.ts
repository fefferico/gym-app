import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subscription, of, firstValueFrom } from 'rxjs';
import { switchMap, tap, take, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

import { TrainingProgram, ScheduledRoutineDay, TrainingProgramHistoryEntry, ProgramWeek } from '../../../core/models/training-program.model';
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
import { addDays, differenceInDays, format, getDay, parseISO } from 'date-fns';
import { TrackingService } from '../../../core/services/tracking.service';
import { WorkoutLog } from '../../../core/models/workout-log.model';
import { MenuMode } from '../../../core/models/app-settings.model';

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
    private trackingService = inject(TrackingService);

    programForm!: FormGroup;
    submitted = false; // Add this flag

    isEditMode = false;
    isNewMode = false;
    isViewMode = false;
    isEditableMode = computed(() => this.isEditMode || this.isNewMode);
    currentProgramId: string | null = null;
    currentProgram: TrainingProgram | null | undefined = null;
    isCurrentProgramActive = signal<boolean>(false);
    private routeSub!: Subscription;

    private sanitizer = inject(DomSanitizer);
    public sanitizedDescription: SafeHtml = '';

    infoTooltipString: string = 'The total number of days in the repeating cycle, INCLUDING rest days. Example: For an Upper/Lower split with a rest day after each workout (Upper, Rest, Lower, Rest), set Cycle Length to 4.';

    // For routine selection modal
    isRoutineModalOpen = signal(false);
    availableRoutines: Routine[] = [];
    modalSearchTerm = signal('');
    private targetScheduleIndexForRoutine: number | null = null; // To know which schedule day to update
    private targetIndicesForRoutine: { weekIndex?: number, dayIndex: number } | null = null;

    // Day options for dropdown
    dayOfWeekOptions: DayOption[] = [
        { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' },
        { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' },
        { value: 0, label: 'Sunday' }
    ];

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

    currentDayOptions = computed<DayOption[]>(() => {
        // --- FIX 3: Depend on the new signal ---
        const cycleLength = this.cycleLengthSignal();
        return (cycleLength && cycleLength > 0) ? this.cycleDayOptions() : this.dayOfWeekOptions;
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
        const program = this.currentProgram;
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
        const program = this.currentProgram;
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
        const program = this.currentProgram;
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
                    this.programForm.reset({ programType: null, cycleLength: null, schedule: [] });
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

    handleProgramTypeChange(type: 'cycled' | 'linear'): void {
        const isRepeatingControl = this.programForm.get('isRepeating');
        if (type === 'linear') {
            this.scheduleFormArray.clear();
            this.programForm.get('cycleLength')?.setValue(null);
            this.programForm.get('cycleLength')?.disable();
            isRepeatingControl?.enable(); // Enable repeat toggle for linear programs
            if (this.weeksFormArray.length === 0 && !this.isViewMode) {
                this.addWeek(); // Add the first week automatically in edit/new modes
            }
        } else { // 'cycled'
            this.weeksFormArray.clear();
            this.programForm.get('cycleLength')?.enable();
            isRepeatingControl?.setValue(false); // Reset and disable for cycled programs
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
            name: [week?.name ?? `Week ${this.weeksFormArray.length + 1}`, Validators.required],
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
        this.cdr.detectChanges();
        setTimeout(() => { /* scroll to new week logic */ }, 50);
    }

    // --- NEW: Remove a week from the form ---
    removeWeek(weekIndex: number): void {
        this.weeksFormArray.removeAt(weekIndex);
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
    
        this.expandedWeekIds.set(initialWeekIds);
        this.expandedDayIds.set(initialDayIds);
    
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
                        'Check Day Name'
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
    
        this.cdr.detectChanges();
    
        setTimeout(() => {
            const elements = document.querySelectorAll('.scheduled-day-card');
            if (elements.length > 0) {
                elements[elements.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 50);
    }

    // --- MODIFIED: Remove a day from the correct schedule ---
    removeScheduledDay(index: number, weekIndex?: number): void {
        if (this.isViewMode) return;
        const programType = this.programForm.get('programType')?.value;

        if (programType === 'linear' && weekIndex !== undefined) {
            const weekSchedule = this.weeksFormArray.at(weekIndex).get('schedule') as FormArray;
            weekSchedule.removeAt(index);
        } else {
            this.scheduleFormArray.removeAt(index);
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

    // --- MODIFIED: Signature and logic updated ---
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
            isActive: this.currentProgram?.isActive ?? false
        };

        try {
            this.spinnerService.show("Saving program...");
            if (this.isNewMode) {
                const newProgram = await this.trainingProgramService.addProgram(programPayload as Omit<TrainingProgram, 'id' | 'isActive' | 'schedule'> & { schedule: Omit<ScheduledRoutineDay, 'id'>[] });
                this.isNewMode = false;
                this.isEditMode = true;
                this.currentProgramId = newProgram.id;
            } else if (this.isEditMode && this.currentProgramId) {
                const existingProgram = await firstValueFrom(this.trainingProgramService.getProgramById(this.currentProgramId).pipe(take(1)));
                programPayload.isActive = existingProgram?.isActive ?? false;
                await this.trainingProgramService.updateProgram(programPayload);
            }
            this.toastService.success("Program saved successfully", 0, "Success");
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
        try {
            this.spinnerService.show("Deleting program...");
            await this.trainingProgramService.deleteProgram(this.currentProgramId);

            if (this.router.url.includes(`/training-programs/edit/${this.currentProgramId}`) ||
                this.router.url.includes(`/training-programs/view/${this.currentProgramId}`)) {
                this.router.navigate(['/training-programs']);
            }
        } catch (error) {
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
        if (!this.currentProgram?.history || this.currentProgram.history.length === 0) {
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
        const activateBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-green-600 flex items-center text-sm hover:text-gray-100';;
        const deactivateBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-500 flex items-center text-sm hover:text-gray-100';;

        const currentProgram = this.currentProgram;

        const editProgramButton =
        {
            label: 'EDIT',
            actionKey: 'edit',
            iconName: `edit`,
            iconClass: 'w-8 h-8 mr-2',
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
            data: { programId: programId }
        };

        const activateProgramBtn = {
            label: 'ACTIVATE',
            actionKey: 'activate',
            iconName: 'activate',
            iconClass: 'w-8 h-8 mr-2',
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + activateBtnClass,
            data: { programId: programId }
        };

        const historyProgramBtn = {
            label: 'HISTORY',
            actionKey: 'history',
            iconName: 'clock',
            iconClass: 'w-8 h-8 mr-2',
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
            data: { programId: programId }
        };

        const finishProgramBtn = {
            label: 'FINISH',
            actionKey: 'finish',
            iconName: 'goal',
            iconClass: 'w-8 h-8 mr-2',
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
            data: { programId: programId }
        };

        const deactivateProgramBtn =
        {
            label: 'DEACTIVATE',
            actionKey: 'deactivate',
            iconSvg: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" stroke="currentColor" stroke-width="10"/><line x1="25" y1="50" x2="75" y2="50" stroke="currentColor" stroke-width="10"/></svg>`,
            iconClass: 'w-7 h-7 mr-2',
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deactivateBtnClass,
            data: { programId: programId }
        };

        let actionsArray = [] as ActionMenuItem[];

        if (currentProgram?.isActive) {
            actionsArray.push(finishProgramBtn);
            actionsArray.push(deactivateProgramBtn);
        } else {
            actionsArray.push(activateProgramBtn);
        }

        // if (currentProgram?.history && currentProgram.history.length > 0) {
        actionsArray.push(historyProgramBtn);
        // }

        if (this.isViewMode) {
            actionsArray.push(editProgramButton);
        }
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
        }
    }

    activeRoutineIdActions = signal<string | null>(null);

    toggleActions(routineId: string, event: MouseEvent): void {
        event.stopPropagation();
        this.activeRoutineIdActions.update(current => (current === routineId ? null : routineId));
    }

    areActionsVisible(routineId: string): boolean {
        return this.activeRoutineIdActions() === routineId;
    }

    onCloseActionMenu() {
        this.activeRoutineIdActions.set(null);
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
            this.currentProgram = updatedProgram;
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
            this.currentProgram = updatedProgram;

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

    // --- NEW ---
    onWeekDrop(event: CdkDragDrop<FormGroup[]>): void {
        if (this.isViewMode) return;
        moveItemInArray(this.weeksFormArray.controls, event.previousIndex, event.currentIndex);
        // Update weekNumber property after reordering
        this.weeksFormArray.controls.forEach((group, index) => {
            group.get('weekNumber')?.setValue(index + 1);
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
    toggleWeek(weekId: string): void {
        this.expandedWeekIds.update(currentSet => {
            const newSet = new Set(currentSet);
            if (newSet.has(weekId)) {
                newSet.delete(weekId);
            } else {
                newSet.add(weekId);
            }
            return newSet;
        });
    }

    isWeekExpanded(weekId: string): boolean {
        return this.expandedWeekIds().has(weekId);
    }

    toggleDay(dayId: string): void {
        this.expandedDayIds.update(currentSet => {
            const newSet = new Set(currentSet);
            if (newSet.has(dayId)) {
                newSet.delete(dayId);
            } else {
                newSet.add(dayId);
            }
            return newSet;
        });
    }

    isDayExpanded(dayId: string): boolean {
        return this.expandedDayIds().has(dayId);
    }
}