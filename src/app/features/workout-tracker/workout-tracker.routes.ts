// src/app/features/workout-tracker/workout-tracker.routes.ts
import { Routes } from '@angular/router';
import { RoutineListComponent } from './routine-list';
import { BuilderMode, WorkoutBuilderComponent } from './workout-builder'; // This now serves multiple purposes
import { WorkoutSummaryComponent } from './workout-summary/workout-summary';
import { KettleBellWorkoutTrackerComponent } from '../../kb-workout-tracker/kb-workout-tracker';
import { CompactWorkoutPlayerComponent } from './compact-workout-player/compact-workout-player.component';
import { TabataPlayerComponent } from './tabata-workout-player/tabata-workout-player.component';
import { FocusPlayerComponent } from './focus-workout-player/focus-workout-player.component';

export const WORKOUT_TRACKER_ROUTES: Routes = [
  {
    path: '',
    component: RoutineListComponent,
  data: { animation: 'RoutineListPage' },
    title: 'My Routines'
  },
  // --- Routine Builder Routes ---
  {
    path: 'routine/new', // Changed path for clarity
    component: WorkoutBuilderComponent,
    data: { mode: 'routineBuilder', isNew: true,showPausedWorkoutBanner: false }, // Pass mode and isNew
    title: 'Create New Routine'
  },
  {
    path: 'routine/new-from-log/:logId',
    component: WorkoutBuilderComponent,
    data: { mode: 'routineBuilder', isNew: true,showPausedWorkoutBanner: false },
    title: 'Create New Routine'
  },
  {
    path: 'routine/edit/:routineId', // Changed path for clarity
    component: WorkoutBuilderComponent,
    data: { mode: BuilderMode.routineBuilder, isNew: false,showPausedWorkoutBanner: false, animation: 'RoutineEditDetail' }, // Pass mode and isNew
    title: 'Edit Routine'
  },
  {
    path: 'routine/view/:routineId', // Changed path for clarity
    component: WorkoutBuilderComponent,
    data: { mode: 'routineBuilder', isNew: false, isView: true,showPausedWorkoutBanner: false, animation: 'RoutineViewDetail' }, // Pass mode, isNew, and isView
    title: 'View Routine'
  },
  // --- Manual Log Entry Routes ---
  {
    path: 'log/manual/new', // New path for creating a manual log
    component: WorkoutBuilderComponent,
    data: { mode: 'manualLogEntry', isNew: true,showPausedWorkoutBanner: false },
    title: 'Log Past Workout'
  },
  {
    path: 'log/manual/new/from/:routineId', // New path for creating a manual log prefilled from a routine
    component: WorkoutBuilderComponent,
    data: { mode: 'manualLogEntry', isNew: true, prefillFromRoutine: true,showPausedWorkoutBanner: false }, // Indicate prefill
    title: 'Log Workout from Routine'
  },
  {
    path: 'log/manual/edit/:logId', // New path for editing a manual log
    component: WorkoutBuilderComponent,
    data: { mode: 'manualLogEntry', isNew: false,showPausedWorkoutBanner: false },
    title: 'Edit Workout Log'
  },
  // --- Player and Summary Routes ---
  {
    path: 'play',
    component: CompactWorkoutPlayerComponent,
    data: { mode: 'newRoutine', isNew: false,showPausedWorkoutBanner: false, shouldShowNavigationBanner: false },
    title: 'Workout Session'
  },
  {
    path: 'play/:routineId',
    component: CompactWorkoutPlayerComponent,
    title: 'Workout Session',
    data: { showPausedWorkoutBanner: false, shouldShowNavigationBanner: false },
  },
  {
    path: 'summary/:logId',
    component: WorkoutSummaryComponent,
    title: 'Workout Summary',
    data: { showPausedWorkoutBanner: false}
  },
  {
    path: 'routine/kb-workout-tracker',
    component: KettleBellWorkoutTrackerComponent,
    data: { showPausedWorkoutBanner: false}
  },
  {
    path: 'play/compact/:routineId',
    component: CompactWorkoutPlayerComponent,
    data: { showPausedWorkoutBanner: false, shouldShowNavigationBanner: false}
  },
  {
    path: 'play/tabata/:routineId',
    component: TabataPlayerComponent,
    data: { showPausedWorkoutBanner: false, shouldShowNavigationBanner: false}
  },
  {
    path: 'play/focus/:routineId',
    component: FocusPlayerComponent,
    data: { showPausedWorkoutBanner: false, shouldShowNavigationBanner: false}
  },
];