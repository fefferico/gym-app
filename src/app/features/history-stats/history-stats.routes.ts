// src/app/features/history-stats/history-stats.routes.ts
import { Routes } from '@angular/router';
import { HistoryListComponent } from './history-list/history-list';
import { WorkoutLogDetailComponent } from './workout-log-detail/workout-log-detail';
import { StatsDashboardComponent } from './stats-dashboard/stats-dashboard';
// import { StatsDashboardComponent } from './stats-dashboard.component'; // For later

export const HISTORY_STATS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'list', // Redirect empty path to the list
    pathMatch: 'full'
  },
  {
    path: 'list', // Explicit path for the list
    component: HistoryListComponent,
    title: 'Workout History'
  },
  {
    path: 'log/:logId', // Changed from just ':logId' to be more descriptive
    component: WorkoutLogDetailComponent,
    title: 'Workout Log Details'
  },
  {
    path: 'dashboard', // Path for the stats dashboard
    component: StatsDashboardComponent,
    title: 'My Stats'
  }
];