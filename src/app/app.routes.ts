// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: 'workout',
    loadChildren: () => import('./features/workout-tracker/workout-tracker.routes') // Ensure this file exists
      .then(c => c.WORKOUT_TRACKER_ROUTES)
  },
  {
    path: 'history',
    loadComponent: () => import('./features/history-stats/history-placeholder/history-placeholder') // Ensure this file exists
      .then(c => c.HistoryPlaceholderComponent)
  },
 {
    path: 'library', // Main path for the library feature
    loadChildren: () => import('./features/exercise-library/exercise-library.routes') // Lazy load children routes
      .then(m => m.EXERCISE_LIBRARY_ROUTES)
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile-settings/profile-placeholder/profile-placeholder') // Ensure this file exists
      .then(c => c.ProfilePlaceholderComponent)
  },
  { path: '', redirectTo: '/workout', pathMatch: 'full' },
  { path: '**', redirectTo: '/workout' }
];