import { Routes } from '@angular/router';
import { ProfileSettingsComponent } from './profile-settings/profile-settings';
import { PersonalBestsComponent } from './personal-bests/personal-bests';
import { MeasurementHistoryComponent } from '../measurement-history/measurement-history';

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
  },
  {
    path: 'measurements', // New sub-route for PBs
    component: MeasurementHistoryComponent,
    title: 'Body Measurements'
  }
];