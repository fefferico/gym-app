import { Component, Input, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoggedSet, WorkoutLog } from '../../../../core/models/workout-log.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { TrackingService } from '../../../../core/services/tracking.service';
import { UnitsService } from '../../../../core/services/units.service';
import { WeightUnitPipe } from '../../../../shared/pipes/weight-unit-pipe';

// This can be in the same file or a separate model file
interface DisplayLoggedExercise {
    exerciseId: string;
    exerciseName: string;
    sets: LoggedSet[];
}

interface PerformanceSummary {
    setsCount: number;
    totalReps: number;
    totalVolume: number;
    avgWeightPerRep: number;
}

interface PerformanceComparison {
    setsDiff: number;
    repsDiff: number;
    volumeDiff: number;
    avgWeightDiff: number;
    setsPercentChange: number;
    repsPercentChange: number;
    volumePercentChange: number;
    avgWeightPercentChange: number;
}

interface ComparisonData {
    currentLog: WorkoutLog;
    previousLog: WorkoutLog | null;
    currentSets: LoggedSet[];
    previousSets: LoggedSet[];
    currentSummary: PerformanceSummary;
    previousSummary: PerformanceSummary;
    comparison: PerformanceComparison;
}

@Component({
    selector: 'app-performance-comparison-modal',
    standalone: true,
    imports: [CommonModule, DatePipe, DecimalPipe, IconComponent, WeightUnitPipe],
    templateUrl: './performance-comparison-modal.component.html',
})
export class PerformanceComparisonModalComponent implements OnInit {
    private trackingService = inject(TrackingService);
    protected unitService = inject(UnitsService);

    @Input({ required: true }) exercise!: DisplayLoggedExercise;
    @Input({ required: true }) currentLog!: WorkoutLog;

    comparisonData$!: Observable<ComparisonData | null>;

    ngOnInit() {
        // FIX: Add a guard clause to check for a routineId
        if (!this.currentLog.routineId) {
            // Cannot compare if the log isn't part of a routine.
            // Return an observable that emits null immediately.
            this.comparisonData$ = of(null);
            return;
        }

        // Now, this line is safe because we've confirmed routineId is a string.
        this.comparisonData$ = this.trackingService.getLogsForRoutine(this.currentLog.routineId, 2).pipe(
            map(logs => {
                // The rest of the logic is the same, but we add an extra check for safety
                if (!this.currentLog.routineId || logs.length === 0) return null;

                const sortedLogs = logs.sort((a, b) => b.startTime - a.startTime);
                const currentLogInHistory = sortedLogs.find(log => log.id === this.currentLog.id);
                const previousLog = sortedLogs.find(log => log.id !== this.currentLog.id);

                if (!currentLogInHistory) return null;

                const currentExercise = currentLogInHistory.exercises.find(ex => ex.exerciseId === this.exercise.exerciseId);
                const previousExercise = previousLog?.exercises.find(ex => ex.exerciseId === this.exercise.exerciseId);

                const currentSets = currentExercise?.sets || [];
                const previousSets = previousExercise?.sets || [];

                const currentSummary = this.calculateSummary(currentSets);
                const previousSummary = this.calculateSummary(previousSets);
                const comparison = this.calculateComparison(currentSummary, previousSummary);

                return {
                    currentLog: currentLogInHistory,
                    previousLog: previousLog || null,
                    currentSets,
                    previousSets,
                    currentSummary,
                    previousSummary,
                    comparison
                };
            })
        );
    }


    private calculateSummary(sets: LoggedSet[]): PerformanceSummary {
        if (!sets || sets.length === 0) {
            return { setsCount: 0, totalReps: 0, totalVolume: 0, avgWeightPerRep: 0 };
        }
        const totalReps = sets.reduce((sum, set) => sum + (set.repsAchieved || 0), 0);
        const totalVolume = sets.reduce((sum, set) => sum + ((set.repsAchieved || 0) * (set.weightUsed || 0)), 0);
        const avgWeightPerRep = totalReps > 0 ? totalVolume / totalReps : 0;
        return { setsCount: sets.length, totalReps, totalVolume, avgWeightPerRep };
    }

    private calculateComparison(current: PerformanceSummary, previous: PerformanceSummary): PerformanceComparison {
        const calcChange = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : c > 0 ? 100 : 0);
        return {
            setsDiff: current.setsCount - previous.setsCount,
            repsDiff: current.totalReps - previous.totalReps,
            volumeDiff: current.totalVolume - previous.totalVolume,
            avgWeightDiff: current.avgWeightPerRep - previous.avgWeightPerRep,
            setsPercentChange: calcChange(current.setsCount, previous.setsCount),
            repsPercentChange: calcChange(current.totalReps, previous.totalReps),
            volumePercentChange: calcChange(current.totalVolume, previous.totalVolume),
            avgWeightPercentChange: calcChange(current.avgWeightPerRep, previous.avgWeightPerRep),
        };
    }

    protected getTrendIcon(value: number): string {
        if (value > 0) return 'arrow-up';
        if (value < 0) return 'arrow-down';
        return 'minus';
    }
}