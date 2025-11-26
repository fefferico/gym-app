// src/app/features/exercises/exercise-list/exercise-list.ts
import { Component, inject, OnInit, signal, computed, effect, PLATFORM_ID, HostListener, OnDestroy } from '@angular/core';
import { AsyncPipe, CommonModule, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, map, Observable, Subscription } from 'rxjs';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Muscle } from '../../core/models/muscle.model';
import { ExerciseCategoryService, HydratedExerciseCategory } from '../../core/services/exercise-category.service';
import { MuscleMapService } from '../../core/services/muscle-map.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { EquipmentService, HydratedEquipment } from '../../core/services/equipment.service';
import { BumpClickDirective } from '../../shared/directives/bump-click.directive';

export type DisplayExercise = Exercise & {
  categoryLabel: string;
  muscleGroupLabel: string;
  muscleGroupsHydrated: Muscle[]; // use a different property name
  equipmentNeededHydrated: HydratedEquipment[]; // use a different property name
  equipmentLabel: string;
  iconName?: string;
};

@Component({
  selector: 'app-exercise-list',
  standalone: true,
  imports: [CommonModule, RouterLink, AsyncPipe, TitleCasePipe, PressDirective, ActionMenuComponent, IconComponent, TranslateModule, BumpClickDirective],
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
export class ExerciseListComponent implements OnInit, OnDestroy {

  public exerciseService = inject(ExerciseService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private toastService = inject(ToastService);
  private spinnerService = inject(SpinnerService);
  private themeService = inject(ThemeService);
  private platformId = inject(PLATFORM_ID);
  private appSettingsService = inject(AppSettingsService);
  private trackingService = inject(TrackingService);
  private translate = inject(TranslateService);
  private exerciseCategoryService = inject(ExerciseCategoryService);
  private muscleGroupService = inject(MuscleMapService);
  private equipmentService = inject(EquipmentService);

  categories = this.exerciseCategoryService.getHydratedCategories();
  hydratedMuscles = this.muscleGroupService.getHydratedMuscles();
  hydratedEquipments = this.equipmentService.getTranslatedEquipment();


  // This will hold the raw, untranslated data
  private staticExercises: Exercise[] = [];
  private langChangeSub?: Subscription;

  primaryMuscleGroups$: Observable<Muscle[]> | undefined;
  selectedCategory = signal<string | null>(null);
  selectedEquipment = signal<string | null>(null);
  selectedMuscleGroup = signal<Muscle | null>(null);
  searchTerm = signal<string>('');
  allExercises = signal<Exercise[]>([]);

  showHiddenExercises = signal<boolean>(false);

  actionsVisibleId = signal<string | null>(null);
  menuModeDropdown: boolean = false;
  menuModeCompact: boolean = false;
  menuModeModal: boolean = false;
  isFilterAccordionOpen = signal(false);

  // Signal for hydrated exercises
  hydratedExercises = toSignal(
    combineLatest([
      this.exerciseService.getHydratedExercises(),
      this.exerciseCategoryService.hydratedCategories$,
      this.muscleGroupService.hydratedMuscles$,
      this.equipmentService.hydratedEquipments$
    ]).pipe(
      map(([exercises, categories, muscles, equipments]) =>
        exercises.map(ex => {
          // const categoryObj = categories.find(cat => 
          //   Array.isArray(ex.categories) 
          //     ? ex.categories.map(String).includes(cat.id.toString()) 
          //     : cat.id.toString() === ex.categories.toString()
          // );
          const muscleObj = muscles.find(muscle => muscle.id === ex.primaryMuscleGroup?.id);
          const equipmentArray = [
            ...new Set(
              equipments
                .filter(equipment => [ex.equipmentNeeded.map(eq => eq.id)].toString().includes(equipment.id))
                .map(eq => eq.name)
            )
          ];

          return {
            ...ex,
            categories: ex.categories,
            categoriesLabel: ex.categoryLabels,
            muscleGroupLabel: muscleObj?.name || ex.primaryMuscleGroup,
            equipmentLabel: equipmentArray.join(', ')
          };
        })
      )
    ),
    { initialValue: [] } // <-- pass as an object!
  );

  filteredExercises = computed(() => {
    let exercises = this.hydratedExercises();
    const showHidden = this.showHiddenExercises(); // Get value once
    if (!exercises) {
      return [];
    }

    if (!showHidden) {
      exercises = exercises.filter(ex => !ex.isHidden);
    }
    // ------------------------------------------

    const category = this.selectedCategory();
    if (category) {
      exercises = exercises.filter(ex => ex.categories.filter(cat => cat.toString() === category).length > 0);
    }
    const equipment = this.selectedEquipment();
    if (equipment) {
      exercises = exercises.filter(ex =>
        Array.isArray(ex.equipmentNeeded)
          ? ex.equipmentNeeded.some(eq => eq.id === equipment)
          : ex.equipmentNeeded === equipment
      );
    }
    const muscleGroup = this.selectedMuscleGroup();
    if (muscleGroup) {
      exercises = exercises.filter(ex => ex.primaryMuscleGroup?.id === muscleGroup.id);
    }

    let term = this.searchTerm();
    term = this.exerciseService.normalizeExerciseNameForSearch(term);

    if (term) {
      const words = term.split(/\s+/).filter(Boolean);
      exercises = exercises.filter(ex => {
        const englishName = [ex._searchId, ex._searchName, ex.name].filter(Boolean).join(' ');
        const searchable = [
          englishName,
          ex.name,
          ex.categories,
          ex.description || ''
        ].join(' ').toLowerCase();
        return words.every(word => searchable.includes(word));
      });
    }

    return exercises.map(ex => {
      // const categoryObj = this.categories.find(cat => cat.id.toString() === ex.categories);
      const muscleGroupObj = this.muscleGroupService.getHydratedMuscles().find(mg => mg.id === ex.primaryMuscleGroup?.id);

      return {
        ...ex,
        iconName: this.exerciseService.determineExerciseIcon(this.exerciseService.mapHydratedExerciseToExercise(ex), ex?._searchName),
        categoryLabel: ex.categories,
        muscleGroupLabel: muscleGroupObj?.name || ex.primaryMuscleGroup?.name
      };
    });
  });

  constructor() {
    this.categories = this.exerciseCategoryService.getHydratedCategories();
  }

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
    this.primaryMuscleGroups$ = this.exerciseService.getUniquePrimaryMuscleGroups();

    this.menuModeDropdown = this.appSettingsService.isMenuModeDropdown();
    this.menuModeCompact = this.appSettingsService.isMenuModeCompact();
    this.menuModeModal = this.appSettingsService.isMenuModeModal();

    // 1. Get the static, untranslated exercises ONCE
    this.exerciseService.getExercises().subscribe(staticExercises => {
      this.staticExercises = staticExercises;
      this.translateAllExercises(); // Perform the initial translation
    });

    // 2. Subscribe to language changes to re-translate the list
    this.langChangeSub = this.translate.onLangChange.subscribe(() => {
      this.translateAllExercises();
    });
  }


  onCategoryChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedCategory.set(target.value || null);
  }

  onEquipmentChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedEquipment.set(target.value || null);
  }

  onMuscleGroupChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (!target.value || !this.primaryMuscleGroups$) {
      this.selectedMuscleGroup.set(null);
      return;
    }
    // Subscribe to the observable to get the array and then find the muscle group
    this.primaryMuscleGroups$?.subscribe((muscleGroups: Muscle[]) => {
      const selectedMuscleGroup = muscleGroups.find((mg: Muscle) => mg.id === target.value) || null;
      this.selectedMuscleGroup.set(selectedMuscleGroup);
    });
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
    this.selectedEquipment.set(null);
    const equipmentSelect = document.getElementById('equipment-filter') as HTMLSelectElement;
    if (equipmentSelect) equipmentSelect.value = '';
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

  // Update dynamic strings in your methods to use the translation service
  async deleteExercise(exerciseId: string): Promise<void> {
    this.actionsVisibleId.set(null);
    const exerciseToDelete = this.allExercises().find(ex => ex.id === exerciseId);
    if (!exerciseToDelete) {
      this.toastService.error(this.translate.instant('exerciseList.delete.notFound'), 0, "Error");
      return;
    }
    const confirm = await this.alertService.showConfirm(
      this.translate.instant('exerciseList.delete.confirmTitle'),
      this.translate.instant('exerciseList.delete.confirmMessage', { name: exerciseToDelete.name }),
      this.translate.instant('common.delete')
    );
    if (confirm && confirm.data) {
      try {
        this.spinnerService.show(this.translate.instant('exerciseList.delete.deleting'));
        await this.exerciseService.deleteExercise(exerciseId);
        this.toastService.success(this.translate.instant('exerciseList.delete.success', { name: exerciseToDelete.name }), 3000, this.translate.instant('exerciseList.delete.successTitle'));
      } catch (error) {
        console.error("Error deleting exercise:", error);
        this.toastService.error(this.translate.instant('exerciseList.delete.error'), 0, "Error");
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


  /**
   * Merges the static exercise data with the current language translations.
   */
  private translateAllExercises(): void {
    this.translate.get('exercises').subscribe(translations => {
      // Get hydrated categories (with translated labels)
      const hydratedCategories = this.exerciseCategoryService.getHydratedCategories();
      const hydratedMuscleGroups = this.muscleGroupService.getHydratedMuscles();

      const translatedList = this.staticExercises.map(ex => {
        // Find the hydrated category for this exercise
        // const categoryObj = hydratedCategories.find(cat =>
        //   Array.isArray(ex.categories)
        //     ? ex.categories.includes(cat.id.toString())
        //     : cat.id.toString() === ex.categories
        // );
        const muscleGroupObj = hydratedMuscleGroups.find(mg => mg.id === ex.primaryMuscleGroup);

        return {
          ...ex,
          name: translations[ex.id]?.name || ex.name,
          description: translations[ex.id]?.description || ex.description,
          categories: ex.categories, // fallback to ID if not found
          muscleGroupLabels: muscleGroupObj?.name || ex.primaryMuscleGroup // fallback to ID if not found
        } as Exercise & { categoryLabels: string, muscleGroupLabels: string };
      });

      this.allExercises.set(translatedList);
    });
  }

  ngOnDestroy(): void {
    // Unsubscribe to prevent memory leaks
    this.langChangeSub?.unsubscribe();
  }

  get sortedCategories() {
    // If categories is an observable or signal, resolve it accordingly
    const categories = Array.isArray(this.categories) ? this.categories : [];
    return [...categories].sort((a, b) =>
      this.translate.instant(a.name).localeCompare(this.translate.instant(b.name))
    );
  }
}