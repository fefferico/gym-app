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

// NEW: Central computed signal for round information (correctly handles `rounds` for standard exercises)
    roundInfo = computed(() => {
        // If it's a superset exercise, get rounds from supersetRounds (which is consistent across the group)
        // Otherwise, get rounds from its own `rounds` property (for standard exercises).
        const totalRounds = this.exercise.supersetId ? (this.exercise.supersetRounds || 1) : (this.exercise.rounds || 1);
        const roundIndices = Array.from({ length: totalRounds }, (_, i) => i); // Creates [0, 1, 2...]
        return { totalRounds, roundIndices };
    });
    
// MODIFIED: totalPlannedSets now represents the "total completion units"
    // For standard exercises: sets.length * rounds
    // For supersets: sets.length * supersetRounds (which is handled by `roundInfo`)
    totalPlannedSets = computed<number>(() => {
        return this.exercise.sets.length * this.roundInfo().totalRounds;
    });

    // MODIFIED: status computation is now more robust
    status = computed(() => {
        const loggedCount = this.getLoggedSetsForDisplay(this.exercise.id).length; // Use the dedicated getter
        const totalPlanned = this.totalPlannedSets();

        if (this.exercise.sessionStatus === 'skipped') return { text: 'Skipped', class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
        if (this.exercise.sessionStatus === 'do_later') return { text: 'Do Later', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
        if (totalPlanned > 0 && loggedCount >= totalPlanned) return { text: 'Completed', class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
        if (loggedCount > 0) return { text: 'In Progress', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
        return { text: 'Pending', class: 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300' };
    });

    // MODIFIED: Find logged set using the composite ID for multi-round exercises
    getLoggedSetFor(plannedSetId: string, roundIndex: number): LoggedSet | undefined {
        const exerciseLog = this.loggedExercises.find(le => le.id === this.exercise.id);
        if (!exerciseLog) return undefined;

        // Determine if this exercise uses round-specific logging for its sets
        const usesRoundSpecificLogging = this.roundInfo().totalRounds > 1; // Any exercise with more than 1 round

        // Construct the target ID to find the specific logged set for this planned set and round
        const targetLoggedSetId = usesRoundSpecificLogging
            ? `${plannedSetId}-round-${roundIndex}`
            : plannedSetId; // If only one round, just use the plannedSetId

        return exerciseLog.sets.find(ls => ls.plannedSetId === targetLoggedSetId);
    }

    // NEW: Helper to get all logged sets relevant to THIS exercise instance for display count
    getLoggedSetsForDisplay(exerciseId: string): LoggedSet[] {
        return this.loggedExercises.find(le => le.id === exerciseId)?.sets ?? [];
    }
    
    getNumberOfLoggedSets(exerciseId: string): number {
        return this.loggedExercises.find(le => le.id === exerciseId)?.sets.length ?? 0;
    }

    formatSet(set: ExerciseSetParams | LoggedSet | undefined, isPerformed = false): string {
        if (!set) return isPerformed ? '—' : 'N/A';
    
        let weight: number | null | undefined;
        let reps: number | undefined;
        let duration: number | undefined;
        let distance: number | undefined;
    
        if ('repsAchieved' in set) { // It's a LoggedSet (performed)
          weight = set.weightUsed;
          reps = set.repsAchieved;
          duration = set.durationPerformed;
          distance = set.distanceAchieved;
        } else { // It's an ExerciseSetParams (planned)
          weight = set.weight;
          reps = set.reps;
          duration = set.duration;
          distance = set.distance;
        }
        
        let parts = [];
        if (weight != null && weight > 0) { // Only show weight if > 0
            parts.push(`${this.weightUnitPipe.transform(weight)}`);
        }
        if (reps != null && reps > 0) { // Only show reps if > 0
            parts.push(`${reps} reps`);
        }
        if (duration != null && duration > 0) { // Only show duration if > 0
            parts.push(`${duration}s`);
        }
        if (distance != null && distance > 0) { // Only show distance if > 0
            parts.push(`${distance}km`);
        }
        
        return parts.length > 0 ? parts.join(' / ') : (isPerformed ? '—' : 'N/A');
    }

    constructor(private weightUnitPipe: WeightUnitPipe) {}
}