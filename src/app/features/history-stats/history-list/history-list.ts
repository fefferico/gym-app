import { Component, inject, OnInit, signal, computed, effect } from '@angular/core'; // effect for debugging
import { CommonModule, DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable, combineLatest } from 'rxjs'; // Added combineLatest
import { map, startWith, distinctUntilChanged } from 'rxjs/operators'; // Added distinctUntilChanged
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms'; // For filter form
import { ExerciseService } from '../../../core/services/exercise.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { WorkoutLog } from '../../../core/models/workout-log.model';
import { Exercise } from '../../../core/models/exercise.model';
import { toSignal } from '@angular/core/rxjs-interop'; // Import toSignal
import { WorkoutService } from '../../../core/services/workout.service';
import { UnitsService } from '../../../core/services/units.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';

@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, FormsModule, ReactiveFormsModule], // Added FormsModule, ReactiveFormsModule
  templateUrl: './history-list.html',
  styleUrl: './history-list.scss',
})
export class HistoryListComponent implements OnInit {
  protected trackingService = inject(TrackingService);
  protected workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService); // Inject
  private router = inject(Router);
  private fb = inject(FormBuilder); // Inject
  protected unitsService = inject(UnitsService); // Use 'protected' for direct template access

  protected allWorkoutLogs = signal<WorkoutLog[]>([]);
  availableExercisesForFilter$: Observable<Exercise[]> | undefined;
  isFilterAccordionOpen = signal(false); // Signal to control accordion state, initially closed

  filterForm: FormGroup;
  private filterValuesSignal = signal<any>({}); // Initialize with empty or form's initial state

  // Computed signal for filtered logs
  filteredWorkoutLogs = computed(() => {
    const logs = this.allWorkoutLogs();
    const filters = this.filterValuesSignal(); // *** NOW DEPENDS ON A SIGNAL ***

    console.log('Filtering with (from filterValuesSignal):', filters, 'Original logs count:', logs.length);

    if (!logs || logs.length === 0) return [];
    if (!filters) return logs;

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

  ngOnInit(): void {
    window.scrollTo(0, 0);
    this.trackingService.workoutLogs$.subscribe(logs => {
      this.allWorkoutLogs.set(logs);
    });
    this.availableExercisesForFilter$ = this.exerciseService.getExercises().pipe(
      map(exercises => exercises.sort((a, b) => a.name.localeCompare(b.name)))
    );
  }

  viewLogDetails(logId: string): void {
    this.router.navigate(['/history/log', logId]); // Updated path
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
  clearAllLogsForDev(): void {
    if (this.trackingService.clearAllWorkoutLogs_DEV_ONLY) {
      this.trackingService.clearAllWorkoutLogs_DEV_ONLY();
    } else {
      alert('Clear logs function not available in TrackingService.');
    }

    if (this.trackingService.clearAllPersonalBests_DEV_ONLY) {
      this.trackingService.clearAllPersonalBests_DEV_ONLY();
    } else {
      alert('Clear PBs function not available in TrackingService.');
    }

    if (this.workoutService.clearAllExecutedRoutines_DEV_ONLY) {
      this.workoutService.clearAllExecutedRoutines_DEV_ONLY();
    } else {
      alert('Clear routines function not available in WorkoutService.');
    }
  }

  toggleFilterAccordion(): void {
    this.isFilterAccordionOpen.update(isOpen => !isOpen);
  }
}