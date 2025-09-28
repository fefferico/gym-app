import { Component, Input, inject, OnInit, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { map } from 'rxjs/operators';
import { LoggedSet, WorkoutLog } from '../../../../core/models/workout-log.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { TrackingService } from '../../../../core/services/tracking.service';
import { UnitsService } from '../../../../core/services/units.service';
import { WeightUnitPipe } from '../../../../shared/pipes/weight-unit-pipe';

// --- UPDATED INTERFACES ---
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
    maxWeight: number;       // New
    totalDuration: number;   // New
    totalDistance: number;   // New
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
    maxWeightDiff: number;            // New
    maxWeightPercentChange: number;   // New
    durationDiff: number;             // New
    durationPercentChange: number;    // New
    distanceDiff: number;             // New
    distancePercentChange: number;    // New
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
    @Output() logSelect = new EventEmitter<string>();


    allHistoricalLogs = signal<WorkoutLog[]>([]);
    comparisonData = signal<ComparisonData | null>(null);
    selectedLogId: string | null = null;

    // --- NEW SIGNALS FOR DYNAMIC UI ---
    showWeightMetrics = signal<boolean>(false);
    showCardioMetrics = signal<boolean>(false);

    ngOnInit() {
        if (!this.currentLog.routineId) {
            this.comparisonData.set(null);
            return;
        }

        this.trackingService.getLogsForRoutine(this.currentLog.routineId).pipe(
            map(logs => {
                if (logs.length <= 1) {
                    this.allHistoricalLogs.set([]);
                    return null;
                }
                const historical = logs
                    .filter(log => log.id !== this.currentLog.id)
                    .sort((a, b) => b.startTime - a.startTime);
                this.allHistoricalLogs.set(historical);
                const defaultPreviousLog = historical.length > 0 ? historical[0] : null;
                this.selectedLogId = defaultPreviousLog?.id ?? null;
                return defaultPreviousLog;
            })
        ).subscribe(previousLog => {
            this.generateComparisonData(previousLog);
        });
    }

    onComparisonLogChange(event: Event): void {
        const selectElement = event.target as HTMLSelectElement;
        const logId = selectElement.value;
        this.selectedLogId = logId;
        const selectedLog = this.allHistoricalLogs().find(log => log.id === logId) ?? null;
        this.generateComparisonData(selectedLog);
    }

    private generateComparisonData(previousLog: WorkoutLog | null): void {
        const currentExercise = this.currentLog.exercises.find(ex => ex.exerciseId === this.exercise.exerciseId);
        const previousExercise = previousLog?.exercises.find(ex => ex.exerciseId === this.exercise.exerciseId);

        const currentSets = currentExercise?.sets || [];
        const previousSets = previousExercise?.sets || [];

        const currentSummary = this.calculateSummary(currentSets);
        const previousSummary = this.calculateSummary(previousSets);
        const comparison = this.calculateComparison(currentSummary, previousSummary);

        // --- NEW: Determine which metric groups to show ---
        this.showWeightMetrics.set(currentSummary.maxWeight > 0 || previousSummary.maxWeight > 0);
        this.showCardioMetrics.set(
            (currentSummary.totalDuration > 0 || currentSummary.totalDistance > 0) ||
            (previousSummary.totalDuration > 0 || previousSummary.totalDistance > 0)
        );

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
            return { setsCount: 0, totalReps: 0, totalVolume: 0, avgWeightPerRep: 0, maxWeight: 0, totalDuration: 0, totalDistance: 0 };
        }
        const totalReps = sets.reduce((sum, set) => sum + (set.repsAchieved || 0), 0);
        const totalVolume = sets.reduce((sum, set) => sum + ((set.repsAchieved || 0) * (set.weightUsed || 0)), 0);
        const avgWeightPerRep = totalReps > 0 ? totalVolume / totalReps : 0;

        // --- NEW CALCULATIONS ---
        const maxWeight = Math.max(0, ...sets.map(set => set.weightUsed || 0));
        const totalDuration = sets.reduce((sum, set) => sum + (set.durationPerformed || 0), 0);
        const totalDistance = sets.reduce((sum, set) => sum + (set.distanceAchieved || 0), 0);

        return { setsCount: sets.length, totalReps, totalVolume, avgWeightPerRep, maxWeight, totalDuration, totalDistance };
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
            // --- NEW CALCULATIONS ---
            maxWeightDiff: current.maxWeight - previous.maxWeight,
            maxWeightPercentChange: calcChange(current.maxWeight, previous.maxWeight),
            durationDiff: current.totalDuration - previous.totalDuration,
            durationPercentChange: calcChange(current.totalDuration, previous.totalDuration),
            distanceDiff: current.totalDistance - previous.totalDistance,
            distancePercentChange: calcChange(current.totalDistance, previous.totalDistance),
        };
    }

    // --- NEW HELPER METHOD ---
    protected formatDuration(totalSeconds: number): string {
        if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);

        const pad = (num: number) => num.toString().padStart(2, '0');

        if (hours > 0) {
            return `${hours}:${pad(minutes)}:${pad(seconds)}`;
        }
        return `${minutes}:${pad(seconds)}`;
    }

    protected getTrendIcon(value: number): string {
        if (value > 0) return 'arrow-up';
        if (value < 0) return 'arrow-down';
        return 'minus';
    }

    goToPreviousLogDetail(logId: string | undefined): void {
        if (logId) {
            this.logSelect.emit(logId);
        }
    }
}