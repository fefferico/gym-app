// src/app/features/profile-settings/profile-settings.component.ts
import { Component, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
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
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ProgressiveOverloadService, ProgressiveOverloadSettings, ProgressiveOverloadStrategy } from '../../../core/services/progressive-overload.service.ts';
import { AlertButton, AlertInput } from '../../../core/models/alert.model';


@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PressDirective, IconComponent],
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
  protected appSettingsService = inject(AppSettingsService);
  protected progressiveOverloadService = inject(ProgressiveOverloadService);
  private platformId = inject(PLATFORM_ID);
  private toastService = inject(ToastService);

  protected currentVibrator = navigator;

  profileForm!: FormGroup;
  appSettingsForm!: FormGroup;
  progressiveOverloadForm!: FormGroup;

  currentUnit = this.unitsService.currentUnit;
  readonly genders: { label: string, value: Gender }[] = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' },
    { label: 'Prefer not to say', value: 'prefer_not_to_say' },
  ];
  protected readonly progressiveOverloadStrategies = [
    { label: 'Increase Weight', value: ProgressiveOverloadStrategy.WEIGHT },
    { label: 'Increase Reps', value: ProgressiveOverloadStrategy.REPS }
  ];

  private readonly BACKUP_VERSION = 4;

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
      countdownSoundSeconds: [5, [Validators.required, Validators.min(1), Validators.max(60)]],
      enablePresetTimer: [false],
      presetTimerDurationSeconds: [10, [Validators.required, Validators.min(3), Validators.max(60)]],
      weightStep: [2.5, [Validators.required, Validators.min(0.01), Validators.max(50)]]
    });

    this.progressiveOverloadForm = this.fb.group({
      enabled: [false],
      strategy: [null as ProgressiveOverloadStrategy | null],
      weightIncrement: [null as number | null, [Validators.min(0.1)]],
      repsIncrement: [null as number | null, [Validators.min(1), Validators.pattern("^[0-9]*$")]],
      sessionsToIncrement: [1, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
    }
    this.loadProfileData();
    this.loadAppSettingsData();
    this.loadProgressiveOverloadSettings();

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

    this.listenForProgressiveOverloadChanges();
  }

  /**
   * Sets up listeners for the progressive overload form.
   * - Handles auto-saving on value changes.
   * - Manages dynamic validators based on user selections.
   */
  listenForProgressiveOverloadChanges(): void {
    this.progressiveOverloadForm.valueChanges.pipe(
      debounceTime(700),
      filter(() => this.progressiveOverloadForm.valid && this.progressiveOverloadForm.dirty),
      tap(settings => {
        this.progressiveOverloadService.saveSettings(settings as ProgressiveOverloadSettings);
        this.progressiveOverloadForm.markAsPristine({ onlySelf: false });
        this.toastService.info("Progressive Overload settings auto-saved", 1500);
      })
    ).subscribe();

    const enabledControl = this.progressiveOverloadForm.get('enabled');
    const strategyControl = this.progressiveOverloadForm.get('strategy');
    const weightIncrementControl = this.progressiveOverloadForm.get('weightIncrement');
    const repsIncrementControl = this.progressiveOverloadForm.get('repsIncrement');

    enabledControl?.valueChanges.subscribe(enabled => {
      if (enabled) {
        strategyControl?.setValidators(Validators.required);
      } else {
        strategyControl?.clearValidators();
        strategyControl?.setValue(null, { emitEvent: false });
      }
      strategyControl?.updateValueAndValidity();
    });

    strategyControl?.valueChanges.subscribe(strategy => {
      if (strategy === ProgressiveOverloadStrategy.WEIGHT) {
        weightIncrementControl?.setValidators([Validators.required, Validators.min(0.1)]);
        repsIncrementControl?.clearValidators();
        repsIncrementControl?.setValue(null, { emitEvent: false });
      } else if (strategy === ProgressiveOverloadStrategy.REPS) {
        repsIncrementControl?.setValidators([Validators.required, Validators.min(1), Validators.pattern("^[0-9]*$")]);
        weightIncrementControl?.clearValidators();
        weightIncrementControl?.setValue(null, { emitEvent: false });
      } else {
        weightIncrementControl?.clearValidators();
        repsIncrementControl?.clearValidators();
        weightIncrementControl?.setValue(null, { emitEvent: false });
        repsIncrementControl?.setValue(null, { emitEvent: false });
      }
      weightIncrementControl?.updateValueAndValidity();
      repsIncrementControl?.updateValueAndValidity();
    });
  }

  loadProfileData(): void {
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

  loadProgressiveOverloadSettings(): void {
    const settings = this.progressiveOverloadService.getSettings();
    this.progressiveOverloadForm.reset(settings, { emitEvent: false });
  }

  exportData(): void {
    this.spinnerService.show('Exporting data...');
    const backupData = {
      version: this.BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      profile: this.userProfileService.getDataForBackup(),
      appSettings: this.appSettingsService.getDataForBackup(),
      progressiveOverload: this.progressiveOverloadService.getDataForBackup(),
      routines: this.workoutService.getDataForBackup(),
      programs: this.trainingProgramService.getDataForBackup(),
      exercises: this.exerciseService.getDataForBackup(),
      workoutLogs: this.trackingService.getLogsForBackup(),
      personalBests: this.trackingService.getPBsForBackup(),
    };
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

        const version = importedData.version;
        if (version > this.BACKUP_VERSION) {
          this.alertService.showAlert('Error', `Backup version ${version} is newer than the app's supported version ${this.BACKUP_VERSION}. Please update the app.`);
          input.value = ''; return;
        }

        this.alertService.showConfirm("WARNING", "Importing data will try to MERGE your current data with the IMPORTED one. Are you sure?").then((result) => {
          if (result && result.data) {
            this.spinnerService.show('Importing data...');
            this.workoutService.mergeData(importedData.routines);
            this.trackingService.replaceLogs(importedData.workoutLogs);
            this.trackingService.replacePBs(importedData.personalBests);

            if (version >= 4) {
              this.progressiveOverloadService.replaceData(importedData.progressiveOverload as ProgressiveOverloadSettings | null);
            } else {
              this.progressiveOverloadService.replaceData(null);
            }

            if (version >= 3) {
              this.exerciseService.mergeData(importedData.exercises);
              this.trainingProgramService.mergeData(importedData.programs);
            }

            if (version >= 2) {
              this.userProfileService.replaceData(importedData.profile as UserProfile | null);
              this.appSettingsService.replaceData(importedData.appSettings as AppSettings | null);
            } else {
              this.userProfileService.replaceData(null);
              this.appSettingsService.replaceData(null);
            }

            this.loadProfileData();
            this.loadAppSettingsData();
            this.loadProgressiveOverloadSettings();
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
      `This will delete ALL your workout data, profile, and settings. This cannot be undone. Are you sure?`,
      [
        { text: "Cancel", role: "cancel", data: false, icon: 'cancel' } as AlertButton,
        { text: "Clear all data", role: "confirm", data: true, cssClass: "bg-red-600", icon: 'trash' } as AlertButton,
      ],
    );

    if (initialConfirmation && initialConfirmation.data) {
      // show a second confirmation dialog asking the user to exactly type "DELETE" to confirm

      const absoluteConfirmation = await this.alertService.showPromptDialog(
        'Confirm Data Deletion',
        `To confirm, please type "DELETE" in the input below. This will delete ALL your workout data, profile, and settings. This cannot be undone.`,
        [{
          name: 'confirmDialogInput',
          type: 'text',
          placeholder: `Type DELETE to confirm`,
          value: '',
          autofocus: true,
        }] as AlertInput[],
        'CLEAR ALL DATA'
      );

      const response: string | null = absoluteConfirmation && typeof absoluteConfirmation['confirmDialogInput'] === 'string'
        ? absoluteConfirmation['confirmDialogInput']
        : null;
      if (!response || response.toUpperCase() !== 'DELETE') {
        this.alertService.showAlert("Cancelled", "Data clearing cancelled. No changes made.");
        return;
      }

      if (this.trackingService.clearAllWorkoutLogs_DEV_ONLY) await this.trackingService.clearAllWorkoutLogs_DEV_ONLY();
      if (this.trackingService.clearAllPersonalBests_DEV_ONLY) await this.trackingService.clearAllPersonalBests_DEV_ONLY();
      if (this.workoutService.clearAllRoutines_DEV_ONLY) await this.workoutService.clearAllRoutines_DEV_ONLY();
      if (this.userProfileService.clearUserProfile_DEV_ONLY) this.userProfileService.clearUserProfile_DEV_ONLY();
      if (this.appSettingsService.clearAppSettings_DEV_ONLY) this.appSettingsService.clearAppSettings_DEV_ONLY();
      if (this.progressiveOverloadService.clearSettings_DEV_ONLY) this.progressiveOverloadService.clearSettings_DEV_ONLY();
      if (this.trainingProgramService.deactivateAllPrograms) this.trainingProgramService.deactivateAllPrograms();

      this.loadProfileData();
      this.loadAppSettingsData();
      this.loadProgressiveOverloadSettings();

      await this.alertService.showAlert("Info", "All application data has been cleared");
    }
  }

  selectUnit(unit: WeightUnit): void {
    this.unitsService.setUnitPreference(unit);
  }

  toggleWipDisclaimer(): void {
    const isCurrentlyHidden = this.userProfileService.getHideWipDisclaimer();
    this.userProfileService.updateHideWipDisclaimer(!isCurrentlyHidden);
  }

  navigateToExerciseLibrary(): void {
    this.router.navigate(['/library']);
  }

  navigateToPersonalBests(): void {
    this.router.navigate(['/profile/personal-bests']);
  }

  async onSyncExerciseHistoryClick(): Promise<void> {
    const confirmation = await this.alertService.showConfirm(
      'Sync Exercise History',
      'This will scan your workout logs to update the "Last Used" date for all exercises. This may take a moment. Proceed?'
    );

    if (confirmation && confirmation.data) {
      await this.trackingService.backfillLastUsedExerciseTimestamps();
    }
  }
}