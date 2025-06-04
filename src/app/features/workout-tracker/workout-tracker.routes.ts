import { Routes } from "@angular/router";
import { WorkoutBuilderComponent } from "./workout-builder";
import { WorkoutPlayerComponent } from "./workout-player";
import { RoutineListComponent } from "./routine-list";


export const WORKOUT_TRACKER_ROUTES: Routes = [
  { path: '', component: RoutineListComponent }, // Default view: list of routines
  { path: 'new', component: WorkoutBuilderComponent }, // Create new
  { path: 'edit/:routineId', component: WorkoutBuilderComponent }, // Edit existing
  {
    path: 'play/:routineId', // For playing/tracking a routine
    component: WorkoutPlayerComponent,
    title: 'Workout Session'
  }
];