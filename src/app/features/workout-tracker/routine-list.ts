// src/app/features/workout-routines/routine-list/routine-list.component.ts
import { Component, inject, OnInit, PLATFORM_ID, signal, computed, OnDestroy, HostListener, ViewChildren } from '@angular/core'; // Added computed, OnDestroy
import { CommonModule, DatePipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom, Observable, Subscription, take } from 'rxjs'; // Added Subscription
import { PausedWorkoutState, Routine } from '../../core/models/workout.model'; // Added ExerciseDetail
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
import { ThemeService } from '../../core/services/theme.service';
import { ActionMenuItem } from '../../core/models/action-menu.model';
import { ActionMenuComponent } from '../../shared/components/action-menu/action-menu';
import { PressDirective } from '../../shared/directives/press.directive';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TrainingProgramService } from '../../core/services/training-program.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { WorkoutLog } from '../../core/models/workout-log.model';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { MenuMode } from '../../core/models/app-settings.model';
import { PremiumFeature, SubscriptionService } from '../../core/services/subscription.service';
import { cloneBtn, deleteBtn, editBtn, favouriteBtn, hideBtn, historyBtn, startBtn, unhideBtn, unmarkFavouriteBtn, viewBtn } from '../../core/services/buttons-data';
import { GenerateWorkoutModalComponent } from './generate-workout-modal/generate-workout-modal.component';
import { GeneratedWorkoutSummaryComponent } from './generated-workout-summary/generated-workout-summary.component';
import { WorkoutGenerationOptions, WorkoutGeneratorService } from '../../core/services/workout-generator.service';
import { FabAction, FabMenuComponent } from '../../shared/components/fab-menu/fab-menu.component';

