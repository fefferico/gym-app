import { Component, computed, Input } from "@angular/core";
import { IconComponent } from "../../../../shared/components/icon/icon.component";
import { CommonModule } from "@angular/common";
import { ExerciseSetParams, WorkoutExercise } from "../../../../core/models/workout.model";
import { LoggedSet, LoggedWorkoutExercise } from "../../../../core/models/workout-log.model";
import { WeightUnitPipe } from "../../../../shared/pipes/weight-unit-pipe";

/**
 * A reusable sub-component to display the details of a single exercise.
 * This keeps the main modal template clean.
 */
@Component({
    selector: 'app-exercise-overview-item',
    standalone: true,
    imports: [CommonModule, IconComponent, WeightUnitPipe],
    providers: [WeightUnitPipe],
    templateUrl: 'app-exercise-overview-item.component.html'
})
export class ExerciseOverviewItemComponent {
    @Input() exercise!: WorkoutExercise;
    @Input() loggedExercises!: LoggedWorkoutExercise[];

     // NEW: Central computed signal for round information
    roundInfo = computed(() => {
        const totalRounds = this.exercise.supersetRounds || this.exercise.rounds || 1;
        const roundIndices = Array.from({ length: totalRounds }, (_, i) => i); // Creates [0, 1, 2...]
        return { totalRounds, roundIndices };
    });
    
    // Total planned sets for THIS exercise, considering rounds
    totalPlannedSets = computed<number>(() => {
        return this.exercise.sets.length * this.roundInfo().totalRounds;
    });

    status = computed(() => {
        const loggedSetCount = this.getNumberOfLoggedSets(this.exercise.id);
        const totalPlanned = this.totalPlannedSets();
        
        if (this.exercise.sessionStatus === 'skipped') return { text: 'Skipped', class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
        if (this.exercise.sessionStatus === 'do_later') return { text: 'Do Later', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
        if (totalPlanned > 0 && loggedSetCount >= totalPlanned) return { text: 'Completed', class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
        if (loggedSetCount > 0) return { text: 'In Progress', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
        return { text: 'Pending', class: 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300' };
    });

    // UPDATED: Find logged set using the composite ID for multi-round exercises
    getLoggedSetFor(plannedSetId: string, roundIndex: number): LoggedSet | undefined {
        const exerciseLog = this.loggedExercises.find(le => le.id === this.exercise.id);
        if (!exerciseLog) return undefined;

        const isMultiRound = this.roundInfo().totalRounds > 1;
        const targetId = isMultiRound ? `${plannedSetId}-round-${roundIndex}` : plannedSetId;

        return exerciseLog.sets.find(ls => ls.plannedSetId === targetId);
    }
    
    getNumberOfLoggedSets(exerciseId: string): number {
        return this.loggedExercises.find(le => le.id === exerciseId)?.sets.length ?? 0;
    }

    formatSet(set: ExerciseSetParams | LoggedSet | undefined, isPerformed = false): string {
        if (!set) return isPerformed ? '—' : 'N/A';
    
        let weight: number | null | undefined;
        let reps: number | undefined;
    
        // Type guard: 'repsAchieved' exists on LoggedSet but not on ExerciseSetParams
        if ('repsAchieved' in set) {
          // It's a LoggedSet (performed)
          weight = set.weightUsed;
          reps = set.repsAchieved;
        } else {
          // It's an ExerciseSetParams (planned)
          weight = set.weight;
          reps = set.reps;
        }
        
        let parts = [];
        if (weight != null && reps != null) {
            parts.push(`${this.weightUnitPipe.transform(weight)} x ${reps} reps`);
        } else if (reps != null) {
            parts.push(`${reps} reps`);
        }
        // Add more conditions for duration/distance if needed for your UI
        
        return parts.length > 0 ? parts.join(', ') : (isPerformed ? '—' : 'N/A');
    }

    constructor(private weightUnitPipe: WeightUnitPipe) {}
}