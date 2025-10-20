import { Component, OnInit, inject, signal, ChangeDetectionStrategy, PLATFORM_ID, Renderer2, ElementRef, computed } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgxChartsModule, ScaleType, TooltipService } from '@swimlane/ngx-charts';
import * as shape from 'd3-shape'; // +++ IMPORT d3-shape
import { combineLatest, of, Subscription } from 'rxjs';
import { switchMap, map, catchError, take } from 'rxjs/operators';

import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { PersonalBestSet } from '../../../core/models/workout-log.model';
import { UnitsService } from '../../../core/services/units.service';
import { ToastService } from '../../../core/services/toast.service';
import { ThemeService } from '../../../core/services/theme.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { WorkoutService } from '../../../core/services/workout.service';

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
        RouterLink,
        IconComponent,
        TranslateModule
    ],
    templateUrl: './pb-trend-chart.html',
    styleUrls: ['./pb-trend-chart.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [TooltipService]
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
    private themeService = inject(ThemeService);
    private renderer = inject(Renderer2);
    private el = inject(ElementRef);
    private translate = inject(TranslateService);
    private workoutService = inject(WorkoutService);
    private themeSubscription: Subscription | undefined;

    chartData = signal<ChartData[] | null>(null);
    isLoading = signal<boolean>(true);
    errorMessage = signal<string | null>(null);

    historyTableData = computed<ChartSeriesPoint[]>(() => {
        const data = this.chartData();
        if (!data || !data[0] || !data[0].series) {
            return [];
        }
        return [...data[0].series].sort((a, b) => b.name.getTime() - a.name.getTime());
    });

    currentExerciseId: string | null = null;
    currentPbType: string | null = null;
    currentExerciseName = signal<string>('Exercise');
    yAxisLabel = signal<string>('Value');
    lineChartReferenceLines = signal<{ name: string, value: number }[]>([]); // +++ ADD for average line

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
    lineChartCurve = shape.curveMonotoneX; // +++ ADD for smoother curve

    // +++ USE UNIFIED COLOR SCHEME
    chartColorScheme = {
        name: 'fitTrackProScheme',
        selectable: true,
        group: ScaleType.Ordinal,
        domain: ['#10B981', '#3B82F6', '#F97316', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1'],
    };

    xAxisTickFormatting = (val: string | Date): string => {
        if (val instanceof Date) {
            return this.datePipe.transform(val, 'MMM d, yy') || '';
        }
        return String(val);
    };

    constructor() { }

    ngOnInit(): void {
        if (isPlatformBrowser(this.platformId)) {
            this.view = [window.innerWidth > 768 ? 700 : window.innerWidth - 40, 400];
            this.updateChartTextColors(this.themeService.isDarkTheme());
        }

        if (this.themeService.isDarkTheme()) {
            this.updateChartTextColors(true);
        } else {
            this.updateChartTextColors(false);
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
                    this.errorMessage.set(this.translate.instant('pbTrend.error.missingParams'));
                    this.isLoading.set(false);
                    return of({ pb: null, exercise: null, error: 'Missing parameters' });
                }

                this.currentExerciseId = exerciseIdParam;
                try {
                    this.currentPbType = decodeURIComponent(encodedPbTypeParam);
                } catch (e) {
                    this.errorMessage.set(this.translate.instant('pbTrend.error.invalidPbType'));
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
                        this.errorMessage.set(this.translate.instant('pbTrend.error.fetchFailed'));
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
                this.errorMessage.set(this.translate.instant('pbTrend.error.noData', { exercise: this.currentExerciseName(), pbType: this.currentPbType }));
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
            this.yAxisLabel.set(this.translate.instant('pbTrend.yAxis.weight', { unit: this.unitsService.getWeightUnitSuffix() }));
        } else if (pbType.includes('Max Reps')) {
            this.yAxisLabel.set(this.translate.instant('pbTrend.yAxis.reps'));
        } else if (pbType.includes('Max Duration')) {
            this.yAxisLabel.set(this.translate.instant('pbTrend.yAxis.duration'));
        } else if (pbType.includes('Max Distance')) { // <-- ADD THIS BLOCK
            this.yAxisLabel.set(this.translate.instant('pbTrend.yAxis.distance', { unit: this.unitsService.getDistanceMeasureUnitSuffix() }));
        } else {
            this.yAxisLabel.set(this.translate.instant('pbTrend.yAxis.value'));
        }
    }

    private prepareChartData(pb: PersonalBestSet): void {
        const seriesData: ChartSeriesPoint[] = [];

        const currentValue = this.extractValueForChart(pb, pb.pbType);
        if (currentValue !== null && pb.timestamp) {
            seriesData.push({
                name: new Date(pb.timestamp),
                value: currentValue,
                extra: { reps: pb.repsLogged, notes: pb.notes, workoutLogId: pb.workoutLogId }
            });
        }

        if (pb.history) {
            pb.history.forEach(histInstance => {
                const histValue = this.extractValueForChart(histInstance, pb.pbType);
                if (histValue !== null && histInstance.timestamp) {
                    seriesData.push({
                        name: new Date(histInstance.timestamp),
                        value: histValue,
                        extra: { reps: histInstance.repsLogged, notes: undefined, workoutLogId: histInstance.workoutLogId }
                    });
                }
            });
        }

        // +++ UPDATED LOGIC for handling 0 or 1 data points
        if (seriesData.length < 2) {
            this.errorMessage.set(this.translate.instant('pbTrend.error.notEnoughData'));
            this.chartData.set(null); // Ensure chart doesn't render
            this.lineChartReferenceLines.set([]);
            return;
        }

        seriesData.sort((a, b) => a.name.getTime() - b.name.getTime());

        // +++ ADD logic to calculate average for reference line
        const totalValue = seriesData.reduce((sum, item) => sum + item.value, 0);
        const averageValue = totalValue / seriesData.length;
        this.lineChartReferenceLines.set([{ name: this.translate.instant('pbTrend.chart.averageLine', { value: averageValue.toFixed(1) }), value: averageValue }]);

        this.chartData.set([{
            name: `${this.currentPbType || 'PB'} Trend`,
            series: seriesData
        }]);
    }

    private extractValueForChart(
        item: { weightLogged?: number | null; repsLogged?: number; durationLogged?: number | null; distanceLogged?: number | null }, // <-- Add distanceLogged
        pbType: string
    ): number | null {
        if (pbType.includes('RM') || pbType.includes('Heaviest Lifted')) {
            return item.weightLogged ?? null;
        } else if (pbType.includes('Max Reps')) {
            return item.repsLogged ?? null;
        } else if (pbType.includes('Max Duration')) {
            return item.durationLogged ?? null;
        } else if (pbType.includes('Max Distance')) { // <-- ADD THIS BLOCK
            return item.distanceLogged ?? null;
        }
        // Fallback logic
        if (item.weightLogged && item.weightLogged > 0) return item.weightLogged;
        if (item.repsLogged && item.repsLogged > 0) return item.repsLogged;
        if (item.durationLogged && item.durationLogged > 0) return item.durationLogged;
        if (item.distanceLogged && item.distanceLogged > 0) return item.distanceLogged; // <-- Add distance fallback
        return null;
    }

    onChartSelect(event: any): void {
        // +++ UPDATED to use consistent route
        if (event && event.extra && event.extra.workoutLogId) {
            this.router.navigate(['/history/log', event.extra.workoutLogId]);
        } else if (event && event.extra) {
            this.toastService.info(this.translate.instant('pbTrend.chart.tooltip.value', { value: event.value, unit: this.yAxisLabel().split(' ')[0] }) + ` on ${this.datePipe.transform(event.name, 'mediumDate')}. ${event.extra.reps ? this.translate.instant('pbTrend.chart.tooltip.reps', { reps: event.extra.reps }) : ''}`, 5000, "PB Detail");
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

    /**
     * Formats the value for the history table based on the current PB type.
     * @param record The chart data point for the table row.
     * @returns A formatted string for display.
     */
    public formatTableValue(record: ChartSeriesPoint): string {
        // If the PB is for duration, format the value as mm:ss
        if (this.currentPbType?.includes('Max Duration')) {
            return this.workoutService.formatSecondsToTime(record.value) || record.value.toString();
        }
        // Otherwise, return the value as a standard string
        return record.value.toString();
    }
}