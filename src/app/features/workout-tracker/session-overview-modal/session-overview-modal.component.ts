import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routine, WorkoutExercise, ExerciseSetParams } from '../../../core/models/workout.model';
import { LoggedWorkoutExercise, LoggedSet } from '../../../core/models/workout-log.model';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ExerciseOverviewItemComponent } from './app-exercise-overview-item/app-exercise-overview-item.component';

// Define interfaces for the structured data this component will use
interface StandardExerciseGroup {
  type: 'standard';
  exercise: WorkoutExercise;
}

interface SupersetGroup {
  type: 'superset';
  exercises: WorkoutExercise[];
  supersetId: string;
}

type DisplayGroup = StandardExerciseGroup | SupersetGroup;

@Component({
  selector: 'app-session-overview-modal',
  standalone: true,
  imports: [CommonModule, IconComponent, WeightUnitPipe, ExerciseOverviewItemComponent],
  template: `
    <div *ngIf="isOpen" class="fixed inset-0 bg-gray-900/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100]" (click)="close.emit()">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl h-[90vh] flex flex-col overflow-hidden" (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <header class="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <div class="flex items-center gap-3">
            <app-icon name="clipboard-list" class="h-7 w-7 text-primary dark:text-primary-light"></app-icon>
            <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100">Session Overview</h3>
          </div>
          <button (click)="close.emit()" class="p-1.5 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/70 focus:outline-none transition-colors">
            <app-icon name="cancel" class="h-6 w-6"></app-icon>
          </button>
        </header>

        <!-- Main Content (Scrollable) -->
        <div class="p-4 sm:p-6 overflow-y-auto space-y-6 flex-grow">
          <ng-container *ngFor="let group of groupedExercises(); trackBy: trackByGroup">
            
            <!-- Superset Group Card -->
            <div *ngIf="group.type === 'superset'" class="bg-gray-50 dark:bg-gray-900/50 border border-primary/50 rounded-lg">
              <h4 class="text-lg font-bold text-primary dark:text-primary-light p-3 border-b border-primary/20">Superset</h4>
              <div class="space-y-4 p-3">
                <ng-container *ngFor="let exercise of group.exercises; let i = index">
                  <div [ngClass]="{'pt-4 border-t border-gray-200 dark:border-gray-700': i > 0}">
                    <app-exercise-overview-item 
                      [exercise]="exercise" 
                      [loggedExercises]="loggedExercises">
                    </app-exercise-overview-item>
                  </div>
                </ng-container>
              </div>
            </div>

            <!-- Standard Exercise Card -->
            <div *ngIf="group.type === 'standard'" class="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-3">
              <app-exercise-overview-item 
                [exercise]="group.exercise" 
                [loggedExercises]="loggedExercises">
              </app-exercise-overview-item>
            </div>

          </ng-container>
        </div>

        <!-- Footer -->
        <footer class="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-right flex-shrink-0">
          <button (click)="close.emit()" class="inline-flex items-center bg-primary hover:bg-primary-dark focus:ring-4 focus:ring-primary-focus text-white font-semibold py-2.5 px-6 rounded-md text-sm transition-colors shadow-md hover:shadow-lg">
            <app-icon name="done" class="h-7 w-7 mr-1"></app-icon>
            DONE
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class SessionOverviewModalComponent {
  @Input() isOpen: boolean = false;
  @Input() routine: Routine | undefined | null = undefined;
  @Input() loggedExercises: LoggedWorkoutExercise[] = [];
  @Output() close = new EventEmitter<void>();

  /**
   * Transforms the flat exercise list into a structured list of standard exercises and superset groups.
   * This makes rendering in the template much cleaner.
   */
  groupedExercises = computed<DisplayGroup[]>(() => {
    if (!this.routine) return [];
    
    const displayGroups: DisplayGroup[] = [];
    const processedSupersetIds = new Set<string>();

    this.routine.exercises.forEach(exercise => {
      if (exercise.supersetId) {
        if (!processedSupersetIds.has(exercise.supersetId)) {
          const groupExercises = this.routine!.exercises
            .filter(ex => ex.supersetId === exercise.supersetId)
            .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0));
          
          displayGroups.push({ type: 'superset', exercises: groupExercises, supersetId: exercise.supersetId });
          processedSupersetIds.add(exercise.supersetId);
        }
      } else {
        displayGroups.push({ type: 'standard', exercise });
      }
    });

    return displayGroups;
  });

  trackByGroup(index: number, group: DisplayGroup): string {
    return group.type === 'standard' ? group.exercise.id : group.supersetId;
  }
}

