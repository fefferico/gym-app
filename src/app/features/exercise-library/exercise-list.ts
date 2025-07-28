// src/app/features/exercises/exercise-list/exercise-list.ts
import { Component, inject, OnInit, signal, computed, effect, PLATFORM_ID, HostListener } from '@angular/core';
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
import { PressDirective } from '../../shared/directives/press.directive';
import { ActionMenuComponent } from '../../shared/components/action-menu/action-menu';
import { ActionMenuItem } from '../../core/models/action-menu.model';

@Component({
  selector: 'app-exercise-list',
  standalone: true,
  imports: [CommonModule, RouterLink, AsyncPipe, TitleCasePipe, PressDirective, ActionMenuComponent],
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
  menuModeCompact: boolean = false;
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
    this.menuModeCompact = this.themeService.isMenuModeCompact();

    // This subscription now gets ALL exercises from the service
    this.exerciseService.exercises$.subscribe(exercises => {
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

  getExerciseDropdownActionItems(exerciseId: string, mode: 'dropdown' | 'compact-bar'): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';

    // --- NEW: Find the current exercise to check its status ---
    const currentExercise = this.allExercises().find(ex => ex.id === exerciseId);
    // --------------------------------------------------------

    const actionsArray: ActionMenuItem[] = [
      {
        label: 'VIEW',
        actionKey: 'view',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z" /><path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 11-8 0 4 4 0 018 0Z" clip-rule="evenodd" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { exerciseId: exerciseId }
      },
      {
        label: 'EDIT',
        actionKey: 'edit',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { exerciseId: exerciseId }
      },
      { isDivider: true },
    ];

    // --- NEW: Conditionally add Hide/Unhide button ---
    if (currentExercise?.isHidden) {
      actionsArray.push({
        label: 'UNHIDE',
        actionKey: 'unhide',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z" /><path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 11-8 0 4 4 0 018 0Z" clip-rule="evenodd" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { exerciseId }
      });
    } else {
      actionsArray.push({
        label: 'HIDE',
        actionKey: 'hide',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z" clip-rule="evenodd" /><path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.257 0-7.893-2.66-9.336-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { exerciseId }
      });
    }
    // ---------------------------------------------

    // Add Delete button at the end
    actionsArray.push({
      label: 'DELETE',
      actionKey: 'delete',
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.177-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5Zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5Z" clip-rule="evenodd" /></svg>`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
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