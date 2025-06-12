// src/app/features/workout-routines/routine-list/routine-list.component.ts
import { Component, inject, OnInit, PLATFORM_ID, signal, computed, OnDestroy } from '@angular/core'; // Added computed, OnDestroy
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

@Component({
  selector: 'app-routine-list',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe, RouterLink],
  templateUrl: './routine-list.html',
  styleUrl: './routine-list.scss',
  animations: [
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
  private router = inject(Router);
  private alertService = inject(AlertService);
  private spinnerService = inject(SpinnerService);
  private toastService = inject(ToastService);
  private storageService = inject(StorageService);
  private themeService = inject(ThemeService);
  private platformId = inject(PLATFORM_ID);

  routines$: Observable<Routine[]> | undefined; // Original observable
  allRoutinesForList = signal<Routine[]>([]); // Signal for all routines
  private routinesSubscription: Subscription | undefined;
  private exercisesSubscription: Subscription | undefined;


  // Signals for menu and accordion
  visibleActionsRutineId = signal<string | null>(null);
  menuModeCompact: boolean = false;
  isFilterAccordionOpen = signal(false);

  // Signals for filter values
  routineSearchTerm = signal<string>('');
  selectedRoutineGoal = signal<string | null>(null);
  selectedRoutineMuscleGroup = signal<string | null>(null);

  // Signals for filter dropdown options
  uniqueRoutineGoals = signal<string[]>([]);
  uniqueRoutineMuscleGroups = signal<string[]>([]);
  private allExercisesMap = new Map<string, Exercise>(); // To store exercises for quick lookup

  private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';

  // Computed signal for filtered routines
  filteredRoutines = computed(() => {
    let routines = this.allRoutinesForList();
    const searchTerm = this.routineSearchTerm().toLowerCase();
    const goalFilter = this.selectedRoutineGoal();
    const muscleFilter = this.selectedRoutineMuscleGroup();

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
    return routines;
  });


  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
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
      this.allRoutinesForList.set(routines); // Update the signal with all routines
      this.populateRoutineFilterOptions(routines);
    });
  }

  private populateRoutineFilterOptions(routines: Routine[]): void {
    if (!routines) return;

    const goals = new Set<string>();
    const muscles = new Set<string>();

    routines.forEach(routine => {
      if (routine.goal) {
        goals.add(routine.goal);
      }
      routine.exercises.forEach(exDetail => {
        const fullExercise = this.allExercisesMap.get(exDetail.exerciseId);
        if (fullExercise?.primaryMuscleGroup) {
          muscles.add(fullExercise.primaryMuscleGroup);
        }
      });
    });
    this.uniqueRoutineGoals.set(Array.from(goals).sort());
    this.uniqueRoutineMuscleGroups.set(Array.from(muscles).sort());
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

  onRoutineMuscleGroupChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedRoutineMuscleGroup.set(target.value || null);
  }

  clearRoutineFilters(): void {
    this.routineSearchTerm.set('');
    this.selectedRoutineGoal.set(null);
    this.selectedRoutineMuscleGroup.set(null);

    const searchInput = document.getElementById('routine-search-term') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
    const goalSelect = document.getElementById('routine-goal-filter') as HTMLSelectElement;
    if (goalSelect) goalSelect.value = '';
    const muscleSelect = document.getElementById('routine-muscle-filter') as HTMLSelectElement;
    if (muscleSelect) muscleSelect.value = '';
  }


  // --- Action Methods ---
  navigateToCreateRoutine(): void {
    this.router.navigate(['/workout/routine/new']);
  }

  editRoutine(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.router.navigate(['/workout/routine/edit', routineId]);
    this.visibleActionsRutineId.set(null);
  }

  async deleteRoutine(routineId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.visibleActionsRutineId.set(null);

    const routineToDelete = this.allRoutinesForList().find(r => r.id === routineId); // Use signal value
    if (!routineToDelete) {
      this.toastService.error("Routine not found for deletion.", 0, "Error");
      return;
    }

    const associatedLogs = await firstValueFrom(this.trackingService.getWorkoutLogsByRoutineId(routineId).pipe(take(1))) || [];
    let confirmationMessage = `Are you sure you want to delete the routine "${routineToDelete.name}"?`;
    if (associatedLogs.length > 0) {
      confirmationMessage += ` This will also delete ${associatedLogs.length} associated workout log(s). This action cannot be undone.`;
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
        this.toastService.error("Failed to delete routine or its logs.", 0, "Deletion Failed");
      } finally {
        this.spinnerService.hide();
      }
    }
  }

  async startWorkout(newRoutineId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
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
        { text: `Resume: ${pausedRoutineName.substring(0,15)}${pausedRoutineName.length > 15 ? '...' : ''}`, role: 'confirm', data: 'resume_paused', cssClass: 'bg-green-500 hover:bg-green-600 text-white' },
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

  viewRoutineDetails(routineId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/workout/routine/view', routineId, { isView: 'routineBuilder' }]); // Pass isView flag
    this.visibleActionsRutineId.set(null);
  }

  toggleActions(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.visibleActionsRutineId.update(current => (current === routineId ? null : routineId));
  }

  areActionsVisible(routineId: string): boolean {
    return this.visibleActionsRutineId() === routineId;
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

  ngOnDestroy(): void {
    this.routinesSubscription?.unsubscribe();
    this.exercisesSubscription?.unsubscribe();
  }
}