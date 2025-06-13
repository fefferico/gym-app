// src/app/features/profile-settings/personal-bests.component.ts
import { Component, inject, OnInit, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable, combineLatest, of } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';

import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { PersonalBestSet } from '../../../core/models/workout-log.model';
import { Exercise, EXERCISE_CATEGORIES } from '../../../core/models/exercise.model'; // Import EXERCISE_CATEGORIES
import { UnitsService } from '../../../core/services/units.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';
import { ToastService } from '../../../core/services/toast.service';


// Interface to combine PB data with Exercise details
interface DisplayPersonalBest extends PersonalBestSet {
  exerciseName: string;
  exerciseCategory: string; // Should be ExerciseCategory type if EXERCISE_CATEGORIES uses it
  primaryMuscleGroup: string;
}

@Component({
  selector: 'app-personal-bests',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe],
  templateUrl: './personal-bests.html',
  styleUrl: './personal-bests.scss',
})
export class PersonalBestsComponent implements OnInit {
  private trackingService = inject(TrackingService);
  private exerciseService = inject(ExerciseService);
  protected unitsService = inject(UnitsService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  // Signals for raw data
  private allPersonalBestsRaw = signal<Record<string, PersonalBestSet[]>>({});
  private allExercisesRaw = signal<Exercise[]>([]);

  // Signal for accordion visibility
  filtersVisible = signal<boolean>(false); // Accordion closed by default

  // Signals for filters
  exerciseNameFilter = signal<string>('');
  exerciseCategoryFilter = signal<string>('');

  availableCategories = computed<string[]>(() => {
    // Assuming EXERCISE_CATEGORIES is a readonly array of strings
    // If it's an enum, the logic `Object.values(EXERCISE_CATEGORIES).filter(v => typeof v === 'string')` is correct.
    // If it's `as const` array, `[...EXERCISE_CATEGORIES]` is fine.
    // Let's stick to the previous `as const` approach for simplicity or direct array.
    return [...EXERCISE_CATEGORIES].sort() as string[]; // Cast to string[] if EXERCISE_CATEGORIES is `as const`
  });

  private combinedPersonalBests = computed<DisplayPersonalBest[]>(() => {
    const pbsByExercise = this.allPersonalBestsRaw();
    const exercises = this.allExercisesRaw();

    if (Object.keys(pbsByExercise).length === 0 || exercises.length === 0) {
      return [];
    }

    const exerciseMap = new Map(exercises.map(ex => [ex.id, ex]));
    const combinedList: DisplayPersonalBest[] = [];

    for (const exerciseId in pbsByExercise) {
      if (pbsByExercise.hasOwnProperty(exerciseId)) {
        const exerciseDetails = exerciseMap.get(exerciseId);
        const pbsForExercise = pbsByExercise[exerciseId];

        if (exerciseDetails) {
          pbsForExercise.forEach(pb => {
            combinedList.push({
              ...pb,
              exerciseName: exerciseDetails.name,
              exerciseCategory: exerciseDetails.category,
              primaryMuscleGroup: exerciseDetails.primaryMuscleGroup,
            });
          });
        }
      }
    }
    return combinedList;
  });

  displayPersonalBests = computed<DisplayPersonalBest[]>(() => {
    const combinedList = this.combinedPersonalBests();
    const nameFilter = this.exerciseNameFilter().toLowerCase().trim();
    const categoryFilter = this.exerciseCategoryFilter();

    if (!nameFilter && !categoryFilter) {
      return this.sortPBs(combinedList);
    }

    const filteredList = combinedList.filter(pb => {
      const nameMatch = nameFilter ? pb.exerciseName.toLowerCase().includes(nameFilter) : true;
      const categoryMatch = categoryFilter ? pb.exerciseCategory === categoryFilter : true;
      return nameMatch && categoryMatch;
    });

    return this.sortPBs(filteredList);
  });

  hasActiveFilters = computed<boolean>(() => {
    return this.exerciseNameFilter().trim() !== '' || this.exerciseCategoryFilter() !== '';
  });

  allPersonalBestsSignalEmpty = computed<boolean>(() => {
    return Object.keys(this.allPersonalBestsRaw()).length === 0;
  });

  constructor() { }

  private platformId = inject(PLATFORM_ID); // Inject PLATFORM_ID

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) { // Check if running in a browser
      window.scrollTo(0, 0);
    }
    combineLatest([
      this.trackingService.personalBests$.pipe(take(1)),
      this.exerciseService.getExercises().pipe(take(1))
    ]).subscribe(([pbs, exercises]) => {
      this.allPersonalBestsRaw.set(pbs);
      this.allExercisesRaw.set(exercises);
    });
  }

  toggleFiltersVisibility(): void {
    this.filtersVisible.update(visible => !visible);
  }

  resetFilters(): void {
    this.exerciseNameFilter.set('');
    this.exerciseCategoryFilter.set('');
    // The input fields in the template are bound using [value],
    // so setting the signals will automatically clear them.
  }

  // Used by the button in the "no results" message
  resetFiltersAndShow(): void {
    this.resetFilters();
    this.filtersVisible.set(true); // Optionally open filters if they were closed
  }

  private getPbTypeSortOrder(pbType: string): number {
    if (pbType.includes('1RM (Actual)')) return 0;
    if (pbType.includes('1RM (Estimated)')) return 1;
    if (pbType.includes('3RM (Actual)')) return 2;
    if (pbType.includes('5RM (Actual)')) return 3;
    if (pbType.includes('Heaviest Lifted')) return 4;
    if (pbType.includes('Max Reps (Bodyweight)')) return 5;
    if (pbType.includes('Max Duration')) return 6;
    return 100;
  }

  private sortPBs(list: DisplayPersonalBest[]): DisplayPersonalBest[] {
    return [...list].sort((a, b) => {
      const nameCompare = a.exerciseName.localeCompare(b.exerciseName);
      if (nameCompare !== 0) return nameCompare;
      
      const orderA = this.getPbTypeSortOrder(a.pbType);
      const orderB = this.getPbTypeSortOrder(b.pbType);
      if (orderA !== orderB) return orderA - orderB;

      if (a.weightUsed !== undefined && b.weightUsed !== undefined) {
        return (b.weightUsed ?? 0) - (a.weightUsed ?? 0);
      }
      if (a.repsAchieved !== undefined && b.repsAchieved !== undefined && a.pbType.includes('Max Reps')) {
        return (b.repsAchieved ?? 0) - (a.repsAchieved ?? 0);
      }
      if (a.durationPerformed !== undefined && b.durationPerformed !== undefined && a.pbType.includes('Max Duration')) {
        return (b.durationPerformed ?? 0) - (a.durationPerformed ?? 0);
      }
      return a.pbType.localeCompare(b.pbType);
    });
  }

  formatPbValue(pb: PersonalBestSet): string {
    let value = '';
    if (pb.weightUsed !== undefined && pb.weightUsed !== null) {
      value += `${pb.weightUsed}${this.unitsService.getUnitSuffix()}`;
      if (pb.repsAchieved > 0 && !(pb.pbType.includes('RM (Actual)') && pb.repsAchieved === parseInt(pb.pbType, 10))) {
        value += ` x ${pb.repsAchieved}`;
      }
    } else if (pb.repsAchieved > 0 && pb.pbType.includes('Max Reps')) {
      value = `${pb.repsAchieved} reps`;
    } else if (pb.durationPerformed && pb.durationPerformed > 0 && pb.pbType.includes('Max Duration')) {
      value = `${pb.durationPerformed}s`;
    }
    return value || 'N/A';
  }

  navigateToLogDetail(workoutLogId: string | undefined, event?: MouseEvent): void {
    event?.stopPropagation();
    if (workoutLogId) {
      this.router.navigate(['/workout/summary', workoutLogId]);
    } else {
      this.toastService.error('Could not find the associated workout log for this personal best. It\'s possible that the related workout session has been removed.', 0, 'Navigation Error');
      console.warn('Attempted to navigate to log detail, but workoutLogId is undefined for PB:', event);
    }
  }
}