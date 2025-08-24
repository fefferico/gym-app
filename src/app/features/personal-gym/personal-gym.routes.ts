// src/app/features/personal-gym/personal-gym.routes.ts
import { Routes } from '@angular/router';
import { PersonalGymListComponent } from './personal-gym-list/personal-gym-list.component';
import { PersonalGymFormComponent } from './personal-gym-form/personal-gym-form.component';

export const PERSONAL_GYM_ROUTES: Routes = [
  {
    // The main list view, e.g., /personal-gym
    path: '',
    component: PersonalGymListComponent,
    title: 'My Personal Gym' // Sets the browser tab title
  },
  {
    // The form for creating a new item, e.g., /personal-gym/new
    path: 'new',
    component: PersonalGymFormComponent,
    title: 'Add New Equipment'
  },
  {
    // The form for editing an existing item, e.g., /personal-gym/edit/some-unique-id
    path: 'edit/:id',
    component: PersonalGymFormComponent,
    title: 'Edit Equipment'
  }
];