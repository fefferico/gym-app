import { Component, computed, inject, input, model, Output, ViewChild, ElementRef, AfterViewInit, EventEmitter, OnChanges, SimpleChanges, signal, effect, Inject, DOCUMENT } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Exercise } from '../../../core/models/exercise.model';
import { ExerciseService, HydratedExercise } from '../../../core/services/exercise.service';
import { IconComponent } from '../icon/icon.component';
import { Observable, Subscription, take } from 'rxjs';
import { ToastService } from '../../../core/services/toast.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BumpClickDirective } from '../../directives/bump-click.directive';
import { Muscle } from '../../../core/models/muscle.model';
import { MuscleMapService } from '../../../core/services/muscle-map.service';
import { MuscleValue } from '../../../core/services/muscles-data';
import { HydratedExerciseCategory } from '../../../core/services/exercise-category.service';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { EXERCISE_CATEGORY_TYPES } from '../../../core/models/exercise-category.model';

type ListItem = HydratedExercise | { isHeader: true; label: string };

@Component({
    selector: 'app-exercise-selection-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, TitleCasePipe, DatePipe, IconComponent, AsyncPipe, TranslateModule, BumpClickDirective, ScrollingModule],
    templateUrl: './exercise-selection-modal.component.html',
})
export class ExerciseSelectionModalComponent implements AfterViewInit, OnChanges {
    private exerciseService = inject(ExerciseService);
    private trackingService = inject(TrackingService);
    private toastService = inject(ToastService);
    private translate = inject(TranslateService);
    private muscleMapService = inject(MuscleMapService);
    private translatedMuscles = signal<Muscle[]>([]);

    isMultiSelect = input<boolean>(false);
    isFocusInputOnStart = input<boolean>(false);
    customPB = input<string>('');
    protected static lastSelectedCategory: EXERCISE_CATEGORY_TYPES | null = null;

    // --- OUTPUTS ---
    @Output() exerciseSelected = new EventEmitter<Exercise>(); // For single-select mode
    @Output() exercisesSelected = new EventEmitter<Exercise[]>(); // <-- NEW OUTPUT for multi-select

    // --- STATE SIGNALS ---
    selectedExerciseIds = signal<string[]>([]); // <-- NEW SIGNAL to track selections

