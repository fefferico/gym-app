import { Component, inject, OnInit, signal, computed, effect, PLATFORM_ID } from '@angular/core'; // effect for debugging
import { CommonModule, DatePipe, DecimalPipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable, combineLatest } from 'rxjs'; // Added combineLatest
import { map, startWith, distinctUntilChanged, take } from 'rxjs/operators'; // Added distinctUntilChanged
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms'; // For filter form
import { ExerciseService } from '../../../core/services/exercise.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { WorkoutLog } from '../../../core/models/workout-log.model';
import { Exercise } from '../../../core/models/exercise.model';
import { toSignal } from '@angular/core/rxjs-interop'; // Import toSignal
import { WorkoutService } from '../../../core/services/workout.service';
import { UnitsService } from '../../../core/services/units.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';
import { Routine } from '../../../core/models/workout.model';
import { ThemeService } from '../../../core/services/theme.service';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { AlertService } from '../../../core/services/alert.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, FormsModule, ReactiveFormsModule], // Added FormsModule, ReactiveFormsModule
  templateUrl: './history-list.html',
  styleUrl: './history-list.scss',
  providers: [DecimalPipe],
  animations: [
    trigger('slideInOutActions', [
      state('void', style({
        height: '20px',
        opacity: 0,
        overflow: 'hidden',
        paddingTop: '0',
        paddingBottom: '0',
        marginTop: '0',
        marginBottom: '0'
      })),
      state('*', style({
        height: '*',
        opacity: 1,
        overflow: 'hidden',
        paddingTop: '0.5rem', // Tailwind's p-2
        paddingBottom: '0.5rem' // Tailwind's p-2
      })),
      transition('void <=> *', animate('200ms ease-in-out'))
    ]),
    // NEW ANIMATION for the dropdown menu
    trigger('dropdownMenu', [
      state('void', style({
        opacity: 0,
        transform: 'scale(0.75) translateY(-10px)', // Start slightly smaller and moved up
        transformOrigin: 'top right' // Animate from the top-right corner
      })),
      state('*', style({
        opacity: 1,
        transform: 'scale(1) translateY(0)',
        transformOrigin: 'top right'
      })),
      transition('void => *', [ // Enter animation
        animate('400ms cubic-bezier(0.25, 0.8, 0.25, 1)') // A nice easing function
      ]),
      transition('* => void', [ // Leave animation
        animate('300ms cubic-bezier(0.25, 0.8, 0.25, 1)')
      ])
    ])
  ]
})
export class HistoryListComponent implements OnInit {
  protected trackingService = inject(TrackingService);
  protected toastService = inject(ToastService);
  protected workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService); // Inject
  private router = inject(Router);
  private fb = inject(FormBuilder); // Inject
  protected unitsService = inject(UnitsService); // Use 'protected' for direct template access
  private themeService = inject(ThemeService); // Inject StorageService
  private alertService = inject(AlertService); // Inject AlertService for delete confirmation

  protected allWorkoutLogs = signal<WorkoutLog[]>([]);
  availableExercisesForFilter$: Observable<Exercise[]> | undefined;
  isFilterAccordionOpen = signal(false); // Signal to control accordion state, initially closed
  availableRoutines: Routine[] = []; // Array to hold available routines for filter
  visibleActionsRutineId = signal<string | null>(null);
  menuModeCompact: boolean = false; // Signal to control compact menu mode

  filterForm: FormGroup;
  private filterValuesSignal = signal<any>({}); // Initialize with empty or form's initial state

  // Computed signal for filtered logs
  filteredWorkoutLogs = computed(() => {
    let logs = this.allWorkoutLogs();
    const filters = this.filterValuesSignal(); // *** NOW DEPENDS ON A SIGNAL ***

    console.log('Filtering with (from filterValuesSignal):', filters, 'Original logs count:', logs.length);

    if (!logs || logs.length === 0) return [];
    if (!filters) return logs;

    logs = logs.map(log => {
      // Ensure all logs have a startTime and endTime as Date objects
      return {
        ...log,
        goal: this.availableRoutines && this.availableRoutines.find(r => r.id === log.routineId)?.goal || '',
      };
    });

    const filtered = logs.filter(log => {
      let match = true;
      // Date From Filter
      if (filters.dateFrom) {
        const filterDateFrom = new Date(filters.dateFrom);
        filterDateFrom.setHours(0, 0, 0, 0);
        if (!isNaN(filterDateFrom.getTime())) {
          const logDate = new Date(log.startTime);
          logDate.setHours(0, 0, 0, 0);
          match &&= logDate.getTime() >= filterDateFrom.getTime();
        }
      }
      // Date To Filter
      if (filters.dateTo) {
        const filterDateTo = new Date(filters.dateTo);
        filterDateTo.setHours(23, 59, 59, 999);
        if (!isNaN(filterDateTo.getTime())) {
          match &&= new Date(log.startTime).getTime() <= filterDateTo.getTime();
        }
      }
      // Routine Name Filter
      const routineNameFilter = filters.routineName?.trim().toLowerCase();
      if (routineNameFilter) {
        match &&= (log.routineName || '').toLowerCase().includes(routineNameFilter);
      }
      // Exercise Performed Filter
      if (filters.exerciseId) {
        match &&= log.exercises.some(ex => ex.exerciseId === filters.exerciseId);
      }
      return match;
    });
    console.log('Filtered logs count (from filterValuesSignal):', filtered.length);
    return filtered.sort((a, b) => {
      const aTime = a.endTime ? new Date(a.endTime).getTime() : 0;
      const bTime = b.endTime ? new Date(b.endTime).getTime() : 0;
      return bTime - aTime;
    });
  });


  constructor() {
    this.filterForm = this.fb.group({
      dateFrom: [''], // Consider using null or specific date type
      dateTo: [''],
      routineName: [''],
      exerciseId: [''] // Will store the selected exercise ID
    });

    // Initialize filterValuesSignal with the initial state of the form
    this.filterValuesSignal.set(this.filterForm.value);

    // Subscribe to valueChanges and update the signal
    this.filterForm.valueChanges.pipe(
      // startWith(this.filterForm.value), // Alternative to setting initial value above
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)) // Only emit if value actually changed
    ).subscribe(newValues => {
      console.log('filterForm.valueChanges emitted:', newValues); // DEBUG
      this.filterValuesSignal.set(newValues);
    });
  }

  private platformId = inject(PLATFORM_ID); // Inject PLATFORM_ID

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) { // Check if running in a browser
      window.scrollTo(0, 0);
    }
    this.trackingService.workoutLogs$.subscribe(logs => {
      this.allWorkoutLogs.set(logs);
    });
    this.workoutService.routines$.pipe(take(1)).subscribe(routines => this.availableRoutines = routines);
    this.menuModeCompact = this.themeService.isMenuModeCompact();

    this.availableExercisesForFilter$ = this.exerciseService.getExercises().pipe(
      map(exercises => exercises.sort((a, b) => a.name.localeCompare(b.name)))
    );
  }

  viewLogDetails(logId: string): void {
    this.router.navigate(['/history/log', logId]); // Updated path
  }

  editLogDetails(logId: string): void {
    this.router.navigate(['/history/edit', logId]); // Updated path
  }

  async deleteLogDetails(logId: string): Promise<void> {
    this.alertService.showConfirm("Delete Workout Log", "Are you sure you want to delete this workout log? This action cannot be undone.", "Delete")
      .then(confirm => {
        if (confirm && confirm.data) {
          this.trackingService.deleteWorkoutLog(logId).then(() => {
            this.toastService.success("Workout log deleted successfully.");
          }).catch(err => {
            console.error('Error deleting workout log:', err);
            this.toastService.error("Failed to delete workout log. Please try again.");
          });
        }
      });
  }

  resetFilters(): void {
    this.filterForm.reset({
      dateFrom: '', // Or null
      dateTo: '',   // Or null
      routineName: '',
      exerciseId: '' // Or null
    });
    console.log('Filters reset to:', this.filterForm.value); // DEBUG LINE
  }

  // For development
  async clearAllLogsForDev(): Promise<void> {
    if (this.trackingService.clearAllWorkoutLogs_DEV_ONLY) {
      await this.trackingService.clearAllWorkoutLogs_DEV_ONLY();
    } else {
      alert('Clear logs function not available in TrackingService.');
    }

    if (this.trackingService.clearAllPersonalBests_DEV_ONLY) {
      await this.trackingService.clearAllPersonalBests_DEV_ONLY();
    } else {
      alert('Clear PBs function not available in TrackingService.');
    }

    if (this.workoutService.clearAllExecutedRoutines_DEV_ONLY) {
      await this.workoutService.clearAllExecutedRoutines_DEV_ONLY();
    } else {
      alert('Clear routines function not available in WorkoutService.');
    }
  }

  toggleFilterAccordion(): void {
    this.isFilterAccordionOpen.update(isOpen => !isOpen);
  }

  toggleActions(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.visibleActionsRutineId.update(current => (current === routineId ? null : routineId));
  }

  areActionsVisible(routineId: string): boolean {
    return this.visibleActionsRutineId() === routineId;
  }
}