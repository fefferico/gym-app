// src/app/features/workout-tracker/session-overview-modal/app-exercise-overview-item/app-exercise-overview-item.component.ts

import { Component, computed, Input, Signal } from "@angular/core";
import { IconComponent } from "../../../../shared/components/icon/icon.component";
import { CommonModule } from "@angular/common";
import { ExerciseTargetSetParams, WorkoutExercise } from "../../../../core/models/workout.model";
import { LoggedSet, LoggedWorkoutExercise } from "../../../../core/models/workout-log.model";
import { WeightUnitPipe } from "../../../../shared/pipes/weight-unit-pipe";

@Component({
    selector: 'app-exercise-overview-item',
    standalone: true,
    imports: [CommonModule],
    providers: [WeightUnitPipe],
    templateUrl: 'app-exercise-overview-item.component.html'
})
export class ExerciseOverviewItemComponent {
  @Input() exercise!: WorkoutExercise;
    @Input() loggedExercises!: LoggedWorkoutExercise[];
    @Input() activeExerciseId: string | undefined;
    @Input() activeSetIndex: number | undefined;
    @Input() activeBlockRound: number | undefined;

    isCurrent = computed<boolean>(() => {
        return this.exercise.id === this.activeExerciseId;
    });

    // CORRECTED: This logic now strictly separates superset rounds from standard set lists.
    roundInfo = computed(() => {
        // Only supersets have a concept of multiple visual rounds in the overview.
        const totalRounds = this.exercise.supersetId 
            ? (this.exercise.supersetRounds || 1) 
            : 1; // Standard exercises are ALWAYS treated as 1 round in the overview.
            
        const roundIndices = Array.from({ length: totalRounds }, (_, i) => i);
        return { totalRounds, roundIndices };
    });
    
    // CORRECTED: This calculation now respects the new roundInfo logic.
    totalPlannedSets = computed<number>(() => {
        // For a standard exercise, totalRounds will be 1, so this correctly returns sets.length.
        // For a superset, it multiplies the sets in one round by the number of supersetRounds.
        return this.exercise.sets.length * this.roundInfo().totalRounds;
    });

    status = computed(() => {
        const loggedCount = this.getNumberOfLoggedSets(this.exercise.id);
        const totalPlanned = this.totalPlannedSets();
        
        if (this.exercise.sessionStatus === 'skipped') return { text: 'Skipped', class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
        if (this.exercise.sessionStatus === 'do_later') return { text: 'Do Later', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
        if (totalPlanned > 0 && loggedCount >= totalPlanned) return { text: 'Completed', class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
        if (loggedCount > 0) return { text: 'In Progress', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
        return { text: 'Pending', class: 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300' };
    });

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
    
    getLoggedSetsForDisplay(exerciseId: string): LoggedSet[] {
        return this.loggedExercises.find(le => le.id === exerciseId)?.sets ?? [];
    }

    getSetStatusIndicatorClass(plannedSetId: string, roundIndex: number, setIndex: number): { class: string, title: string } {
        const isSetLogged = !!this.getLoggedSetFor(plannedSetId, roundIndex);
    
        // Rule 1: If the set is logged, it's always green.
        if (isSetLogged) {
            return { class: 'bg-green-500', title: 'Completed' };
        }
    
        // Rule 2: Check if this is the *exact* current set.
        const isTheCurrentSet = this.isCurrent() &&
                                this.activeSetIndex === setIndex &&
                                (this.activeBlockRound ? this.activeBlockRound - 1 : 0) === roundIndex;
    
        if (isTheCurrentSet) {
            return { class: 'bg-blue-400 animate-pulse', title: 'Current' };
        }
    
        // Rule 3: If not completed or current, check the overall exercise status.
        switch (this.exercise.sessionStatus) {
            case 'skipped':
                return { class: 'bg-yellow-500', title: 'Skipped' };
            case 'do_later':
                return { class: 'bg-orange-500', title: 'Do Later' };
            default: // Includes 'pending' and 'started'
                return { class: 'bg-gray-300 dark:bg-gray-600', title: 'Pending' };
        }
    }

    formatSet(set: ExerciseTargetSetParams | LoggedSet | undefined, isPerformed = false): string {
        if (!set) return isPerformed ? '—' : 'N/A';
    
        let weight: number | null | undefined;
        let reps: number | undefined;
    
        if ('repsAchieved' in set) {
          weight = set.weightUsed;
          reps = set.repsAchieved;
        } else {
          weight = set.targetWeight;
          reps = set.targetReps || 0;
        }
        
        let parts = [];
        if (weight != null && reps != null) {
            parts.push(`${this.weightUnitPipe.transform(weight)} x ${reps} reps`);
        } else if (reps != null) {
            parts.push(`${reps} reps`);
        }
        
        return parts.length > 0 ? parts.join(', ') : (isPerformed ? '—' : 'N/A');
    }

    constructor(private weightUnitPipe: WeightUnitPipe) {}
}