// src/app/shared/components/exercise-selection-modal/exercise-selection-modal.component.ts
import { Component, computed, inject, input, model, Output, ViewChild, ElementRef, AfterViewInit, EventEmitter, OnChanges, SimpleChanges, signal, effect } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Exercise } from '../../../core/models/exercise.model';
import { ExerciseService } from '../../../core/services/exercise.service';
import { IconComponent } from '../icon/icon.component';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { ToastService } from '../../../core/services/toast.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { toSignal } from '@angular/core/rxjs-interop';

// +++ NEW: Type definition for the list, which can now contain headers +++
type ListItem = Exercise | { isHeader: true; label: string };

@Component({
    selector: 'app-exercise-selection-modal',
    standalone: true,
    // +++ Added AsyncPipe for the new filter dropdowns +++
    imports: [CommonModule, FormsModule, TitleCasePipe, DatePipe, IconComponent, AsyncPipe],
    templateUrl: './exercise-selection-modal.component.html',
})
export class ExerciseSelectionModalComponent implements AfterViewInit, OnChanges {
    private exerciseService = inject(ExerciseService);
    private trackingService = inject(TrackingService);
    private toastService = inject(ToastService);

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['isOpen'] && changes['isOpen'].currentValue) {
            this.checkForInputFocus();
            // When the modal opens, reset filters to default
            this.clearFilters(false);
        }
    }

    private enrichedExercises = signal<Exercise[]>([]); // This will hold the exercises with usage counts

    private usageCounts = toSignal(this.trackingService.getExerciseUsageCounts(), {
        initialValue: new Map<string, number>()
    });

    private dataSub: Subscription | undefined;

    @ViewChild('exerciseSearchFied') myExerciseInput!: ElementRef;
    @ViewChild('scrollContainer') private scrollContainer!: ElementRef<HTMLDivElement>;


    constructor() {
        // This effect runs whenever the `exercises` input OR the `usageCounts` change.
        effect(() => {
            const exercisesFromInput = this.exercises(); // Dependency 1: The input signal
            const usageMap = this.usageCounts();         // Dependency 2: The usage count signal

            // Enrich the list that was PASSED IN with the latest usage counts.
            const exercisesWithData = exercisesFromInput.map(ex => ({
                ...ex,
                usageCount: usageMap.get(ex.id) || 0
            }));
            
            this.enrichedExercises.set(exercisesWithData);
        });

        // Effect for scrolling remains the same
        effect(() => {
            this.sortMode();
            if (this.scrollContainer?.nativeElement) {
                this.scrollContainer.nativeElement.scrollTop = 0;
            }
            if (this.sortMode() === 'lastUsed'){
                this.isFilterAccordionOpen.set(false);
            }
        });
    }

    // --- Inputs: (Unchanged) ---
    isOpen = model<boolean>(false);
    title = input<string>('Select Exercise');
    exercises = input.required<Exercise[]>();
    searchPlaceholder = input<string>('Search exercises...');
    itemIconName = input<string>('plus-circle');
    itemIconClass = input<string>('text-primary dark:text-primary-light');

    // --- Feature Flags: (Unchanged) ---
    showSimilarButton = input<boolean>(false);
    showCreateCustomLink = input<boolean>(false);
    isShowingSimilarView = input<boolean>(false);

    // --- Outputs: (Unchanged) ---
    @Output() close = new EventEmitter<void>();
    @Output() exerciseSelected = new EventEmitter<Exercise>();
    @Output() findSimilarClicked = new EventEmitter<void>();
    @Output() createCustomClicked = new EventEmitter<void>();
    @Output() backToSearchClicked = new EventEmitter<void>();

    // --- Search Term Model: (Unchanged) ---
    searchTerm = model<string>('');

    // +++ NEW: State management signals for filters and sorting +++
    isFilterAccordionOpen = signal(false);
    selectedCategory = signal<string | null>(null);
    selectedMuscleGroup = signal<string | null>(null);
    sortMode = signal<'alpha' | 'lastUsed' | 'frequency'>('alpha');

    // +++ NEW: Observables to populate filter dropdowns +++
    categories$: Observable<string[]> = this.exerciseService.getUniqueCategories();
    primaryMuscleGroups$: Observable<string[]> = this.exerciseService.getUniquePrimaryMuscleGroups();

    // --- CORE LOGIC: Replaced with a powerful computed signal for processing ---
    processedExercises = computed<ListItem[]>(() => {
        const term = this.searchTerm()?.toLowerCase() ?? '';
        let exerciseList = this.enrichedExercises();
        const mode = this.sortMode();
        const category = this.selectedCategory();
        const muscleGroup = this.selectedMuscleGroup();

        // 1. --- FILTERING (Unchanged) ---
        if (category) {
            exerciseList = exerciseList.filter(ex => ex.category === category);
        }
        if (muscleGroup) {
            exerciseList = exerciseList.filter(ex => ex.primaryMuscleGroup === muscleGroup);
        }
        if (term) {
            const normalizedTerm = this.exerciseService.normalizeExerciseNameForSearch(term);
            exerciseList = exerciseList.filter(ex => {
                return normalizedTerm.split(' ').every(part =>
                    ex.name.toLowerCase().includes(part) ||
                    (ex.category?.toLowerCase().includes(part)) ||
                    (ex.primaryMuscleGroup?.toLowerCase().includes(part))
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
    private groupExercisesAlphabetically(exercises: Exercise[]): ListItem[] {
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
    private groupExercisesByFrequency(exercises: Exercise[]): ListItem[] {
        if (exercises.length === 0) return [];

        const itemsWithHeaders: ListItem[] = [];
        let currentGroupLabel = '';

        const getGroupLabel = (count: number): string => {
            if (count >= 30) return '30+ Times';
            if (count >= 10) return '< 30 Times';
            if (count >= 5) return '< 10 Times';
            return '< 5 Times';
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
    isExercise(item: ListItem): item is Exercise {
        return !(item as { isHeader: true }).isHeader;
    }

    // --- Event Handlers ---
    onExerciseClicked(exercise: Exercise): void {
        this.exerciseSelected.emit(exercise);
        this.onClose();
    }

    onClose(): void {
        this.isOpen.set(false);
        this.close.emit();
    }

    onFindSimilar(): void { this.findSimilarClicked.emit(); this.isFilterAccordionOpen.set(false);}
    onCreateCustom(): void { this.createCustomClicked.emit(); }
    onBackToSearch(): void { this.backToSearchClicked.emit(); }

    onSearchEnter(): void {
        const filteredList = this.processedExercises().filter(item => this.isExercise(item));
        if (filteredList.length === 1) {
            this.onExerciseClicked(filteredList[0] as Exercise);
        }
    }

    ngAfterViewInit(): void {
        if (this.isOpen()) {
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

    onCategoryChange(event: Event): void {
        this.selectedCategory.set((event.target as HTMLSelectElement).value || null);
    }

    onMuscleGroupChange(event: Event): void {
        this.selectedMuscleGroup.set((event.target as HTMLSelectElement).value || null);
    }

    onSortModeChange(event: Event): void {
        const mode = (event.target as HTMLSelectElement).value as 'alpha' | 'lastUsed' | 'frequency';
        this.sortMode.set(mode);
    }

    clearFilters(showToast: boolean = true): void {
        this.selectedCategory.set(null);
        this.selectedMuscleGroup.set(null);
        this.searchTerm.set('');
        this.sortMode.set('alpha');
        if (showToast) {
            this.toastService.info('Filters cleared');
        }
    }
}