@Component({
  selector: 'app-routine-list',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe, ActionMenuComponent, PressDirective, IconComponent, GenerateWorkoutModalComponent,
    GenerateWorkoutModalComponent,
    GeneratedWorkoutSummaryComponent,
    FabMenuComponent
  ],
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
  workoutService = inject(WorkoutService);
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
  private appSettingsService = inject(AppSettingsService);
  private workoutGeneratorService = inject(WorkoutGeneratorService);
  protected subscriptionService = inject(SubscriptionService);

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

  @ViewChildren('workoutGeneratorModal') workoutGeneratorModal!: GenerateWorkoutModalComponent;

  // Signals for menu and accordion
  visibleActionsRutineId = signal<string | null>(null);
  menuModeDropdown: boolean = false;
  menuModeCompact: boolean = false;
  menuModeModal: boolean = false;
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

  personalGymEquipment = signal<string[]>([]);


  private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';


  maxDuration = signal<number>(120); // A default max, will be updated dynamically
  selectedMaxDuration = signal<number>(120); // The current value of the slider
  showHiddenRoutines = signal<boolean>(false);
  showFavouriteRoutinesOnly = signal<boolean>(false);

  hideRoutines = (hide: boolean): void => {
    this.showHiddenRoutines.set(hide);
    if (hide) {
      this.toastService.info('Showing hidden routines', 2000, 'Hidden Routines');
    } else {
      this.toastService.info('Hiding hidden routines', 2000, 'Hidden Routines');
    }
    this.workoutService.vibrate();
    this.closeFilterAndScrollToTop();
  }

  showFavouriteOnlyRoutines = (show: boolean): void => {
    this.showFavouriteRoutinesOnly.set(show);
    if (show) {
      this.toastService.info('Showing only favourite routines', 2000, 'Hidden Routines');
    }
    this.workoutService.vibrate();
    this.closeFilterAndScrollToTop();
  }

  closeFilterAndScrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.isFilterAccordionOpen.set(false);
  }

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
      const words = searchTerm.split(/\s+/).filter(Boolean);
      routines = routines.filter(r => {
        const searchable = [
          r.name,
          r.description || ''
        ].join(' ').toLowerCase();
        return words.every(word => searchable.includes(word));
      });
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
    this.menuModeDropdown = this.appSettingsService.isMenuModeDropdown();
    this.menuModeCompact = this.appSettingsService.isMenuModeCompact();
    this.menuModeModal = this.appSettingsService.isMenuModeModal();

    // Fetch all exercises first to build the map
    this.exercisesSubscription = this.exerciseService.getExercises().subscribe(exercises => {
      exercises.forEach(ex => this.allExercisesMap.set(ex.id, ex));
      // Once exercises are loaded, then load routines and populate filters
      this.loadRoutinesAndPopulateFilters();
    });

    // This observable is for the template's async pipe if needed for loading states, before filtering kicks in.
    this.routines$ = this.workoutService.routines$;
    this.refreshFabMenuItems();
  }

  private async loadRoutinesAndPopulateFilters(): Promise<void> {
    this.routinesSubscription = this.workoutService.routines$.subscribe(async routines => {
      // routines.map(routine => ({
      //   ...routine,
      //   description: this.updateSanitizedDescription(routine.description || '')
      // }));

      this.allRoutinesForList.set(routines);
      this.populateRoutineFilterOptions(routines);
      await this.populateLastRoutineLoggedInfo(routines);
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
    const sortedEquipment = Array.from(equipments).sort();

    // Set the max for the slider, with a sensible ceiling (e.g., 180 mins)
    const newMax = Math.min(Math.ceil(maxCalculatedDuration / 10) * 10, 180); // Round up to nearest 10
    this.maxDuration.set(newMax > 0 ? newMax : 120);
    this.selectedMaxDuration.set(newMax > 0 ? newMax : 120); // Also reset the selected value

    this.uniqueRoutineGoals.set(Array.from(goals).sort());
    this.uniqueRoutineMuscleGroups.set(Array.from(muscles).sort());
    this.uniqueRoutineEquipments.set(sortedEquipment);
    this.personalGymEquipment.set(sortedEquipment);
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
    this.workoutService.vibrate();
  }

  // --- UPDATE the clear filters method ---
  clearFilters(): void {
    this.workoutService.vibrate();
    this.routineSearchTerm.set('');
    this.selectedRoutineGoal.set(null);
    this.selectedRoutineMuscleGroup.set(null);
    this.selectedEquipment.set([]);
    this.showHiddenRoutines.set(false);
    this.showFavouriteRoutinesOnly.set(false);
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
    this.workoutService.vibrate();

    const totalRoutines = this.allRoutinesForList() ? this.allRoutinesForList().length : 0;

    if (!this.subscriptionService.canAccess(PremiumFeature.UNLIMITED_ROUTINES, totalRoutines)) {
      this.subscriptionService.showUpgradeModal('You have reached the maximum number of custom routines available to Free Tier users. Upgrade now to unlock the possibility to create endless routines and much more!');
      return;
    }
    this.router.navigate(['/workout/routine/new']);
  }

  editRoutine(routineId: string, event?: MouseEvent): void {
    this.router.navigate(['/workout/routine/edit', routineId]);
    this.visibleActionsRutineId.set(null);
  }

  async deleteRoutine(routineId: string, event?: Event): Promise<void> {
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
      if (associatedPrograms.length === 1) {
        const associatedProgram = associatedPrograms[0].schedule.find(sched => sched.routineId === routineId);
        const programName = associatedProgram ? '\'' + associatedProgram.routineName + '\'' : '';
        confirmationMessage += ` This will also delete the entries in ${programName ? programName : '1'} associated program(s).`;
      } else {
        confirmationMessage += ` This will also delete the entries in ${associatedPrograms.length} associated program(s).`;
      }
    }

    if (associatedLogs.length > 0 || associatedPrograms.length > 0) {
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
    this.visibleActionsRutineId.set(null);

    // retrieve current player mode before starting
    // if the retrieved workout it's a "tabata" style I'll force the focus mode
    const playerRoute = this.workoutService.checkPlayerMode(newRoutineId);

    const pausedState = this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);
    if (pausedState) {
      const pausedRoutineName = pausedState.sessionRoutine?.name || 'a previous session';
      const pausedDate = pausedState.workoutDate ? ` from ${format(new Date(pausedState.workoutDate), 'MMM d, HH:mm')}` : '';
      const buttons: AlertButton[] = [
        { text: `Resume: ${pausedRoutineName.substring(0, 15)}${pausedRoutineName.length > 15 ? '...' : ''}`, role: 'confirm', data: 'resume_paused', cssClass: 'bg-green-500 hover:bg-green-600 text-white', icon: 'play' },
        { text: 'Discard Paused & Start New', role: 'confirm', data: 'discard_start_new', cssClass: 'bg-red-500 hover:bg-red-600 text-white', icon: 'change' },
        { text: 'Cancel', role: 'cancel', data: 'cancel', icon: 'cancel' },
      ];
      const confirmation = await this.alertService.showConfirmationDialog('Workout in Progress', `You have a paused workout ("${pausedRoutineName}"${pausedDate}). What would you like to do?`, buttons);

      if (confirmation && confirmation.data === 'resume_paused') {
        const targetRoutineId = pausedState.routineId || 'ad-hoc';
        this.workoutService.navigateToPlayer(targetRoutineId);
        // this.router.navigate([playerRoute, pausedState.routineId || ''], { queryParams: { resume: 'true' } }); // Handle undefined routineId
      } else if (confirmation && confirmation.data === 'discard_start_new') {
        this.workoutService.removePausedWorkout();
        this.toastService.info('Previous paused workout discarded.', 3000);
        // this.router.navigate([playerRoute, newRoutineId]);
        this.workoutService.navigateToPlayer(newRoutineId);
      } else {
        // this.toastService.info('Starting new workout cancelled.', 2000);
      }
    } else {
      if (!isPlatformBrowser(this.platformId)) {
        // this.router.navigate([playerRoute, newRoutineId]);
        this.workoutService.navigateToPlayer(newRoutineId);
        return;
      }

      // Use absolute path for player
      if (/* condition to start new */ true) { // Simplified condition
        // this.router.navigate([playerRoute, newRoutineId]);
        this.workoutService.navigateToPlayer(newRoutineId);
      }
    }
  }

  viewRoutineDetails(routineId: string, event?: Event): void {
    // event?.stopPropagation();
    if (event && event.target) {
      const elem = event.target as HTMLElement;
      if (elem.className && elem.className.includes('bg-primary')) {
        return;
      }
    }
    this.workoutService.vibrate();
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
    this.workoutService.vibrate();
    if (!this.subscriptionService.canAccess(PremiumFeature.CAMERA_TRACKING)) {
      this.subscriptionService.showUpgradeModal();
      return;
    }
    this.router.navigate(['/workout/routine/kb-workout-tracker']);
  }

  getIconPath(iconName: string | undefined): string {
    return this.exerciseService.getIconPath(iconName);
  }


  getRoutineDropdownActionItems(routineId: string, mode: MenuMode): ActionMenuItem[] {
    const currentRoutine = this.allRoutinesForList().find(routine => routine.id === routineId);

    const standardTextClass = ' w-full flex justify-center items-center text-left px-4 py-2 rounded-md text-xl font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 text-black dark:text-white hover:text-white ';
    const currHideRoutineButton = {
      ...hideBtn,
      overrideCssButtonClass: standardTextClass + hideBtn.buttonClass,
      data: { routineId }
    } as ActionMenuItem;
    const unhideRoutineButton = {
      ...unhideBtn,
      overrideCssButtonClass: standardTextClass + unhideBtn.buttonClass,
      data: { routineId }
    } as ActionMenuItem;
    const markAsFavouriteRoutineButton = {
      ...favouriteBtn,
      overrideCssButtonClass: standardTextClass + favouriteBtn.buttonClass,
      data: { routineId }
    } as ActionMenuItem;
    const unmarkAsFavouriteRoutineButton = {
      ...unmarkFavouriteBtn,
      overrideCssButtonClass: standardTextClass + unmarkFavouriteBtn.buttonClass,
      data: { routineId }
    } as ActionMenuItem;

    const routineHistoryBtn = {
      ...historyBtn,
      overrideCssButtonClass: standardTextClass + historyBtn.buttonClass,
      data: { routineId }
    } as ActionMenuItem;

    const actionsArray = [
      {
        ...viewBtn,
        overrideCssButtonClass: standardTextClass + viewBtn.buttonClass,
        data: { routineId }
      },
      {
        ...startBtn,
        overrideCssButtonClass: standardTextClass + startBtn.buttonClass,
        data: { routineId }
      },
      {
        ...editBtn,
        overrideCssButtonClass: standardTextClass + editBtn.buttonClass,
        data: { routineId }
      },
      {
        ...cloneBtn,
        overrideCssButtonClass: standardTextClass + cloneBtn.buttonClass,
        data: { routineId }
      },
      {
        ...routineHistoryBtn,
        overrideCssButtonClass: standardTextClass + routineHistoryBtn.buttonClass,
      }

    ] as ActionMenuItem[];

    if (currentRoutine?.isHidden) {
      actionsArray.push(unhideRoutineButton);
    } else {
      // Only show the "Hide" button if we are not already in the "Show Hidden" view
      if (!this.showHiddenRoutines()) {
        actionsArray.push(currHideRoutineButton);
      }
    }

    if (currentRoutine?.isFavourite) {
      actionsArray.push(unmarkAsFavouriteRoutineButton);
    } else {
      actionsArray.push(markAsFavouriteRoutineButton);
    }
    actionsArray.push(...[
      {
        ...deleteBtn,
        overrideCssButtonClass: standardTextClass + deleteBtn.buttonClass,
        data: { routineId }
      }
    ] as ActionMenuItem[])

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
      case 'history':
        this.goToRoutineHistory(routineId);
        break;
    }
    this.activeRoutineIdActions.set(null); // Close the menu
  }

  goToRoutineHistory(routineId: string): void {
    this.router.navigate(['/history/list'], routineId ? { queryParams: { routineId: routineId } } : {});
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

  lastLoggedRoutineInfo = signal<{ [id: string]: { duration: number, name: string, startTime: number | null } }>({});
  /**
   * Efficiently populates the last logged information for a given list of routines.
   * This optimized version fetches all logs once and processes them in a single pass
   * to avoid the N+1 query problem.
   * @param routines The array of routines to find the last log for.
   */
  private async populateLastRoutineLoggedInfo(routines: Routine[]): Promise<void> {
    // Step 1: Get all workout logs just one time.
    // The workoutLogs$ observable is already sorted from newest to oldest.
    const allLogs = await firstValueFrom(this.trackingService.workoutLogs$.pipe(take(1)));

    // If there are no logs, we can set an empty object and exit early.
    if (!allLogs || allLogs.length === 0) {
      this.lastLoggedRoutineInfo.set({});
      return;
    }

    // Step 2: Create a lookup map for the most recent log of each routine.
    const lastLogByRoutineId = new Map<string, WorkoutLog>();

    // By iterating through the logs (which are sorted newest to oldest), the *first* time
    // we see a routineId, we know it's the most recent log for that routine.
    for (const log of allLogs) {
      if (log.routineId && !lastLogByRoutineId.has(log.routineId)) {
        lastLogByRoutineId.set(log.routineId, log);
      }
    }

    // Step 3: Build the final data structure using the lookup map.
    // We use .reduce() for a clean, functional way to build the object.
    const routineData = routines.reduce((acc, routine) => {
      const lastLog = lastLogByRoutineId.get(routine.id);

      acc[routine.id] = {
        // Use the duration from the found log, or default to 0.
        duration: lastLog?.durationMinutes ?? 0,
        name: routine.name,
        // Use the start time from the found log, or default to an empty string.
        startTime: lastLog?.startTime ?? null
      };
      return acc;
    }, {} as { [id: string]: { duration: number, name: string, startTime: number | null } });

    // Step 4: Set the signal with the efficiently-built data.
    this.lastLoggedRoutineInfo.set(routineData);
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
    this.toastService.info(`Showing ${this.showFavouriteRoutinesOnly() ? 'only favourite' : 'all'} routines`, 3000, "Filter Update");
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
      this.clearFilters();
      this.onRoutineGoalChange(event);
      this.toastService.info(`Filtered routines by goal '${goal}'`);
    }
  }

  filterByMuscleGroup(muscle: string, event: Event): void {
    event?.stopPropagation();
    if (event && event.target && muscle) {
      const target = event.target as HTMLSelectElement;
      target.value = muscle;
      this.clearFilters();
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

  // --- NEW SIGNALS FOR MODAL CONTROL ---
  isGenerateModalOpen = signal(false);
  isSummaryModalOpen = signal(false);
  generatedRoutine = signal<Routine | null>(null);
  private lastGenerationOptions = signal<WorkoutGenerationOptions | null>(null);


  // A computed signal to pass to the overview modal
  generatedRoutineSignal = computed(() => this.generatedRoutine());

  openGenerateWorkoutModal() {
    this.isFabActionsOpen.set(false);
    this.isGenerateModalOpen.set(true);
  }

  async handleWorkoutGenerated(options: WorkoutGenerationOptions | 'quick') {
    this.isGenerateModalOpen.set(false);

    let routine: Routine | null = null;
    if (options === 'quick') {
      // For a quick workout, we don't have detailed options to save for a retry,
      // so we'll just re-run the quick generator if they retry.
      this.lastGenerationOptions.set(null); // Mark as quick
      routine = await this.workoutGeneratorService.generateQuickWorkout();
    } else {
      this.lastGenerationOptions.set(options); // Save options for retry
      routine = await this.workoutGeneratorService.generateWorkout(options);
    }

    if (routine && routine.exercises.length > 0) {
      this.generatedRoutine.set(routine);
      this.isSummaryModalOpen.set(true);
    } else {
      this.toastService.warning("Could not generate a workout with the selected criteria. Please try again.", 5000, "Generation Failed");
    }
  }

  /**
  * --- NEW METHOD ---
  * This is the handler for the (routineUpdated) event from the summary modal.
  * It updates the state signal, which triggers the UI to re-render.
  * @param updatedRoutine The new state of the routine after an edit.
  */
  handleRoutineUpdate(updatedRoutine: Routine): void {
    this.generatedRoutine.set(updatedRoutine);
  }

  startGeneratedWorkout(routine: Routine) {
    if (!routine) return;
    const tempRoutine = this.workoutService.addRoutine(routine);

    // --- Now we clear the state because the user has committed ---
    this.isSummaryModalOpen.set(false);
    this.generatedRoutine.set(null);
    this.lastGenerationOptions.set(null);

    this.workoutService.navigateToPlayer(tempRoutine.id);
  }

  // Add a method to handle the close event from the summary modal
  closeSummaryModal() {
    this.isSummaryModalOpen.set(false);
    this.generatedRoutine.set(null); // Clear the routine when closing
  }

  /**
     * --- REWRITTEN ---
     * Seamlessly generates a new workout and updates the signal.
     */
  async handleRetryGeneration(): Promise<void> {
    // this.toastService.info("Generating a new workout...", 2000, "Please Wait");

    // Set the signal to null briefly to show a loading state if desired
    this.generatedRoutine.set(null);

    const lastOptions = this.lastGenerationOptions();
    let newRoutine: Routine | null = null;

    if (lastOptions) {
      // If we have detailed options, use them again
      newRoutine = await this.workoutGeneratorService.generateWorkout(lastOptions);
    } else {
      // If the last one was a "quick" generation, run that again
      newRoutine = await this.workoutGeneratorService.generateQuickWorkout();
    }

    if (newRoutine && newRoutine.exercises.length > 0) {
      this.generatedRoutine.set(newRoutine);
    } else {
      // This should rarely happen with the fallback logic, but it's a good safeguard
      this.isSummaryModalOpen.set(false); // Close the modal on failure
      this.toastService.error("Failed to generate a new workout. Please try adjusting your options.", 0, "Error");
    }
  }

  /**
   * Handles the 'Back' button from the summary modal.
   * Closes the summary and re-opens the generation modal with the last used options.
   */
  handleBackToGenerator(): void {
    this.isSummaryModalOpen.set(false);
    // Don't clear the generatedRoutine or lastGenerationOptions here
    setTimeout(() => {
      this.isGenerateModalOpen.set(true);
    }, 50); // Timeout for smooth animation transition
  }

  /**
  * --- NEW: A dedicated method to fully cancel the generation flow ---
  * Called when the user closes the generation modal.
  */
  cancelGenerationFlow(): void {
    this.isSummaryModalOpen.set(false);
    this.isGenerateModalOpen.set(false);
    this.generatedRoutine.set(null);
    this.lastGenerationOptions.set(null);
  }


  fabMenuItems: FabAction[] = [];
  private refreshFabMenuItems(): void {
    this.fabMenuItems = [{
      label: 'CREATE NEW ROUTINE',
      actionKey: 'add_routine',
      iconName: 'plus-circle',
      cssClass: 'bg-blue-500 focus:ring-blue-400',
      isPremium: false
    },
    {
      label: 'START NEW SESSION',
      actionKey: 'start_routine',
      iconName: 'play',
      cssClass: 'bg-green-500 focus:ring-green-400',
      isPremium: false
    },
    {
      label: 'GENERATE RANDOM WORKOUT',
      actionKey: 'random_workout',
      iconName: 'magic-wand',
      cssClass: 'bg-violet-500 focus:ring-violet-400',
      isPremium: true
    },
    ];
  }

  onFabAction(actionKey: string): void {
    switch (actionKey) {
      case 'add_routine':
        this.navigateToCreateRoutine();
        break;
      case 'start_routine':
        this.startNewSession();
        break;
      case 'random_workout':
        this.openGenerateWorkoutModal();
        break;
    }
  }
}