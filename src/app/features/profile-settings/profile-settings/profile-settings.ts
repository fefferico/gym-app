// src/app/features/profile-settings/profile-settings.component.ts
import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { format } from 'date-fns';
import { debounceTime, filter, Subscription, tap } from 'rxjs';

import { WorkoutService } from '../../../core/services/workout.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { StorageService } from '../../../core/services/storage.service';
// MODIFIED: Import all unit types
import { UnitsService, WeightUnit, BodyWeightUnit, BodyMeasureUnit, MeasureUnit, DistanceMeasureUnit } from '../../../core/services/units.service';
import { AlertService } from '../../../core/services/alert.service';
import { SpinnerService } from '../../../core/services/spinner.service';
import { ThemeService } from '../../../core/services/theme.service';
import { AppSettings, MenuMode } from '../../../core/models/app-settings.model';
import { ToastService } from '../../../core/services/toast.service';
import { Gender, MeasurementEntry, UserMeasurements, UserProfile } from '../../../core/models/user-profile.model';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { PressDirective } from '../../../shared/directives/press.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ProgressiveOverloadService, ProgressiveOverloadSettings, ProgressiveOverloadStrategy } from '../../../core/services/progressive-overload.service.ts';
import { AlertButton, AlertInput } from '../../../core/models/alert.model';
import { ImageStorageService } from '../../../core/services/image-storage.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { PersonalGymService } from '../../../core/services/personal-gym.service';
import { AppSettingsService } from '../../../core/services/app-settings.service';
// +++ NEW: Import the conversion service
import { DataConversionService } from '../../../core/services/data-conversion.service';
import { SubscriptionService, PremiumFeature } from '../../../core/services/subscription.service';
import { ActivityService } from '../../../core/services/activity.service';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PressDirective, IconComponent, TooltipDirective],
  templateUrl: './profile-settings.html',
  styleUrl: './profile-settings.scss',
})
export class ProfileSettingsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private workoutService = inject(WorkoutService);
  private trackingService = inject(TrackingService);
  private activityService = inject(ActivityService);
  private personalGymService = inject(PersonalGymService);
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
  private imageStorageService = inject(ImageStorageService);
  // +++ NEW: Inject the conversion service
  private dataConversionService = inject(DataConversionService);
  protected subscriptionService = inject(SubscriptionService);
  private cdr = inject(ChangeDetectorRef); // <-- Inject ChangeDetectorRef

  private subscriptions = new Subscription();

  public PremiumFeature = PremiumFeature;

  protected currentVibrator = navigator;

  syncHistoryTooltipString = 'This will scan all workout logs to update the "Last Used" date for every exercise in your library. Run this if the dates seem out of sync after an import or an update.'

  goalsForm!: FormGroup;
  profileForm!: FormGroup;
  appSettingsForm!: FormGroup;
  progressiveOverloadForm!: FormGroup;

  // +++ NEW: Add a method to handle the upgrade button click
  handleUpgradeClick(): void {
    // In a real app, this would navigate to a pricing page.
    // For now, we'll just toggle the premium status for development.
    this.subscriptionService.togglePremium_DEV_ONLY();
    const newStatus = this.subscriptionService.isPremium() ? 'Premium' : 'Free';
    this.toastService.success(`You are now on the ${newStatus} tier!`, 3000, "Status Updated");

    if (this.subscriptionService.isPremium()) {
      this.toastService.veryImportant("Thank you for supporting the app! All premium features are now unlocked.", 10000, "Thank You!");
      // Ensure all routines are enabled upon upgrade
      this.workoutService.enableAllRoutines_DEV_ONLY();
    }
  }

  /**
      * A reusable handler for features that navigate or perform an action.
      * Checks for premium access. If access is denied, it shows the upgrade modal.
      * If access is granted and a route is provided, it navigates.
      * @param feature The premium feature to check.
      * @param event The mouse event, used to prevent default behavior if access is denied.
      * @param route Optional. The Angular route to navigate to if access is granted.
      */
  handlePremiumFeatureOrNavigate(feature: PremiumFeature, event: Event, route?: any[]): void {
    this.workoutService.vibrate();

    if (this.subscriptionService.canAccess(feature)) {
      // Access granted. If a route is provided, navigate to it.
      if (route) {
        this.router.navigate(route);
      }
      // If no route is provided, do nothing and let the default event (like a toggle) proceed.
    } else {
      // Access denied.
      event.preventDefault();  // *** THIS IS THE CRITICAL FIX ***
      event.stopPropagation(); // Stop the event from propagating further.
      this.subscriptionService.showUpgradeModal();
    }
  }

  // REMOVED: No longer need this, using signals from service directly
  // currentUnit = this.unitsService.currentWeightUnit;
  readonly genders: { label: string, value: Gender }[] = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' },
    { label: 'Prefer not to say', value: 'prefer_not_to_say' },
  ];
  protected readonly progressiveOverloadStrategies = [
    { label: 'Increase Weight', value: ProgressiveOverloadStrategy.WEIGHT },
    { label: 'Increase Reps', value: ProgressiveOverloadStrategy.REPS },
    { label: 'Increase Distance', value: ProgressiveOverloadStrategy.DISTANCE },
    { label: 'Increase Duration', value: ProgressiveOverloadStrategy.DURATION }
  ];

  private readonly BACKUP_VERSION = 6;

  constructor() {
    this.profileForm = this.fb.group({
      general: this.fb.group({
        username: [''],
        gender: [null as Gender | null],
        age: [null as number | null, [Validators.min(0), Validators.max(150), Validators.required]]
      }),
      measurements: this.fb.group({
        height: [null as number | null, [Validators.min(0), Validators.required]],
        weight: [null as number | null, [Validators.min(0), Validators.required]],
        chest: [null as number | null, [Validators.min(0)]],
        neck: [null as number | null, [Validators.min(0)]],
        waist: [null as number | null, [Validators.min(0)]],
        hips: [null as number | null, [Validators.min(0)]],
        rightArm: [null as number | null, [Validators.min(0)]],
      })
    });

    // Initialize the new goals form
    this.goalsForm = this.fb.group({
      weight: [null as number | null, [Validators.min(0)]],
      waist: [null as number | null, [Validators.min(0)]],
      // Add other goal controls
    });

    this.appSettingsForm = this.fb.group({
      enableTimerCountdownSound: [true],
      playerMode: ['compact'],
      countdownSoundSeconds: [5, [Validators.required, Validators.min(1), Validators.max(60)]],
      enablePresetTimer: [false],
      presetTimerDurationSeconds: [10, [Validators.required, Validators.min(3), Validators.max(60)]],
      weightStep: [2.5, [Validators.required, Validators.min(0.01), Validators.max(50)]]
    });

    this.progressiveOverloadForm = this.fb.group({
      enabled: [false],
      strategies: this.fb.array([]),
      weightIncrement: [null as number | null, [Validators.min(0.1)]],
      repsIncrement: [null as number | null, [Validators.min(1), Validators.pattern("^[0-9]*$")]],
      distanceIncrement: [null as number | null, [Validators.min(0.01)]],
      durationIncrement: [null as number | null, [Validators.min(1), Validators.pattern("^[0-9]*$")]],
      sessionsToIncrement: [1, [Validators.required, Validators.min(1)]]
    });
  }

  // ... (ngOnInit and other methods remain the same)
  // ... (make sure you have the other methods like loadProfileData, saveMeasurements, etc.)

  // +++ NEW: Methods to handle unit changes and trigger conversion workflow +++

  /**
   * Toggles the playerMode form control between 'compact' and 'focus'.
   * This is triggered by the (change) event of the checkbox input.
   * @param event The change event from the input element.
   */
  togglePlayerMode(event: Event): void {
    this.workoutService.vibrate();
    const inputElement = event.target as HTMLInputElement;
    const isChecked = inputElement.checked;
    const newMode = isChecked ? 'focus' : 'compact';

    if (this.workoutService.isPausedSession()) {
      // Show the alert to the user.
      this.alertService.showAlert(
        "Action Disabled",
        "It's not possible to change the player mode during a workout session. Please complete or discard your current workout first."
      );

      // *** THE CORE FIX ***
      // Prevent the visual change by directly reverting the checkbox's checked state.
      // This is more reliable than trying to patch the form value after the fact.
      inputElement.checked = !isChecked;

      // Ensure Angular's change detection knows about this manual DOM change.
      this.cdr.detectChanges();

    } else {
      // If the workout is not paused, proceed with saving the new setting as normal.
      this.appSettingsForm.get('playerMode')?.setValue(newMode);
      this.appSettingsService.saveSettings({ playerMode: newMode });
    }
  }

  async selectWeightUnit(unit: WeightUnit): Promise<void> {
    const oldUnit = this.unitsService.currentWeightUnit();
    if (unit === oldUnit) return; // No change

    // const confirm = await this.alertService.showConfirm(
    //   'Convert All Weight Data?',
    //   `You've changed the weight unit from ${oldUnit.toUpperCase()} to ${unit.toUpperCase()}. Would you like to convert all existing workout data (logs, routines, gym equipment) to the new unit?`
    // );
    // if (confirm && confirm.data) {
    // await this.dataConversionService.convertAllWeightData(oldUnit, unit);
    // }
    await this.dataConversionService.convertAllWeightData(oldUnit, unit);
    this.unitsService.setWeightUnitPreference(unit);
  }

  async selectMeasureUnit(unit: MeasureUnit): Promise<void> {
    const oldUnit = this.unitsService.currentMeasureUnit();
    if (unit === oldUnit) return; // No change

    // const confirm = await this.alertService.showConfirm(
    //   'Convert All Measure Data?',
    //   `You've changed the measure unit from ${oldUnit.toUpperCase()} to ${unit.toUpperCase()}. Would you like to convert all existing workout data (logs, routines, gym equipment) to the new unit?`
    // );
    // if (confirm && confirm.data) {
    //   await this.dataConversionService.convertAllMeasureData(oldUnit, unit);
    // }
    await this.dataConversionService.convertAllMeasureData(oldUnit, unit);
    this.unitsService.setMeasureUnitPreference(unit);
  }

  async selectDistanceMeasureUnit(unit: DistanceMeasureUnit): Promise<void> {
    const oldUnit = this.unitsService.currentDistanceMeasureUnit();
    if (unit === oldUnit) return; // No change

    // const confirm = await this.alertService.showConfirm(
    //   'Convert All Distance Measure Data?',
    //   `You've changed the measure unit from ${oldUnit.toUpperCase()} to ${unit.toUpperCase()}. Would you like to convert all existing workout data (logs, routines, gym equipment) to the new unit?`
    // );
    // if (confirm && confirm.data) {
    //   await this.dataConversionService.convertAllDistanceMeasureData(oldUnit, unit);
    // }
    await this.dataConversionService.convertAllDistanceMeasureData(oldUnit, unit);
    this.unitsService.setDistanceMeasureUnitPreference(unit);
  }

  async selectBodyWeightUnit(unit: BodyWeightUnit): Promise<void> {
    const oldUnit = this.unitsService.currentBodyWeightUnit();
    if (unit === oldUnit) return;

    // const confirm = await this.alertService.showConfirm(
    //   'Convert All Body Weight Data?',
    //   `You've changed the body weight unit from ${oldUnit.toUpperCase()} to ${unit.toUpperCase()}. Would you like to convert all your historical body weight entries to the new unit?`
    // );
    // if (confirm && confirm.data) {
    //   await this.dataConversionService.convertAllBodyWeightData(oldUnit, unit);
    // }
    await this.dataConversionService.convertAllBodyWeightData(oldUnit, unit);
    this.unitsService.setBodyWeightUnitPreference(unit);
  }

  async selectBodyMeasureUnit(unit: BodyMeasureUnit): Promise<void> {
    const oldUnit = this.unitsService.currentBodyMeasureUnit();
    if (unit === oldUnit) return;

    // const confirm = await this.alertService.showConfirm(
    //   'Convert All Body Measurement Data?',
    //   `You've changed the measurement unit from ${oldUnit.toUpperCase()} to ${unit.toUpperCase()}. Would you like to convert all your historical measurements (height, waist, etc.) to the new unit?`
    // );
    // if (confirm && confirm.data) {
    //   await this.dataConversionService.convertAllBodyMeasureData(oldUnit, unit);
    // }
    await this.dataConversionService.convertAllBodyMeasureData(oldUnit, unit);
    this.unitsService.setBodyMeasureUnitPreference(unit);
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
    }
    this.loadProfileData();
    // REMOVED: this.loadAppSettingsData();
    this.loadProgressiveOverloadSettings();
    this.loadGoalsData();

    // +++ START: THE FIX - Subscribe to AppSettings changes +++
    // This subscription will run for the lifetime of the component.
    // It handles both the initial data load and any subsequent updates (like a downgrade).
    this.subscriptions.add(
      this.appSettingsService.appSettings$.subscribe(settings => {
        if (settings) {
          // Reset the form with the latest settings.
          // `emitEvent: false` prevents an infinite loop with the valueChanges autosave.
          this.appSettingsForm.reset(settings, { emitEvent: false });
          this.cdr.detectChanges();

        }
      })
    );
    // +++ END: THE FIX +++

    // This auto-save logic remains the same.
    this.subscriptions.add(
      this.appSettingsForm.valueChanges.pipe(
        debounceTime(700),
        filter(() => this.appSettingsForm.valid && this.appSettingsForm.dirty),
        tap(value => {
          this.appSettingsService.saveSettings(value as AppSettings);
          this.appSettingsForm.markAsPristine({ onlySelf: false });
          this.toastService.info("App settings auto-saved", 1500);
        })
      ).subscribe()
    );

    this.listenForProgressiveOverloadChanges();

    this.subscriptions.add(
      this.profileForm.get('general')?.valueChanges.pipe(
        debounceTime(700),
      ).subscribe(() => this.saveGeneralData())
    );

    this.subscriptions.add(
      this.goalsForm.valueChanges.pipe(
        debounceTime(700),
        filter(() => this.goalsForm.valid && this.goalsForm.dirty),
        tap(goals => {
          this.userProfileService.saveGoals(goals);
          this.goalsForm.markAsPristine();
          this.toastService.info("Goals auto-saved", 1500);
        })
      ).subscribe()
    );
  }

  // +++ NEW: Implement OnDestroy to clean up subscriptions +++
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadGoalsData(): void {
    const goals = this.userProfileService.getProfile()?.measurementGoals;
    if (goals) {
      this.goalsForm.reset(goals, { emitEvent: false });
    }
  }

  saveMeasurements(): void {
    const measurementsGroup = this.profileForm?.get('measurements');
    if (!this.profileForm || !measurementsGroup || measurementsGroup.invalid) {
      this.toastService.error("Please fill in all required fields correctly: at least age, height and weight should be filled.");
      return;
    }
    const measurements = this.profileForm.get('measurements')?.value as UserMeasurements;
    this.userProfileService.addOrUpdateMeasurementEntry(measurements as MeasurementEntry);
    this.profileForm.get('measurements')!.markAsPristine(); // Mark as saved
    this.toastService.info("Measurements history updated", 1500);
  }


  // Helper to save non-measurement profile data
  private saveGeneralData(): void {
    const profileData = {
      username: this.profileForm.get('general.username')?.value,
      gender: this.profileForm.get('general.gender')?.value,
      age: this.profileForm.get('general.age')?.value
    };
    this.userProfileService.saveProfile(profileData);
    this.toastService.info("Profile auto-saved", 1500);
    this.profileForm.markAsPristine();
  }

  /**
   * Sets up listeners for the progressive overload form.
   * - Handles auto-saving on value changes.
   * - Manages dynamic validators based on user selections.
   */
  listenForProgressiveOverloadChanges(): void {
    this.subscriptions.add(
      this.progressiveOverloadForm.valueChanges.pipe(
        debounceTime(700),
        filter(() => this.progressiveOverloadForm.valid && this.progressiveOverloadForm.dirty),
        tap(settings => {
          this.progressiveOverloadService.saveSettings(settings as ProgressiveOverloadSettings);
          this.progressiveOverloadForm.markAsPristine({ onlySelf: false });
          this.toastService.info("Progressive Overload settings auto-saved", 1500);
        })
      ).subscribe()
    );

    const enabledControl = this.progressiveOverloadForm.get('enabled');

    const setupStrategyValidators = (strategies: ProgressiveOverloadStrategy[]) => {
      const weightControl = this.progressiveOverloadForm.get('weightIncrement');
      const repsControl = this.progressiveOverloadForm.get('repsIncrement');
      const distanceControl = this.progressiveOverloadForm.get('distanceIncrement');
      const durationControl = this.progressiveOverloadForm.get('durationIncrement');

      // Helper function to set or clear validators
      const toggleValidators = (control: any, condition: boolean, validators: any[]) => {
        if (condition) {
          control?.setValidators(validators);
        } else {
          control?.clearValidators();
          control?.setValue(null, { emitEvent: false });
        }
        control?.updateValueAndValidity();
      };

      toggleValidators(weightControl, strategies.includes(ProgressiveOverloadStrategy.WEIGHT), [Validators.required, Validators.min(0.1)]);
      toggleValidators(repsControl, strategies.includes(ProgressiveOverloadStrategy.REPS), [Validators.required, Validators.min(1), Validators.pattern("^[0-9]*$")]);
      toggleValidators(distanceControl, strategies.includes(ProgressiveOverloadStrategy.DISTANCE), [Validators.required, Validators.min(0.01)]);
      toggleValidators(durationControl, strategies.includes(ProgressiveOverloadStrategy.DURATION), [Validators.required, Validators.min(1), Validators.pattern("^[0-9]*$")]);
    };

    // Listen to changes in the strategies array
    this.subscriptions.add(
      this.strategiesFormArray.valueChanges.subscribe(strategies => {
        setupStrategyValidators(strategies);
      })
    );

    // Listen to the main enabled toggle
    this.subscriptions.add(
      enabledControl?.valueChanges.subscribe(enabled => {
        if (enabled) {
          setupStrategyValidators(this.strategiesFormArray.value);
        } else {
          // Clear all strategy validators if the feature is disabled
          setupStrategyValidators([]);
        }
      })
    );
  }

  loadProfileData(): void {
    const profile = this.userProfileService.getProfile();
    if (profile) {
      // We load the latest measurements into the form
      const latestMeasurements = this.userProfileService.getMeasurements();
      this.profileForm.reset({
        general: {
          username: profile.username || '',
          gender: profile.gender || null,
          age: profile.age || null,
        },
        measurements: latestMeasurements || {}
      }, { emitEvent: false });
    } else {
      this.profileForm.reset({
        general: {
          username: null,
          gender: null,
          age: null,
        },
        measurements: { height: null, weight: null, age: null, chest: null, waist: null, hips: null, rightArm: null }
      }, { emitEvent: false });
    }
  }

  loadProgressiveOverloadSettings(): void {
    const settings = this.progressiveOverloadService.getSettings();

    // Clear the form array before populating it
    this.strategiesFormArray.clear();

    // If there are saved strategies, create a form control for each
    if (settings.strategies && settings.strategies.length > 0) {
      settings.strategies.forEach(strategy => {
        this.strategiesFormArray.push(this.fb.control(strategy), { emitEvent: false });
      });
    }

    // Reset the rest of the form, excluding the array
    this.progressiveOverloadForm.reset({
      ...settings,
      strategies: this.strategiesFormArray.value // Keep the array value
    }, { emitEvent: false });
  }

  async exportData(): Promise<void> { // <-- Make the method async
    this.spinnerService.show('Exporting data...');

    const photos = await this.imageStorageService.getAllImagesForBackup();

    const backupData = {
      version: this.BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      profile: this.userProfileService.getDataForBackup(),
      progressPhotos: photos, // <-- Add photos to the backup object
      appSettings: this.appSettingsService.getDataForBackup(),
      progressiveOverload: this.progressiveOverloadService.getDataForBackup(),
      routines: this.workoutService.getDataForBackup(),
      programs: this.trainingProgramService.getDataForBackup(),
      exercises: this.exerciseService.getDataForBackup(),
      workoutLogs: this.trackingService.getDataForBackup(),
      activitiyLogs: this.activityService.getLogsForBackup(),
      personalBests: this.trackingService.getPBsForBackup(),
      personalGym: this.personalGymService.getDataForBackup(),
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

        this.alertService.showConfirm("WARNING", "Importing data will try to MERGE your current data with the IMPORTED one. Are you sure?").then(async (result) => {
          if (result && result.data) {
            this.spinnerService.show('Importing data...');

            // Check for the new version and presence of photo data
            if (version >= 6 && importedData.progressPhotos) {
              await this.imageStorageService.importImages(importedData.progressPhotos);
            }

            // --- UPDATED PROFILE IMPORT LOGIC ---
            if (version >= 5) {
              // Use the new smart merge for modern backups
              this.userProfileService.mergeData(importedData.profile as UserProfile | null);
            } else if (version >= 2) {
              // Use the old replace method for legacy backups
              this.userProfileService.replaceData(importedData.profile as UserProfile | null);
            } else {
              this.userProfileService.replaceData(null);
            }

            // Other data can still use their existing merge/replace logic
            if (!this.subscriptionService.isPremium()) {
              // avaialable standard routines and imported one
              // must be enabled (isDisabled = false) for a maximum of 4 routines

              const existingRoutines = this.workoutService.getCurrentRoutines().filter(r => !r.isDisabled);
              const importedRoutines = Array.isArray(importedData.routines) ? importedData.routines : [];
              const enabledImportedRoutines = importedRoutines.filter((r: any) => !r.isDisabled);
              const totalEnabledCount = existingRoutines.length + enabledImportedRoutines.length;
              if (totalEnabledCount > 4) {
                // disable all imported routines, apart from top 4
                importedRoutines.forEach((r: any, index: number) => r.isDisabled = index > 3 ? true : false);
                this.toastService.veryImportant(`Import detected ${enabledImportedRoutines.length} enabled routines. Free users can only have 4 enabled routines. All imported routines have been disabled. You can enable them after upgrading to Premium.`, 10000, "Routines Disabled");
                this.workoutService.mergeData(importedRoutines);
              }
            } else {
              this.workoutService.mergeData(importedData.routines);
            }

            if (importedData.workoutLogs) {
              this.trackingService.replaceLogs(importedData.workoutLogs || []);
              this.trackingService.replacePBs(importedData.personalBests || {});
            }

            // +++ ADD THIS BLOCK TO MERGE ACTIVITY LOGS +++
            if (Array.isArray(importedData.activityLogs)) {
              this.activityService.mergeData(importedData.activityLogs);
            }

            if (importedData.personalGym) {
              this.personalGymService.mergeData(importedData.personalGym);
            }

            if (version >= 4) {
              this.progressiveOverloadService.replaceData(importedData.progressiveOverload);
            }
            if (version >= 3) {
              this.exerciseService.mergeData(importedData.exercises);
              this.trainingProgramService.mergeData(importedData.programs);
            }
            if (version >= 2) {
              this.appSettingsService.replaceData(importedData.appSettings);
            }

            this.loadProfileData();
            // this.loadAppSettingsData();
            this.loadProgressiveOverloadSettings();
            this.loadGoalsData(); // <-- Reload goals form as well

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
      // this.loadAppSettingsData();
      this.loadProgressiveOverloadSettings();

      await this.alertService.showAlert("Info", "All application data has been cleared");
    }
  }

  selectUnit(unit: WeightUnit): void {
    this.unitsService.setWeightUnitPreference(unit);
  }

  toggleWipDisclaimer(): void {
    const isCurrentlyHidden = this.userProfileService.getHideWipDisclaimer();
    this.userProfileService.updateHideWipDisclaimer(!isCurrentlyHidden);
  }

  navigateToExerciseLibrary(): void {
    this.router.navigate(['/library']);
  }

  navigateToPersonalGym(event?: Event): void {
    this.workoutService.vibrate();
    if (!this.subscriptionService.canAccess(PremiumFeature.PERSONAL_GYM)) {
      this.subscriptionService.showUpgradeModal();
      return;
    }

    // 4. If the check passes, proceed with navigation
    this.router.navigate(['/personal-gym']);
  }
  navigateToPersonalBests(): void {
    this.router.navigate(['/profile/personal-bests']);
  }

  navigateToBodyMeasurements(): void {
    this.router.navigate(['/profile/measurements']);
  }

  showSyncHistoryTooltip(): void {
    // show only if on mobile 
    if (this.platformId === 'browser' && window.innerWidth <= 768) {
      this.workoutService.vibrate();
      this.alertService.showAlert("Sync Exercise History", this.syncHistoryTooltipString);
      return;
    }
  }

  selectMenuMode(mode: MenuMode): void {
    this.workoutService.vibrate();
    if (!this.subscriptionService.canAccess(PremiumFeature.MENU_MODE)) {
      this.subscriptionService.showUpgradeModal();
      return;
    }
    this.appSettingsService.setMenuMode(mode);
  }


  /**
   * Triggers a full synchronization of all historical data, including
   * exercise `lastUsedAt` timestamps and routine `lastPerformed` dates.
   */
  async onSyncHistoryClick(): Promise<void> { // Method renamed for clarity
    const confirmation = await this.alertService.showConfirm(
      'Sync Full History',
      'This will scan all workout logs to update the "Last Used" date for all exercises AND the "Last Performed" date for all routines. This may take a moment. Proceed?'
    );

    if (confirmation && confirmation.data) {
      // Call the new, all-encompassing sync method in the TrackingService
      await this.trackingService.syncAllHistory();
    }
  }

  /**
   * Helper to manage strategies FormArray.
   * @returns The strategies FormArray.
   */
  get strategiesFormArray(): FormArray {
    return this.progressiveOverloadForm.get('strategies') as FormArray;
  }

  /**
   * Handles the change event for strategy checkboxes.
   * Adds or removes the strategy from the FormArray.
   */
  onStrategyChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const strategyValue = checkbox.value as ProgressiveOverloadStrategy;

    if (checkbox.checked) {
      this.strategiesFormArray.push(this.fb.control(strategyValue));
    } else {
      const index = this.strategiesFormArray.controls.findIndex(control => control.value === strategyValue);
      if (index !== -1) {
        this.strategiesFormArray.removeAt(index);
      }
    }
    this.progressiveOverloadForm.markAsDirty(); // Mark form as dirty to trigger save
  }

  /**
   * Checks if a specific strategy is currently selected in the FormArray.
   * Used to conditionally show/hide increment input fields in the template.
   */
  isStrategySelected(strategy: ProgressiveOverloadStrategy): boolean {
    return this.strategiesFormArray.value.includes(strategy);
  }
  public ProgressiveOverloadStrategy = ProgressiveOverloadStrategy;
}