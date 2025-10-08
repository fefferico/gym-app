// src/app/features/exercises/exercise-list/exercise-list.ts
import { Component, inject, OnInit, signal, computed, effect, PLATFORM_ID, HostListener } from '@angular/core';
import { AsyncPipe, CommonModule, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, Observable } from 'rxjs';
import { Exercise } from '../../core/models/exercise.model';
import { ExerciseService } from '../../core/services/exercise.service';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { AlertService } from '../../core/services/alert.service';
import { ToastService } from '../../core/services/toast.service';
import { SpinnerService } from '../../core/services/spinner.service';
import { ThemeService } from '../../core/services/theme.service';
import { PressDirective } from '../../shared/directives/press.directive';
import { ActionMenuComponent } from '../../shared/components/action-menu/action-menu';
import { ActionMenuItem } from '../../core/models/action-menu.model';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { MenuMode } from '../../core/models/app-settings.model';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { deleteBtn, editBtn, hideBtn, unhideBtn, viewBtn } from '../../core/services/buttons-data';
import { TrackingService } from '../../core/services/tracking.service';

@Component({
  selector: 'app-exercise-list',
  standalone: true,
  imports: [CommonModule, RouterLink, AsyncPipe, TitleCasePipe, PressDirective, ActionMenuComponent, IconComponent],
  templateUrl: './exercise-list.html',
  styleUrl: './exercise-list.scss',
  animations: [
    trigger('fabSlideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(200%)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(100%)' }))
      ])
    ]),
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
  private appSettingsService = inject(AppSettingsService);
  private trackingService = inject(TrackingService);

  categories$: Observable<string[]> | undefined;
  primaryMuscleGroups$: Observable<string[]> | undefined;
  selectedCategory = signal<string | null>(null);
  selectedMuscleGroup = signal<string | null>(null);
  searchTerm = signal<string>('');
  allExercises = signal<Exercise[]>([]);

  // --- NEW ---
  showHiddenExercises = signal<boolean>(false);
  // -----------

  actionsVisibleId = signal<string | null>(null);
  menuModeDropdown: boolean = false;
  menuModeCompact: boolean = false;
  menuModeModal: boolean = false;
  isFilterAccordionOpen = signal(false);

  filteredExercises = computed(() => {
    let exercises = this.allExercises();
    const showHidden = this.showHiddenExercises(); // Get value once

    // --- NEW: Filter by isHidden status first ---
    if (!showHidden) {
      exercises = exercises.filter(ex => !ex.isHidden);
    }
    // ------------------------------------------

    const category = this.selectedCategory();
    if (category) {
      exercises = exercises.filter(ex => ex.category === category);
    }
    const muscleGroup = this.selectedMuscleGroup();
    if (muscleGroup) {
      exercises = exercises.filter(ex => ex.primaryMuscleGroup === muscleGroup);
    }

    let term = this.searchTerm();
    term = this.exerciseService.normalizeExerciseNameForSearch(term);
    if (term) {
      const words = term.split(/\s+/).filter(Boolean);
      exercises = exercises.filter(ex => {
        const searchable = [
          ex.name,
          ex.category,
          ex.description || ''
        ].join(' ').toLowerCase();
        return words.every(word => searchable.includes(word));
      });
    }

    return exercises.map(ex => ({
      ...ex,
      iconName: this.exerciseService.determineExerciseIcon(ex, ex?.name)
    }));
  });

  constructor() { }

  showBackToTopButton = signal<boolean>(false);
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    const verticalOffset = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    this.showBackToTopButton.set(verticalOffset > 400);
  }

  isFabActionsOpen = signal(false);
  isTouchDevice = false;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
      this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    this.categories$ = this.exerciseService.getUniqueCategories();
    this.primaryMuscleGroups$ = this.exerciseService.getUniquePrimaryMuscleGroups();

    this.menuModeDropdown = this.appSettingsService.isMenuModeDropdown();
    this.menuModeCompact = this.appSettingsService.isMenuModeCompact();
    this.menuModeModal = this.appSettingsService.isMenuModeModal();

    // =================== START OF REVERT ===================
    // The subscription is now simple again. It only fetches the raw exercise list.
    // The modal will handle adding the usage counts.
    this.exerciseService.exercises$.subscribe(exercises => {
      this.allExercises.set(exercises);
    });
    // =================== END OF REVERT ===================
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
    this.showHiddenExercises.set(false); // Also reset the hidden toggle
    const categorySelect = document.getElementById('category-filter') as HTMLSelectElement;
    if (categorySelect) categorySelect.value = '';
    const muscleGroupSelect = document.getElementById('muscle-group-filter') as HTMLSelectElement;
    if (muscleGroupSelect) muscleGroupSelect.value = '';
    const searchInput = document.getElementById('search-term') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
  }

  goToExerciseDetails(id: string): void {
    this.router.navigate(['/library', id]);
    this.actionsVisibleId.set(null);
  }

  getIconPath(iconName: string | undefined): string {
    return this.exerciseService.getIconPath(iconName);
  }

  editExercise(exerciseId: string): void {
    this.router.navigate(['/library/edit', exerciseId]);
    this.actionsVisibleId.set(null);
  }

  async deleteExercise(exerciseId: string): Promise<void> {
    this.actionsVisibleId.set(null);
    const exerciseToDelete = this.allExercises().find(ex => ex.id === exerciseId);
    if (!exerciseToDelete) {
      this.toastService.error("Exercise not found", 0);
      return;
    }
    const confirm = await this.alertService.showConfirm(
      'Delete Exercise',
      `Are you sure you want to delete the exercise "${exerciseToDelete.name}"? This action cannot be undone.`,
      'Delete'
    );
    if (confirm && confirm.data) {
      try {
        this.spinnerService.show("Deleting exercise..");
        await this.exerciseService.deleteExercise(exerciseId);
        this.toastService.success(`Exercise "${exerciseToDelete.name}" deleted successfully.`, 3000, "Deleted");
      } catch (error) {
        console.error("Error deleting exercise:", error);
        this.toastService.error("Failed to delete exercise. It might be in use", 0, "Error");
      } finally {
        this.spinnerService.hide();
      }
    }
  }

  // --- NEW: Hide/Unhide methods ---
  hideExercise(exerciseId: string): void {
    this.exerciseService.hideExercise(exerciseId).subscribe();
    this.activeExerciseIdActions.set(null);
  }

  unhideExercise(exerciseId: string): void {
    this.exerciseService.unhideExercise(exerciseId).subscribe();
    this.activeExerciseIdActions.set(null);
  }
  // --------------------------------

  toggleFilterAccordion(): void {
    this.isFilterAccordionOpen.update(isOpen => !isOpen);
  }

  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  handleFabClick(): void {
    this.isFabActionsOpen.update(v => !v);
  }

  handleFabMouseEnter(): void {
    if (!this.isTouchDevice) {
      this.isFabActionsOpen.set(true);
    }
  }

  handleFabMouseLeave(): void {
    if (!this.isTouchDevice) {
      this.isFabActionsOpen.set(false);
    }
  }

  navigateToCreateExercise(): void {
    this.router.navigate(['/library/new']);
  }

  getExerciseDropdownActionItems(exerciseId: string, mode: MenuMode): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';

    // --- NEW: Find the current exercise to check its status ---
    const currentExercise = this.allExercises().find(ex => ex.id === exerciseId);
    // --------------------------------------------------------

    const actionsArray: ActionMenuItem[] = [
      {
        ...viewBtn,
        data: { exerciseId: exerciseId }
      },
      {
        ...editBtn,
        data: { exerciseId: exerciseId }
      }
    ];

    // --- NEW: Conditionally add Hide/Unhide button ---
    if (currentExercise?.isHidden) {
      actionsArray.push({
        ...unhideBtn,
        data: { exerciseId }
      });
    } else {
      actionsArray.push({
        ...hideBtn,
        data: { exerciseId }
      });
    }
    // ---------------------------------------------

    // Add Delete button at the end
    actionsArray.push({
      ...deleteBtn,
      data: { exerciseId: exerciseId }
    });

    return actionsArray;
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }, originalMouseEvent?: MouseEvent): void {
    const exerciseId = event.data?.exerciseId;
    if (!exerciseId) return;

    switch (event.actionKey) {
      case 'view':
        this.goToExerciseDetails(exerciseId);
        break;
      case 'edit':
        this.editExercise(exerciseId);
        break;
      case 'delete':
        this.deleteExercise(exerciseId);
        break;
      // --- NEW: Handle hide/unhide actions ---
      case 'hide':
        this.hideExercise(exerciseId);
        break;
      case 'unhide':
        this.unhideExercise(exerciseId);
        break;
      // -------------------------------------
    }
    this.activeExerciseIdActions.set(null); // Close the menu
  }

  activeExerciseIdActions = signal<string | null>(null);
  toggleActions(exerciseId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeExerciseIdActions.update(current => (current === exerciseId ? null : exerciseId));
  }

  areActionsVisible(exerciseId: string): boolean {
    return this.activeExerciseIdActions() === exerciseId;
  }

  onCloseActionMenu() {
    this.activeExerciseIdActions.set(null);
  }
}