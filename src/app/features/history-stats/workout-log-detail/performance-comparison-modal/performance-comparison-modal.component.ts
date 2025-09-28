import { Component, Input, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { map } from 'rxjs/operators';
import { LoggedSet, WorkoutLog } from '../../../../core/models/workout-log.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { TrackingService } from '../../../../core/services/tracking.service';
import { UnitsService } from '../../../../core/services/units.service';
import { WeightUnitPipe } from '../../../../shared/pipes/weight-unit-pipe';

// Interfaces remain the same
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

    // --- STATE MANAGEMENT REFACTORED TO USE SIGNALS ---
    allHistoricalLogs = signal<WorkoutLog[]>([]);
    comparisonData = signal<ComparisonData | null>(null);
    selectedLogId: string | null = null; // Used to bind to the <select> element's value

    ngOnInit() {
        if (!this.currentLog.routineId) {
            this.comparisonData.set(null);
            return;
        }

        // Fetch ALL logs for the routine to populate the dropdown
        this.trackingService.getLogsForRoutine(this.currentLog.routineId).pipe(
            map(logs => {
                if (logs.length <= 1) { // No other logs exist to compare to
                    this.allHistoricalLogs.set([]);
                    return null;
                }

                // Filter out the current log from the list of choices
                const historical = logs
                    .filter(log => log.id !== this.currentLog.id)
                    .sort((a, b) => b.startTime - a.startTime); // Ensure newest is first

                this.allHistoricalLogs.set(historical);

                // Default to comparing with the most recent historical log
                const defaultPreviousLog = historical.length > 0 ? historical[0] : null;
                this.selectedLogId = defaultPreviousLog?.id ?? null;

                return defaultPreviousLog;
            })
        ).subscribe(previousLog => {
            // Generate the initial comparison against the default (most recent) log
            this.generateComparisonData(previousLog);
        });
    }

    /**
     * Triggered when the user selects a different historical workout from the dropdown.
     */
    onComparisonLogChange(event: Event): void {
        const selectElement = event.target as HTMLSelectElement;
        const logId = selectElement.value;
        this.selectedLogId = logId;
        const selectedLog = this.allHistoricalLogs().find(log => log.id === logId) ?? null;
        this.generateComparisonData(selectedLog);
    }

    /**
     * Performs all calculations and updates the main signal that drives the template.
     * @param previousLog The historical log to compare against. Can be null.
     */
    private generateComparisonData(previousLog: WorkoutLog | null): void {
        const currentExercise = this.currentLog.exercises.find(ex => ex.exerciseId === this.exercise.exerciseId);
        
        // Find the performance of the same exercise in the selected historical log
        const previousExercise = previousLog?.exercises.find(ex => ex.exerciseId === this.exercise.exerciseId);

        const currentSets = currentExercise?.sets || [];
        const previousSets = previousExercise?.sets || [];

        const currentSummary = this.calculateSummary(currentSets);
        const previousSummary = this.calculateSummary(previousSets);
        const comparison = this.calculateComparison(currentSummary, previousSummary);

        // Update the signal, which will automatically refresh the component's view
        this.comparisonData.set({
            currentLog: this.currentLog,
            previousLog: previousLog,
            currentSets,
            previousSets,
            currentSummary,
            previousSummary,
            comparison
        });
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