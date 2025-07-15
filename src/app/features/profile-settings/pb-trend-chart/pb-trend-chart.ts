// src/app/features/profile-settings/pb-trend-chart/pb-trend-chart.component.ts
import { Component, OnInit, inject, signal, ChangeDetectionStrategy, PLATFORM_ID, Renderer2, ElementRef, computed } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts'; // Import NgxChartsModule and ScaleType
import { combineLatest, of, Subscription } from 'rxjs';
import { switchMap, map, catchError, take } from 'rxjs/operators';

import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { PersonalBestSet, PBHistoryInstance } from '../../../core/models/workout-log.model';
import { UnitsService } from '../../../core/services/units.service'; // For Y-axis label
import { ToastService } from '../../../core/services/toast.service';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { ThemeService } from '../../../core/services/theme.service';

interface ChartSeriesPoint {
    name: Date; // X-axis (timestamp)
    value: number; // Y-axis (PB value)
    extra?: { // Optional additional data for tooltips, etc.
        reps?: number;
        notes?: string;
        workoutLogId?: string;
    };
}

interface ChartData {
    name: string; // Series name (e.g., "1RM (Actual) Trend")
    series: ChartSeriesPoint[];
}

@Component({
    selector: 'app-pb-trend-chart',
    standalone: true,
    imports: [
        CommonModule,
        NgxChartsModule, // Import NgxChartsModule here for standalone component
        DatePipe
    ],
    templateUrl: './pb-trend-chart.html',
    styleUrls: ['./pb-trend-chart.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
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
    private appSettingsService = inject(AppSettingsService); // Inject AppSettingsService
    private themeService = inject(ThemeService);
    private renderer = inject(Renderer2);
    private el = inject(ElementRef);
    private themeSubscription: Subscription | undefined;

    chartData = signal<ChartData[] | null>(null);
    isLoading = signal<boolean>(true);
    errorMessage = signal<string | null>(null);

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

    // Dynamically set color scheme based on theme
    chartColorScheme = computed(() => {
        const isDark = this.themeService.isDarkTheme(); // Assuming this method exists
        return {
            name: 'pbTrendScheme',
            selectable: true,
            group: ScaleType.Ordinal,
            domain: isDark
                ? ['#70C0AE', '#E9724C', '#F0C24B', '#CCCCCC'] // Lighter, distinct colors for dark mode
                : ['#5AA454', '#A10A28', '#C7B42C', '#333333'] // Original or adjusted for light
        };
    });

    // For ngx-charts text colors, we'll use CSS variables updated by the component
    // Or rely on ::ng-deep if absolutely necessary and CSS variables don't work well enough
    // For this example, we'll try to set CSS variables on the host element.

    xAxisTickFormatting = (val: string | Date): string => {
        if (val instanceof Date) {
            return this.datePipe.transform(val, 'MMM d, yy') || '';
        }
        return String(val);
    };

    constructor() {
        // If AppSettingsService.isDarkTheme() is a signal or observable, subscribe to it
        // For this example, assuming it's a synchronous check or a signal that chartColorScheme can react to.
        // If it's an observable, you'd subscribe and update a local signal for isDark.
    }


    ngOnInit(): void {
        if (isPlatformBrowser(this.platformId)) {
            this.view = [window.innerWidth > 768 ? 700 : window.innerWidth - 40, 400];
            // Subscribe to theme changes to update CSS variables for chart text
            // Set chart text colors based on current theme
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
        const textColor = isDark ? '#E5E7EB' : '#374151'; // Example: gray-200 for dark, gray-700 for light
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

        // Add current PB to series
        const currentValue = this.extractValueForChart(pb, pb.pbType);
        if (currentValue !== null && pb.timestamp) {
            seriesData.push({
                name: new Date(pb.timestamp),
                value: currentValue,
                extra: { reps: pb.repsAchieved, notes: pb.notes, workoutLogId: pb.workoutLogId }
            });
        }

        // Add history to series
        if (pb.history) {
            pb.history.forEach(histInstance => {
                // Use the main PB's type for context when extracting value from history
                const histValue = this.extractValueForChart(histInstance, pb.pbType);
                if (histValue !== null && histInstance.timestamp) {
                    seriesData.push({
                        name: new Date(histInstance.timestamp),
                        value: histValue,
                        extra: { reps: histInstance.repsAchieved, notes: undefined, workoutLogId: histInstance.workoutLogId } // Notes usually aren't in PBHistoryInstance
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
            // We can still show the single point, or just the message.
            // For ngx-charts to draw a "line", it needs at least two points.
            // Let's create a "flat line" by duplicating the point with a slight time offset for visualization
            const singlePoint = seriesData[0];
            const slightlyEarlierDate = new Date(singlePoint.name.getTime() - (24 * 60 * 60 * 1000)); // One day before
            seriesData.unshift({
                name: slightlyEarlierDate,
                value: singlePoint.value, // Keep the same value to make it a point/flat line start
                extra: singlePoint.extra
            });
        }


        // Sort by date ascending for the chart
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
            // For bodyweight max reps, weightUsed might be 0 or null. The value is reps.
            return item.repsAchieved ?? null;
        } else if (pbType.includes('Max Duration')) {
            return item.durationPerformed ?? null;
        }
        // Fallback or if pbType is unrecognized for value extraction
        if (item.weightUsed && item.weightUsed > 0) return item.weightUsed;
        if (item.repsAchieved > 0) return item.repsAchieved;
        if (item.durationPerformed && item.durationPerformed > 0) return item.durationPerformed;
        return null;
    }

    onChartSelect(event: any): void {
        // console.log('Chart item selected:', event);
        if (event && event.extra && event.extra.workoutLogId) {
            this.router.navigate(['/workout/summary', event.extra.workoutLogId]);
        } else if (event && event.extra) {
            this.toastService.info(`PB achieved: ${event.value} ${this.yAxisLabel().split(' ')[0]} on ${this.datePipe.transform(event.name, 'mediumDate')}. ${event.extra.reps ? 'Reps: ' + event.extra.reps : ''} ${event.extra.notes ? 'Notes: ' + event.extra.notes : ''}`, 5000, "PB Detail");
        }
    }

    goBack(): void {
        this.router.navigate(['/profile/personal-bests']);
    }

    // Adjust view based on window resize
    onResize(event: Event): void {
        if (isPlatformBrowser(this.platformId)) {
            const target = event.target as Window;
            this.view = [target.innerWidth > 768 ? 700 : target.innerWidth - 40, 400];
        }
    }
}