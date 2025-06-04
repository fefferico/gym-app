import { Component, inject, OnInit, OnDestroy, signal, ChangeDetectionStrategy } from '@angular/core'; // Added ChangeDetectionStrategy
import { CommonModule, TitleCasePipe, DecimalPipe } from '@angular/common'; // Added DecimalPipe
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

// ngx-charts imports
import { NgxChartsModule, BarVerticalComponent, LineChartModule } from '@swimlane/ngx-charts'; // Import specific chart modules
// For ngx-charts, you might need BrowserAnimationsModule provided globally in app.config.ts (provideAnimations()) which we already have.

import { MuscleGroupPerformance, StatsService, WeeklySummary, DatedVolume } from '../../../core/services/stats.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { WorkoutLog } from '../../../core/models/workout-log.model';

// Define a simple structure for ngx-charts data
export interface ChartDataPoint {
  name: string;  // Label for X-axis or legend
  value: number; // Value for Y-axis
}

export interface ChartSeries {
  name: string; // Series name (for multi-series charts)
  series: ChartDataPoint[];
}


@Component({
  selector: 'app-stats-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TitleCasePipe, DecimalPipe, NgxChartsModule], // Added DecimalPipe
  templateUrl: './stats-dashboard.html',
  styleUrl: './stats-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush, // Good practice for components with async data
})
export class StatsDashboardComponent implements OnInit {
  private trackingService = inject(TrackingService);
  private statsService = inject(StatsService);

  allLogs = signal<WorkoutLog[]>([]);

  // Signals for overall stats (from your existing code)
  overallTotalVolume = signal<number>(0);
  overallWorkoutCount = signal<number>(0);

  // Signals for chart data
  muscleGroupChartData = signal<ChartDataPoint[]>([]);
  weeklyVolumeChartData = signal<ChartSeries[]>([]); // For line chart (multi-series format)

  // Signals for tabular data (from your existing code)
  weeklySummariesTableData = signal<WeeklySummary[]>([]); // Renamed to avoid conflict if used directly by chart
  muscleGroupPerformanceTableData = signal<MuscleGroupPerformance[]>([]); // Renamed

  private logsSub: Subscription | undefined;

  // Chart options (can be customized)
  view: [number, number] = [700, 300]; // Default view size [width, height]
  showXAxis = true;
  showYAxis = true;
  gradient = false;
  showLegend = true;
  showXAxisLabel = true;
  xAxisLabelMuscle = 'Muscle Group';
  xAxisLabelWeek = 'Week';
  showYAxisLabel = true;
  yAxisLabelVolume = 'Total Volume (kg)';
  colorScheme = 'vivid'; // ngx-charts color scheme (e.g., 'cool', 'night', 'forest')

  ngOnInit(): void {
    this.logsSub = this.trackingService.workoutLogs$.subscribe(logs => {
      this.allLogs.set(logs);
      this.calculateOverallStats(logs);
      this.prepareChartData(logs); // New method to prepare data for charts
      this.prepareTableData(logs); // New method for just table data
    });
  }

  private calculateOverallStats(logs: WorkoutLog[]): void {
    this.overallWorkoutCount.set(logs.length);
    this.overallTotalVolume.set(this.statsService.calculateTotalVolumeForAllLogs(logs));
  }

  private prepareTableData(logs: WorkoutLog[]): void {
    this.weeklySummariesTableData.set(this.statsService.getWeeklySummaries(logs));
    // This is async, so it will update when ready
    this.statsService.getPerformanceByMuscleGroup(logs).then(perf => {
      this.muscleGroupPerformanceTableData.set(perf);
    });
  }

  private async prepareChartData(logs: WorkoutLog[]): Promise<void> {
    // Muscle Group Performance (for Bar Chart)
    const musclePerf = await this.statsService.getPerformanceByMuscleGroup(logs);
    this.muscleGroupChartData.set(
      musclePerf.map(p => ({ name: p.muscleGroup, value: p.volume }))
    );

    // Weekly Volume (for Line Chart)
    const weeklyVol = this.statsService.getWeeklyVolumeForChart(logs); // New method in StatsService
    this.weeklyVolumeChartData.set([ // ngx-charts line chart expects an array of series
      {
        name: 'Total Volume',
        series: weeklyVol.map(wv => ({ name: wv.weekLabel, value: wv.totalVolume }))
      }
    ]);
  }

  /**
   * Handles the (select) event emitted by ngx-charts when a chart item is clicked.
   * @param event The event data emitted by the chart. Structure depends on chart type.
   *              For bar/line charts, it's often { name: string, value: number, series?: string }.
   */
  onChartSelect(event: any): void {
    console.log('Chart item selected:', event);
    // You can add logic here later, for example:
    // - Navigate to a more detailed view related to the selected item.
    // - Display more information in a tooltip or a separate section.
    // - Filter other data on the page based on the selection.

    // For now, just logging it is fine.
    if (event.name && event.value) {
      alert(`Selected: ${event.series || event.name} - Value: ${event.value}`);
    } else {
      alert(`Chart item clicked: ${JSON.stringify(event)}`);
    }
  }

  ngOnDestroy(): void {
    if (this.logsSub) {
      this.logsSub.unsubscribe();
    }
  }
}