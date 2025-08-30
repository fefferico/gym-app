// src/app/features/training-programs/training-program.routes.ts
import { Routes } from '@angular/router';
import { TrainingProgramListComponent } from './training-program-list/training-program-list';

export const TRAINING_PROGRAM_ROUTES: Routes = [
  {
    path: '',
    component: TrainingProgramListComponent,
    title: 'Training Programs'
  },
  {
    path: 'new',
    loadComponent: () => import('./training-program-builder/training-program-builder').then(m => m.TrainingProgramBuilderComponent),
    data: { mode: 'new', showPausedWorkoutBanner: false },
    title: 'New Training Program'
  },
  {
    path: 'edit/:programId',
    loadComponent: () => import('./training-program-builder/training-program-builder').then(m => m.TrainingProgramBuilderComponent),
    data: { mode: 'edit', showPausedWorkoutBanner: false },
    title: 'Edit Training Program'
  },
  {
    path: 'view/:programId',
    loadComponent: () => import('./training-program-builder/training-program-builder').then(m => m.TrainingProgramBuilderComponent),
    data: { mode: 'view', showPausedWorkoutBanner: false },
    title: 'View Training Program'
  },
  {
    path: 'completed/:programId',
    loadComponent: () => import('./program-completion.component').then(m => m.ProgramCompletionComponent),
    data: { mode: 'view', showPausedWorkoutBanner: false },
    title: 'Program Completed'
  }
];