// src/app/features/history-stats/history-stats.routes.ts
import { Routes } from '@angular/router';
import { HistoryListComponent } from './history-list/history-list'; // Assuming path is correct
import { WorkoutLogDetailComponent } from './workout-log-detail/workout-log-detail'; // Assuming path is correct
import { StatsDashboardComponent } from './stats-dashboard/stats-dashboard'; // Assuming path is correct

export const HISTORY_STATS_ROUTES: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' }, // Default to history list
  {
    path: 'list', // Changed from 'history' to 'list' to avoid conflict with parent 'history' path
    component: HistoryListComponent,
    title: 'Workout History'
  },
  {
    path: 'log/:logId', // For viewing a specific log
    component: WorkoutLogDetailComponent,
    title: 'Workout Details',
    data: { showPausedWorkoutBanner: false}
  },
  {
    path: 'dashboard', // Changed from 'stats' to 'dashboard'
    component: StatsDashboardComponent,
    title: 'My Stats',
    data: { showPausedWorkoutBanner: false}
  }
];