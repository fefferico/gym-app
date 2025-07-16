// src/app/features/workout-routines/routine-list/routine-list.component.ts
import { Component, inject, OnInit, PLATFORM_ID, signal, computed, OnDestroy, HostListener } from '@angular/core'; // Added computed, OnDestroy
import { CommonModule, DatePipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, Observable, Subscription, take } from 'rxjs'; // Added Subscription
import { map } from 'rxjs/operators';
import { Routine } from '../../core/models/workout.model'; // Added ExerciseDetail
import { Exercise } from '../../core/models/exercise.model'; // Added Exercise
import { WorkoutService } from '../../core/services/workout.service';
import { ExerciseService } from '../../core/services/exercise.service'; // Import ExerciseService
import { AlertService } from '../../core/services/alert.service';
import { SpinnerService } from '../../core/services/spinner.service';
import { TrackingService } from '../../core/services/tracking.service';
import { ToastService } from '../../core/services/toast.service';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { StorageService } from '../../core/services/storage.service';
import { AlertButton } from '../../core/models/alert.model';
import { format } from 'date-fns';
import { PausedWorkoutState } from './workout-player'; // Adjust path as needed
import { ThemeService } from '../../core/services/theme.service';
import { ActionMenuItem } from '../../core/models/action-menu.model';
import { ActionMenuComponent } from '../../shared/components/action-menu/action-menu';
import e from 'express';
import { LongPressDirective } from '../../shared/directives/long-press.directive';
import { PressDirective } from '../../shared/directives/press.directive';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TrainingProgramService } from '../../core/services/training-program.service';
import { PressScrollDirective } from '../../shared/directives/press-scroll.directive';

