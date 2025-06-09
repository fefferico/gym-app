import { Component, inject, Input, OnInit, signal, OnDestroy } from '@angular/core'; // Added OnDestroy
import { CommonModule, TitleCasePipe, DatePipe } from '@angular/common'; // Added DatePipe
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, of, Subscription, forkJoin, map, take, tap } from 'rxjs'; // Added Subscription, forkJoin
import { Exercise } from '../../core/models/exercise.model';
import { ExerciseService } from '../../core/services/exercise.service';
import { TrackingService, ExercisePerformanceDataPoint } from '../../core/services/tracking.service'; // Import new type
import { PersonalBestSet } from '../../core/models/workout-log.model';

import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts'; // Import NgxChartsModule and ScaleType
import { ChartDataPoint, ChartSeries } from '../../features/history-stats/stats-dashboard/stats-dashboard'; // Reuse chart types if suitable
import { AlertService } from '../../core/services/alert.service';
import { AlertButton } from '../../core/models/alert.model';

@Component({
  selector: 'app-exercise-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, NgxChartsModule], // Added DatePipe, NgxChartsModule
  templateUrl: './exercise-detail.html',
  styleUrl: './exercise-detail.scss',
})
export class ExerciseDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router); // Inject Router if you want to navigate from chart clicks
  private exerciseService = inject(ExerciseService);
  protected trackingService = inject(TrackingService); // Inject TrackingService
  private alertService = inject(AlertService); // Inject AlertService

  // Using a signal for the exercise data
  exercise = signal<Exercise | undefined | null>(undefined);
  // For image carousel
  currentImageIndex = signal<number>(0);
  exercisePBs = signal<PersonalBestSet[]>([]); // New signal for PBs

  exerciseProgressChartData = signal<ChartSeries[]>([]);
  private exerciseDetailSub?: Subscription;
  // Chart options
  progressChartView: [number, number] = [700, 300]; // Default view size
  progressChartColorScheme = 'cool';
  // progressChartColorScheme = { domain: ['#06b6d4'] }; // Example: Using your primary color
  progressChartXAxisLabel = 'Date';
  progressChartYAxisLabel = 'Max Weight Lifted (kg)';
  progressChartShowXAxis = true;
  progressChartShowYAxis = true;
  progressChartGradient = false;
  progressChartShowXAxisLabel = true;
  progressChartShowYAxisLabel = true;
  progressChartTimeline = true; // Important for date-based X-axis
  progressChartAutoScale = true;

  @Input() id?: string; // For route parameter binding

  ngOnInit(): void {
    window.scrollTo(0, 0);
    const idSource$ = this.id ? of(this.id) : this.route.paramMap.pipe(map(params => params.get('id')));

    this.exerciseDetailSub = idSource$.pipe(
      tap(exerciseId => { // Reset data when ID changes
        this.exercise.set(undefined);
        this.exercisePBs.set([]);
        this.exerciseProgressChartData.set([]);
        if (exerciseId) {
          this.loadExerciseData(exerciseId);
        } else {
          this.exercise.set(null); // No ID, so exercise not found
        }
      })
    ).subscribe();
  }

  loadExercise(exerciseId: string): void {
    this.exerciseService.getExerciseById(exerciseId).subscribe(ex => {
      this.exercise.set(ex || null);
      this.currentImageIndex.set(0);
    });
  }

  nextImage(): void {
    const ex = this.exercise();
    if (ex && ex.imageUrls.length > 1) {
      this.currentImageIndex.update(index => (index + 1) % ex.imageUrls.length);
    }
  }

  prevImage(): void {
    const ex = this.exercise();
    if (ex && ex.imageUrls.length > 1) {
      this.currentImageIndex.update(index => (index - 1 + ex.imageUrls.length) % ex.imageUrls.length);
    }
  }

  // Method to load PBs for the current exercise
  private loadExercisePBs(exerciseId: string): void {
    this.trackingService.getAllPersonalBestsForExercise(exerciseId)
      .pipe(take(1)) // Take the first emission and complete
      .subscribe(pbs => {
        // Sort PBs for consistent display, e.g., by type or weight
        const sortedPBs = pbs.sort((a, b) => {
          // Example sort: "XRM (Actual)" first, then "XRM (Estimated)", then others
          // This is a basic sort, can be made more sophisticated
          if (a.pbType.includes('RM (Actual)') && !b.pbType.includes('RM (Actual)')) return -1;
          if (!a.pbType.includes('RM (Actual)') && b.pbType.includes('RM (Actual)')) return 1;
          if (a.pbType.includes('RM (Estimated)') && !b.pbType.includes('RM (Estimated)')) return -1;
          if (!a.pbType.includes('RM (Estimated)') && b.pbType.includes('RM (Estimated)')) return 1;
          return (b.weightUsed ?? 0) - (a.weightUsed ?? 0) || a.pbType.localeCompare(b.pbType);
        });
        this.exercisePBs.set(sortedPBs);
        console.log(`PBs for ${exerciseId}:`, sortedPBs);
      });
  }

  // Helper function to format PB display (can be moved to a pipe later)
  formatPbValue(pb: PersonalBestSet): string {
    let value = '';
    if (pb.weightUsed !== undefined && pb.weightUsed !== null) {
      value += `${pb.weightUsed}kg`;
      if (pb.repsAchieved > 1 && !pb.pbType.includes('RM (Actual)') && !pb.pbType.includes('RM (Estimated)')) {
        // Show reps for "Heaviest Lifted" if reps > 1, but not for explicit 1RMs where reps is 1 by definition
        value += ` x ${pb.repsAchieved}`;
      } else if (pb.repsAchieved > 1 && pb.pbType === "Heaviest Lifted") {
        value += ` x ${pb.repsAchieved}`;
      }
    } else if (pb.repsAchieved > 0 && pb.pbType.includes('Max Reps')) {
      value = `${pb.repsAchieved} reps`;
    } else if (pb.durationPerformed && pb.durationPerformed > 0 && pb.pbType.includes('Max Duration')) {
      value = `${pb.durationPerformed}s`;
    }
    return value || 'N/A';
  }

  private loadExerciseData(exerciseId: string): void {
    // Use forkJoin to load base exercise, PBs, and progress data concurrently
    forkJoin({
      baseExercise: this.exerciseService.getExerciseById(exerciseId).pipe(take(1)),
      pbs: this.trackingService.getAllPersonalBestsForExercise(exerciseId).pipe(take(1)),
      progress: this.trackingService.getExercisePerformanceHistory(exerciseId).pipe(take(1))
    }).subscribe(({ baseExercise, pbs, progress }) => {
      this.exercise.set(baseExercise || null);
      this.currentImageIndex.set(0);
//      // Sort PBs (existing logic)
      const sortedPBs = pbs.sort((a, b) => /* your sorting logic */(b.weightUsed ?? 0) - (a.weightUsed ?? 0) || a.pbType.localeCompare(b.pbType));
      this.exercisePBs.set(sortedPBs);
//      // Prepare data for progress chart
      if (progress && progress.length > 0) {
        this.exerciseProgressChartData.set([
          {
            name: baseExercise?.name || 'Max Weight', // Series name
            series: progress.map(p => ({
              name: p.date, // ngx-charts will handle date formatting on axis
              value: p.value, // Max weight
              // You can add extra data here if you want to use it in tooltips or click events
              extra: { reps: p.reps, logId: p.logId }
            }))
          }
        ]);
      } else {
        this.exerciseProgressChartData.set([]); // Ensure empty if no progress data
      }
    }, error => {
      console.error("Error loading exercise details page data:", error);
      this.exercise.set(null); // Set to null on error to show "not found" or error state
    });
  }

  // Chart click handler (optional)
  onProgressChartSelect(event: any): void {
    console.log('Progress chart item selected:', event);
    // Example: navigate to the specific workout log if logId is in event.extra
    if (event.extra && event.extra.logId) {
      //this.router.navigate(['/history/log', event.extra.logId]);
    }
  }

  get hasSufficientProgressData(): boolean {
    const chartData = this.exerciseProgressChartData();
    return chartData.length > 0 &&
      chartData[0] &&
      chartData[0].series &&
      chartData[0].series.length > 1; // Ensure more than 1 point for a line
  }

  async confirmDeleteExercise(exerciseToDelete: Exercise): Promise<void> {
    if (!exerciseToDelete) return;

    // Step 1: Check if the exercise is used in any workout logs.
    // This requires TrackingService to have a method like isExerciseUsedInLogs(exerciseId): Observable<boolean>
    // For simplicity now, let's assume we always show a detailed warning.
    // A more advanced check would involve:
    // const isUsed = await firstValueFrom(this.trackingService.isExerciseUsedInLogs(exerciseToDelete.id));

    const customBtns: AlertButton[] = [{
          text: 'Cancel',
          role: 'cancel',
          data: false,
          cssClass: 'bg-gray-300 hover:bg-gray-500' // Example custom class
        } as AlertButton,
        {
          text: 'Delete Exercise',
          role: 'confirm',
          data: true,
          cssClass: 'button-danger'
        } as AlertButton];

    const confirmation = await this.alertService.showConfirmationDialog(
      'Confirm Deletion',
      `Are you sure you want to delete the exercise "${exerciseToDelete.name}"? 
      If this exercise is part of any past workout logs, it will be removed from those logs. 
      If a log becomes empty as a result, the entire log might be deleted. This action cannot be undone.`,
      customBtns
    );

    if (confirmation && confirmation.data === true) {
      try {
        await this.exerciseService.deleteExercise(exerciseToDelete.id);
        this.alertService.showAlert('Success', `Exercise "${exerciseToDelete.name}" deleted successfully.`);
        this.router.navigate(['/library']);
      } catch (error) {
        console.error('Error deleting exercise:', error);
        this.alertService.showAlert('Error', `Failed to delete exercise: ${(error as Error).message || 'Unknown error'}`);
      }
    }
  }

  ngOnDestroy(): void {
    this.exerciseDetailSub?.unsubscribe();
  }
}