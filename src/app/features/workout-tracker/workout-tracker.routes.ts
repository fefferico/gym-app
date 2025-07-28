// src/app/features/workout-tracker/workout-tracker.routes.ts
import { Routes } from '@angular/router';
import { RoutineListComponent } from './routine-list';
import { WorkoutBuilderComponent } from './workout-builder'; // This now serves multiple purposes
import { WorkoutPlayerComponent } from './workout-player';
import { WorkoutSummaryComponent } from './workout-summary/workout-summary';
import { KettleBellWorkoutTrackerComponent } from '../../kb-workout-tracker/kb-workout-tracker';

export const WORKOUT_TRACKER_ROUTES: Routes = [
  {
    path: '',
    component: RoutineListComponent,
    title: 'My Routines'
  },
  // --- Routine Builder Routes ---
  {
    path: 'routine/new', // Changed path for clarity
    component: WorkoutBuilderComponent,
    data: { mode: 'routineBuilder', isNew: true }, // Pass mode and isNew
    title: 'Create New Routine'
  },
    {
    path: 'routine/new-from-log/:logId',
    component: WorkoutBuilderComponent,
    data: { mode: 'routineBuilder', isNew: true },
    title: 'Create New Routine'
  },
  {
    path: 'routine/edit/:routineId', // Changed path for clarity
    component: WorkoutBuilderComponent,
    data: { mode: 'routineBuilder', isNew: false }, // Pass mode and isNew
    title: 'Edit Routine'
  },
  {
    path: 'routine/view/:routineId', // Changed path for clarity
    component: WorkoutBuilderComponent,
    data: { mode: 'routineBuilder', isNew: false, isView: true }, // Pass mode, isNew, and isView
    title: 'View Routine'
  },
  // --- Manual Log Entry Routes ---
  {
    path: 'log/manual/new', // New path for creating a manual log
    component: WorkoutBuilderComponent,
    data: { mode: 'manualLogEntry', isNew: true },
    title: 'Log Past Workout'
  },
  {
    path: 'log/manual/new/from/:routineId', // New path for creating a manual log prefilled from a routine
    component: WorkoutBuilderComponent,
    data: { mode: 'manualLogEntry', isNew: true, prefillFromRoutine: true }, // Indicate prefill
    title: 'Log Workout from Routine'
  },
  {
    path: 'log/manual/edit/:logId', // New path for editing a manual log
    component: WorkoutBuilderComponent,
    data: { mode: 'manualLogEntry', isNew: false },
    title: 'Edit Workout Log'
  },
  // --- Player and Summary Routes ---
  {
    path: 'play',
    component: WorkoutPlayerComponent,
    data: { mode: 'newRoutine', isNew: false },
    title: 'Workout Session'
  },
  {
    path: 'play/:routineId',
    component: WorkoutPlayerComponent,
    title: 'Workout Session'
  },
  {
    path: 'summary/:logId',
    component: WorkoutSummaryComponent,
    title: 'Workout Summary'
  },
  {
    path: 'routine/kb-workout-tracker',
    component: KettleBellWorkoutTrackerComponent
  },
];