import { Component, inject, Input, OnInit, signal } from '@angular/core'; // Added signal
import { AsyncPipe, CommonModule } from '@angular/common'; // Import CommonModule for NgIf, NgFor
import { ActivatedRoute, RouterLink } from '@angular/router'; // Added RouterLink
import { Observable, switchMap } from 'rxjs';
import { Exercise } from '../../core/models/exercise.model';
import { ExerciseService } from '../../core/services/exercise.service';

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

  // Using a signal for the exercise data
  exercise = signal<Exercise | undefined | null>(undefined); // undefined initially, null if not found

  // For image carousel
  currentImageIndex = signal<number>(0);

  @Input() id?: string; // For route parameter binding

  ngOnInit(): void {
    if (this.id) { // If id is passed via input binding (from router)
      this.loadExercise(this.id);
    } else { // Fallback to snapshot if not using input binding (less common now)
      this.route.paramMap.pipe(
        switchMap(params => {
          const exerciseId = params.get('id');
          if (exerciseId) {
            return this.exerciseService.getExerciseById(exerciseId);
          }
          return new Observable<Exercise | undefined>(observer => observer.next(undefined)); // Or of(undefined)
        })
      ).subscribe(ex => {
        this.exercise.set(ex || null); // Set to null if not found
        this.currentImageIndex.set(0); // Reset image index
      });
    }
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
}