import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectionStrategy, effect, ViewChild, ElementRef, afterNextRender, HostListener, PLATFORM_ID } from '@angular/core';
import { CommonModule, TitleCasePipe, DecimalPipe, DatePipe, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms'; // Import ReactiveFormsModule
import { combineLatest, distinctUntilChanged, Subscription } from 'rxjs';
// No need for startWith, distinctUntilChanged from rxjs/operators if using signals directly for form values
import { parseISO, isValid, format, isSameDay } from 'date-fns'; // isSameDay was already here

import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
import * as shape from 'd3-shape';


import { MuscleGroupPerformance, StatsService, WeeklySummary, DatedVolume, StreakInfo } from '../../../core/services/stats.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { WorkoutLog } from '../../../core/models/workout-log.model';
import { UnitsService } from '../../../core/services/units.service';
import { PressDirective } from '../../../shared/directives/press.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ActivityLog } from '../../../core/models/activity-log.model';
import { ActivityService } from '../../../core/services/activity.service';

export interface ChartDataPoint {
  name: string | Date;
  value: number; extra?: any
}
export interface ChartSeries { name: string; series: ChartDataPoint[]; }

@Component({
  selector: 'app-stats-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    TitleCasePipe,
    DecimalPipe,
    DatePipe, // Add DatePipe here
    NgxChartsModule,
    ReactiveFormsModule, // Add ReactiveFormsModule here
    PressDirective,
    IconComponent
  ],
  templateUrl: './stats-dashboard.html',
  styleUrl: './stats-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsDashboardComponent implements OnInit, OnDestroy {
  private trackingService = inject(TrackingService);
  private statsService = inject(StatsService);
  private fb = inject(FormBuilder); // Inject FormBuilder
  protected unitsService = inject(UnitsService);
  protected router = inject(Router);
  private activityService = inject(ActivityService); // Inject the ActivityService

  // --- UPDATED: Renamed for clarity ---
  @ViewChild('weeklyChartWrapper') weeklyChartWrapperRef!: ElementRef<HTMLDivElement>;
  weeklyContainerView = signal<[number, number]>([320, 300]);

  chartHeight = 300;
  // --- UPDATED: More descriptive constants for responsive control ---
  private readonly BAR_WIDTH_PER_ENTRY = 70;
  private readonly VISIBLE_MOBILE_WEEK_ENTRIES = 5;
  private readonly MIN_PC_WEEK_ENTRY_WIDTH = 80;

  muscleGroupChartView = computed<[number, number]>(() => {
    const dataCount = this.muscleGroupChartDataForPeriod().length;
    if (dataCount > 0) {
      const totalWidth = dataCount * this.BAR_WIDTH_PER_ENTRY;
      return [totalWidth, this.chartHeight];
    }
    return [300, this.chartHeight];
  });

  // --- NEW: Computed signal for the scrollable weekly volume chart view ---
  weeklyVolumeChartView = computed<[number, number]>(() => {
    const data = this.weeklyVolumeChartDataForPeriod();
    const series = data[0]?.series;
    if (!series || series.length === 0) {
      return this.weeklyContainerView(); // Fallback to the container's current size
    }

    const dataCount = series.length;
    const containerWidth = this.weeklyContainerView()[0];

    // Use a breakpoint to differentiate between mobile and PC layouts
    const isPcView = containerWidth > 768;

    if (isPcView) {
      // --- PC LOGIC ---
      // On larger screens, try to show all data. Only scroll if necessary.
      const totalRequiredWidth = dataCount * this.MIN_PC_WEEK_ENTRY_WIDTH;
      // The chart's width will be the larger of the container's width or the width required to show all data points comfortably.
      const chartWidth = Math.max(containerWidth, totalRequiredWidth);
      return [chartWidth, this.chartHeight];
    } else {
      // --- MOBILE LOGIC ---
      // On smaller screens, enforce scrolling for better readability if data exceeds a certain count.
      if (dataCount <= this.VISIBLE_MOBILE_WEEK_ENTRIES) {
        // If there are few data points, let the chart fill the container without scrolling.
        return [containerWidth, this.chartHeight];
      } else {
        // If there are many data points, calculate a total width that makes the chart scrollable, showing ~5 items at once.
        const widthPerItem = containerWidth / this.VISIBLE_MOBILE_WEEK_ENTRIES;
        const totalChartWidth = widthPerItem * dataCount;
        return [totalChartWidth, this.chartHeight];
      }
    }
  });


  allLogs = signal<WorkoutLog[]>([]);
  allActivityLogs = signal<ActivityLog[]>([]); // Add a signal for activity logs
  statsFilterForm!: FormGroup;

  private dateFilters = signal<{ dateFrom: Date | null; dateTo: Date | null }>({
    dateFrom: null,
    dateTo: null,
  });

  isFilterAccordionOpen = signal(false);

  filteredLogsForStats = computed(() => {
    const logs = this.allLogs();
    const { dateFrom, dateTo } = this.dateFilters();

    if (!dateFrom && !dateTo) {
      return logs;
    }

    return logs.filter(log => {
      const logDate = parseISO(log.date);
      let match = true;

      if (dateFrom && isValid(dateFrom)) {
        const normalizedLogDate = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        const normalizedDateFrom = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate());
        match &&= normalizedLogDate >= normalizedDateFrom;
      }
      if (dateTo && isValid(dateTo)) {
        const normalizedLogDate = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        const normalizedDateTo = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate());
        match &&= normalizedLogDate <= normalizedDateTo;
      }
      return match;
    });
  });

  workoutsInPeriodCount = signal<number>(0);
  volumeInPeriod = signal<number>(0);
  muscleGroupChartDataForPeriod = signal<ChartDataPoint[]>([]);
  weeklyVolumeChartDataForPeriod = signal<ChartSeries[]>([]);
  weeklySummariesTableDataForPeriod = signal<WeeklySummary[]>([]);
  muscleGroupPerformanceTableDataForPeriod = signal<MuscleGroupPerformance[]>([]);
  lineChartReferenceLines = signal<{ name: string, value: number }[]>([]);

  currentWorkoutStreakInfo = signal<StreakInfo>({ length: 0 });
  longestWorkoutStreakInfo = signal<StreakInfo>({ length: 0 });

  private dataSub?: Subscription; // Renamed for clarity
  private filterFormSub?: Subscription;

  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showXAxisLabel = true;
  showYAxisLabel = true;
  yAxisLabelVolume = computed(() => `Total Volume (${this.unitsService.getWeightUnitSuffix()})`);
  xAxisLabelMuscle = 'Muscle Group';
  xAxisLabelWeek = 'Week';
  barChartShowDataLabel = true;
  barChartRoundEdges = true;
  lineChartTimeline = true;
  lineChartCurve = shape.curveMonotoneX;

  customColorScheme = {
    name: 'fitTrackProScheme',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#10B981', '#3B82F6', '#F97316', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1'],
  };


  constructor() {
    this.statsFilterForm = this.fb.group({
      dateFrom: [null as string | null],
      dateTo: [null as string | null]
    });

    effect(async () => {
      const logsToProcess = this.filteredLogsForStats();
      this.calculatePeriodStats(logsToProcess);
      await this.preparePeriodChartData(logsToProcess);
      this.preparePeriodTableData(logsToProcess);
    });

    afterNextRender(() => {
      this.updateWeeklyContainerView();
    });
  }

  private platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
    }

    // Use combineLatest to get both workout and activity logs together
    this.dataSub = combineLatest([
      this.trackingService.workoutLogs$,
      this.activityService.activityLogs$ // Assuming this exists in your ActivityService
    ]).subscribe(([allWorkoutLogs, allActivityLogs]) => {

      this.allLogs.set(allWorkoutLogs);
      this.allActivityLogs.set(allActivityLogs); // Store the activity logs

      // Update streak calculations to use both sets of data
      this.currentWorkoutStreakInfo.set(this.statsService.calculateCurrentWorkoutStreak(allWorkoutLogs, allActivityLogs));
      this.longestWorkoutStreakInfo.set(this.statsService.calculateLongestWorkoutStreak(allWorkoutLogs, allActivityLogs));
    });

    this.filterFormSub = this.statsFilterForm.valueChanges.pipe(
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    ).subscribe(formValues => {
      this.applyStatsFiltersFromForm(formValues);
    });
    this.applyStatsFiltersFromForm(this.statsFilterForm.value);
  }

  private applyStatsFiltersFromForm(formValues: { dateFrom: string | null, dateTo: string | null }): void {
    let dateFromObj: Date | null = null;
    let dateToObj: Date | null = null;

    if (formValues.dateFrom) {
      const parsedFrom = parseISO(formValues.dateFrom);
      if (isValid(parsedFrom)) dateFromObj = parsedFrom;
    }
    if (formValues.dateTo) {
      const parsedTo = parseISO(formValues.dateTo);
      if (isValid(parsedTo)) dateToObj = parsedTo;
    }

    if (dateFromObj && dateToObj && dateFromObj > dateToObj) {
      alert("'From Date' cannot be after 'To Date'. Filters not applied");
      return;
    }

    this.dateFilters.set({ dateFrom: dateFromObj, dateTo: dateToObj });
  }

  applyStatsFilters(): void {
    this.applyStatsFiltersFromForm(this.statsFilterForm.value);
  }

  resetStatsFilters(): void {
    this.statsFilterForm.reset({ dateFrom: null, dateTo: null });
    this.isFilterAccordionOpen.set(false);
  }

  toggleStatsFilterAccordion(): void {
    this.isFilterAccordionOpen.update(isOpen => !isOpen);
  }

  hasActiveDateFilters(): boolean {
    const { dateFrom, dateTo } = this.dateFilters();
    return !!(dateFrom || dateTo);
  }

  private calculatePeriodStats(logs: WorkoutLog[]): void {
    this.workoutsInPeriodCount.set(logs.length);
    this.volumeInPeriod.set(this.statsService.calculateTotalVolumeForAllLogs(logs));
  }

  private async preparePeriodChartData(logs: WorkoutLog[]): Promise<void> {
    if (logs.length === 0 && this.hasActiveDateFilters()) {
      this.muscleGroupChartDataForPeriod.set([]);
      this.weeklyVolumeChartDataForPeriod.set([]);
      this.lineChartReferenceLines.set([]);
      return;
    }
    const musclePerf = await this.statsService.getPerformanceByMuscleGroup(logs);
    this.muscleGroupChartDataForPeriod.set(
      musclePerf.map(p => ({ name: this.toTitleCase(p.muscleGroup), value: p.volume }))
    );

    const weeklyVol = this.statsService.getWeeklyVolumeForChart(logs);
    if (weeklyVol.length > 0) {
      const seriesData = weeklyVol.map(wv => ({ name: wv.weekLabel, value: wv.totalVolume }));
      this.weeklyVolumeChartDataForPeriod.set([{ name: 'Total Volume', series: seriesData }]);
      const totalVolume = seriesData.reduce((sum, item) => sum + item.value, 0);
      const averageVolume = totalVolume / seriesData.length;
      this.lineChartReferenceLines.set([{ name: `Avg: ${averageVolume.toFixed(0)}`, value: averageVolume }]);
    } else {
      this.weeklyVolumeChartDataForPeriod.set([]);
      this.lineChartReferenceLines.set([]);
    }
  }

  private preparePeriodTableData(logs: WorkoutLog[]): void {
    if (logs.length === 0 && this.hasActiveDateFilters()) {
      this.weeklySummariesTableDataForPeriod.set([]);
      this.muscleGroupPerformanceTableDataForPeriod.set([]);
      return;
    }
    this.weeklySummariesTableDataForPeriod.set(this.statsService.getWeeklySummaries(logs));
    this.statsService.getPerformanceByMuscleGroup(logs).then(perf => {
      this.muscleGroupPerformanceTableDataForPeriod.set(
        perf.map(p => ({ ...p, muscleGroup: this.toTitleCase(p.muscleGroup) }))
      );
    });
  }

  private toTitleCase(str: string): string {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  yAxisTickFormat(value: any): string {
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'k';
    }
    return value.toLocaleString();
  }

  onChartSelect(event: any): void {
    console.log('Chart item selected:', event);
  }

  isSameDate(date1?: Date, date2?: Date): boolean {
    if (!date1 || !date2) return true;
    return isSameDay(date1, date2);
  }

  get hasWeeklyVolumeChartData(): boolean {
    const chartData = this.weeklyVolumeChartDataForPeriod();
    return chartData.length > 0 && chartData[0]?.series?.length > 1;
  }

  @HostListener('window:resize')
  onResize() {
    this.updateWeeklyContainerView();
  }

  // --- UPDATED: Renamed for clarity ---
  private updateWeeklyContainerView(): void {
    if (this.weeklyChartWrapperRef?.nativeElement) {
      const width = this.weeklyChartWrapperRef.nativeElement.offsetWidth;
      const chartContentWidth = Math.max(width - 20, 100);
      this.weeklyContainerView.set([chartContentWidth, this.chartHeight]);
    }
  }

  goToPBs(): void {
    this.router.navigate(['profile/personal-bests']);
  }

  browseRoutines(): void {
    this.router.navigate(['/workout']);
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
    this.filterFormSub?.unsubscribe();
  }
}