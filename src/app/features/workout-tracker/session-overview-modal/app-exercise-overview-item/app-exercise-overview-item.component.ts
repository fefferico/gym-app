import { Component, Input } from "@angular/core";
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

    get status(): { text: string, class: string } {
        const loggedSetCount = this.getNumberOfLoggedSets(this.exercise.id);
        const totalSets = this.exercise.sets.length;

        if (this.exercise.sessionStatus === 'skipped') return { text: 'Skipped', class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
        if (this.exercise.sessionStatus === 'do_later') return { text: 'Do Later', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
        if (loggedSetCount >= totalSets) return { text: 'Completed', class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
        if (loggedSetCount > 0) return { text: 'In Progress', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
        return { text: 'Pending', class: 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300' };
    }

    getLoggedSetFor(plannedSetId: string): LoggedSet | undefined {
        const exerciseLog = this.loggedExercises.find(le => le.id === this.exercise.id);
        return exerciseLog?.sets.find(ls => ls.plannedSetId === plannedSetId);
    }

    getNumberOfLoggedSets(exerciseId: string): number {
        return this.loggedExercises.find(le => le.id === exerciseId)?.sets.length ?? 0;
    }

    formatSet(set: ExerciseSetParams | LoggedSet | undefined, isPerformed = false): string {
        if (!set) return isPerformed ? '—' : 'N/A';
        const weight = 'weightUsed' in set ? set.weightUsed : set.targetWeight;
        const reps = 'repsAchieved' in set ? set.repsAchieved : set.targetReps;

        let parts = [];
        if (weight != null && reps != null) {
            parts.push(`${weight}${this.weightUnitPipe.transform(0)} x ${reps} reps`);
        } else if (reps != null) {
            parts.push(`${reps} reps`);
        }
        // Add more conditions for duration/distance if needed
        return parts.length > 0 ? parts.join(', ') : (isPerformed ? '—' : 'N/A');
    }

    // This is needed to inject the pipe since it's a standalone component
    constructor(private weightUnitPipe: WeightUnitPipe) { }
}