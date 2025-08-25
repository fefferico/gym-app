// src/app/shared/components/exercise-selection-modal/exercise-selection-modal.component.ts
import { Component, computed, inject, input, model, Output, ViewChild, ElementRef, AfterViewInit, EventEmitter } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Exercise } from '../../../core/models/exercise.model';
import { ExerciseService } from '../../../core/services/exercise.service';
import { IconComponent } from '../icon/icon.component';
import { PressDirective } from '../../directives/press.directive';
import { PressScrollDirective } from '../../directives/press-scroll.directive';
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
    selector: 'app-exercise-selection-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, TitleCasePipe, DatePipe, IconComponent, PressDirective, PressScrollDirective, ScrollingModule],
    templateUrl: './exercise-selection-modal.component.html',
})
export class ExerciseSelectionModalComponent implements AfterViewInit {

    @ViewChild('exerciseSearchFied') myExerciseInput!: ElementRef;

    // --- Injected Services ---
    private exerciseService = inject(ExerciseService);

    // --- Inputs: Replaced with modern signal-based inputs ---
    isOpen = model<boolean>(false);
    title = input<string>('Select Exercise');
    exercises = input.required<Exercise[]>();
    searchPlaceholder = input<string>('Search exercises...');
    itemIconName = input<string>('plus-circle');
    itemIconClass = input<string>('text-primary dark:text-primary-light');
    
    // --- Feature Flags for UI variations ---
    showSimilarButton = input<boolean>(false);
    showCreateCustomLink = input<boolean>(false);
    isShowingSimilarView = input<boolean>(false);
    
    // --- Outputs: No change needed here ---
    @Output() close = new EventEmitter<void>();
    @Output() exerciseSelected = new EventEmitter<Exercise>();
    @Output() findSimilarClicked = new EventEmitter<void>();
    @Output() createCustomClicked = new EventEmitter<void>();
    @Output() backToSearchClicked = new EventEmitter<void>();

    // --- Two-way binding for the search term using model() ---
    searchTerm = model<string>('');

    // --- Internal Filtering Logic ---
    filteredExercises = computed(() => {
        const term = this.searchTerm()?.toLowerCase() ?? ''; // Read from the model signal
        const exerciseList = this.exercises(); // Read from the input signal

        if (!term) {
            return exerciseList;
        }
        const normalizedTerm = this.exerciseService.normalizeExerciseNameForSearch(term);
        return exerciseList.filter(ex =>
            ex.name.toLowerCase().includes(normalizedTerm) ||
            ex.category?.toLowerCase().includes(term) ||
            ex.primaryMuscleGroup?.toLowerCase().includes(term)
        );
    });

    // --- Event Handlers ---
    onExerciseClicked(exercise: Exercise): void {
        this.exerciseSelected.emit(exercise);
        this.onClose();
    }

    onClose(): void {
        this.isOpen.set(false); // Update the model signal
        this.close.emit();
    }

    onFindSimilar(): void {
        this.findSimilarClicked.emit();
    }

    onCreateCustom(): void {
        this.createCustomClicked.emit();
    }

    onBackToSearch(): void {
        this.backToSearchClicked.emit();
    }

    // This method is no longer needed as ngModel handles the update
    // onSearchTermChange(newValue: string): void { ... }

    onSearchEnter(): void {
        const filteredList = this.filteredExercises();
        if (filteredList.length === 1) {
            this.onExerciseClicked(filteredList[0]);
        }
    }
    
    ngAfterViewInit(): void {
        // ngOnChanges is not reliable for focusing. AfterViewInit is better.
        // We still need a small timeout to ensure the element is truly visible.
        if (this.isOpen()) {
            setTimeout(() => {
                this.myExerciseInput?.nativeElement.focus();
                this.myExerciseInput?.nativeElement.select();
            }, 50);
        }
    }
}