// src/app/features/profile-settings/profile-settings.component.ts
import { Component, inject, OnInit, PLATFORM_ID, signal, WritableSignal } from '@angular/core'; // Added OnInit
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'; // Import ReactiveFormsModule and FormBuilder
import { format } from 'date-fns';

import { WorkoutService } from '../../../core/services/workout.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { StorageService } from '../../../core/services/storage.service';
import { UnitsService, WeightUnit } from '../../../core/services/units.service';
import { AlertService } from '../../../core/services/alert.service';
import { SpinnerService } from '../../../core/services/spinner.service';
import { ThemeService } from '../../../core/services/theme.service';
import { UserProfileService } from '../../../core/services/user-profile.service'; // Import
import { AppSettingsService } from '../../../core/services/app-settings.service'; // Import
import { AppSettings } from '../../../core/models/app-settings.model'; // Import
import { ToastService } from '../../../core/services/toast.service'; // Import ToastService
import { Gender, UserProfile } from '../../../core/models/user-profile.model';
import { debounceTime, filter, tap } from 'rxjs';
import { TrainingProgramService } from '../../../core/services/training-program.service';


@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule], // Add ReactiveFormsModule
  templateUrl: './profile-settings.html',
  styleUrl: './profile-settings.scss',
})
export class ProfileSettingsComponent implements OnInit { // Implement OnInit
  private fb = inject(FormBuilder);
  private workoutService = inject(WorkoutService);
  private trackingService = inject(TrackingService);
  private trainingProgramService = inject(TrainingProgramService);
  private storageService = inject(StorageService); // Not directly used now, but services use it
  private unitsService = inject(UnitsService);
  private alertService = inject(AlertService);
  private spinnerService = inject(SpinnerService);
  protected themeService = inject(ThemeService);
  protected userProfileService = inject(UserProfileService);
  protected appSettingsService = inject(AppSettingsService);
  private platformId = inject(PLATFORM_ID);
  private toastService = inject(ToastService);

  profileForm!: FormGroup;
  appSettingsForm!: FormGroup; // Define here

  currentUnit = this.unitsService.currentUnit;
  readonly genders: { label: string, value: Gender }[] = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' },
    { label: 'Prefer not to say', value: 'prefer_not_to_say' },
  ];

  private readonly BACKUP_VERSION = 2;

  constructor() {
    // Initialize forms ONCE in the constructor
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
        // Add leftArmCm if needed
      })
    });

    this.appSettingsForm = this.fb.group({
      enableTimerCountdownSound: [true],
      countdownSoundSeconds: [5, [Validators.required, Validators.min(1), Validators.max(60)]],
      enablePresetTimer: [false], // Initialize with all controls
      enablePresetTimerAfterRest: [false], // Initialize with all controls
      presetTimerDurationSeconds: [10, [Validators.required, Validators.min(3), Validators.max(60)]]
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
    }
    this.loadProfileData();
    this.loadAppSettingsData();

    // Auto-save on valueChanges (optional: can be removed if only explicit save is desired)
    this.profileForm.valueChanges.pipe(
      debounceTime(700), // Wait for 700ms of silence before saving
      filter(() => this.profileForm.valid && this.profileForm.dirty), // Only save if valid and dirty
      tap(value => {
        console.log('Auto-saving profile...', value);
        this.userProfileService.saveProfile(value as UserProfile);
        this.profileForm.markAsPristine({ onlySelf: false }); // Mark as pristine after auto-save
        this.toastService.info("Profile auto-saved", 1500);
      })
    ).subscribe();

    this.appSettingsForm.valueChanges.pipe(
      debounceTime(700),
      filter(() => this.appSettingsForm.valid && this.appSettingsForm.dirty),
      tap(value => {
        console.log('Auto-saving app settings...', value);
        this.appSettingsService.saveSettings(value as AppSettings);
        this.appSettingsForm.markAsPristine({ onlySelf: false });
        this.toastService.info("App settings auto-saved", 1500);
      })
    ).subscribe();
  }

  loadProfileData(): void {
    const profile = this.userProfileService.getProfile();
    if (profile) {
      // Use reset instead of patchValue to also reset dirty/touched states
      this.profileForm.reset(profile, { emitEvent: false });
    } else {
      this.profileForm.reset({
        username: '',
        gender: null,
        measurements: {
          heightCm: null, weightKg: null, age: null, chestCm: null,
          waistCm: null, hipsCm: null, rightArmCm: null
        }
      }, { emitEvent: false });
    }
  }

  loadAppSettingsData(): void {
    const settings = this.appSettingsService.getSettings(); // This already merges with defaults in service
    this.appSettingsForm.reset(settings, { emitEvent: false });
  }

  saveProfileSettings(): void {
    if (this.profileForm.invalid) {
      this.toastService.error("Please correct errors in the profile form.", 3000, "Validation Error");
      this.profileForm.markAllAsTouched(); // Show all errors
      return;
    }
    this.userProfileService.saveProfile(this.profileForm.value as UserProfile);
    this.profileForm.markAsPristine();
    this.toastService.success("Profile saved successfully!", 2000);
  }

  saveAppSettings(): void {
    if (this.appSettingsForm.invalid) {
      this.toastService.error("Please correct errors in the app settings form.", 3000, "Validation Error");
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
      profile: this.userProfileService.getDataForBackup(),         // NEW
      appSettings: this.appSettingsService.getDataForBackup(),     // NEW
      routines: this.workoutService.getDataForBackup(),
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
    this.toastService.success("Data export initiated.", 3000);
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

        if (importedData.version === 2) {
          // ... (your V2 validation) ...
          if (!importedData.routines || !importedData.workoutLogs || !importedData.personalBests ||
            importedData.profile === undefined || importedData.appSettings === undefined) {
            this.alertService.showAlert('Error', "Invalid V2 backup file content. Missing essential data sections.");
            input.value = ''; return;
          }
        } else if (importedData.version === 1) {
          // ... (your V1 validation) ...
          if (!importedData.routines || !importedData.workoutLogs || !importedData.personalBests) {
            this.alertService.showAlert('Error', "Invalid V1 backup file content. Missing essential data sections.");
            input.value = ''; return;
          }
        } else {
          this.alertService.showAlert('Error', `Unsupported backup file version. Expected 1 or 2, got ${importedData.version}.`);
          input.value = ''; return;
        }

        this.alertService.showConfirm("WARNING", "Importing data will OVERWRITE your current data. Are you sure?").then((result) => {
          if (result && result.data) {
            this.spinnerService.show('Importing data...');
            this.workoutService.replaceData(importedData.routines);
            this.trackingService.replaceLogs(importedData.workoutLogs);
            this.trackingService.replacePBs(importedData.personalBests);

            if (importedData.version === 2) {
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
            this.toastService.info("Data import cancelled.", 2000);
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
      // NEW: Clear profile and app settings
      if (this.userProfileService.clearUserProfile_DEV_ONLY) this.userProfileService.clearUserProfile_DEV_ONLY();
      if (this.appSettingsService.clearAppSettings_DEV_ONLY) this.appSettingsService.clearAppSettings_DEV_ONLY();
      if (this.trainingProgramService.deactivateAllPrograms) this.trainingProgramService.deactivateAllPrograms();

      this.loadProfileData(); // Reload empty/default profile
      this.loadAppSettingsData(); // Reload default app settings

      await this.alertService.showAlert("Info", "All application data has been cleared.");
    }
  }

  get measForm(): FormGroup { // Helper to get measurements form group
    return this.profileForm.get('measurements') as FormGroup;
  }
}