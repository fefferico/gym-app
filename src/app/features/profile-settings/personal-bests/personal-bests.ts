// src/app/features/profile-settings/personal-bests.component.ts
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, combineLatest, of } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';

import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { PersonalBestSet } from '../../../core/models/workout-log.model';
import { Exercise } from '../../../core/models/exercise.model';
import { UnitsService } from '../../../core/services/units.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';

// Interface to combine PB data with Exercise details
interface DisplayPersonalBest extends PersonalBestSet {
  exerciseName: string; // Get from ExerciseService
  exerciseCategory: string; // Get from ExerciseService
  primaryMuscleGroup: string; // Get from ExerciseService
}

@Component({
  selector: 'app-personal-bests',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, WeightUnitPipe],
  templateUrl: './personal-bests.html',
  styleUrl: './personal-bests.scss',
})
export class PersonalBestsComponent implements OnInit {
  private trackingService = inject(TrackingService);
  private exerciseService = inject(ExerciseService);
  protected unitsService = inject(UnitsService); // Use 'protected' for direct template access

  // Signals to hold raw data
  allPersonalBests = signal<Record<string, PersonalBestSet[]>>({}); // { exerciseId: [PB1, PB2, ...] }
  allExercises = signal<Exercise[]>([]); // List of all exercises

  // Computed signal to combine PB data with exercise details and flatten for display
  displayPersonalBests = computed<DisplayPersonalBest[]>(() => {
    const pbsByExercise = this.allPersonalBests();
    const exercises = this.allExercises();

    // If either data source is not yet loaded/available, return empty
    if (Object.keys(pbsByExercise).length === 0 || exercises.length === 0) {
      return [];
    }

    const exerciseMap = new Map(exercises.map(ex => [ex.id, ex]));
    const displayList: DisplayPersonalBest[] = [];

    // Iterate through the PB data grouped by exerciseId
    for (const exerciseId in pbsByExercise) {
      if (pbsByExercise.hasOwnProperty(exerciseId)) {
        const exerciseDetails = exerciseMap.get(exerciseId);
        const pbsForExercise = pbsByExercise[exerciseId];

        // If we found the exercise details, add its PBs to the display list
        if (exerciseDetails) {
          pbsForExercise.forEach(pb => {
            displayList.push({
              ...pb, // Spread all properties from the PersonalBestSet
              exerciseName: exerciseDetails.name,
              exerciseCategory: exerciseDetails.category,
              primaryMuscleGroup: exerciseDetails.primaryMuscleGroup,
              // Optionally add other details like imageUrls etc.
            });
          });
        }
      }
    }

    // Sort the flattened list for display
    // Example sort: by exercise name, then by PB type, then by value descending
    return displayList.sort((a, b) => {
      const nameCompare = a.exerciseName.localeCompare(b.exerciseName);
      if (nameCompare !== 0) return nameCompare;

      // Custom sort order for PB Types (e.g., 1RM first, then 3RM, 5RM, Estimated, Heaviest, Max Reps, Duration)
      const orderA = this.getPbTypeSortOrder(a.pbType);
      const orderB = this.getPbTypeSortOrder(b.pbType);
      if (orderA !== orderB) return orderA - orderB;

      // Finally, sort by value (weight, reps, duration) descending
      if (a.weightUsed !== undefined && b.weightUsed !== undefined) {
        return (b.weightUsed ?? 0) - (a.weightUsed ?? 0);
      }
      if (a.repsAchieved !== undefined && b.repsAchieved !== undefined && a.pbType.includes('Max Reps') && b.pbType.includes('Max Reps')) {
        return b.repsAchieved - a.repsAchieved;
      }
      if (a.durationPerformed !== undefined && b.durationPerformed !== undefined && a.pbType.includes('Max Duration') && b.pbType.includes('Max Duration')) {
        return (b.durationPerformed ?? 0) - (a.durationPerformed ?? 0);
      }

      return a.pbType.localeCompare(b.pbType); // Fallback sort by type string
    });
  });

  constructor() { }

  ngOnInit(): void {
    // CombineLatest to load both PBs and Exercises concurrently
    combineLatest([
      this.trackingService.personalBests$.pipe(
        tap(pbs => console.log('Loaded PBs for PBs Page:', Object.keys(pbs).length)),
        take(1) // Take the first emission and complete
      ),
      this.exerciseService.getExercises().pipe(
        tap(exercises => console.log('Loaded Exercises for PBs Page:', exercises.length)),
        take(1) // Take the first emission and complete
      )
    ]).subscribe(([pbs, exercises]) => {
      this.allPersonalBests.set(pbs);
      this.allExercises.set(exercises);
      // The computed signal displayPersonalBests will update automatically
    });
  }

  // Helper to define a custom sort order for PB types
  private getPbTypeSortOrder(pbType: string): number {
    if (pbType.includes('1RM (Actual)')) return 0;
    if (pbType.includes('1RM (Estimated)')) return 1;
    if (pbType.includes('3RM (Actual)')) return 2;
    if (pbType.includes('5RM (Actual)')) return 3;
    if (pbType.includes('Heaviest Lifted')) return 4;
    if (pbType.includes('Max Reps (Bodyweight)')) return 5;
    if (pbType.includes('Max Duration')) return 6;
    return 100; // Others at the end
  }


  // Helper function to format PB display (reuse from ExerciseDetail or make a pipe)
  formatPbValue(pb: PersonalBestSet): string {
    let value = '';
    if (pb.weightUsed !== undefined && pb.weightUsed !== null) {
      value += `${pb.weightUsed}kg`;
      // Only show reps if it's not an actual XRM PB where reps is implicitly X
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

  // Add filtering/sorting logic here later (optional)
  // filterPBs(...)
  // sortPBs(...)

  // Add ngOnDestroy to unsubscribe if using non-take(1) observables or multiple subscriptions
}