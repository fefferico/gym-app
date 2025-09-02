// src/app/features/profile-settings/pb-trend-chart/pb-trend-chart.component.ts
import { Component, OnInit, inject, signal, ChangeDetectionStrategy, PLATFORM_ID, Renderer2, ElementRef, computed } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
// ==========================================================
// START: CORRECTED IMPORTS
// ==========================================================
import { NgxChartsModule, ScaleType, TooltipService } from '@swimlane/ngx-charts';
// ** NOTE: Only TooltipService is needed. InjectionService is internal.
// ==========================================================
// END: CORRECTED IMPORTS
// ==========================================================
import { combineLatest, of, Subscription } from 'rxjs';
import { switchMap, map, catchError, take } from 'rxjs/operators';

import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { PersonalBestSet, PBHistoryInstance } from '../../../core/models/workout-log.model';
import { UnitsService } from '../../../core/services/units.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { ThemeService } from '../../../core/services/theme.service';

interface ChartSeriesPoint {
    name: Date;
    value: number;
    extra?: {
        reps?: number;
        notes?: string;
        workoutLogId?: string;
    };
}

interface ChartData {
    name: string;
    series: ChartSeriesPoint[];
}

@Component({
    selector: 'app-pb-trend-chart',
    standalone: true,
    imports: [
        CommonModule,
        NgxChartsModule,
        DatePipe,
        RouterLink
    ],
    templateUrl: './pb-trend-chart.html',
    styleUrls: ['./pb-trend-chart.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    // ==========================================================
    // START: ADD THIS PROVIDERS ARRAY
    // This is the key change to fix the dependency injection issue.
    // ==========================================================
    providers: [TooltipService]
    // ==========================================================
    // END: ADD THIS PROVIDERS ARRAY
    // ==========================================================
})
export class PbTrendChartComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private trackingService = inject(TrackingService);
    private exerciseService = inject(ExerciseService);
    private unitsService = inject(UnitsService);
    private toastService = inject(ToastService);
    private platformId = inject(PLATFORM_ID);
    private datePipe = new DatePipe('en-US');
    private appSettingsService = inject(AppSettingsService);
    private themeService = inject(ThemeService);
    private renderer = inject(Renderer2);
    private el = inject(ElementRef);
    private themeSubscription: Subscription | undefined;

    chartData = signal<ChartData[] | null>(null);
    isLoading = signal<boolean>(true);
    errorMessage = signal<string | null>(null);

    // +++ NEW: Computed signal for the history table, sorted newest-first +++
    historyTableData = computed<ChartSeriesPoint[]>(() => {
        const data = this.chartData();
        if (!data || !data[0] || !data[0].series) {
            return [];
        }
        // Create a copy and sort it descending by date
        return [...data[0].series].sort((a, b) => b.name.getTime() - a.name.getTime());
    });

    currentExerciseId: string | null = null;
    currentPbType: string | null = null;
    currentExerciseName = signal<string>('Exercise');
    yAxisLabel = signal<string>('Value');

    // Chart options
    view: [number, number] = [700, 400];
    legend: boolean = false;
    showXAxisLabel: boolean = true;
    showYAxisLabel: boolean = true;
    xAxis: boolean = true;
    yAxis: boolean = true;
    timeline: boolean = true;
    autoScale: boolean = true;
    roundDomains: boolean = true;

    chartColorScheme = computed(() => {
        const isDark = this.themeService.isDarkTheme();
        return {
            name: 'pbTrendScheme',
            selectable: true,
            group: ScaleType.Ordinal,
            domain: isDark
                ? ['#70C0AE', '#E9724C', '#F0C24B', '#CCCCCC']
                : ['#5AA454', '#A10A28', '#C7B42C', '#333333']
        };
    });

    xAxisTickFormatting = (val: string | Date): string => {
        if (val instanceof Date) {
            return this.datePipe.transform(val, 'MMM d, yy') || '';
        }
        return String(val);
    };

    constructor() {}

    ngOnInit(): void {
        if (isPlatformBrowser(this.platformId)) {
            this.view = [window.innerWidth > 768 ? 700 : window.innerWidth - 40, 400];
            this.updateChartTextColors(this.themeService.isDarkTheme());
        }
        this.route.paramMap.pipe(
            take(1),
            switchMap(params => {
                this.isLoading.set(true);
                this.errorMessage.set(null);
                this.chartData.set(null);

                const exerciseIdParam = params.get('exerciseId');
                const encodedPbTypeParam = params.get('pbType');

                if (!exerciseIdParam || !encodedPbTypeParam) {
                    this.errorMessage.set('Exercise ID or PB Type missing in URL.');
                    this.isLoading.set(false);
                    return of({ pb: null, exercise: null, error: 'Missing parameters' });
                }

                this.currentExerciseId = exerciseIdParam;
                try {
                    this.currentPbType = decodeURIComponent(encodedPbTypeParam);
                } catch (e) {
                    this.errorMessage.set('Invalid PB Type in URL.');
                    this.isLoading.set(false);
                    return of({ pb: null, exercise: null, error: 'Invalid PB Type' });
                }

                this.setYAxisLabel(this.currentPbType);

                return combineLatest([
                    this.trackingService.getPersonalBestForExerciseByType(this.currentExerciseId, this.currentPbType),
                    this.exerciseService.getExerciseById(this.currentExerciseId)
                ]).pipe(
                    map(([pb, exercise]) => ({ pb, exercise, error: null })),
                    catchError(err => {
                        console.error('Error fetching PB trend data:', err);
                        this.errorMessage.set('Failed to load data for the trend chart.');
                        return of({ pb: null, exercise: null, error: 'Fetch error' });
                    })
                );
            })
        ).subscribe(({ pb, exercise, error }) => {
            if (error) {
                this.isLoading.set(false);
                return;
            }
            this.currentExerciseName.set(exercise?.name || 'Selected Exercise');
            if (pb) {
                this.prepareChartData(pb);
            } else {
                this.errorMessage.set(`No Personal Best data found for "${this.currentExerciseName()}" of type "${this.currentPbType}"`);
            }
            this.isLoading.set(false);
        });
    }

    private updateChartTextColors(isDark: boolean): void {
        const textColor = isDark ? '#E5E7EB' : '#374151';
        this.renderer.setStyle(this.el.nativeElement, '--ngx-charts-text-color', textColor);
    }

    private setYAxisLabel(pbType: string): void {
        if (pbType.includes('RM') || pbType.includes('Heaviest Lifted')) {
            this.yAxisLabel.set(`Weight (${this.unitsService.getUnitSuffix()})`);
        } else if (pbType.includes('Max Reps')) {
            this.yAxisLabel.set('Repetitions');
        } else if (pbType.includes('Max Duration')) {
            this.yAxisLabel.set('Duration (seconds)');
        } else {
            this.yAxisLabel.set('Value');
        }
    }

    private prepareChartData(pb: PersonalBestSet): void {
        const seriesData: ChartSeriesPoint[] = [];

        const currentValue = this.extractValueForChart(pb, pb.pbType);
        if (currentValue !== null && pb.timestamp) {
            seriesData.push({
                name: new Date(pb.timestamp),
                value: currentValue,
                extra: { reps: pb.repsAchieved, notes: pb.notes, workoutLogId: pb.workoutLogId }
            });
        }

        if (pb.history) {
            pb.history.forEach(histInstance => {
                const histValue = this.extractValueForChart(histInstance, pb.pbType);
                if (histValue !== null && histInstance.timestamp) {
                    seriesData.push({
                        name: new Date(histInstance.timestamp),
                        value: histValue,
                        extra: { reps: histInstance.repsAchieved, notes: undefined, workoutLogId: histInstance.workoutLogId }
                    });
                }
            });
        }

        if (seriesData.length === 0) {
            this.errorMessage.set(`Not enough data points to plot a trend for "${this.currentExerciseName()}" - ${pb.pbType}`);
            this.chartData.set(null);
            return;
        }
        if (seriesData.length === 1) {
            this.errorMessage.set(`Only one data point available for "${this.currentExerciseName()}" - ${pb.pbType}. Trend line cannot be drawn`);
            const singlePoint = seriesData[0];
            const slightlyEarlierDate = new Date(singlePoint.name.getTime() - (24 * 60 * 60 * 1000));
            seriesData.unshift({
                name: slightlyEarlierDate,
                value: singlePoint.value,
                extra: singlePoint.extra
            });
        }

        seriesData.sort((a, b) => a.name.getTime() - b.name.getTime());

        this.chartData.set([{
            name: `${this.currentPbType || 'PB'} Trend`,
            series: seriesData
        }]);
    }

    private extractValueForChart(
        item: { weightUsed?: number | null; repsAchieved: number; durationPerformed?: number | null },
        pbType: string
    ): number | null {
        if (pbType.includes('RM') || pbType.includes('Heaviest Lifted')) {
            return item.weightUsed ?? null;
        } else if (pbType.includes('Max Reps')) {
            return item.repsAchieved ?? null;
        } else if (pbType.includes('Max Duration')) {
            return item.durationPerformed ?? null;
        }
        if (item.weightUsed && item.weightUsed > 0) return item.weightUsed;
        if (item.repsAchieved > 0) return item.repsAchieved;
        if (item.durationPerformed && item.durationPerformed > 0) return item.durationPerformed;
        return null;
    }

    onChartSelect(event: any): void {
        if (event && event.extra && event.extra.workoutLogId) {
            this.router.navigate(['/workout/summary', event.extra.workoutLogId]);
        } else if (event && event.extra) {
            this.toastService.info(`PB achieved: ${event.value} ${this.yAxisLabel().split(' ')[0]} on ${this.datePipe.transform(event.name, 'mediumDate')}. ${event.extra.reps ? 'Reps: ' + event.extra.reps : ''} ${event.extra.notes ? 'Notes: ' + event.extra.notes : ''}`, 5000, "PB Detail");
        }
    }

    goBack(): void {
        this.router.navigate(['/profile/personal-bests']);
    }

    onResize(event: Event): void {
        if (isPlatformBrowser(this.platformId)) {
            const target = event.target as Window;
            this.view = [target.innerWidth > 768 ? 700 : target.innerWidth - 40, 400];
        }
    }
}