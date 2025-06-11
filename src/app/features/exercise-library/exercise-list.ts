import { Component, inject, OnInit, signal, computed, effect, PLATFORM_ID } from '@angular/core';
import { AsyncPipe, CommonModule, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Exercise } from '../../core/models/exercise.model';
import { ExerciseService } from '../../core/services/exercise.service';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { AlertService } from '../../core/services/alert.service';
import { ToastService } from '../../core/services/toast.service';
import { SpinnerService } from '../../core/services/spinner.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-exercise-list',
  standalone: true,
  imports: [CommonModule, RouterLink, AsyncPipe, TitleCasePipe],
  templateUrl: './exercise-list.html',
  styleUrl: './exercise-list.scss',
  animations: [
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
  public exerciseService = inject(ExerciseService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private toastService = inject(ToastService);
  private spinnerService = inject(SpinnerService);
  private themeService = inject(ThemeService);
  private platformId = inject(PLATFORM_ID);

  categories$: Observable<string[]> | undefined;
  primaryMuscleGroups$: Observable<string[]> | undefined;
  selectedCategory = signal<string | null>(null);
  selectedMuscleGroup = signal<string | null>(null);
  searchTerm = signal<string>('');
  allExercises = signal<Exercise[]>([]);

  actionsVisibleId = signal<string | null>(null);
  menuModeCompact: boolean = false;
  isFilterAccordionOpen = signal(false); // Signal for accordion state

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
        (ex.description && ex.description.toLowerCase().includes(term))
      );
    }
    return exercises.map(ex => ({
      ...ex,
      iconName: this.exerciseService.determineExerciseIcon(ex, ex?.name)
    }));
  });

  constructor() {
    // effect(() => { // Keep for debugging if needed
    //   console.log('Filtered exercises updated:', this.filteredExercises().length);
    // });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
    }
    this.categories$ = this.exerciseService.getUniqueCategories();
    this.primaryMuscleGroups$ = this.exerciseService.getUniquePrimaryMuscleGroups();
    this.menuModeCompact = this.themeService.isMenuModeCompact();

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
    const categorySelect = document.getElementById('category-filter') as HTMLSelectElement;
    if (categorySelect) categorySelect.value = '';
    const muscleGroupSelect = document.getElementById('muscle-group-filter') as HTMLSelectElement;
    if (muscleGroupSelect) muscleGroupSelect.value = '';
    const searchInput = document.getElementById('search-term') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
  }

  goToExerciseDetails(id: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/library', id]);
    this.actionsVisibleId.set(null);
  }

  getIconPath(iconName: string | undefined): string {
    return this.exerciseService.getIconPath(iconName);
  }

  toggleActions(exerciseId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.actionsVisibleId.update(current => (current === exerciseId ? null : exerciseId));
  }

  editExercise(exerciseId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.router.navigate(['/library/edit', exerciseId]);
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
        await this.exerciseService.deleteExercise(exerciseId);
        this.toastService.success(`Exercise "${exerciseToDelete.name}" deleted successfully.`, 3000, "Deleted");
      } catch (error) {
        console.error("Error deleting exercise:", error);
        this.toastService.error("Failed to delete exercise. It might be in use.", 0, "Error");
      } finally {
        this.spinnerService.hide();
      }
    }
  }

  // Method to toggle the filter accordion
  toggleFilterAccordion(): void {
    this.isFilterAccordionOpen.update(isOpen => !isOpen);
  }
}