    // Computed signal for the selection counter in the UI
    selectionCount = computed(() => this.selectedExerciseIds().length);

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['isOpen'] && changes['isOpen'].currentValue) {
            if (ExerciseSelectionModalComponent.lastSelectedCategory) {
                this.selectedCategory.set(ExerciseSelectionModalComponent.lastSelectedCategory);
                this.selectedCategoryValue = ExerciseSelectionModalComponent.lastSelectedCategory;
            } else {
                this.selectedCategoryValue = "";
            }
        }
    }

    private enrichedExercises = signal<HydratedExercise[]>([]); // This will hold the exercises with usage counts

    private usageCounts = toSignal(this.trackingService.getExerciseUsageCounts(), {
        initialValue: new Map<string, number>()
    });

    private dataSub: Subscription | undefined;

    @ViewChild('exerciseSearchFied') myExerciseInput!: ElementRef;
    @ViewChild('scrollContainer') private scrollContainer!: ElementRef<HTMLDivElement>;

    private translatedExercises = signal<Exercise[]>([]);
    hydratedExercises = signal<HydratedExercise[]>([]);

    constructor(@Inject(DOCUMENT) private document: Document) {
        // =================== START OF SNIPPET 2 ===================
        // Effect 1: Translate the raw exercises list whenever the input changes.
        effect(() => {
            const exercisesToTranslate = this.exercises(); // Dependency on the input signal
            if (exercisesToTranslate && exercisesToTranslate.length > 0) {
                // Unsubscribing is handled by `take(1)`
                this.exerciseService.getHydratedExerciseList(exercisesToTranslate)
                    .pipe(take(1)) // Ensure the subscription auto-completes
                    .subscribe(hydrated => {
                        this.hydratedExercises.set(hydrated);
                    });
            } else {
                this.translatedExercises.set([]); // Handle empty input
            }

            this.muscleMapService.getTranslatedMuscles().pipe(take(1)).subscribe(muscles => {
                this.translatedMuscles.set(muscles);
            });
        });

        // Effect 2: Enrich the TRANSLATED exercises with usage counts.
        // This runs whenever the translated list or usage counts change.
        effect(() => {
            const hydrated = this.hydratedExercises();
            const usageMap = this.usageCounts();

            const hydratedWithUsage = hydrated.map(ex => ({
                ...ex,
                usageCount: usageMap.get(ex.id) || 0
            }));

            this.enrichedExercises.set(hydratedWithUsage);
        });
        // =================== END OF SNIPPET 2 ===================

        // Effect for scrolling remains the same
        effect(() => {
            this.sortMode();
            if (this.scrollContainer?.nativeElement) {
                this.scrollContainer.nativeElement.scrollTop = 0;
            }
            if (this.sortMode() === 'lastUsed') {
                this.isFilterAccordionOpen.set(false);
            }
        });

        effect(() => {
            if (this.isOpen()) {
                this.document.body.classList.add('overflow-hidden');
            } else {
                this.document.body.classList.remove('overflow-hidden');
            }
        });

        effect((onCleanup) => {
            onCleanup(() => {
                this.document.body.classList.remove('overflow-hidden');
            });
        });
    }

    // --- Inputs: (Unchanged) ---
    isOpen = model<boolean>(false);
    title = input<string>('Select Exercise');
    exercises = input.required<Exercise[]>();
    searchPlaceholder = input<string>('Search exercises...');
    itemIconName = input<string>('done');
    itemIconClass = input<string>('text-primary dark:text-primary-light');

    // --- Feature Flags: (Unchanged) ---
    showSimilarButton = input<boolean>(false);
    showCreateCustomLink = input<boolean>(false);
    isShowingSimilarView = input<boolean>(false);

    // --- Outputs: (Unchanged) ---
    @Output() close = new EventEmitter<void>();
    @Output() findSimilarClicked = new EventEmitter<void>();
    @Output() createCustomClicked = new EventEmitter<void>();
    @Output() backToSearchClicked = new EventEmitter<void>();

    // --- Search Term Model: (Unchanged) ---
    searchTerm = model<string>('');

    isFilterAccordionOpen = signal(false);
    public selectedCategoryValue: EXERCISE_CATEGORY_TYPES | string = "";
    selectedCategory = signal<EXERCISE_CATEGORY_TYPES | string>("");
    selectedMuscleGroup = signal<Muscle | null>(null);
    sortMode = signal<'alpha' | 'lastUsed' | 'frequency'>('alpha');

    categories$: Observable<HydratedExerciseCategory[]> = this.exerciseService.getUniqueCategories();
    primaryMuscleGroups$: Observable<Muscle[]> = this.exerciseService.getUniquePrimaryMuscleGroups();

    // --- CORE LOGIC: Replaced with a powerful computed signal for processing ---
    processedExercises = computed<ListItem[]>(() => {
        const term = this.searchTerm()?.toLowerCase() ?? '';
        let exerciseList = this.enrichedExercises();
        const mode = this.sortMode();
        const category = this.selectedCategory() as string;
        const muscleGroup = this.selectedMuscleGroup();

        // 1. --- FILTERING (Unchanged) ---
        if (category && category !== "") {
            exerciseList = exerciseList.filter(ex => ex.categories?.some(cat => cat == category));
        }
        if (muscleGroup) {
            exerciseList = exerciseList.filter(ex =>
                (ex.primaryMuscleGroup && ex.primaryMuscleGroup.id === muscleGroup.id) ||
                (Array.isArray(ex.muscleGroups) && ex.muscleGroups.some(muscle => muscle.id === muscleGroup.id))
            );
        }
        if (term) {
            const normalizedTerm = this.exerciseService.normalizeExerciseNameForSearch(term);
            exerciseList = exerciseList.filter(ex => {
                // Also search in translated muscle names and English name
                const primaryMuscleName = this.getMuscleNameById(ex.primaryMuscleGroup?.id || '');
                const muscleNames = (ex.muscleGroups || []).map(muscle => this.getMuscleNameById(muscle.id)).join(' ');
                // ex.originalName is the English name (fallback to ex.name if not present)
                const englishName = [ex._searchId, ex._searchName, ex.name].filter(Boolean).join(' ');
                return normalizedTerm.split(' ').every(part =>
                    ex.name.toLowerCase().includes(part) ||
                    englishName.toLowerCase().includes(part) ||
                    (ex.categories?.some(cat => cat.toString().toLowerCase().includes(part))) ||
                    (ex.description?.toLowerCase().includes(part)) ||
                    (primaryMuscleName?.toLowerCase().includes(part)) ||
                    muscleNames.toLowerCase().includes(part)
                );
            });
        }

        // 2. --- SORTING & GROUPING ---
        switch (mode) {
            case 'lastUsed':
                exerciseList.sort((a, b) => (b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0) - (a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0));
                return exerciseList; // Return ungrouped list
            case 'frequency':
                exerciseList.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
                return this.groupExercisesByFrequency(exerciseList); // Return grouped list
            case 'alpha':
            default:
                exerciseList.sort((a, b) => a.name.localeCompare(b.name));
                return this.groupExercisesAlphabetically(exerciseList); // Return grouped list
        }
    });

    // --- MODIFIED: This function now uses 'label' instead of 'letter' ---
    private groupExercisesAlphabetically(exercises: HydratedExercise[]): ListItem[] {
        if (exercises.length === 0) return [];

        const itemsWithHeaders: ListItem[] = [];
        let lastLetter = '';

        for (const exercise of exercises) {
            const firstLetter = exercise.name[0].toUpperCase();
            if (firstLetter !== lastLetter) {
                lastLetter = firstLetter;
                itemsWithHeaders.push({ isHeader: true, label: firstLetter });
            }
            itemsWithHeaders.push(exercise);
        }

        return itemsWithHeaders;
    }

    // +++ NEW: Function to group exercises by their usage count +++
    private groupExercisesByFrequency(exercises: HydratedExercise[]): ListItem[] {
        if (exercises.length === 0) return [];

        const itemsWithHeaders: ListItem[] = [];
        let currentGroupLabel = '';

        const getGroupLabel = (count: number): string => {
            if (count >= 30) return this.translate.instant('exerciseSelectionModal.frequencyGroups.gt30');
            if (count >= 10) return this.translate.instant('exerciseSelectionModal.frequencyGroups.lt30');
            if (count >= 5) return this.translate.instant('exerciseSelectionModal.frequencyGroups.lt10');
            return this.translate.instant('exerciseSelectionModal.frequencyGroups.lt5');
        };

        for (const exercise of exercises) {
            const usageCount = exercise.usageCount || 0;
            const groupLabel = getGroupLabel(usageCount);

            if (groupLabel !== currentGroupLabel) {
                currentGroupLabel = groupLabel;
                itemsWithHeaders.push({ isHeader: true, label: groupLabel });
            }
            itemsWithHeaders.push(exercise);
        }

        return itemsWithHeaders;
    }

    // +++ NEW: Type guard for the template to differentiate list items +++
    isExercise(item: ListItem): item is HydratedExercise {
        return !(item as { isHeader: true }).isHeader;
    }

    /**
     * Handles what happens when a list item is clicked.
     * In single-select mode, it emits and closes.
     * In multi-select mode, it toggles the selection.
     */
    onExerciseClicked(exercise: HydratedExercise): void {
        if (this.isMultiSelect()) {
            this.toggleSelection(exercise);
        } else {
            const original = this.exercises().find(ex => ex.id === exercise.id);
            if (original) {
                // Store the category for next time
                ExerciseSelectionModalComponent.lastSelectedCategory = original?.categories[0] ?? null;
                this.exerciseSelected.emit(original);
            }
            this.onClose();
        }
    }

    /**
    * Toggles an exercise's selection state in the selectedExerciseIds signal.
    */
    toggleSelection(exercise: HydratedExercise | Exercise): void {
        const currentIds = this.selectedExerciseIds();
        let newIds: string[];
        if (currentIds.includes(exercise.id)) {
            // If already selected, remove it
            newIds = currentIds.filter(id => id !== exercise.id);
        } else {
            // If not selected, add it
            newIds = [...currentIds, exercise.id];
        }
        this.selectedExerciseIds.set(newIds);

        // --- Remember category if only one exercise is selected ---
        if (newIds.length === 1) {
            const selected = this.exercises().find(ex => ex.id === newIds[0]);
            if (selected) {
                // If category is an object, use .id; if string, use as is
                const cat = typeof selected.categories === 'object' && selected.categories !== null
                    ? selected.categories
                    : selected.categories ?? null;
                ExerciseSelectionModalComponent.lastSelectedCategory = (cat && cat[0]) ?? null;
            }
        }
    }

    /**
     * Checks if an exercise is currently selected. Used to bind the checkbox state.
     */
    isSelected(exercise: Exercise | HydratedExercise): boolean {
        return this.selectedExerciseIds().includes(exercise.id);
    }

    /**
     * Gathers all selected exercises, emits them, and closes the modal.
     * Triggered by the new "Add Selected" button.
     */
    confirmSelection(): void {
        const selectedIds = this.selectedExerciseIds();
        if (selectedIds.length === 0) {
            this.toastService.info(this.translate.instant('exerciseSelectionModal.toasts.noSelection'));
            return;
        }
        const selectedExercises = selectedIds
            .map(id => this.exercises().find(ex => ex.id === id))
            .filter((ex): ex is Exercise => !!ex);

        this.exercisesSelected.emit(selectedExercises);
        this.onClose();
    }


    /**
     * Overrides the default close action to also clear the selection state.
     */
    onClose(): void {
        this.isOpen.set(false);
        this.selectedExerciseIds.set([]); // Reset selection on close
        this.close.emit();
    }

    onFindSimilar(): void { this.findSimilarClicked.emit(); this.isFilterAccordionOpen.set(false); }
    onCreateCustom(): void { this.createCustomClicked.emit(); }
    onBackToSearch(): void { this.backToSearchClicked.emit(); }

    onSearchEnter(): void {
        const filteredList = this.processedExercises().filter(item => this.isExercise(item));
        if (filteredList.length === 1) {
            this.onExerciseClicked(filteredList[0]);
        }
    }

    ngAfterViewInit(): void {
        if (this.isOpen() && this.isFocusInputOnStart()) {
            this.checkForInputFocus();
        }
    }

    private checkForInputFocus(): void {
        setTimeout(() => {
            this.myExerciseInput?.nativeElement.focus();
            this.myExerciseInput?.nativeElement.select();
        }, 100);
    }

    // +++ NEW: Handlers for new UI controls +++
    toggleFilterAccordion(): void {
        this.isFilterAccordionOpen.update(v => !v);
    }

    onCategoryChangeModel(value: EXERCISE_CATEGORY_TYPES | null) {
        this.selectedCategory.set(value || "");
        this.selectedCategoryValue = value || "";
        if (this.scrollContainer?.nativeElement) {
            this.scrollContainer.nativeElement.scrollTop = 0;
        }
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

    private muscleToMuscleValue(muscle: Muscle): MuscleValue {
        return muscle.id as MuscleValue;
    }

    onSortModeChange(event: Event): void {
        const mode = (event.target as HTMLSelectElement).value as 'alpha' | 'lastUsed' | 'frequency';
        this.sortMode.set(mode);
    }

    /**
     * Overrides the clear filters action to also clear selections.
     */
    clearFilters(showToast: boolean = true): void {
        this.selectedCategory.set("");
        this.selectedMuscleGroup.set(null);
        this.searchTerm.set('');
        this.sortMode.set('alpha');
        ExerciseSelectionModalComponent.lastSelectedCategory = null;
        if (showToast) {
            this.toastService.info(this.translate.instant('exerciseSelectionModal.toasts.filtersCleared'));
        }
        // Scroll to top after clearing filters
        setTimeout(() => {
            this.scrollContainer?.nativeElement?.scrollTo({ top: 0, behavior: 'smooth' });
        }, 0);
    }

    getMuscleNameById(id: string): string {
        return this.translatedMuscles().find(m => m.id === id)?.name || id;
    }

    getMuscleById(id: string): Muscle | null {
        return this.translatedMuscles().find(m => m.id === id) || null;
    }

    getSelectionIndex(item: Exercise | HydratedExercise): number | null {
        if (!this.isMultiSelect()) return null;
        const selectedIds = this.selectedExerciseIds();
        const idx = selectedIds.findIndex(id => id === item.id);
        return idx !== -1 ? idx + 1 : null;
    }

    trackByExerciseOrHeader(index: number, item: ListItem): string {
        // If it's a header, use its label; if it's an exercise, use its id
        return (item as any).isHeader ? 'header-' + (item as any).label : 'exercise-' + (item as HydratedExercise).id;
    }

    isMobileScreen(): boolean {
        return window.innerWidth < 640; // or use your preferred breakpoint
    }

    getCategoryLabel(categories: HydratedExerciseCategory[] | null, id: EXERCISE_CATEGORY_TYPES | null): string | null {
        if (!categories || !id) return id ? String(id) : null;
        const found = categories.find(c => c.id.toString() === id.toString());
        if (!found) return id ? String(id) : null;
        // If the label is a translation key, translate it
        if (found.name && typeof found.name === 'string') {
            return found.name;
        }
        return (typeof found.name === 'string' ? found.name : null) || (id ? String(id) : null);
    }

    getLastCategory(): EXERCISE_CATEGORY_TYPES | null {
        return ExerciseSelectionModalComponent.lastSelectedCategory;
    }

    get filteredExerciseCount(): number {
        return this.processedExercises().filter(item => this.isExercise(item)).length;
    }

    get totalExerciseCount(): number {
        return this.hydratedExercises()?.length || 0;
    }
}