@Component({
  selector: 'app-routine-list',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe, RouterLink, ActionMenuComponent, PressDirective, PressScrollDirective],
  templateUrl: './routine-list.html',
  styleUrl: './routine-list.scss',
  animations: [
    trigger('fabSlideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(200%)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(100%)' }))
      ])
    ]),
    trigger('slideInOutActions', [
      state('void', style({
        height: '0px', opacity: 0, overflow: 'hidden',
        paddingTop: '0', paddingBottom: '0', marginTop: '0', marginBottom: '0'
      })),
      state('*', style({
        height: '*', opacity: 1, overflow: 'hidden',
        paddingTop: '0.5rem', paddingBottom: '0.5rem'
      })),
      transition('void <=> *', animate('200ms ease-in-out'))
    ]),
    trigger('dropdownMenu', [
      state('void', style({
        opacity: 0, transform: 'scale(0.75) translateY(-10px)', transformOrigin: 'top right'
      })),
      state('*', style({
        opacity: 1, transform: 'scale(1) translateY(0)', transformOrigin: 'top right'
      })),
      transition('void => *', [animate('150ms cubic-bezier(0.25, 0.8, 0.25, 1)')]),
      transition('* => void', [animate('100ms cubic-bezier(0.25, 0.8, 0.25, 1)')])
    ])
  ]
})
export class RoutineListComponent implements OnInit, OnDestroy {
  private workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService); // Inject ExerciseService
  private trackingService = inject(TrackingService);
  private trainingService = inject(TrainingProgramService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private spinnerService = inject(SpinnerService);
  private toastService = inject(ToastService);
  private storageService = inject(StorageService);
  private themeService = inject(ThemeService);
  private platformId = inject(PLATFORM_ID);

  private sanitizer = inject(DomSanitizer);
  public sanitizedDescription: SafeHtml = '';

  routines$: Observable<Routine[]> | undefined; // Original observable
  allRoutinesForList = signal<Routine[]>([]); // Signal for all routines
  private routinesSubscription: Subscription | undefined;
  private exercisesSubscription: Subscription | undefined;

  showBackToTopButton = signal<boolean>(false);
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    // Check if the user has scrolled down more than a certain amount (e.g., 400 pixels)
    // You can adjust this value to your liking.
    const verticalOffset = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    this.showBackToTopButton.set(verticalOffset > 400);
  }

  // Signals for menu and accordion
  visibleActionsRutineId = signal<string | null>(null);
  menuModeCompact: boolean = false;
  isFilterAccordionOpen = signal(false);

  // Signals for filter values
  routineSearchTerm = signal<string>('');
  selectedRoutineGoal = signal<string | null>(null);
  selectedEquipment = signal<string[]>([]); // Now an array of strings
  selectedRoutineMuscleGroup = signal<string | null>(null);

  // Signals for filter dropdown options
  uniqueRoutineGoals = signal<string[]>([]);
  uniqueRoutineEquipments = signal<string[]>([]);
  uniqueRoutineMuscleGroups = signal<string[]>([]);
  private allExercisesMap = new Map<string, Exercise>(); // To store exercises for quick lookup

  private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';


  maxDuration = signal<number>(120); // A default max, will be updated dynamically
  selectedMaxDuration = signal<number>(120); // The current value of the slider
  showHiddenRoutines = signal<boolean>(false);
  showFavouriteRoutinesOnly = signal<boolean>(false);

  // Computed signal for filtered routines
  filteredRoutines = computed(() => {
    let routines = this.allRoutinesForList();
    const showHidden = this.showHiddenRoutines(); // Get the value of the signal once
    const showFavouriteRoutinesOnlyFilter = this.showFavouriteRoutinesOnly();

    if (!showHidden) {
      routines = routines.filter(routine => !routine.isHidden);
    }
    if (showFavouriteRoutinesOnlyFilter) {
      routines = routines.filter(routine => routine.isFavourite);
    }
    const searchTerm = this.routineSearchTerm().toLowerCase();
    const goalFilter = this.selectedRoutineGoal();
    const muscleFilter = this.selectedRoutineMuscleGroup();
    const equipmentFilter = this.selectedEquipment();
    const durationFilter = this.selectedMaxDuration(); // Get the slider value

    // Calculate estimated duration for each routine once, to avoid recalculating
    const routinesWithDuration = routines.map(r => ({
      ...r,
      estimatedDuration: this.getRoutineDuration(r)
    }));

    // Apply duration filter first
    routines = routinesWithDuration.filter(r => r.estimatedDuration <= durationFilter);

    if (searchTerm) {
      routines = routines.filter(r =>
        r.name.toLowerCase().includes(searchTerm) ||
        (r.description && r.description.toLowerCase().includes(searchTerm))
      );
    }
    if (goalFilter) {
      routines = routines.filter(r => r.goal?.toLowerCase() === goalFilter.toLowerCase());
    }
    if (muscleFilter) {
      routines = routines.filter(r =>
        r.exercises.some(exDetail => {
          const fullExercise = this.allExercisesMap.get(exDetail.exerciseId);
          return fullExercise?.primaryMuscleGroup.toLowerCase() === muscleFilter.toLowerCase();
        })
      );
    }
    // New logic for multi-select equipment
    if (equipmentFilter.length > 0) {
      routines = routines.filter(r => {
        // Get all unique equipment for this routine
        const routineEquipment = new Set<string>();
        r.exercises.forEach(exDetail => {
          const fullExercise = this.allExercisesMap.get(exDetail.exerciseId);
          if (fullExercise?.equipment) {
            routineEquipment.add(fullExercise.equipment);
          }
          fullExercise?.equipmentNeeded?.forEach(eq => {
            // Simplified cleanup logic
            if (eq.toLowerCase().includes('kettlebell')) {
              routineEquipment.add('Kettlebell');
            } else {
              routineEquipment.add(eq.split(' (')[0].trim());
            }
          });
        });
        // Check if every selected filter equipment is present in the routine's equipment
        return equipmentFilter.every(filterEq => routineEquipment.has(filterEq));
      });
    }
    return routines;
  });

  // --- ADD A NEW METHOD TO TOGGLE EQUIPMENT CHIPS ---
  toggleEquipmentFilter(equipment: string): void {
    this.selectedEquipment.update(current => {
      const newSelection = new Set(current);
      if (newSelection.has(equipment)) {
        newSelection.delete(equipment); // If it exists, remove it
      } else {
        newSelection.add(equipment); // If it doesn't exist, add it
      }
      return Array.from(newSelection);
    });
  }


  // --- ADD NEW PROPERTIES FOR THE FAB ---
  isFabActionsOpen = signal(false);
  isTouchDevice = false;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
      this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    this.menuModeCompact = this.themeService.isMenuModeCompact();

    // Fetch all exercises first to build the map
    this.exercisesSubscription = this.exerciseService.getExercises().subscribe(exercises => {
      exercises.forEach(ex => this.allExercisesMap.set(ex.id, ex));
      // Once exercises are loaded, then load routines and populate filters
      this.loadRoutinesAndPopulateFilters();
    });

    // This observable is for the template's async pipe if needed for loading states, before filtering kicks in.
    this.routines$ = this.workoutService.routines$;
  }

  private loadRoutinesAndPopulateFilters(): void {
    this.routinesSubscription = this.workoutService.routines$.subscribe(routines => {
      // routines.map(routine => ({
      //   ...routine,
      //   description: this.updateSanitizedDescription(routine.description || '')
      // }));

      this.allRoutinesForList.set(routines); // Update the signal with all routines
      this.populateRoutineFilterOptions(routines);
    });
  }

  private populateRoutineFilterOptions(routines: Routine[]): void {
    if (!routines || routines.length === 0) {
      this.maxDuration.set(120); // Reset to default if no routines
      return;
    };

    const goals = new Set<string>();
    const muscles = new Set<string>();
    const equipments = new Set<string>();
    let maxCalculatedDuration = 0;

    routines.forEach(routine => {
      // Calculate duration for each routine
      const duration = this.getRoutineDuration(routine);
      if (duration > maxCalculatedDuration) {
        maxCalculatedDuration = duration;
      }

      if (routine.goal) {
        goals.add(routine.goal);
      }
      routine.exercises.forEach(exDetail => {
        const fullExercise = this.allExercisesMap.get(exDetail.exerciseId);
        if (fullExercise?.primaryMuscleGroup) {
          muscles.add(fullExercise.primaryMuscleGroup);
        }

        // EQUIPMENTS
        if (fullExercise?.equipmentNeeded) {
          fullExercise.equipmentNeeded.forEach(equip => {
            // remove noise from equipment string
            // and reduce any KB-relates exercise to just 'Kettlebell'
            const altIndex = equip.indexOf(' (alternative)');
            const optIndex = equip.indexOf(' (optional)');
            const dbIndex = equip.indexOf('Dumbbells');
            const dbsIndex = equip.indexOf('Dumbbell(s)');
            const kbIndex = equip.indexOf('Kettlebells');
            const kbsIndex = equip.indexOf('Kettlebell(s)');
            if (altIndex >= 0) {
              equip = equip.substring(0, altIndex);
            }
            if (optIndex >= 0) {
              equip = equip.substring(0, optIndex);
            }
            if (kbsIndex >= 0 || kbIndex >= 0) {
              equip = 'Kettlebell';
            }
            if (dbIndex >= 0 || dbsIndex >= 0) {
              equip = 'Dumbbell';
            }
            equipments.add(equip);
          });
        } else if (fullExercise?.equipment) {
          equipments.add(fullExercise.equipment);
        }
      });
    });
    // Set the max for the slider, with a sensible ceiling (e.g., 180 mins)
    const newMax = Math.min(Math.ceil(maxCalculatedDuration / 10) * 10, 180); // Round up to nearest 10
    this.maxDuration.set(newMax > 0 ? newMax : 120);
    this.selectedMaxDuration.set(newMax > 0 ? newMax : 120); // Also reset the selected value

    this.uniqueRoutineGoals.set(Array.from(goals).sort());
    this.uniqueRoutineMuscleGroups.set(Array.from(muscles).sort());
    this.uniqueRoutineEquipments.set(Array.from(equipments).sort());
  }

  // --- Filter Methods ---
  toggleFilterAccordion(): void {
    this.isFilterAccordionOpen.update(isOpen => !isOpen);
  }

  onRoutineSearchTermChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.routineSearchTerm.set(target.value);
  }

  onRoutineGoalChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedRoutineGoal.set(target.value || null);
  }

  // onRoutineEquipmentChange(event: Event): void {
  //   const target = event.target as HTMLSelectElement;
  //   this.selectedEquipment.set(target.value || null);
  // }

  onRoutineMuscleGroupChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedRoutineMuscleGroup.set(target.value || null);
  }

  onDurationFilterChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectedMaxDuration.set(Number(target.value));
  }

  // --- UPDATE the clear filters method ---
  clearRoutineFilters(): void {
    this.routineSearchTerm.set('');
    this.selectedRoutineGoal.set(null);
    this.selectedRoutineMuscleGroup.set(null);
    this.selectedEquipment.set([]);
    this.selectedMaxDuration.set(this.maxDuration()); // Reset slider to its max value

    const searchInput = document.getElementById('routine-search-term') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
    const goalSelect = document.getElementById('routine-goal-filter') as HTMLSelectElement;
    if (goalSelect) goalSelect.value = '';
    const muscleSelect = document.getElementById('routine-muscle-filter') as HTMLSelectElement;
    if (muscleSelect) muscleSelect.value = '';
    const equipmentSelect = document.getElementById('routine-equipment-filter') as HTMLSelectElement; // This ID will be removed, but keeping logic just in case
    if (equipmentSelect) equipmentSelect.value = '';
  }


  // --- Action Methods ---
  navigateToCreateRoutine(): void {
    this.router.navigate(['/workout/routine/new']);
  }

  editRoutine(routineId: string, event?: MouseEvent): void {
    // event.stopPropagation();
    this.router.navigate(['/workout/routine/edit', routineId]);
    this.visibleActionsRutineId.set(null);
  }

  async deleteRoutine(routineId: string, event?: MouseEvent): Promise<void> {
    // event.stopPropagation();
    this.visibleActionsRutineId.set(null);

    const routineToDelete = this.allRoutinesForList().find(r => r.id === routineId); // Use signal value
    if (!routineToDelete) {
      this.toastService.error("Routine not found for deletion", 0, "Error");
      return;
    }

    const associatedLogs = await firstValueFrom(this.trackingService.getWorkoutLogsByRoutineId(routineId).pipe(take(1))) || [];
    const associatedPrograms = await firstValueFrom(this.trainingService.getProgramsByRoutineId(routineId).pipe(take(1))) || [];
    let confirmationMessage = `Are you sure you want to delete the routine "${routineToDelete.name}"?`;
    if (associatedLogs.length > 0) {
      confirmationMessage += ` This will also delete ${associatedLogs.length} associated workout log(s).`;
    }
    if (associatedPrograms.length > 0) {
      if (associatedPrograms.length === 1){
        const associatedProgram = associatedPrograms[0].schedule.find(sched => sched.routineId === routineId);
        const programName = associatedProgram ? '\'' +  associatedProgram.routineName + '\'' : '';
        confirmationMessage += ` This will also delete the entries in ${programName ? programName : '1'} associated program(s).`;
      } else {
        confirmationMessage += ` This will also delete the entries in ${associatedPrograms.length} associated program(s).`;
      }
    }

    if (associatedLogs.length > 0 || associatedPrograms.length > 0){
       confirmationMessage += ' This action cannot be undone.';
    }

    const confirm = await this.alertService.showConfirm('Delete Routine', confirmationMessage, 'Delete');

    if (confirm && confirm.data) {
      try {
        this.spinnerService.show();
        if (associatedLogs.length > 0) {
          await this.trackingService.clearWorkoutLogsByRoutineId(routineId);
        }
        await this.workoutService.deleteRoutine(routineId); // Assuming this is async now
        this.toastService.success(`Routine "${routineToDelete.name}" deleted successfully.`, 4000, "Routine Deleted");
      } catch (error) {
        console.error("Error during deletion:", error);
        this.toastService.error("Failed to delete routine or its logs", 0, "Deletion Failed");
      } finally {
        this.spinnerService.hide();
      }
    }
  }

  async startWorkout(newRoutineId: string, event?: MouseEvent): Promise<void> {
    // event.stopPropagation();
    this.visibleActionsRutineId.set(null);

    if (!isPlatformBrowser(this.platformId)) {
      this.router.navigate(['/workout/play', newRoutineId]);
      return;
    }

    const pausedState = this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);
    if (pausedState) {
      const pausedRoutineName = pausedState.sessionRoutine?.name || 'a previous session';
      const pausedDate = pausedState.workoutDate ? ` from ${format(new Date(pausedState.workoutDate), 'MMM d, HH:mm')}` : '';
      const buttons: AlertButton[] = [
        { text: 'Cancel', role: 'cancel', data: 'cancel' },
        { text: 'Discard Paused & Start New', role: 'confirm', data: 'discard_start_new', cssClass: 'bg-red-500 hover:bg-red-600 text-white' },
        { text: `Resume: ${pausedRoutineName.substring(0, 15)}${pausedRoutineName.length > 15 ? '...' : ''}`, role: 'confirm', data: 'resume_paused', cssClass: 'bg-green-500 hover:bg-green-600 text-white' },
      ];
      const confirmation = await this.alertService.showConfirmationDialog('Workout in Progress', `You have a paused workout ("${pausedRoutineName}"${pausedDate}). What would you like to do?`, buttons);

      if (confirmation && confirmation.data === 'resume_paused') {
        const targetRoutineId = pausedState.routineId || 'ad-hoc';
        this.router.navigate(['/workout/play', pausedState.routineId || ''], { queryParams: { resume: 'true' } }); // Handle undefined routineId
      } else if (confirmation && confirmation.data === 'discard_start_new') {
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        this.toastService.info('Previous paused workout discarded.', 3000);
        this.router.navigate(['/workout/play', newRoutineId]);
      } else {
        this.toastService.info('Starting new workout cancelled.', 2000);
      }
    } else {
      // Use absolute path for player
      if (/* condition to start new */ true) { // Simplified condition
        this.router.navigate(['/workout/play', newRoutineId]);
      }
    }
  }

  viewRoutineDetails(routineId: string, event?: Event): void {
    event?.stopPropagation();
    if (event && event.target) {
      const elem = event.target as HTMLElement;
      if (elem.className && elem.className.includes('bg-primary')) {
        return;
      }
    }
    this.router.navigate(['/workout/routine/view', routineId, { isView: 'routineBuilder' }]); // Pass isView flag
    this.visibleActionsRutineId.set(null);
  }

  hideRoutine(routineId: string, event?: MouseEvent | Event): void {
    event?.stopPropagation();
    const hiddenRoutine = this.allRoutinesForList().find(routine => routine.id === routineId);
    if (hiddenRoutine) {
      hiddenRoutine.isHidden = true;
      this.workoutService.updateRoutine(hiddenRoutine);
      this.loadRoutinesAndPopulateFilters();
    }
  }

  async unhideRoutine(routineId: string, event?: MouseEvent | Event, confirmation: boolean = false): Promise<void> {
    event?.stopPropagation();
    const hiddenRoutine = this.allRoutinesForList().find(routine => routine.id === routineId);
    if (hiddenRoutine) {
      if (confirmation) {
        const buttons: AlertButton[] = [
          { text: 'Cancel', role: 'cancel', data: 'cancel' },
          { text: 'Unmark', role: 'confirm', data: 'confirm' },
        ];
        const confirmation = await this.alertService.showConfirmationDialog('Unhide routine', `Would you like to unhide ${hiddenRoutine.name} from hidden ones?`, buttons);
        if (!confirmation || !confirmation.data || confirmation.data === 'cancel') {
          return;
        }
      }
      hiddenRoutine.isHidden = false;
      this.workoutService.updateRoutine(hiddenRoutine);
      this.loadRoutinesAndPopulateFilters();
      this.toastService.success(`Removed ${hiddenRoutine.name} from hidden ones`)
    }
  }

  markAsFavourite(routineId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    const favouriteRoutine = this.allRoutinesForList().find(routine => routine.id === routineId);
    if (favouriteRoutine) {
      favouriteRoutine.isFavourite = true;
      this.workoutService.updateRoutine(favouriteRoutine);
      this.loadRoutinesAndPopulateFilters();
      this.toastService.info(`Routine "${favouriteRoutine.name}" added to favourites`)
    }
  }

  async unmarkAsFavourite(routineId: string, event?: MouseEvent | Event, confirmation: boolean = false): Promise<void> {
    event?.stopPropagation();
    const favouriteRoutine = this.allRoutinesForList().find(routine => routine.id === routineId);
    if (favouriteRoutine) {
      if (confirmation) {
        const buttons: AlertButton[] = [
          { text: 'Cancel', role: 'cancel', data: 'cancel' },
          { text: 'Unmark', role: 'confirm', data: 'confirm' },
        ];
        const confirmation = await this.alertService.showConfirmationDialog('Unmark favourite routine', `Would you like to unmark ${favouriteRoutine.name} from favourites?`, buttons);
        if (!confirmation || !confirmation.data || confirmation.data === 'cancel') {
          return;
        }
      }
      favouriteRoutine.isFavourite = false;
      this.workoutService.updateRoutine(favouriteRoutine);
      this.loadRoutinesAndPopulateFilters();
      this.toastService.info(`Routine "${favouriteRoutine.name}" removed from favourites`)
    }
  }

  // Helper to get muscle groups for display on the card
  getRoutineMainMuscleGroups(routine: Routine): string[] {
    if (!this.allExercisesMap.size || !routine.exercises.length) return [];
    const muscles = new Set<string>();
    routine.exercises.forEach(exDetail => {
      const fullExercise = this.allExercisesMap.get(exDetail.exerciseId);
      if (fullExercise?.primaryMuscleGroup) {
        muscles.add(fullExercise.primaryMuscleGroup);
      }
    });
    return Array.from(muscles).slice(0, 3); // Show up to 3 for brevity on card
  }

  async cloneAndEditRoutine(routineId: string, event?: MouseEvent): Promise<void> {
    // event.stopPropagation();
    this.visibleActionsRutineId.set(null);

    const originalRoutine = this.allRoutinesForList().find(r => r.id === routineId);
    if (!originalRoutine) {
      this.toastService.error("Routine not found for cloning", 0, "Error");
      return;
    }

    // Deep clone the routine and assign a new id
    let clonedRoutine: Routine = {
      ...structuredClone(originalRoutine),
      name: originalRoutine.name + " (Copy)",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      this.spinnerService.show();
      clonedRoutine = await this.workoutService.addRoutine(clonedRoutine);
      this.toastService.success(`Routine "${clonedRoutine.name}" cloned successfully.`, 3000, "Routine Cloned");
      this.router.navigate(['/workout/routine/edit', clonedRoutine.id]);
      this.visibleActionsRutineId.set(null);
    } catch (error) {
      console.error("Error during routine cloning:", error);
      this.toastService.error("Failed to clone routine", 0, "Clone Failed");
    } finally {
      this.spinnerService.hide();
    }
  }


  ngOnDestroy(): void {
    this.routinesSubscription?.unsubscribe();
    this.exercisesSubscription?.unsubscribe();
  }

  startKB(): void {
    this.router.navigate(['/workout/routine/kb-workout-tracker']);
  }

  getIconPath(iconName: string | undefined): string {
    return this.exerciseService.getIconPath(iconName);
  }


  getRoutineDropdownActionItems(routineId: string, mode: 'dropdown' | 'compact-bar'): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';;

    const currentRoutine = this.allRoutinesForList().find(routine => routine.id === routineId);
    const hideRoutineButton = {
      label: 'HIDE',
      actionKey: 'hide',
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" clip-rule="evenodd" />
        <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.257 0-7.893-2.66-9.336-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" /></svg>`,
      iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    };
    const unhideRoutineButton = {
      label: 'UNHIDE',
      actionKey: 'unhide',
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z" /><path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 11-8 0 4 4 0 018 0Z" clip-rule="evenodd" /></svg>`,
      iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    };
    const markAsFavouriteRoutineButton = {
      label: 'FAVOURITE',
      actionKey: 'markAsFavourite',
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>`,
      iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    };
    const unmarkAsFavouriteRoutineButton = {
      label: 'REMOVE',
      actionKey: 'unmarkAsFavourite',
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        <line x1="2" y1="20" x2="22" y2="4"></line>
      </svg>`,
      iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    };
    const actionsArray = [
      {
        label: 'VIEW',
        actionKey: 'view',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z" /><path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 11-8 0 4 4 0 018 0Z" clip-rule="evenodd" /></svg>`,
        iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      {
        label: 'START',
        actionKey: 'start',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      {
        label: 'EDIT',
        actionKey: 'edit',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      {
        label: 'CLONE',
        actionKey: 'clone',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path d="M 5 3 H 16 A 2 2 0 0 1 18 5 V 16 A 2 2 0 0 1 16 18 H 5 A 2 2 0 0 1 3 16 V 5 A 2 2 0 0 1 5 3 Z M 8 6 H 19 A 2 2 0 0 1 21 8 V 19 A 2 2 0 0 1 19 21 H 8 A 2 2 0 0 1 6 19 V 8 A 2 2 0 0 1 8 6 Z" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      { isDivider: true },
      {
        label: 'DELETE',
        actionKey: 'delete',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.177-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5Zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5Z" clip-rule="evenodd" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
        data: { routineId }
      }
    ];

    if (currentRoutine?.isHidden) {
      actionsArray.push(unhideRoutineButton);
    } else {
      // Only show the "Hide" button if we are not already in the "Show Hidden" view
      if (!this.showHiddenRoutines()) {
        actionsArray.push(hideRoutineButton);
      }
    }

    if (currentRoutine?.isFavourite) {
      actionsArray.push(unmarkAsFavouriteRoutineButton);
    } else {
      actionsArray.push(markAsFavouriteRoutineButton);
    }

    return actionsArray;
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }, originalMouseEvent?: MouseEvent): void {
    // originalMouseEvent.stopPropagation(); // Stop original event that opened the menu
    const routineId = event.data?.routineId;
    if (!routineId) return;

    switch (event.actionKey) {
      case 'view':
        this.viewRoutineDetails(routineId);
        break;
      case 'hide':
        this.hideRoutine(routineId);
        break;
      case 'unhide':
        this.unhideRoutine(routineId);
        break;
      case 'markAsFavourite':
        this.markAsFavourite(routineId);
        break;
      case 'unmarkAsFavourite':
        this.unmarkAsFavourite(routineId);
        break;
      case 'start':
        this.startWorkout(routineId);
        break;
      case 'edit':
        this.editRoutine(routineId);
        break;
      case 'clone':
        this.cloneAndEditRoutine(routineId);
        break;
      case 'delete':
        this.deleteRoutine(routineId);
        break;
    }
    this.activeRoutineIdActions.set(null); // Close the menu
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


  getRoutineDuration(routine: Routine): number {
    if (routine) {
      return this.workoutService.getEstimatedRoutineDuration(routine);
    } else {
      return 0;
    }
  }

  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth' // For a smooth scrolling animation
      });
    }
  }

  toggleOnlyFavouriteRoutines(event: Event): void {
    event?.stopPropagation();
    this.showFavouriteRoutinesOnly.set(!this.showFavouriteRoutinesOnly());
  }

  toggleOnlyHiddenRoutines(event: Event): void {
    event?.stopPropagation();
    this.showHiddenRoutines.set(!this.showHiddenRoutines());
  }

  filterByGoal(goal: string, event: Event): void {
    event?.stopPropagation();
    this.onRoutineGoalChange(event);
    if (event && event.target && goal) {
      const target = event.target as HTMLSelectElement;
      target.value = goal;
      this.onRoutineGoalChange(event);
      this.toastService.info(`Filtered routines by goal '${goal}'`);
    }
  }

  filterByMuscleGroup(muscle: string, event: Event): void {
    event?.stopPropagation();
    if (event && event.target && muscle) {
      const target = event.target as HTMLSelectElement;
      target.value = muscle;
      this.onRoutineMuscleGroupChange(event);
      this.toastService.info(`Filtered routines by muscle '${muscle}'`);
    }
  }

  protected updateSanitizedDescription(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }

  // --- ADD NEW HANDLER METHODS FOR THE FAB ---

  /**
   * Toggles the FAB menu on touch devices.
   */
  handleFabClick(): void {
    this.isFabActionsOpen.update(v => !v);
  } 

  /**
   * Opens the FAB menu on hover for non-touch devices.
   */
  handleFabMouseEnter(): void {
    if (!this.isTouchDevice) {
      this.isFabActionsOpen.set(true);
    }
  }

  /**
   * Closes the FAB menu on mouse leave for non-touch devices.
   */
  handleFabMouseLeave(): void {
    if (!this.isTouchDevice) {
      this.isFabActionsOpen.set(false);
    }
  }

  startNewSession(): void {
    this.router.navigate(['/workout/play', -1], { queryParams: { newSession: 'true' } });
  }
}