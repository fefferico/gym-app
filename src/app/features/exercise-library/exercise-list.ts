import { Component, inject, OnInit, signal, computed, effect, PLATFORM_ID } from '@angular/core';
import { AsyncPipe, CommonModule, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Exercise } from '../../core/models/exercise.model';
import { ExerciseService } from '../../core/services/exercise.service';
import { animate, state, style, transition, trigger } from '@angular/animations'; // Import animations
import { AlertService } from '../../core/services/alert.service'; // For delete confirmation
import { ToastService } from '../../core/services/toast.service'; // For feedback
import { SpinnerService } from '../../core/services/spinner.service'; // For loading indicators
import { ThemeService } from '../../core/services/theme.service'; // Assuming you have this for menuModeCompact

@Component({
  selector: 'app-exercise-list',
  standalone: true,
  imports: [CommonModule, RouterLink, AsyncPipe, TitleCasePipe],
  templateUrl: './exercise-list.html',
  styleUrl: './exercise-list.scss',
  animations: [ // Add animation triggers
    trigger('slideInOutActions', [
      state('void', style({
        height: '0px',
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
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem'
      })),
      transition('void <=> *', animate('200ms ease-in-out'))
    ]),
    trigger('dropdownMenu', [
      state('void', style({
        opacity: 0,
        transform: 'scale(0.75) translateY(-10px)',
        transformOrigin: 'top right'
      })),
      state('*', style({
        opacity: 1,
        transform: 'scale(1) translateY(0)',
        transformOrigin: 'top right'
      })),
      transition('void => *', [
        animate('150ms cubic-bezier(0.25, 0.8, 0.25, 1)')
      ]),
      transition('* => void', [
        animate('100ms cubic-bezier(0.25, 0.8, 0.25, 1)')
      ])
    ])
  ]
})
export class ExerciseListComponent implements OnInit {
  // Keep existing injections
  public exerciseService = inject(ExerciseService); // Made public for template access to isLoadingExercises$
  private router = inject(Router);
  private alertService = inject(AlertService);
  private toastService = inject(ToastService);
  private spinnerService = inject(SpinnerService);
  private themeService = inject(ThemeService); // Uncomment and use if ThemeService is available

  // Keep existing observables and signals for filters and data
  categories$: Observable<string[]> | undefined;
  primaryMuscleGroups$: Observable<string[]> | undefined;
  selectedCategory = signal<string | null>(null);
  selectedMuscleGroup = signal<string | null>(null);
  searchTerm = signal<string>('');
  allExercises = signal<Exercise[]>([]);

  // Add signals and properties for menu logic
  actionsVisibleId = signal<string | null>(null);
  menuModeCompact: boolean = false; // Default, set from ThemeService if available

  filteredExercises = computed(() => {
    let exercises = this.allExercises();
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
        (ex.description && ex.description.toLowerCase().includes(term)) // Check if description exists
      );
    }
    return exercises.map(ex => ({
      ...ex,
      iconName: this.exerciseService.determineExerciseIcon(ex, ex?.name)
    }));
  });

  private platformId = inject(PLATFORM_ID);

  constructor() {
    effect(() => {
      console.log('Filtered exercises updated:', this.filteredExercises().length);
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
    }
    this.categories$ = this.exerciseService.getUniqueCategories();
    this.primaryMuscleGroups$ = this.exerciseService.getUniquePrimaryMuscleGroups();

    this.menuModeCompact = this.themeService.isMenuModeCompact(); // Set from ThemeService

    this.exerciseService.getExercises().subscribe(exercises => {
      this.allExercises.set(exercises);
    });
  }

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
    // Reset select elements visually if not using two-way binding
    const categorySelect = document.getElementById('category-filter') as HTMLSelectElement;
    if (categorySelect) categorySelect.value = '';
    const muscleGroupSelect = document.getElementById('muscle-group-filter') as HTMLSelectElement;
    if (muscleGroupSelect) muscleGroupSelect.value = '';
    const searchInput = document.getElementById('search-term') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
  }

  goToExerciseDetails(id: string, event?: MouseEvent): void {
    event?.stopPropagation(); // Prevent card click if called from button inside
    this.router.navigate(['/library', id]);
    this.actionsVisibleId.set(null); // Close menu
  }

  getIconPath(iconName: string | undefined): string {
    return this.exerciseService.getIconPath(iconName);
  }

  // Methods for menu actions (View, Edit, Delete)
  toggleActions(exerciseId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.actionsVisibleId.update(current => (current === exerciseId ? null : exerciseId));
  }

  editExercise(exerciseId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.router.navigate(['/library/edit', exerciseId]); // Assuming this route exists
    this.actionsVisibleId.set(null);
  }

  async deleteExercise(exerciseId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.actionsVisibleId.set(null);

    const exerciseToDelete = this.allExercises().find(ex => ex.id === exerciseId);
    if (!exerciseToDelete) {
        this.toastService.error("Exercise not found.", 0);
        return;
    }

    const confirm = await this.alertService.showConfirm(
      'Delete Exercise',
      `Are you sure you want to delete the exercise "${exerciseToDelete.name}"? This action cannot be undone.`,
      'Delete'
    );

    if (confirm && confirm.data) {
      try {
        this.spinnerService.show("Deleting exercise...");
        await this.exerciseService.deleteExercise(exerciseId); // Assuming deleteExercise is async
        // No need to manually update allExercises, getExercises() in service should emit new list
        this.toastService.success(`Exercise "${exerciseToDelete.name}" deleted successfully.`, 3000, "Deleted");
      } catch (error) {
        console.error("Error deleting exercise:", error);
        this.toastService.error("Failed to delete exercise. It might be in use in routines or programs.", 0, "Error");
      } finally {
        this.spinnerService.hide();
      }
    }
  }
}