// src/app/features/profile-settings/personal-bests.component.ts
import { Component, inject, OnInit, signal, computed, PLATFORM_ID, HostListener } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe, DecimalPipe, isPlatformBrowser } from '@angular/common'; // Ensure DecimalPipe is imported
import { Router, RouterLink } from '@angular/router';
import { Observable, combineLatest, of } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';

import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
// Make sure PBHistoryInstance is exported from your model file and imported here if needed,
// but for the function signature, a structural type is fine.
import { PersonalBestSet, PBHistoryInstance } from '../../../core/models/workout-log.model';
import { Exercise, EXERCISE_CATEGORIES } from '../../../core/models/exercise.model';
import { UnitsService } from '../../../core/services/units.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe'; // Not directly used in formatPbValue but good to have if template uses it elsewhere
import { ToastService } from '../../../core/services/toast.service';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { PressDirective } from '../../../shared/directives/press.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';


// Interface to combine PB data with Exercise details
interface DisplayPersonalBest extends PersonalBestSet {
  exerciseName: string;
  exerciseCategory: string;
  primaryMuscleGroup: string;
}

@Component({
  selector: 'app-personal-bests',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, PressDirective, IconComponent], // Add DecimalPipe to imports if not already
  templateUrl: './personal-bests.html',
  styleUrl: './personal-bests.scss',
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
export class PersonalBestsComponent implements OnInit {
  private trackingService = inject(TrackingService);
  private exerciseService = inject(ExerciseService);
  protected unitsService = inject(UnitsService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private platformId = inject(PLATFORM_ID);

  // Signals for raw data
  protected allPersonalBestsRaw = signal<Record<string, PersonalBestSet[]>>({});
  private allExercisesRaw = signal<Exercise[]>([]);

  filtersVisible = signal<boolean>(false);
  exerciseNameFilter = signal<string>('');
  pbTypeFilter = signal<string>('');
  exerciseCategoryFilter = signal<string>('');

  // Instantiate DecimalPipe for use in formatPbValue
  private decimalPipe = new DecimalPipe('en-US');

  availableCategories = computed<string[]>(() => {
    return [...EXERCISE_CATEGORIES].sort() as string[];
  });

  availablePbTypes = computed<string[]>(() => {
    // Gather all pbTypes from allPersonalBestsRaw
    const pbsByExercise = this.allPersonalBestsRaw();
    const pbTypesSet = new Set<string>();
    Object.values(pbsByExercise).forEach(pbList => {
      pbList.forEach(pb => {
        if (pb.pbType) {
          pbTypesSet.add(pb.pbType);
        }
      });
    });
    return Array.from(pbTypesSet).sort();
  });

  protected combinedPersonalBests = computed<DisplayPersonalBest[]>(() => {
    const pbsByExercise = this.allPersonalBestsRaw();
    const exercises = this.allExercisesRaw();
    if (Object.keys(pbsByExercise).length === 0 || exercises.length === 0) return [];
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
    const typeFilter = this.pbTypeFilter();

    if (!nameFilter && !categoryFilter && !typeFilter) {
      return this.sortPBs(combinedList);
    }

    // Only filter on fields that have a filter value set
    const filteredList = combinedList.filter(pb => {
      if (nameFilter && !pb.exerciseName.toLowerCase().includes(nameFilter)) return false;
      if (categoryFilter && pb.exerciseCategory !== categoryFilter) return false;
      if (typeFilter && pb.pbType !== typeFilter) return false;
      return true;
    });

    return this.sortPBs(filteredList);
  });

  hasActiveFilters = computed<boolean>(() => {
    return this.exerciseNameFilter().trim() !== ''
      || this.exerciseCategoryFilter() !== ''
      || this.pbTypeFilter().trim() !== '';
  });

  allPersonalBestsSignalEmpty = computed<boolean>(() => {
    return Object.keys(this.allPersonalBestsRaw()).length === 0;
  });

  constructor() { }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
    }
    // Corrected subscription for live updates
    this.trackingService.personalBests$.subscribe(pbs => {
      this.allPersonalBestsRaw.set(pbs);
    });
    this.exerciseService.getExercises().pipe(take(1)).subscribe(exercises => { // exercises usually don't change that often
      this.allExercisesRaw.set(exercises);
    });
  }

  toggleFiltersVisibility(): void {
    this.filtersVisible.update(visible => !visible);
  }

  resetFilters(): void {
    this.exerciseNameFilter.set('');
    this.exerciseCategoryFilter.set('');
  }

  resetFiltersAndShow(): void {
    this.resetFilters();
    this.filtersVisible.set(true);
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
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(); // Fallback to date sort
    });
  }

  // Updated formatPbValue method
  formatPbValue(
    // Item can be a DisplayPersonalBest (which has pbType) or PBHistoryInstance (which doesn't)
    item: { weightUsed?: number; repsAchieved: number; durationPerformed?: number; pbType?: string },
    // pbTypeForContext is used when 'item' is a PBHistoryInstance,
    // and it's the pbType of the main PB record (e.g., pb.pbType from the template).
    pbTypeForContext?: string
  ): string {
    let value = '';
    const effectivePbType = item.pbType || pbTypeForContext;

    if (item.weightUsed !== undefined && item.weightUsed !== null) {
      value += `${this.decimalPipe.transform(item.weightUsed, '1.0-2')}${this.unitsService.getUnitSuffix()}`;

      if (item.repsAchieved > 0) {
        let showRepsSuffix = true;
        if (effectivePbType && effectivePbType.includes('RM (Actual)')) {
          // Extracts X from "XRM (Actual)"
          const rmValueString = effectivePbType.split('RM')[0];
          const rmValue = parseInt(rmValueString, 10);
          if (!isNaN(rmValue) && item.repsAchieved === rmValue) {
            showRepsSuffix = false; // Don't show "x 1" for "1RM (Actual)", etc.
          }
        }
        if (showRepsSuffix) {
          value += ` x ${item.repsAchieved}`;
        }
      }
    } else if (item.repsAchieved > 0 && effectivePbType?.includes('Max Reps')) {
      value = `${item.repsAchieved} reps`;
    } else if (item.durationPerformed && item.durationPerformed > 0 && effectivePbType?.includes('Max Duration')) {
      value = `${item.durationPerformed}s`;
    } else if (item.repsAchieved > 0) { // Fallback if no weight and not a specific 'Max Reps' type
      value = `${item.repsAchieved} reps`;
    } else if (item.durationPerformed && item.durationPerformed > 0) { // Fallback if no weight and not 'Max Duration'
      value = `${item.durationPerformed}s`;
    }

    return value || 'N/A';
  }

  vibrate(): void {
    const currentVibrator = navigator;
    if (currentVibrator && 'vibrate' in currentVibrator) {
      currentVibrator.vibrate(50);
    }
  }

  navigateToLogDetail(workoutLogId: string | undefined, event?: Event): void {
    event?.stopPropagation();
    if (workoutLogId) {
      this.vibrate();
      this.router.navigate(['/history/log', workoutLogId]);
    } else {
      this.toastService.error('Could not find the associated workout log for this personal best. It\'s possible that the related workout session has been removed.', 0, 'Navigation Error');
      console.warn('Attempted to navigate to log detail, but workoutLogId is undefined for PB:', event);
    }
  }

  async triggerRecalculatePBs(): Promise<void> {
    try {
      await this.trackingService.recalculateAllPersonalBests();
      // Success/loading messages are handled by the service.
      // The component will automatically update due to the personalBests$ subscription.
      this.filtersVisible.set(false);
    } catch (error) {
      console.error('Error initiating PB recalculation:', error);
      this.toastService.error('An error occurred while trying to recalculate personal bests.');
    }
  }

  async resetPBs(): Promise<void> {
    try {
      await this.trackingService.clearAllPersonalBests_DEV_ONLY();
    } catch (error) {
      console.error('Error clearAllPersonalBests_DEV_ONLY:', error);
      this.toastService.error('An error occurred while trying to reset personal bests.');
    }
  }

  showPbTrend(exerciseId: string, pbType: string): void {
    if (!exerciseId || !pbType) {
      this.toastService.error('Cannot show trend: Missing exercise ID or PB type.', 0, "Error");
      return;
    }
    // Encode pbType to make it URL-safe, especially if it contains spaces or special characters
    const encodedPbType = encodeURIComponent(pbType);
    this.vibrate();
    this.router.navigate(['/profile/pb-trend', exerciseId, encodedPbType]);
    console.log(`Requesting trend for Exercise ID: ${exerciseId}, PB Type: ${pbType}`);
  }


  showBackToTopButton = signal<boolean>(false);
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    // Check if the user has scrolled down more than a certain amount (e.g., 400 pixels)
    // You can adjust this value to your liking.
    const verticalOffset = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    this.showBackToTopButton.set(verticalOffset > 400);
  }

  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth' // For a smooth scrolling animation
      });
    }
  }
}