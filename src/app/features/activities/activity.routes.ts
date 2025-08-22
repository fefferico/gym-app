// src/app/features/activities/activity.routes.ts
import { Routes } from '@angular/router';

export const ACTIVITY_ROUTES: Routes = [
  {
    // When a user navigates to '/activities', we'll redirect them
    // straight to the logging page for now.
    path: '',
    redirectTo: 'log',
    pathMatch: 'full'
  },
  {
    path: 'log',
    loadComponent: () => import('./log-activity/log-activity.component').then(m => m.LogActivityComponent),
    title: 'Log Activity'
  },
  // Future routes can be added here, for example:
  // {
  //   path: 'history',
  //   loadComponent: () => import('./activity-history/activity-history.component').then(m => m.ActivityHistoryComponent),
  //   title: 'Activity History'
  // }

   {
    path: 'log/:id', // The details view
    loadComponent: () => import('./activity-log-details/activity-log-details.component').then(m => m.ActivityLogDetailsComponent),
    title: 'Activity Details'
  },
  {
    path: 'log/edit/:id', // The edit view
    // For now, it reuses the logging component, which you can later adapt to handle an "edit" mode.
    loadComponent: () => import('./log-activity/log-activity.component').then(m => m.LogActivityComponent),
    data: { mode: 'edit' },
    title: 'Edit Activity Log'
  }
];