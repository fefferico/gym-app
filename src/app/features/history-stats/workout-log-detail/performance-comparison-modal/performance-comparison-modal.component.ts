import { Component, Input, inject, signal, Output, EventEmitter, effect, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { map } from 'rxjs/operators';
import { LoggedSet, WorkoutLog } from '../../../../core/models/workout-log.model';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { TrackingService } from '../../../../core/services/tracking.service';
import { UnitsService } from '../../../../core/services/units.service';
import { WeightUnitPipe } from '../../../../shared/pipes/weight-unit-pipe';
import { DisplayLoggedExercise } from '../workout-log-detail';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { getDistanceValue, getDurationValue, getWeightValue, repsTypeToReps } from '../../../../core/services/workout-helper.service';
import { DistanceTarget, DurationTarget, RepsTarget, WeightTarget } from '../../../../core/models/workout.model';
import { LanguageService } from '../../../../core/services/language.service';
import { Locale } from 'date-fns';
import { ar, de, enUS, es, fr, it, ja, pt, ru, zhCN } from 'date-fns/locale';

// Interfaces for data structure
interface PerformanceSummary {
    setsCount: number;
    totalReps: number;
    totalVolume: number;
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

interface ComparisonTableRow {
    setNumber: number;
    todaySet: LoggedSet | null;
    previousSet: LoggedSet | null;
}

// New interface for the routine comparison table
interface ExerciseComparisonSummary {
    exerciseId: string;
    exerciseName: string;
    currentSummary: PerformanceSummary;
    previousSummary: PerformanceSummary;
    comparison: PerformanceComparison;
    showWeight: boolean;
    showCardio: boolean;
}


@Component({
    selector: 'app-performance-comparison-modal',
    standalone: true,
    providers: [WeightUnitPipe],
    imports: [CommonModule, DatePipe, DecimalPipe, IconComponent, WeightUnitPipe, TranslateModule],
    templateUrl: './performance-comparison-modal.component.html'
})
export class PerformanceComparisonModalComponent {
    private trackingService = inject(TrackingService);
    protected unitService = inject(UnitsService);
    protected weightUnitPipe = inject(WeightUnitPipe);
    protected decimalPipe = inject(DecimalPipe);
    private translate = inject(TranslateService);

    // --- INPUTS ---
    public readonly exerciseSignal = signal<DisplayLoggedExercise | undefined>(undefined);
    @Input() // No longer required, absence triggers routine comparison
    set exercise(value: DisplayLoggedExercise | undefined) {
        this.exerciseSignal.set(value);
    }

    private languageService = inject(LanguageService);
      private dateFnsLocales: { [key: string]: Locale } = {
        en: enUS,
        it: it,
        es: es,
        fr: fr,
        ru: ru,
        ja: ja,
        ar: ar,
        zh: zhCN,
        pt: pt,
        de: de
      };

    private readonly currentLogSignal = signal<WorkoutLog | undefined>(undefined);
    @Input({ required: true })
    set currentLog(value: WorkoutLog) {
        this.currentLogSignal.set(value);
    }

    @Output() logSelect = new EventEmitter<string>();

    // --- STATE MANAGEMENT SIGNALS ---
    readonly comparisonMode = computed(() => this.exerciseSignal() ? 'exercise' : 'routine');

    // For single exercise comparison
    sameRoutineLogs = signal<WorkoutLog[]>([]);
    otherRoutineLogs = signal<WorkoutLog[]>([]);

    // For routine comparison
    allHistoricalLogs = signal<WorkoutLog[]>([]);

    comparisonData = signal<ComparisonData | null>(null);
    selectedLogId: string | null = null;

    showWeightMetrics = signal<boolean>(false);
    showCardioMetrics = signal<boolean>(false);

    // Data for tables
    comparisonTableRows = signal<ComparisonTableRow[]>([]); // For exercise mode
    exerciseComparisonRows = signal<ExerciseComparisonSummary[]>([]); // For routine mode

    constructor() {
        effect(() => {
            const currentLog = this.currentLogSignal();
            if (!currentLog) {
                this.comparisonData.set(null);
                return;
            }

            if (this.comparisonMode() === 'exercise') {
                this.initializeExerciseComparison();
            } else {
                this.initializeRoutineComparison();
            }
        });
    }

    // --- INITIALIZATION LOGIC ---

    private initializeExerciseComparison(): void {
        const currentExercise = this.exerciseSignal();
        const currentLog = this.currentLogSignal();
        if (!currentExercise || !currentLog) return;

        // FAKE SERVICE CALL: In a real app, this would fetch all logs containing this exercise
        // this.trackingService.getAllLogsWithExercise(currentExercise.exerciseId).subscribe(logs => { ... });
        // For demonstration, we'll simulate this by reusing the routine logs
        this.trackingService.getLogsForRoutine(currentLog.routineId!).pipe(
            map(logs => logs.filter(log => log.id !== currentLog.id).sort((a, b) => b.startTime - a.startTime))
        ).subscribe(historicalLogs => {
            // Logic to split logs into same routine vs. others
            const sameRoutine = historicalLogs.filter(log => log.routineId === currentLog.routineId);
            const otherRoutines = historicalLogs.filter(log => log.routineId !== currentLog.routineId); // This would be populated by a real service call

            this.sameRoutineLogs.set(sameRoutine);
            this.otherRoutineLogs.set(otherRoutines);

            const allLogs = [...sameRoutine, ...otherRoutines];
            this.allHistoricalLogs.set(allLogs);

            const defaultPreviousLog = allLogs[0] ?? null;
            this.selectedLogId = defaultPreviousLog?.id ?? null;
            this.generateComparisonData(defaultPreviousLog);
        });
    }

    private initializeRoutineComparison(): void {
        const currentLog = this.currentLogSignal();
        if (!currentLog?.routineId) {
            this.comparisonData.set(null);
            return;
        }

        this.trackingService.getLogsForRoutine(currentLog.routineId).pipe(
            map(logs => logs.filter(log => log.id !== currentLog.id).sort((a, b) => b.startTime - a.startTime))
        ).subscribe(historicalLogs => {
            this.allHistoricalLogs.set(historicalLogs);
            const defaultPreviousLog = historicalLogs[0] ?? null;
            this.selectedLogId = defaultPreviousLog?.id ?? null;
            this.generateComparisonData(defaultPreviousLog);
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
        if (this.comparisonMode() === 'exercise') {
            this.generateExerciseComparison(previousLog);
        } else {
            this.generateRoutineComparison(previousLog);
        }
    }

    // --- DATA GENERATION FOR EXERCISE MODE ---
    private generateExerciseComparison(previousLog: WorkoutLog | null): void {
        const currentLog = this.currentLogSignal();
        const currentExercise = this.exerciseSignal();
        if (!currentLog || !currentExercise) return;

        const previousExercise = previousLog?.exercises.find(ex => ex.exerciseId === currentExercise.exerciseId);
        const currentSets = currentExercise.sets || [];
        const previousSets = previousExercise?.sets || [];

        const currentSummary = this.calculateSummaryForSets(currentSets);
        const previousSummary = this.calculateSummaryForSets(previousSets);
        const comparison = this.calculateComparison(currentSummary, previousSummary);

        this.showWeightMetrics.set(currentSummary.maxWeight > 0 || previousSummary.maxWeight > 0);
        this.showCardioMetrics.set(currentSummary.totalDuration > 0 || currentSummary.totalDistance > 0);

        this.comparisonData.set({ currentLog, previousLog, currentSummary, previousSummary, comparison });

        const maxSets = Math.max(currentSets.length, previousSets.length);
        const rows: ComparisonTableRow[] = Array.from({ length: maxSets }, (_, i) => ({
            setNumber: i + 1,
            todaySet: currentSets[i] || null,
            previousSet: previousSets[i] || null,
        }));
        this.comparisonTableRows.set(rows);
    }

    // --- DATA GENERATION FOR ROUTINE MODE ---
    private generateRoutineComparison(previousLog: WorkoutLog | null): void {
        const currentLog = this.currentLogSignal();
        if (!currentLog) return;

        const currentSummary = this.calculateSummaryForRoutine(currentLog.exercises);
        const previousSummary = this.calculateSummaryForRoutine(previousLog?.exercises || []);
        const comparison = this.calculateComparison(currentSummary, previousSummary);

        this.showWeightMetrics.set(currentSummary.maxWeight > 0 || previousSummary.maxWeight > 0);
        this.showCardioMetrics.set(currentSummary.totalDuration > 0 || currentSummary.totalDistance > 0);

        this.comparisonData.set({ currentLog, previousLog, currentSummary, previousSummary, comparison });

        // Generate per-exercise breakdown
        const exerciseRows: ExerciseComparisonSummary[] = [];
        const allExerciseIds = new Set([...currentLog.exercises.map(e => e.exerciseId), ...previousLog?.exercises.map(e => e.exerciseId) ?? []]);

        allExerciseIds.forEach(exerciseId => {
            const currentEx = currentLog.exercises.find(e => e.exerciseId === exerciseId);
            const prevEx = previousLog?.exercises.find(e => e.exerciseId === exerciseId);

            const currentExSummary = this.calculateSummaryForSets(currentEx?.sets || []);
            const prevExSummary = this.calculateSummaryForSets(prevEx?.sets || []);
            const exComparison = this.calculateComparison(currentExSummary, prevExSummary);

            exerciseRows.push({
                exerciseId,
                exerciseName: currentEx?.exerciseName || prevEx?.exerciseName || 'Unknown Exercise',
                currentSummary: currentExSummary,
                previousSummary: prevExSummary,
                comparison: exComparison,
                showWeight: currentExSummary.maxWeight > 0 || prevExSummary.maxWeight > 0,
                showCardio: currentExSummary.totalDuration > 0 || prevExSummary.totalDuration > 0 || currentExSummary.totalDistance > 0 || prevExSummary.totalDistance > 0
            });
        });

        this.exerciseComparisonRows.set(exerciseRows);
    }

    // --- CALCULATION HELPERS ---

    private calculateSummaryForSets(sets: LoggedSet[]): PerformanceSummary {
        if (!sets || sets.length === 0) {
            return { setsCount: 0, totalReps: 0, totalVolume: 0, maxWeight: 0, totalDuration: 0, totalDistance: 0 };
        }
        const totalReps = sets.reduce((sum, set) => sum + (repsTypeToReps(set.repsLogged) || 0), 0);
        const totalVolume = sets.reduce((sum, set) => sum + ((repsTypeToReps(set.repsLogged) || 0) * (getWeightValue(set.weightLogged) || 0)), 0);
        const maxWeight = Math.max(0, ...sets.map(set => getWeightValue(set.weightLogged) || 0));
        const totalDuration = sets.reduce((sum, set) => sum + (getDurationValue(set.durationLogged) || 0), 0);
        const totalDistance = sets.reduce((sum, set) => sum + (getDistanceValue(set.distanceLogged) || 0), 0);
        return { setsCount: sets.length, totalReps, totalVolume, maxWeight, totalDuration, totalDistance };
    }

    private calculateSummaryForRoutine(exercises: DisplayLoggedExercise[]): PerformanceSummary {
        const summaries = exercises.map(ex => this.calculateSummaryForSets(ex.sets));
        return {
            setsCount: summaries.reduce((sum, s) => sum + s.setsCount, 0),
            totalReps: summaries.reduce((sum, s) => sum + s.totalReps, 0),
            totalVolume: summaries.reduce((sum, s) => sum + s.totalVolume, 0),
            maxWeight: Math.max(0, ...summaries.map(s => s.maxWeight)),
            totalDuration: summaries.reduce((sum, s) => sum + s.totalDuration, 0),
            totalDistance: summaries.reduce((sum, s) => sum + s.totalDistance, 0)
        };
    }

    private calculateComparison(current: PerformanceSummary, previous: PerformanceSummary): PerformanceComparison {
        const calcChange = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : c > 0 ? 100 : 0);
        return {
            setsDiff: current.setsCount - previous.setsCount,
            repsDiff: current.totalReps - previous.totalReps,
            volumeDiff: current.totalVolume - previous.totalVolume,
            maxWeightDiff: current.maxWeight - previous.maxWeight,
            durationDiff: current.totalDuration - previous.totalDuration,
            distanceDiff: current.totalDistance - previous.totalDistance,
            setsPercentChange: calcChange(current.setsCount, previous.setsCount),
            repsPercentChange: calcChange(current.totalReps, previous.totalReps),
            volumePercentChange: calcChange(current.totalVolume, previous.totalVolume),
            maxWeightPercentChange: calcChange(current.maxWeight, previous.maxWeight),
            durationPercentChange: calcChange(current.totalDuration, previous.totalDuration),
            distancePercentChange: calcChange(current.totalDistance, previous.totalDistance),
        };
    }

    // --- TEMPLATE HELPERS ---

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

    /**
         * +++ NEW: This is the adapted method as you requested. +++
         * Checks if a *specific* performance metric has a non-zero difference.
         * @param type The specific metric to check.
         * @param comparison The performance comparison object.
         * @returns `true` if the specified metric has changed, `false` otherwise.
         */
    protected hasChanges(type: 'sets' | 'reps' | 'weight' | 'volume' | 'duration' | 'distance', comparison: PerformanceComparison | undefined): boolean {
        if (!comparison) {
            return false;
        }

        switch (type) {
            case 'sets':
                return comparison.setsDiff !== 0;
            case 'reps':
                return comparison.repsDiff !== 0;
            case 'weight':
                return comparison.maxWeightDiff !== 0;
            case 'volume':
                return comparison.volumeDiff !== 0;
            case 'duration':
                return comparison.durationDiff !== 0;
            case 'distance':
                return comparison.distanceDiff !== 0;
            default:
                return false;
        }
    }

    /**
     * +++ NEW: Renamed from the old `hasChanges` method. +++
     * Checks if *any* of the performance metrics have a non-zero difference.
     * This is used by the template to align the entire table for consistency.
     * @param comparison The performance comparison object.
     * @returns `true` if there is any change, `false` otherwise.
     */
    protected hasAnyChanges(comparison: PerformanceComparison | undefined): boolean {
        if (!comparison) {
            return false;
        }
        return comparison.setsDiff !== 0 ||
            comparison.repsDiff !== 0 ||
            comparison.volumeDiff !== 0 ||
            comparison.maxWeightDiff !== 0 ||
            comparison.durationDiff !== 0 ||
            comparison.distanceDiff !== 0;
    }

     // Helper to structure the summary data for the template's *ngFor loop
  getSummaryRows(data: any): any[] {
    const rows = [];
    
    // Sets
    rows.push({
      metric: this.translate.instant('performanceComparison.summary.sets'),
      currentValue: data.currentSummary.setsCount,
      previousValue: data.previousSummary.setsCount,
      diff: data.comparison.setsDiff,
      percentChange: data.comparison.setsPercentChange,
    });

    // Reps (if applicable)
    if (data.currentSummary.totalReps > 0 || data.previousSummary.totalReps > 0) {
      rows.push({
        metric: this.translate.instant('performanceComparison.summary.totalReps'),
        currentValue: data.currentSummary.totalReps,
        previousValue: data.previousSummary.totalReps,
        diff: data.comparison.repsDiff,
        percentChange: data.comparison.repsPercentChange,
      });
    }

    // Weight Metrics (if applicable)
    if (this.showWeightMetrics()) {
      rows.push({
        metric: this.translate.instant('performanceComparison.summary.maxWeight'),
        currentValue: this.weightUnitPipe.transform(data.currentSummary.maxWeight, '1.0-1'),
        previousValue: this.weightUnitPipe.transform(data.previousSummary.maxWeight, '1.0-1'),
        diff: data.comparison.maxWeightDiff,
        percentChange: data.comparison.maxWeightPercentChange,
      }, {
        metric: this.translate.instant('performanceComparison.summary.totalVolume'),
        currentValue: this.weightUnitPipe.transform(data.currentSummary.totalVolume, '1.0-0'),
        previousValue: this.weightUnitPipe.transform(data.previousSummary.totalVolume, '1.0-0'),
        diff: data.comparison.volumeDiff,
        percentChange: data.comparison.volumePercentChange,
      });
    }

    // Cardio Metrics (if applicable)
    if (this.showCardioMetrics()) {
      rows.push({
        metric: this.translate.instant('performanceComparison.summary.totalDuration'),
        currentValue: this.formatDuration(data.currentSummary.totalDuration),
        previousValue: this.formatDuration(data.previousSummary.totalDuration),
        diff: data.comparison.durationDiff,
        percentChange: data.comparison.durationPercentChange,
      }, {
        metric: this.translate.instant('performanceComparison.summary.totalDistance'),
        currentValue: `${this.decimalPipe.transform(data.currentSummary.totalDistance, '1.0-2')} ${this.unitService.getDistanceMeasureUnitSuffix()}`,
        previousValue: `${this.decimalPipe.transform(data.previousSummary.totalDistance, '1.0-2')} ${this.unitService.getDistanceMeasureUnitSuffix()}`,
        diff: data.comparison.distanceDiff,
        percentChange: data.comparison.distancePercentChange,
      });
    }

    return rows;
  }

  repsTargetRepsToReps(targetReps: RepsTarget | undefined): number {
    return repsTypeToReps(targetReps);
  }

  
        getDurationValue(duration: DurationTarget | undefined): number {
        return getDurationValue(duration);
      }
    
        getWeightValue(duration: WeightTarget | undefined): number {
        return getWeightValue(duration);
      }
    
        getDistanceValue(distance: DistanceTarget | undefined): number {
        return getDistanceValue(distance);
      }
}