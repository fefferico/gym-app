// src/app/features/history-stats/stats-dashboard.ts
import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectionStrategy, effect, ViewChild, ElementRef, afterNextRender, HostListener, PLATFORM_ID } from '@angular/core';
import { CommonModule, TitleCasePipe, DecimalPipe, DatePipe, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms'; // Import ReactiveFormsModule
import { distinctUntilChanged, Subscription } from 'rxjs';
// No need for startWith, distinctUntilChanged from rxjs/operators if using signals directly for form values
import { parseISO, isValid, format, isSameDay } from 'date-fns'; // isSameDay was already here

import { NgxChartsModule } from '@swimlane/ngx-charts';

import { MuscleGroupPerformance, StatsService, WeeklySummary, DatedVolume, StreakInfo } from '../../../core/services/stats.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { WorkoutLog } from '../../../core/models/workout-log.model';
import { UnitsService } from '../../../core/services/units.service';

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
    ReactiveFormsModule // Add ReactiveFormsModule here
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

  @ViewChild('muscleGroupChartWrapper') muscleGroupChartWrapperRef!: ElementRef<HTMLDivElement>;

  view = signal<[number, number] | undefined>(undefined); // Initialize as undefined or a default mobile size
  chartHeight = 300; // Keep height constant

  allLogs = signal<WorkoutLog[]>([]);
  statsFilterForm!: FormGroup; // For the date filters

  // Signal to hold the parsed date filters
  private dateFilters = signal<{ dateFrom: Date | null; dateTo: Date | null }>({
    dateFrom: null,
    dateTo: null,
  });

  isStatsFilterAccordionOpen = signal(false); // For the filter accordion

  // Computed signal for logs filtered by date
  filteredLogsForStats = computed(() => {
    const logs = this.allLogs();
    const { dateFrom, dateTo } = this.dateFilters();

    // console.log('Stats Dashboard: Filtering logs. Date From:', dateFrom, 'Date To:', dateTo);

    if (!dateFrom && !dateTo) {
      // console.log('Stats Dashboard: No date filters, returning all logs:', logs.length);
      return logs; // No date filters applied, return all logs
    }

    return logs.filter(log => {
      const logDate = parseISO(log.date); // log.date is 'YYYY-MM-DD' string
      let match = true;

      if (dateFrom && isValid(dateFrom)) {
        // Compare start of logDate with start of dateFrom
        const normalizedLogDate = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        const normalizedDateFrom = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate());
        match &&= normalizedLogDate >= normalizedDateFrom;
      }
      if (dateTo && isValid(dateTo)) {
        // Compare start of logDate with start of dateTo (inclusive of dateTo)
        const normalizedLogDate = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        const normalizedDateTo = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate());
        match &&= normalizedLogDate <= normalizedDateTo;
      }
      return match;
    });
  });

  // Signals for stats - these will now be driven by an effect watching filteredLogsForStats
  workoutsInPeriodCount = signal<number>(0);
  volumeInPeriod = signal<number>(0);
  muscleGroupChartDataForPeriod = signal<ChartDataPoint[]>([]);
  weeklyVolumeChartDataForPeriod = signal<ChartSeries[]>([]);
  weeklySummariesTableDataForPeriod = signal<WeeklySummary[]>([]);
  muscleGroupPerformanceTableDataForPeriod = signal<MuscleGroupPerformance[]>([]);

  // Streaks are always calculated on all logs
  currentWorkoutStreakInfo = signal<StreakInfo>({ length: 0 });
  longestWorkoutStreakInfo = signal<StreakInfo>({ length: 0 });

  private logsSub?: Subscription;
  private filterFormSub?: Subscription; // Subscription for filter form changes

  // Chart options (same as before)
  showXAxis = true; showYAxis = true; gradient = false; showXAxisLabel = true;
  xAxisLabelMuscle = 'Muscle Group'; xAxisLabelWeek = 'Week';
  showYAxisLabel = true; yAxisLabelVolume = 'Total Volume (kg)'; colorScheme = 'vivid';


  constructor() {
    this.statsFilterForm = this.fb.group({
      dateFrom: [null as string | null], // Initialize with null, store as YYYY-MM-DD string
      dateTo: [null as string | null]
    });

    // Effect to re-calculate stats whenever filteredLogsForStats changes
    effect(async () => { // Make effect async to use await inside
      const logsToProcess = this.filteredLogsForStats();
      console.log('StatsDashboard Effect: Processing stats for', logsToProcess.length, 'filtered logs.');
      this.calculatePeriodStats(logsToProcess);
      // Chart and table data preparations might involve async calls (like getPerformanceByMuscleGroup)
      await this.preparePeriodChartData(logsToProcess); // Make this async
      this.preparePeriodTableData(logsToProcess);     // Make this async if it contains async calls too
    });

    afterNextRender(() => { // Ensure the view is rendered before accessing ElementRef
      this.updateChartView();
    });
  }

  private platformId = inject(PLATFORM_ID); // Inject PLATFORM_ID

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) { // Check if running in a browser
      window.scrollTo(0, 0);
    }
    this.logsSub = this.trackingService.workoutLogs$.subscribe(allLogsData => {
      console.log('StatsDashboard: Received allLogsData update - count:', allLogsData.length);
      this.allLogs.set(allLogsData); // This will trigger the effect for initial calculation

      // Streaks are based on all logs, not the filtered period
      this.currentWorkoutStreakInfo.set(this.statsService.calculateCurrentWorkoutStreak(allLogsData));
      this.longestWorkoutStreakInfo.set(this.statsService.calculateLongestWorkoutStreak(allLogsData));
    });

    // Subscribe to form changes to update the dateFilters signal
    this.filterFormSub = this.statsFilterForm.valueChanges.pipe(
      // startWith(this.statsFilterForm.value), // Trigger initial filter application
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    ).subscribe(formValues => {
      this.applyStatsFiltersFromForm(formValues);
    });
    // Apply initial filter values (which are null) to trigger the effect once logs are loaded
    this.applyStatsFiltersFromForm(this.statsFilterForm.value);
  }

  // Called by the "Apply Filters" button and form valueChanges
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
      alert("'From Date' cannot be after 'To Date'. Filters not applied.");
      // Optionally reset form or just don't update the signal
      // this.statsFilterForm.reset({ dateFrom: null, dateTo: null }, { emitEvent: false }); // Avoid loop
      // this.dateFilters.set({ dateFrom: null, dateTo: null });
      return; // Don't update dateFilters signal if range is invalid
    }

    console.log('StatsDashboard: Applying filters - From:', dateFromObj, 'To:', dateToObj);
    this.dateFilters.set({ dateFrom: dateFromObj, dateTo: dateToObj });
  }

  // This is for the explicit button click, mainly for user interaction clarity
  applyStatsFilters(): void {
    this.applyStatsFiltersFromForm(this.statsFilterForm.value);
  }

  resetStatsFilters(): void {
    this.statsFilterForm.reset({ dateFrom: null, dateTo: null });
    // The valueChanges subscription will call applyStatsFiltersFromForm with nulls,
    // which will update this.dateFilters.set({ dateFrom: null, dateTo: null });
    this.isStatsFilterAccordionOpen.set(false);
  }

  toggleStatsFilterAccordion(): void {
    this.isStatsFilterAccordionOpen.update(isOpen => !isOpen);
  }

  hasActiveDateFilters(): boolean {
    const { dateFrom, dateTo } = this.dateFilters();
    return !!(dateFrom || dateTo);
  }

  private calculatePeriodStats(logs: WorkoutLog[]): void {
    this.workoutsInPeriodCount.set(logs.length);
    this.volumeInPeriod.set(this.statsService.calculateTotalVolumeForAllLogs(logs));
  }

  private async preparePeriodChartData(logs: WorkoutLog[]): Promise<void> { // Made async
    if (logs.length === 0 && this.hasActiveDateFilters()) {
      this.muscleGroupChartDataForPeriod.set([]);
      this.weeklyVolumeChartDataForPeriod.set([]);
      return;
    }
    const musclePerf = await this.statsService.getPerformanceByMuscleGroup(logs);
    this.muscleGroupChartDataForPeriod.set(
      musclePerf.map(p => ({ name: this.toTitleCase(p.muscleGroup), value: p.volume }))
    );

    const weeklyVol = this.statsService.getWeeklyVolumeForChart(logs);
    this.weeklyVolumeChartDataForPeriod.set(
      weeklyVol.length > 0 ? [{
        name: 'Total Volume',
        series: weeklyVol.map(wv => ({ name: wv.weekLabel, value: wv.totalVolume }))
      }] : []
    );
  }

  private preparePeriodTableData(logs: WorkoutLog[]): void { // Could be async if getPerformanceByMuscleGroup is called here
    if (logs.length === 0 && this.hasActiveDateFilters()) {
      this.weeklySummariesTableDataForPeriod.set([]);
      this.muscleGroupPerformanceTableDataForPeriod.set([]);
      return;
    }
    this.weeklySummariesTableDataForPeriod.set(this.statsService.getWeeklySummaries(logs));
    // this.statsService.getPerformanceByMuscleGroup(logs).then(perf => { // Already done in preparePeriodChartData
    //   this.muscleGroupPerformanceTableDataForPeriod.set(
    //     perf.map(p => ({...p, muscleGroup: this.toTitleCase(p.muscleGroup)}))
    //   );
    // });
    // If muscleGroupChartDataForPeriod is already populated, we can derive table data from it
    // or ensure getPerformanceByMuscleGroup is called once and results shared.
    // For simplicity, let's assume preparePeriodChartData has already set the data
    // Or, more robustly, make a dedicated call for the table if needed
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

  onChartSelect(event: any): void {
    console.log('Chart item selected:', event);
  }

  isSameDate(date1?: Date, date2?: Date): boolean { // Already present
    if (!date1 || !date2) return true;
    return isSameDay(date1, date2);
  }

  get hasWeeklyVolumeChartData(): boolean {
    const chartData = this.weeklyVolumeChartDataForPeriod(); // Get the signal's value
    return chartData.length > 0 &&
      chartData[0] &&
      chartData[0].series &&
      chartData[0].series.length > 0;
  }

  @HostListener('window:resize')
  onResize() {
    this.updateChartView();
  }

  private updateChartView(): void {
    if (this.muscleGroupChartWrapperRef?.nativeElement) {
      const width = this.muscleGroupChartWrapperRef.nativeElement.offsetWidth;
      // Subtract some padding/margin if the chart itself shouldn't use the full offsetWidth
      const chartContentWidth = Math.max(width - 20, 100); // Example: subtract 20px, min width 100
      this.view.set([chartContentWidth, this.chartHeight]);
    } else if (!this.view()) { // Set a default if elementRef not ready on init
      this.view.set([300, this.chartHeight]); // A small default
    }
  }

  goToPBs(): void {
    this.router.navigate(['profile/personal-bests']);
  }


  ngOnDestroy(): void {
    this.logsSub?.unsubscribe();
    this.filterFormSub?.unsubscribe();
  }
}