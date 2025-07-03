import { Component, inject, Input, OnInit, signal, OnDestroy, PLATFORM_ID } from '@angular/core'; // Added OnDestroy
import { CommonModule, TitleCasePipe, DatePipe, isPlatformBrowser } from '@angular/common'; // Added DatePipe
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
import { ActionMenuComponent } from '../../shared/components/action-menu/action-menu';
import { ActionMenuItem } from '../../core/models/action-menu.model';

@Component({
  selector: 'app-exercise-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, NgxChartsModule, ActionMenuComponent], // Added DatePipe, NgxChartsModule
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
  @Input() isModal?: boolean = false; // For route parameter binding
  private platformId = inject(PLATFORM_ID); // Inject PLATFORM_ID

  isViewMode = signal<boolean | null>(null);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) { // Check if running in a browser
      if (!this.isModal) { // Only scroll if not in a modal
        window.scrollTo(0, 0);
      }
    }
    const idSource$ = this.id ? of(this.id) : this.route.paramMap.pipe(map(params => params.get('id')));

    this.exerciseDetailSub = idSource$.pipe(
      tap(exerciseId => { // Reset data when ID changes
        this.exercise.set(undefined);
        this.exercisePBs.set([]);
        this.exerciseProgressChartData.set([]);
        if (exerciseId) {
          this.isViewMode.set(true);
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



  getExerciseDropdownActionItems(routineId: string, mode: 'dropdown' | 'compact-bar'): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';;

    const editButton = {
      label: 'EDIT',
      actionKey: 'edit',
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    };

    const deleteButton = {
      label: 'DELETE',
      actionKey: 'delete',
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.177-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5Zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5Z" clip-rule="evenodd" /></svg>`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
      data: { routineId }
    };

    const currentExercise = this.exercise;

    const actionsArray = [
    ];

    if (this.isViewMode()) {
      actionsArray.push(editButton);
      actionsArray.push({isDivider: true});
    }
    actionsArray.push(deleteButton);


    return actionsArray;
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }, originalMouseEvent?: MouseEvent): void {
    // originalMouseEvent.stopPropagation(); // Stop original event that opened the menuù
    const currentExercise = this.exercise();
    const exerciseId = currentExercise?.id;
    if (!exerciseId) return;

    switch (event.actionKey) {
      case 'edit':
        this.router.navigate(['/library/edit/', exerciseId]);
        break;
      case 'delete':
        this.confirmDeleteExercise(currentExercise);
        break;
    }
    this.activeRoutineIdActions.set(null); // Close the menu
  }

  // Your existing toggleActions, areActionsVisible, viewRoutineDetails, etc. methods
  // The toggleActions will now just control a signal like `activeRoutineIdActions`
  // which is used to show/hide the <app-action-menu>
  activeRoutineIdActions = signal<string | null>(null); // Store ID of routine whose actions are open

  toggleActions(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeRoutineIdActions.update(current => (current === routineId ? null : routineId));
  }

  areActionsVisible(routineId: string): boolean {
    return this.activeRoutineIdActions() === routineId;
  }
  // When closing menu from the component's output
  onCloseActionMenu() {
    this.activeRoutineIdActions.set(null);
  }

}