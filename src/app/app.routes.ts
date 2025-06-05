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
    loadChildren: () => import('./features/history-stats/history-stats.routes') // Ensure this file exists
      .then(c => c.HISTORY_STATS_ROUTES)
  },
 {
    path: 'library', // Main path for the library feature
    loadChildren: () => import('./features/exercise-library/exercise-library.routes') // Lazy load children routes
      .then(m => m.EXERCISE_LIBRARY_ROUTES)
  },
  {
    path: 'profile', // Main path for the profile feature
    loadChildren: () => import('./features/profile-settings/profile-settings.routes')
      .then(m => m.PROFILE_SETTINGS_ROUTES)
  },
  { path: '', redirectTo: '/workout', pathMatch: 'full' },
  { path: '**', redirectTo: '/workout' }
];