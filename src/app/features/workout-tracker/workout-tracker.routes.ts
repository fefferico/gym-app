// src/app/features/workout-tracker/workout-tracker.routes.ts
import { Routes } from '@angular/router';
import { RoutineListComponent } from './routine-list';
import { WorkoutBuilderComponent } from './workout-builder';
import { WorkoutPlayerComponent } from './workout-player'; // Assuming you have this for the /play route
import { WorkoutSummaryComponent } from './workout-summary/workout-summary'; // New component

export const WORKOUT_TRACKER_ROUTES: Routes = [
  {
    path: '',
    component: RoutineListComponent,
    title: 'My Routines'
  },
  {
    path: 'new',
    component: WorkoutBuilderComponent,
    title: 'Create New Routine'
  },
  {
    path: 'edit/:routineId',
    component: WorkoutBuilderComponent,
    title: 'Edit Routine'
  },
    {
    path: 'view/:routineId',
    component: WorkoutBuilderComponent,
    title: 'View Routine'
  },
  {
    path: 'play/:routineId', // Route for the player
    component: WorkoutPlayerComponent,
    title: 'Workout Session'
  },
  {
    path: 'summary/:logId', // New route for the summary
    component: WorkoutSummaryComponent,
    title: 'Workout Summary'
  }
];