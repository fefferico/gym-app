import { Component, Input, inject, OnInit, signal, Output, EventEmitter, effect } from '@angular/core';
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
    maxWeight: number;
    totalDuration: number;
    totalDistance: number;
}

interface PerformanceComparison {
    setsDiff: number;
    repsDiff: number;
    volumeDiff: number;
    maxWeightDiff: number;
    durationDiff: number;
    distanceDiff: number;
    setsPercentChange: number;
    repsPercentChange: number;
    volumePercentChange: number;
    maxWeightPercentChange: number;
    durationPercentChange: number;
    distancePercentChange: number;
}

interface ComparisonData {
    currentLog: WorkoutLog;
    previousLog: WorkoutLog | null;
    currentSummary: PerformanceSummary;
    previousSummary: PerformanceSummary;
    comparison: PerformanceComparison;
}

// New interface for the table structure
interface ComparisonTableRow {
    setNumber: number;
    todaySet: LoggedSet | null;
    previousSet: LoggedSet | null;
}

@Component({
    selector: 'app-performance-comparison-modal',
    standalone: true,
    imports: [CommonModule, DatePipe, DecimalPipe, IconComponent, WeightUnitPipe],
    templateUrl: './performance-comparison-modal.component.html',
    styleUrl: './performance-comparison-modal.component.scss'
})
export class PerformanceComparisonModalComponent { // REMOVED OnInit
    private trackingService = inject(TrackingService);
    protected unitService = inject(UnitsService);

    // --- INPUTS ARE NOW BRIDGED TO INTERNAL SIGNALS ---
    public readonly exerciseSignal = signal<DisplayLoggedExercise | undefined>(undefined);
    @Input({ required: true })
    set exercise(value: DisplayLoggedExercise) {
        this.exerciseSignal.set(value);
    }

    private readonly currentLogSignal = signal<WorkoutLog | undefined>(undefined);
    @Input({ required: true })
    set currentLog(value: WorkoutLog) {
        this.currentLogSignal.set(value);
    }

    @Output() logSelect = new EventEmitter<string>();

    allHistoricalLogs = signal<WorkoutLog[]>([]);
    comparisonData = signal<ComparisonData | null>(null);
    selectedLogId: string | null = null;

    showWeightMetrics = signal<boolean>(false);
    showCardioMetrics = signal<boolean>(false);
    comparisonTableRows = signal<ComparisonTableRow[]>([]);

    constructor() {
        // --- THIS EFFECT IS THE CORE OF THE FIX ---
        // It automatically runs when the component is created AND
        // every time the `exerciseSignal` or `currentLogSignal` changes.
        effect(() => {
            const currentExercise = this.exerciseSignal();
            const currentLog = this.currentLogSignal();

            // Guard against running before inputs are ready
            if (!currentExercise || !currentLog) {
                this.comparisonData.set(null);
                return;
            }

            // If the log has no routine, we can't compare.
            if (!currentLog.routineId) {
                this.comparisonData.set(null);
                return;
            }

            // This logic is now reactive and will re-fetch and re-calculate
            // whenever the user clicks a new exercise in the parent component.
            this.trackingService.getLogsForRoutine(currentLog.routineId).pipe(
                map(logs => {
                    if (logs.length <= 1) {
                        this.allHistoricalLogs.set([]);
                        return null;
                    }
                    const historical = logs.filter(log => log.id !== currentLog.id).sort((a, b) => b.startTime - a.startTime);
                    this.allHistoricalLogs.set(historical);
                    const defaultPreviousLog = historical[0] ?? null;
                    this.selectedLogId = defaultPreviousLog?.id ?? null;
                    return defaultPreviousLog;
                })
            ).subscribe(previousLog => {
                this.generateComparisonData(previousLog);
            });
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
        const currentLog = this.currentLogSignal();
        const currentExercise = this.exerciseSignal();
        if (!currentLog || !currentExercise) return;

        const previousExercise = previousLog?.exercises.find(ex => ex.exerciseId === currentExercise.exerciseId);
        const currentSets = currentExercise.sets || [];
        const previousSets = previousExercise?.sets || [];
        const currentSummary = this.calculateSummary(currentSets);
        const previousSummary = this.calculateSummary(previousSets);
        const comparison = this.calculateComparison(currentSummary, previousSummary);

        this.showWeightMetrics.set(currentSummary.maxWeight > 0 || previousSummary.maxWeight > 0);
        this.showCardioMetrics.set((currentSummary.totalDuration > 0 || currentSummary.totalDistance > 0) || (previousSummary.totalDuration > 0 || previousSummary.totalDistance > 0));

        this.comparisonData.set({
            currentLog: currentLog,
            previousLog: previousLog,
            currentSummary,
            previousSummary,
            comparison
        });

        const maxSets = Math.max(currentSets.length, previousSets.length);
        const rows: ComparisonTableRow[] = [];
        for (let i = 0; i < maxSets; i++) {
            rows.push({
                setNumber: i + 1,
                todaySet: currentSets[i] || null,
                previousSet: previousSets[i] || null,
            });
        }
        this.comparisonTableRows.set(rows);
    }

    private calculateSummary(sets: LoggedSet[]): PerformanceSummary {
        if (!sets || sets.length === 0) {
            return { setsCount: 0, totalReps: 0, totalVolume: 0, avgWeightPerRep: 0, maxWeight: 0, totalDuration: 0, totalDistance: 0 };
        }
        const totalReps = sets.reduce((sum, set) => sum + (set.repsAchieved || 0), 0);
        const totalVolume = sets.reduce((sum, set) => sum + ((set.repsAchieved || 0) * (set.weightUsed || 0)), 0);
        const avgWeightPerRep = totalReps > 0 ? totalVolume / totalReps : 0;
        const maxWeight = Math.max(0, ...sets.map(set => set.weightUsed || 0));
        const totalDuration = sets.reduce((sum, set) => sum + (set.durationPerformed || 0), 0);
        // CORRECTED to use distanceAchieved
        const totalDistance = sets.reduce((sum, set) => sum + (set.distanceAchieved || 0), 0);
        return { setsCount: sets.length, totalReps, totalVolume, avgWeightPerRep, maxWeight, totalDuration, totalDistance };
    }

    private calculateComparison(current: PerformanceSummary, previous: PerformanceSummary): PerformanceComparison {
        // This helper function safely calculates percentage change
        const calcChange = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : c > 0 ? 100 : 0);

        return {
            setsDiff: current.setsCount - previous.setsCount,
            repsDiff: current.totalReps - previous.totalReps,
            volumeDiff: current.totalVolume - previous.totalVolume,
            maxWeightDiff: current.maxWeight - previous.maxWeight,
            durationDiff: current.totalDuration - previous.totalDuration,
            distanceDiff: current.totalDistance - previous.totalDistance,
            // --- Calculate and include all percentage changes ---
            setsPercentChange: calcChange(current.setsCount, previous.setsCount),
            repsPercentChange: calcChange(current.totalReps, previous.totalReps),
            volumePercentChange: calcChange(current.totalVolume, previous.totalVolume),
            maxWeightPercentChange: calcChange(current.maxWeight, previous.maxWeight),
            durationPercentChange: calcChange(current.totalDuration, previous.totalDuration),
            distancePercentChange: calcChange(current.totalDistance, previous.totalDistance),
        };
    }

    protected formatDuration(totalSeconds: number): string {
        if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const pad = (num: number) => num.toString().padStart(2, '0');
        if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
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