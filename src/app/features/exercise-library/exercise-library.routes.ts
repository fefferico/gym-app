// src/app/features/exercise-library/exercise-library.routes.ts
import { Routes } from '@angular/router';
import { ExerciseListComponent } from './exercise-list';
import { ExerciseDetailComponent } from './exercise-detail';
import { ExerciseFormComponent } from './exercise-form/exercise-form';

export const EXERCISE_LIBRARY_ROUTES: Routes = [
  {
    path: '',
    component: ExerciseListComponent,
    title: 'Exercise Library'
  },
  {
    path: 'new', // Route for creating a new exercise
    component: ExerciseFormComponent,
    title: 'Add New Exercise'
  },
  {
    path: 'edit/:id', // Route for editing an existing exercise
    component: ExerciseFormComponent,
    title: 'Edit Exercise'
  },
  {
    path: ':id',
    component: ExerciseDetailComponent,
    title: 'Exercise Details'
  }
];