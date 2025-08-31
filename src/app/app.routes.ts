// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home/home';
import { KettleBellWorkoutTrackerComponent } from './kb-workout-tracker/kb-workout-tracker';

export const APP_ROUTES: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' }, 
  
  // The 'home' route is now the single source of truth for the HomeComponent.
  { path: 'home', component: HomeComponent,
    data: { showPausedWorkoutBanner: true, shouldShowNavigationBanner: true } }, 

  {
    path: 'workout',
    loadChildren: () => import('./features/workout-tracker/workout-tracker.routes') // Ensure this file exists
      .then(c => c.WORKOUT_TRACKER_ROUTES),
    data: { showPausedWorkoutBanner: true, shouldShowNavigationBanner: true }
  },
  {
    path: 'history',
    loadChildren: () => import('./features/history-stats/history-stats.routes') // Ensure this file exists
      .then(c => c.HISTORY_STATS_ROUTES),
    data: { showPausedWorkoutBanner: true, shouldShowNavigationBanner: true }
  },
  {
    path: 'library', // Main path for the library feature
    loadChildren: () => import('./features/exercise-library/exercise-library.routes') // Lazy load children routes
      .then(m => m.EXERCISE_LIBRARY_ROUTES),
    data: { shouldShowNavigationBanner: true }
  },
  {
    path: 'profile', // Main path for the profile feature
    loadChildren: () => import('./features/profile-settings/profile-settings.routes')
      .then(m => m.PROFILE_SETTINGS_ROUTES),
    data: { shouldShowNavigationBanner: true }
  },
  {
    path: 'profile/pb-trend/:exerciseId/:pbType',
    loadComponent: () => import('./features/profile-settings/pb-trend-chart/pb-trend-chart').then(m => m.PbTrendChartComponent),
    data: { shouldShowNavigationBanner: true }
    // Add canActivate guards if needed
  },
  {
    path: 'training-programs',
    loadChildren: () => import('./features/training-programs/training-program.routes').then(m => m.TRAINING_PROGRAM_ROUTES),
    data: { showPausedWorkoutBanner: true, shouldShowNavigationBanner: true }
  },
  {
    path: 'activities',
    loadChildren: () => import('./features/activities/activity.routes').then(m => m.ACTIVITY_ROUTES),
    data: { shouldShowNavigationBanner: true }
  },
  {
    path: 'personal-gym',
    loadChildren: () => import('./features/personal-gym/personal-gym.routes').then(m => m.PERSONAL_GYM_ROUTES),
    data: { shouldShowNavigationBanner: true }
  },
  { path: '**', redirectTo: '/home' },
];