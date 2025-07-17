// src/app/features/profile-settings/profile-settings.component.ts
import { Component, inject, OnInit, PLATFORM_ID, signal, WritableSignal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { format } from 'date-fns';
import { debounceTime, filter, tap } from 'rxjs';

import { WorkoutService } from '../../../core/services/workout.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { StorageService } from '../../../core/services/storage.service';
import { UnitsService, WeightUnit } from '../../../core/services/units.service';
import { AlertService } from '../../../core/services/alert.service';
import { SpinnerService } from '../../../core/services/spinner.service';
import { ThemeService } from '../../../core/services/theme.service';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { AppSettings } from '../../../core/models/app-settings.model';
import { ToastService } from '../../../core/services/toast.service';
import { Gender, UserProfile } from '../../../core/models/user-profile.model';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { PressDirective } from '../../../shared/directives/press.directive';


@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PressDirective],
  templateUrl: './profile-settings.html',
  styleUrl: './profile-settings.scss',
})
export class ProfileSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private workoutService = inject(WorkoutService);
  private trackingService = inject(TrackingService);
  private trainingProgramService = inject(TrainingProgramService);
  private exerciseService = inject(ExerciseService);
  private storageService = inject(StorageService);
  protected unitsService = inject(UnitsService);
  private alertService = inject(AlertService);
  private spinnerService = inject(SpinnerService);
  protected themeService = inject(ThemeService);
  protected userProfileService = inject(UserProfileService);
  protected appSettingsService = inject(AppSettingsService); // Already injected
  private platformId = inject(PLATFORM_ID);
  private toastService = inject(ToastService);

  protected currentVibrator = navigator;

  profileForm!: FormGroup;
  appSettingsForm!: FormGroup;

  currentUnit = this.unitsService.currentUnit;
  readonly genders: { label: string, value: Gender }[] = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' },
    { label: 'Prefer not to say', value: 'prefer_not_to_say' },
  ];

  private readonly BACKUP_VERSION = 3;

  constructor() {
    this.profileForm = this.fb.group({
      username: [''],
      gender: [null as Gender | null],
      measurements: this.fb.group({
        heightCm: [null as number | null, [Validators.min(0)]],
        weightKg: [null as number | null, [Validators.min(0)]],
        age: [null as number | null, [Validators.min(0), Validators.max(150)]],
        chestCm: [null as number | null, [Validators.min(0)]],
        waistCm: [null as number | null, [Validators.min(0)]],
        hipsCm: [null as number | null, [Validators.min(0)]],
        rightArmCm: [null as number | null, [Validators.min(0)]],
      })
    });

    this.appSettingsForm = this.fb.group({
      enableTimerCountdownSound: [true],
      enableShowWIP: [true],
      countdownSoundSeconds: [5, [Validators.required, Validators.min(1), Validators.max(60)]],
      enablePresetTimer: [false],
      enablePresetTimerAfterRest: [false],
      presetTimerDurationSeconds: [10, [Validators.required, Validators.min(3), Validators.max(60)]],
      weightStep: [2.5, [Validators.required, Validators.min(0.01), Validators.max(50)]] // <<< ADDED weightStep
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
    }
    this.loadProfileData();
    this.loadAppSettingsData();

    this.profileForm.valueChanges.pipe(
      debounceTime(700),
      filter(() => this.profileForm.valid && this.profileForm.dirty),
      tap(value => {
        this.userProfileService.saveProfile(value as UserProfile);
        this.profileForm.markAsPristine({ onlySelf: false });
        this.toastService.info("Profile auto-saved", 1500);
      })
    ).subscribe();

    this.appSettingsForm.valueChanges.pipe(
      debounceTime(700),
      filter(() => this.appSettingsForm.valid && this.appSettingsForm.dirty),
      tap(value => {
        this.appSettingsService.saveSettings(value as AppSettings);
        this.appSettingsForm.markAsPristine({ onlySelf: false });
        this.toastService.info("App settings auto-saved", 1500);
      })
    ).subscribe();
  }

  loadProfileData(): void { /* ... as before ... */
    const profile = this.userProfileService.getProfile();
    if (profile) {
      this.profileForm.reset(profile, { emitEvent: false });
    } else {
      this.profileForm.reset({
        username: '', gender: null,
        measurements: { heightCm: null, weightKg: null, age: null, chestCm: null, waistCm: null, hipsCm: null, rightArmCm: null }
      }, { emitEvent: false });
    }
  }

  loadAppSettingsData(): void {
    const settings = this.appSettingsService.getSettings();
    this.appSettingsForm.reset(settings, { emitEvent: false });
  }

  saveProfileSettings(): void { /* ... as before ... */
    if (this.profileForm.invalid) {
      this.toastService.error("Please correct errors in the profile form", 3000, "Validation Error");
      this.profileForm.markAllAsTouched(); return;
    }
    this.userProfileService.saveProfile(this.profileForm.value as UserProfile);
    this.profileForm.markAsPristine();
    this.toastService.success("Profile saved successfully!", 2000);
  }

  saveAppSettings(): void {
    if (this.appSettingsForm.invalid) {
      this.toastService.error("Please correct errors in the app settings form", 3000, "Validation Error");
      this.appSettingsForm.markAllAsTouched();
      return;
    }
    this.appSettingsService.saveSettings(this.appSettingsForm.value as AppSettings);
    this.appSettingsForm.markAsPristine();
    this.toastService.success("App settings saved successfully!", 2000);
  }

  selectUnit(unit: WeightUnit): void {
    this.unitsService.setUnitPreference(unit);
    // No form to save here, unit service handles its own persistence
  }

  exportData(): void {
    this.spinnerService.show('Exporting data...');
    const backupData = {
      version: this.BACKUP_VERSION, // Updated version
      timestamp: new Date().toISOString(),
      profile: this.userProfileService.getDataForBackup(),
      appSettings: this.appSettingsService.getDataForBackup(),
      routines: this.workoutService.getDataForBackup(),
      programs: this.trainingProgramService.getDataForBackup(),
      exercises: this.exerciseService.getDataForBackup(),
      workoutLogs: this.trackingService.getLogsForBackup(),
      personalBests: this.trackingService.getPBsForBackup(),
    };
    // ... rest of existing exportData logic ...
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateString = format(new Date(), 'yyyyMMdd_HHmmss');
    a.download = `FitTrackPro_backup_v${this.BACKUP_VERSION}_${dateString}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    this.spinnerService.hide();
    this.toastService.success("Data export initiated", 3000);
  }

  importData(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;
    if (file.type !== 'application/json') {
      this.alertService.showAlert('Error', 'Invalid file type. Please select a JSON file.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result as string;
        const importedData = JSON.parse(fileContent);

        if (typeof importedData !== 'object' || importedData === null) {
          this.alertService.showAlert('Error', 'Invalid backup file format. Expected an object.');
          input.value = ''; return;
        }

        if (importedData.version === 3) {
          // ... (your V3 validation) ...
          if (!importedData.exercises || !importedData.routines) {
            this.alertService.showAlert('Error', "Invalid V3 backup file content. Missing essential data sections");
            input.value = ''; return;
          }
        } else if (importedData.version === 2) {
          // ... (your V2 validation) ...
          if (!importedData.routines || !importedData.workoutLogs || !importedData.personalBests ||
            importedData.profile === undefined || importedData.appSettings === undefined) {
            this.alertService.showAlert('Error', "Invalid V2 backup file content. Missing essential data sections");
            input.value = ''; return;
          }
        } else if (importedData.version === 1) {
          // ... (your V1 validation) ...
          if (!importedData.routines || !importedData.workoutLogs || !importedData.personalBests) {
            this.alertService.showAlert('Error', "Invalid V1 backup file content. Missing essential data sections");
            input.value = ''; return;
          }
        } else {
          this.alertService.showAlert('Error', `Unsupported backup file version. Expected 1,2 or 3, got ${importedData.version}`);
          input.value = ''; return;
        }

        this.alertService.showConfirm("WARNING", "Importing data will try to MERGE your current data with the IMPORTED one. Are you sure?").then((result) => {
          if (result && result.data) {
            this.spinnerService.show('Importing data...');
            this.workoutService.mergeData(importedData.routines);
            this.trackingService.replaceLogs(importedData.workoutLogs);
            this.trackingService.replacePBs(importedData.personalBests);

            if (importedData.version === 3) {
              this.exerciseService.mergeData(importedData.exercises);
              this.trainingProgramService.mergeData(importedData.programs);
            } else if (importedData.version === 2) {
              this.userProfileService.replaceData(importedData.profile as UserProfile | null);
              this.appSettingsService.replaceData(importedData.appSettings as AppSettings | null);
            } else { // For V1, ensure defaults are applied if no settings/profile
              this.userProfileService.replaceData(null); // Reset to default/empty
              this.appSettingsService.replaceData(null); // Reset to default
            }
            // Reload data into forms
            this.loadProfileData();
            this.loadAppSettingsData();
            this.spinnerService.hide();
            this.toastService.success("Data imported successfully!", 5000, "Import Complete");
          } else {
            this.toastService.info("Data import cancelled", 2000);
          }
        });
      } catch (error) {
        console.error('Error processing imported file:', error);
        this.alertService.showAlert('Error', 'Error processing backup file. Ensure it is valid JSON.');
      } finally {
        input.value = '';
      }
    };
    reader.onerror = () => {
      this.alertService.showAlert('Error', 'Error reading file.');
      input.value = '';
    };
    reader.readAsText(file);
  }

  async clearAllAppData(): Promise<void> {
    const initialConfirmation = await this.alertService.showConfirmationDialog(
      "WARNING",
      "This will delete ALL your workout data, profile, and settings. This cannot be undone. Are you sure?"
    );
    if (initialConfirmation && initialConfirmation.data) {
      if (this.trackingService.clearAllWorkoutLogs_DEV_ONLY) await this.trackingService.clearAllWorkoutLogs_DEV_ONLY();
      if (this.trackingService.clearAllPersonalBests_DEV_ONLY) await this.trackingService.clearAllPersonalBests_DEV_ONLY();
      if (this.workoutService.clearAllRoutines_DEV_ONLY) await this.workoutService.clearAllRoutines_DEV_ONLY();
      if (this.userProfileService.clearUserProfile_DEV_ONLY) this.userProfileService.clearUserProfile_DEV_ONLY();
      if (this.appSettingsService.clearAppSettings_DEV_ONLY) this.appSettingsService.clearAppSettings_DEV_ONLY();
      if (this.trainingProgramService.deactivateAllPrograms) this.trainingProgramService.deactivateAllPrograms();

      this.loadProfileData(); // Reload empty/default profile
      this.loadAppSettingsData(); // Reload default app settings

      await this.alertService.showAlert("Info", "All application data has been cleared");
    }
  }

  get measForm(): FormGroup { // Helper to get measurements form group
    return this.profileForm.get('measurements') as FormGroup;
  }

  /**
   * Toggles the 'hideWipDisclaimer' setting in the user profile.
   * This method is called by the (change) event on the toggle switch.
   */
  toggleWipDisclaimer(): void {
    // 1. Get the current state
    const isCurrentlyHidden = this.userProfileService.getHideWipDisclaimer();

    // 2. Update the service with the opposite state
    this.userProfileService.updateHideWipDisclaimer(!isCurrentlyHidden);
  }

  navigateToExerciseLibrary(): void {
    this.router.navigate(['/library']);
  }

  navigateToPersonalBests(): void {
    this.router.navigate(['/profile/personal-bests']);
  }
}