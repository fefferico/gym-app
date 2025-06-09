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
    data: { mode: 'new' },
    title: 'New Training Program'
  },
  {
    path: 'edit/:programId',
    loadComponent: () => import('./training-program-builder/training-program-builder').then(m => m.TrainingProgramBuilderComponent),
    data: { mode: 'edit' },
    title: 'Edit Training Program'
  },
  {
    path: 'view/:programId',
    loadComponent: () => import('./training-program-builder/training-program-builder').then(m => m.TrainingProgramBuilderComponent),
    data: { mode: 'view' },
    title: 'View Training Program'
  }
];