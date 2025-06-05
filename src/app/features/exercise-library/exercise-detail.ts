import { Component, inject, Input, OnInit, signal } from '@angular/core'; // Added signal
import { AsyncPipe, CommonModule } from '@angular/common'; // Import CommonModule for NgIf, NgFor
import { ActivatedRoute, RouterLink } from '@angular/router'; // Added RouterLink
import { map, Observable, of, switchMap, take } from 'rxjs';
import { Exercise } from '../../core/models/exercise.model';
import { ExerciseService } from '../../core/services/exercise.service';
import { TrackingService } from '../../core/services/tracking.service';
import { PersonalBestSet } from '../../core/models/workout-log.model';

@Component({
  selector: 'app-exercise-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, AsyncPipe], // Added RouterLink
  templateUrl: './exercise-detail.html',
  styleUrl: './exercise-detail.scss',
})
export class ExerciseDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private exerciseService = inject(ExerciseService);
  protected trackingService = inject(TrackingService); // Inject TrackingService

  // Using a signal for the exercise data
  exercise = signal<Exercise | undefined | null>(undefined);
  // For image carousel
  currentImageIndex = signal<number>(0);
  exercisePBs = signal<PersonalBestSet[]>([]); // New signal for PBs

  @Input() id?: string; // For route parameter binding

  ngOnInit(): void {
    const idSource$ = this.id ? of(this.id) : this.route.paramMap.pipe(map(params => params.get('id')));

    idSource$.pipe(
      switchMap(exerciseId => {
        if (exerciseId) {
          this.loadExercisePBs(exerciseId); // Load PBs when exerciseId is known
          return this.exerciseService.getExerciseById(exerciseId);
        }
        this.exercisePBs.set([]); // Clear PBs if no exerciseId
        return of(null); // Explicitly return Observable<null>
      })
    ).subscribe(ex => {
      this.exercise.set(ex || null);
      this.currentImageIndex.set(0);
    });
  }

  loadExercise(exerciseId: string): void {
    this.exerciseService.getExerciseById(exerciseId).subscribe(ex => {
      this.exercise.set(ex || null);
      this.currentImageIndex.set(0);
    });
  }

  nextImage(): void {
    const ex = this.exercise();
    if (ex && ex.imageUrls.length > 1) {
      this.currentImageIndex.update(index => (index + 1) % ex.imageUrls.length);
    }
  }

  prevImage(): void {
    const ex = this.exercise();
    if (ex && ex.imageUrls.length > 1) {
      this.currentImageIndex.update(index => (index - 1 + ex.imageUrls.length) % ex.imageUrls.length);
    }
  }

  // Method to load PBs for the current exercise
  private loadExercisePBs(exerciseId: string): void {
    this.trackingService.getAllPersonalBestsForExercise(exerciseId)
      .pipe(take(1)) // Take the first emission and complete
      .subscribe(pbs => {
        // Sort PBs for consistent display, e.g., by type or weight
        const sortedPBs = pbs.sort((a, b) => {
          // Example sort: "XRM (Actual)" first, then "XRM (Estimated)", then others
          // This is a basic sort, can be made more sophisticated
          if (a.pbType.includes('RM (Actual)') && !b.pbType.includes('RM (Actual)')) return -1;
          if (!a.pbType.includes('RM (Actual)') && b.pbType.includes('RM (Actual)')) return 1;
          if (a.pbType.includes('RM (Estimated)') && !b.pbType.includes('RM (Estimated)')) return -1;
          if (!a.pbType.includes('RM (Estimated)') && b.pbType.includes('RM (Estimated)')) return 1;
          return (b.weightUsed ?? 0) - (a.weightUsed ?? 0) || a.pbType.localeCompare(b.pbType);
        });
        this.exercisePBs.set(sortedPBs);
        console.log(`PBs for ${exerciseId}:`, sortedPBs);
      });
  }

  // Helper function to format PB display (can be moved to a pipe later)
  formatPbValue(pb: PersonalBestSet): string {
    let value = '';
    if (pb.weightUsed !== undefined && pb.weightUsed !== null) {
      value += `${pb.weightUsed}kg`;
      if (pb.repsAchieved > 1 && !pb.pbType.includes('RM (Actual)') && !pb.pbType.includes('RM (Estimated)')) {
        // Show reps for "Heaviest Lifted" if reps > 1, but not for explicit 1RMs where reps is 1 by definition
        value += ` x ${pb.repsAchieved}`;
      } else if (pb.repsAchieved > 1 && pb.pbType === "Heaviest Lifted") {
        value += ` x ${pb.repsAchieved}`;
      }
    } else if (pb.repsAchieved > 0 && pb.pbType.includes('Max Reps')) {
      value = `${pb.repsAchieved} reps`;
    } else if (pb.durationPerformed && pb.durationPerformed > 0 && pb.pbType.includes('Max Duration')) {
      value = `${pb.durationPerformed}s`;
    }
    return value || 'N/A';
  }
}