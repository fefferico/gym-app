import { Routes } from '@angular/router';
import { ProfileSettingsComponent } from './profile-settings/profile-settings';
import { PersonalBestsComponent } from './personal-bests/personal-bests';

export const PROFILE_SETTINGS_ROUTES: Routes = [
  {
    path: '', // Default path for /profile will be the settings component
    component: ProfileSettingsComponent,
    title: 'Profile & Settings'
  },
  {
    path: 'personal-bests', // New sub-route for PBs
    component: PersonalBestsComponent,
    title: 'Personal Bests'
  }
];