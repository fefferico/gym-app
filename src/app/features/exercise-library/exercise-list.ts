import { Component, inject, OnInit, signal, computed, effect } from '@angular/core'; // Added computed and effect
import { AsyncPipe, CommonModule, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Exercise } from '../../core/models/exercise.model';
import { ExerciseService } from '../../core/services/exercise.service';

@Component({
  selector: 'app-exercise-list',
  standalone: true,
  imports: [CommonModule, RouterLink, AsyncPipe, TitleCasePipe], // Added TitleCasePipe
  templateUrl: './exercise-list.html',
  styleUrl: './exercise-list.scss',
})
export class ExerciseListComponent implements OnInit {
  private exerciseService = inject(ExerciseService);

  // Observables for populating filter dropdowns
  categories$: Observable<string[]> | undefined;
  primaryMuscleGroups$: Observable<string[]> | undefined;

  // Signals for filter values
  selectedCategory = signal<string | null>(null);
  selectedMuscleGroup = signal<string | null>(null);
  searchTerm = signal<string>('');

  // Signal to hold all exercises fetched from the service
  allExercises = signal<Exercise[]>([]);

  // Computed signal for filtered exercises - THIS IS THE KEY
  filteredExercises = computed(() => {
    let exercises = this.allExercises(); // Get current value of allExercises signal

    const category = this.selectedCategory();
    if (category) {
      exercises = exercises.filter(ex => ex.category === category);
    }

    const muscleGroup = this.selectedMuscleGroup();
    if (muscleGroup) {
      exercises = exercises.filter(ex => ex.primaryMuscleGroup === muscleGroup);
    }

    const term = this.searchTerm();
    if (term) {
      exercises = exercises.filter(ex =>
        ex.name.toLowerCase().includes(term) ||
        ex.description.toLowerCase().includes(term)
      );
    }
    return exercises;
  });

  constructor() {
    // Optional: Log when filteredExercises recomputes (for debugging)
    // effect(() => {
    //   console.log('Filtered exercises updated:', this.filteredExercises().length);
    // });
  }

  ngOnInit(): void {
    window.scrollTo(0, 0);
    this.categories$ = this.exerciseService.getUniqueCategories();
    this.primaryMuscleGroups$ = this.exerciseService.getUniquePrimaryMuscleGroups();

    // Fetch all exercises and store them in the signal
    this.exerciseService.getExercises().subscribe(exercises => {
      this.allExercises.set(exercises);
      // No need to call applyFilters() here anymore,
      // the `filteredExercises` computed signal will update automatically
      // when `allExercises` is set.
    });
  }

  // Event handlers update the filter signals,
  // which automatically triggers recomputation of `filteredExercises`
  onCategoryChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedCategory.set(target.value || null);
  }

  onMuscleGroupChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedMuscleGroup.set(target.value || null);
  }

  onSearchTermChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value.toLowerCase());
  }

  clearFilters(): void {
    this.selectedCategory.set(null);
    this.selectedMuscleGroup.set(null);
    this.searchTerm.set('');
    // Also reset the select elements in the template if they are not two-way bound
    // (For simple selects like this, just clearing signals is enough if [value] is bound)
    // If using ngModel, you'd reset the bound properties.
  }
}