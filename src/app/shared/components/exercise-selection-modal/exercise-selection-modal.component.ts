// src/app/shared/components/exercise-selection-modal/exercise-selection-modal.component.ts
import { Component, Input, Output, EventEmitter, signal, computed, WritableSignal, ViewChild, ElementRef, AfterViewInit, OnInit, SimpleChanges, OnChanges } from '@angular/core';
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
export class ExerciseSelectionModalComponent implements OnChanges {

      @ViewChild('exerciseSearchFied') myExerciseInput!: ElementRef;

    // --- Inputs: How the parent configures this component ---
    @Input() isOpen: boolean = false;
    @Input() title: string = 'Select Exercise';
    @Input() exercises: Exercise[] = [];
    @Input() searchPlaceholder: string = 'Search exercises...';
    @Input() itemIconName: string = 'add';
    @Input() itemIconClass: string = 'text-primary dark:text-primary-light';

    // --- Feature Flags for UI variations ---
    @Input() showSimilarButton: boolean = false;
    @Input() showCreateCustomLink: boolean = false;
    @Input() isShowingSimilarView: boolean = false; // To control the 'Similar' view state from the parent

    // --- Outputs: How this component communicates with the parent ---
    @Output() close = new EventEmitter<void>();
    @Output() exerciseSelected = new EventEmitter<Exercise>();
    @Output() findSimilarClicked = new EventEmitter<void>();
    @Output() createCustomClicked = new EventEmitter<void>();
    @Output() backToSearchClicked = new EventEmitter<void>();

    // Two-way binding for the search term
    internalSearchTerm = signal<string>('');
    @Input()
    set searchTerm(value: string) {
        this.internalSearchTerm.set(value);
    }
    @Output() searchTermChange = new EventEmitter<string>();

    // --- Internal Filtering Logic ---
    // In a real-world scenario, you might inject this service, but for simplicity, we use a static method.
    private exerciseService = new ExerciseService();

    filteredExercises = computed(() => {
        const term = this.internalSearchTerm().toLowerCase(); // Read from the signal
        if (!term) {
            return this.exercises;
        }
        const normalizedTerm = this.exerciseService.normalizeExerciseNameForSearch(term);
        return this.exercises.filter(ex =>
            ex.name.toLowerCase().includes(normalizedTerm) ||
            ex.category?.toLowerCase().includes(term) ||
            ex.primaryMuscleGroup?.toLowerCase().includes(term)
        );
    });

    // --- Event Handlers ---
    onExerciseClicked(exercise: Exercise): void {
        this.exerciseSelected.emit(exercise);
    }

    onClose(): void {
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

    onSearchTermChange(newValue: string): void {
        // Update both the internal signal (for filtering) and emit to the parent.
        this.internalSearchTerm.set(newValue);
        this.searchTermChange.emit(newValue);
    }


    onSearchEnter(): void {
        const filteredList = this.filteredExercises();
        // Check if there is exactly one exercise in the filtered list
        if (filteredList.length === 1) {
            // If so, select that exercise
            const singleExercise = filteredList[0];
            this.onExerciseClicked(singleExercise);
        }
    }

    focusOnSearchInput(searchInput: HTMLInputElement | null): void {
        if (searchInput) {
            setTimeout(() => {
                searchInput.focus();
                searchInput.select();
            }, 0);
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
    // We only care about changes to the 'isOpen' property.
    if (changes['isOpen']) {
      // If the modal is being opened (changed to true)...
      if (this.isOpen) {
        // ...then we schedule the focus action to happen after the view is stable.
        // A timeout with 0 delay is a classic and robust way to do this.
        setTimeout(() => {
          this.myExerciseInput?.nativeElement.focus();
          this.myExerciseInput?.nativeElement.select(); // Bonus: select existing text
        }, 0);
      }
    }
  }

}