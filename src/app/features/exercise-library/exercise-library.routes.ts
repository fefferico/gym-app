// src/app/features/exercise-library/exercise-library.routes.ts
import { Routes } from '@angular/router';
import { ExerciseListComponent } from './exercise-list';
import { ExerciseDetailComponent } from './exercise-detail';

export const EXERCISE_LIBRARY_ROUTES: Routes = [
  {
    path: '',
    component: ExerciseListComponent,
    title: 'Exercise Library' // Optional: For browser tab title
  },
  {
    path: ':id', // Route parameter for exercise ID
    component: ExerciseDetailComponent,
    title: 'Exercise Details' // Can be dynamically set later
  }
];