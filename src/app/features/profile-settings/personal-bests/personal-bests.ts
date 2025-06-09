// src/app/features/profile-settings/personal-bests.component.ts
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router'; // Import Router
import { Observable, combineLatest, of } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';

import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { PersonalBestSet } from '../../../core/models/workout-log.model';
import { Exercise } from '../../../core/models/exercise.model';
import { UnitsService } from '../../../core/services/units.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';
import { ToastService } from '../../../core/services/toast.service'; // Import ToastService


// Interface to combine PB data with Exercise details
interface DisplayPersonalBest extends PersonalBestSet {
  exerciseName: string;
  exerciseCategory: string;
  primaryMuscleGroup: string;
  // workoutLogId: string; // Ensure this is part of your PersonalBestSet model
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
  protected unitsService = inject(UnitsService);
  private router = inject(Router); // Inject Router
  private toastService = inject(ToastService); // Inject ToastService


  allPersonalBests = signal<Record<string, PersonalBestSet[]>>({});
  allExercises = signal<Exercise[]>([]);

  displayPersonalBests = computed<DisplayPersonalBest[]>(() => {
    const pbsByExercise = this.allPersonalBests();
    const exercises = this.allExercises();

    if (Object.keys(pbsByExercise).length === 0 || exercises.length === 0) {
      return [];
    }

    const exerciseMap = new Map(exercises.map(ex => [ex.id, ex]));
    const displayList: DisplayPersonalBest[] = [];

    for (const exerciseId in pbsByExercise) {
      if (pbsByExercise.hasOwnProperty(exerciseId)) {
        const exerciseDetails = exerciseMap.get(exerciseId);
        const pbsForExercise = pbsByExercise[exerciseId];

        if (exerciseDetails) {
          pbsForExercise.forEach(pb => {
            displayList.push({
              ...pb,
              exerciseName: exerciseDetails.name,
              exerciseCategory: exerciseDetails.category,
              primaryMuscleGroup: exerciseDetails.primaryMuscleGroup,
            });
          });
        }
      }
    }
    return displayList.sort((a, b) => {
      const nameCompare = a.exerciseName.localeCompare(b.exerciseName);
      if (nameCompare !== 0) return nameCompare;
      const orderA = this.getPbTypeSortOrder(a.pbType);
      const orderB = this.getPbTypeSortOrder(b.pbType);
      if (orderA !== orderB) return orderA - orderB;
      if (a.weightUsed !== undefined && b.weightUsed !== undefined) {
        return (b.weightUsed ?? 0) - (a.weightUsed ?? 0);
      }
      if (a.repsAchieved !== undefined && b.repsAchieved !== undefined && a.pbType.includes('Max Reps') && b.pbType.includes('Max Reps')) {
        return b.repsAchieved - a.repsAchieved;
      }
      if (a.durationPerformed !== undefined && b.durationPerformed !== undefined && a.pbType.includes('Max Duration') && b.pbType.includes('Max Duration')) {
        return (b.durationPerformed ?? 0) - (a.durationPerformed ?? 0);
      }
      return a.pbType.localeCompare(b.pbType);
    });
  });

  constructor() { }

  ngOnInit(): void {
    window.scrollTo(0,0);
    combineLatest([
      this.trackingService.personalBests$.pipe(
        // tap(pbs => console.log('Loaded PBs for PBs Page:', Object.keys(pbs).length)),
        take(1) 
      ),
      this.exerciseService.getExercises().pipe(
        // tap(exercises => console.log('Loaded Exercises for PBs Page:', exercises.length)),
        take(1)
      )
    ]).subscribe(([pbs, exercises]) => {
      this.allPersonalBests.set(pbs);
      this.allExercises.set(exercises);
    });
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

  formatPbValue(pb: PersonalBestSet): string {
    let value = '';
    if (pb.weightUsed !== undefined && pb.weightUsed !== null) {
      value += `${pb.weightUsed}${this.unitsService.getUnitSuffix()}`; // Use unit service
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

  // --- NEW METHOD ---
  navigateToLogDetail(workoutLogId: string | undefined, event?: MouseEvent): void {
    event?.stopPropagation(); // Prevent further event propagation if called from the button click
    
    if (workoutLogId) {
      // Assuming your route to the log detail/summary page is '/history/detail/:id' or '/workout/summary/:id'
      // Adjust the route as per your application's routing setup.
      // If you want to go to the summary page specifically:
      this.router.navigate(['/workout/summary', workoutLogId]);
      // If you have a generic log detail page at '/history/detail/:id':
      // this.router.navigate(['/history/detail', workoutLogId]);
    } else {
      this.toastService.error('Could not find the associated workout log for this PB.', 0, 'Navigation Error');
      console.warn('Attempted to navigate to log detail, but workoutLogId is undefined for PB:', event);
    }
  }
}