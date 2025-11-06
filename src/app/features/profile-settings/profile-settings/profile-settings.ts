// src/app/features/profile-settings/profile-settings.component.ts
import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { LanguageService } from '../../../core/services/language.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, TooltipDirective, TranslateModule],
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
  private dataConversionService = inject(DataConversionService);
  protected subscriptionService = inject(SubscriptionService);
  protected languageService = inject(LanguageService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService); // Inject TranslateService

  // Map language codes to their translation keys
  languageDisplayNames: { [key: string]: string } = {
    en: 'settings.languageSelector.english',
    es: 'settings.languageSelector.spanish',
    it: 'settings.languageSelector.italian',
    de: 'settings.languageSelector.german',
    fr: 'settings.languageSelector.french',
    ru: 'settings.languageSelector.russian',
    ja: 'settings.languageSelector.japanese',
    zh: 'settings.languageSelector.chinese',
    pt: 'settings.languageSelector.portuguese',
    ar: 'settings.languageSelector.arabic'
  };

  private subscriptions = new Subscription();

  public PremiumFeature = PremiumFeature;

  protected currentVibrator = navigator;

  syncHistoryTooltipString = this.translate.instant('settings.dataManagement.syncTooltip');

  goalsForm!: FormGroup;
  profileForm!: FormGroup;
  appSettingsForm!: FormGroup;
  progressiveOverloadForm!: FormGroup;

  handleUpgradeClick(): void {
    this.subscriptionService.togglePremium_DEV_ONLY();
    const newStatus = this.subscriptionService.isPremium() ? this.translate.instant('settings.subscription.premiumMember') : this.translate.instant('settings.subscription.freeTier');
    this.toastService.success(this.translate.instant('toasts.upgradeSuccess', { status: newStatus }), 3000, this.translate.instant('toasts.statusUpdated'));

    if (this.subscriptionService.isPremium()) {
      this.toastService.veryImportant(this.translate.instant('toasts.upgradeGratitude'), 10000, this.translate.instant('toasts.thankYou'));
      this.workoutService.enableAllRoutines_DEV_ONLY();
    }
  }

  handlePremiumFeatureOrNavigate(feature: PremiumFeature, event: Event, route?: any[]): void {
    this.workoutService.vibrate();
    if (this.subscriptionService.canAccess(feature)) {
      if (route) {
        this.router.navigate(route);
      }
    } else {
      event.preventDefault();
      event.stopPropagation();
      this.subscriptionService.showUpgradeModal();
    }
  }

  // Populate arrays with translation keys
  readonly genders: { label: string, value: Gender }[] = [
    { label: 'settings.userProfile.genders.male', value: 'male' },
    { label: 'settings.userProfile.genders.female', value: 'female' },
    { label: 'settings.userProfile.genders.other', value: 'other' },
    { label: 'settings.userProfile.genders.preferNotToSay', value: 'prefer_not_to_say' },
  ];
  protected readonly progressiveOverloadStrategies = [
    { label: 'settings.progressiveOverload.strategies.increaseWeight', value: ProgressiveOverloadStrategy.WEIGHT },
    { label: 'settings.progressiveOverload.strategies.increaseReps', value: ProgressiveOverloadStrategy.REPS },
    { label: 'settings.progressiveOverload.strategies.increaseDistance', value: ProgressiveOverloadStrategy.DISTANCE },
    { label: 'settings.progressiveOverload.strategies.increaseDuration', value: ProgressiveOverloadStrategy.DURATION }
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

    this.goalsForm = this.fb.group({
      weight: [null as number | null, [Validators.min(0)]],
      waist: [null as number | null, [Validators.min(0)]],
    });

    this.appSettingsForm = this.fb.group({
      enableTimerCountdownSound: [true],
      playerMode: ['compact'],
      countdownSoundSeconds: [5, [Validators.required, Validators.min(1), Validators.max(60)]],
      enablePresetTimer: [false],
      presetTimerDurationSeconds: [10, [Validators.required, Validators.min(3), Validators.max(60)]],
      weightStep: [2.5, [Validators.required, Validators.min(0.01), Validators.max(50)]],
      enableTrueGymMode: [false],
      durationStep: [5, [Validators.required, Validators.min(1), Validators.pattern("^[0-9]*$")]],
      distanceStep: [0.1, [Validators.required, Validators.min(0.01)]],
      restStep: [5, [Validators.required, Validators.min(1), Validators.pattern("^[0-9]*$")]],
      showMetricTarget: [false]
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

  toggleTrueGymMode(event: Event): void {
    this.workoutService.vibrate();
    const inputElement = event.target as HTMLInputElement;
    const isChecked = inputElement.checked;

    if (this.workoutService.isPausedSession()) {
      // Prevent the change and show an alert
      inputElement.checked = !isChecked; // Revert the visual state of the toggle
      this.appSettingsForm.get('enableTrueGymMode')?.setValue(!isChecked, { emitEvent: false }); // Revert form value without triggering listeners
      this.alertService.showAlert(
        this.translate.instant('settings.player.trueGymMode.disabledTitle'),
        this.translate.instant('settings.player.trueGymMode.disabledMessage')
      );
      this.cdr.detectChanges(); // Ensure the view updates
    } else {
      this.appSettingsForm.get('enableTrueGymMode')?.setValue(isChecked);
      this.appSettingsService.saveSettings({ enableTrueGymMode: isChecked });
    }
  }

  toggleMetricTarget(event: Event): void {
    this.workoutService.vibrate();
    const inputElement = event.target as HTMLInputElement;
    const isChecked = inputElement.checked;

    this.appSettingsForm.get('showMetricTarget')?.setValue(isChecked);
    this.appSettingsService.saveSettings({ showMetricTarget: isChecked });
  }

  togglePlayerMode(event: Event): void {
    this.workoutService.vibrate();
    const inputElement = event.target as HTMLInputElement;
    const isChecked = inputElement.checked;
    const newMode = isChecked ? 'focus' : 'compact';

    if (this.workoutService.isPausedSession()) {
      this.alertService.showAlert(
        this.translate.instant('alerts.playerModeChangeDisabledTitle'),
        this.translate.instant('alerts.playerModeChangeDisabledMessage')
      );
      inputElement.checked = !isChecked;
      this.cdr.detectChanges();
    } else {
      this.appSettingsForm.get('playerMode')?.setValue(newMode);
      this.appSettingsService.saveSettings({ playerMode: newMode });
    }
  }

  async selectWeightUnit(unit: WeightUnit): Promise<void> {
    const oldUnit = this.unitsService.currentWeightUnit();
    if (unit === oldUnit) return;
    await this.dataConversionService.convertAllWeightData(oldUnit, unit);
    this.unitsService.setWeightUnitPreference(unit);
  }

  async selectMeasureUnit(unit: MeasureUnit): Promise<void> {
    const oldUnit = this.unitsService.currentMeasureUnit();
    if (unit === oldUnit) return;
    await this.dataConversionService.convertAllMeasureData(oldUnit, unit);
    this.unitsService.setMeasureUnitPreference(unit);
  }

  async selectDistanceMeasureUnit(unit: DistanceMeasureUnit): Promise<void> {
    const oldUnit = this.unitsService.currentDistanceMeasureUnit();
    if (unit === oldUnit) return;
    await this.dataConversionService.convertAllDistanceMeasureData(oldUnit, unit);
    this.unitsService.setDistanceMeasureUnitPreference(unit);
  }

  async selectBodyWeightUnit(unit: BodyWeightUnit): Promise<void> {
    const oldUnit = this.unitsService.currentBodyWeightUnit();
    if (unit === oldUnit) return;
    await this.dataConversionService.convertAllBodyWeightData(oldUnit, unit);
    this.unitsService.setBodyWeightUnitPreference(unit);
  }

  async selectBodyMeasureUnit(unit: BodyMeasureUnit): Promise<void> {
    const oldUnit = this.unitsService.currentBodyMeasureUnit();
    if (unit === oldUnit) return;
    await this.dataConversionService.convertAllBodyMeasureData(oldUnit, unit);
    this.unitsService.setBodyMeasureUnitPreference(unit);
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
    }
    this.loadProfileData();
    this.loadProgressiveOverloadSettings();
    this.loadGoalsData();

    // +++ 2. INITIALIZE the control and SUBSCRIBE to its changes +++
    // Initialize with the current language from the service
    this.languageControl = new FormControl(this.languageService.currentLang(), { nonNullable: true });

    // Listen for changes from the dropdown and update the service
    this.subscriptions.add(
      this.languageControl.valueChanges.subscribe(lang => {
        // Check if the new value is different from the current one to avoid redundant calls
        if (lang && lang !== this.languageService.currentLang()) {
          this.workoutService.vibrate();
          this.languageService.setLanguage(lang);
          const translatedLangName = this.translate.instant(this.languageDisplayNames[lang] || lang);
          this.toastService.success(this.translate.instant('toasts.languageSet', { language: translatedLangName }), 2000);
        }
      })
    );

    this.subscriptions.add(
      this.appSettingsService.appSettings$.subscribe(settings => {
        if (settings) {
          this.appSettingsForm.reset(settings, { emitEvent: false });
          this.cdr.detectChanges();
        }
      })
    );

    this.subscriptions.add(
      this.appSettingsForm.valueChanges.pipe(
        debounceTime(700),
        filter(() => this.appSettingsForm.valid && this.appSettingsForm.dirty),
        tap(value => {
          this.appSettingsService.saveSettings(value as AppSettings);
          this.appSettingsForm.markAsPristine({ onlySelf: false });
          this.toastService.info(this.translate.instant('toasts.appSettingsSaved'), 1500);
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
          this.toastService.info(this.translate.instant('toasts.goalsSaved'), 1500);
        })
      ).subscribe()
    );
  }

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
      this.toastService.error(this.translate.instant('alerts.invalidFields'));
      return;
    }
    const measurements = this.profileForm.get('measurements')?.value as UserMeasurements;
    this.userProfileService.addOrUpdateMeasurementEntry(measurements as MeasurementEntry);
    this.profileForm.get('measurements')!.markAsPristine();
    this.toastService.info(this.translate.instant('toasts.measurementsSaved'), 1500);
  }

  private saveGeneralData(): void {
    const profileData = {
      username: this.profileForm.get('general.username')?.value,
      gender: this.profileForm.get('general.gender')?.value,
      age: this.profileForm.get('general.age')?.value
    };
    this.userProfileService.saveProfile(profileData);
    this.toastService.info(this.translate.instant('toasts.profileSaved'), 1500);
    this.profileForm.markAsPristine();
  }

  listenForProgressiveOverloadChanges(): void {
    this.subscriptions.add(
      this.progressiveOverloadForm.valueChanges.pipe(
        debounceTime(700),
        filter(() => this.progressiveOverloadForm.valid && this.progressiveOverloadForm.dirty),
        tap(settings => {
          this.progressiveOverloadService.saveSettings(settings as ProgressiveOverloadSettings);
          this.progressiveOverloadForm.markAsPristine({ onlySelf: false });
          this.toastService.info(this.translate.instant('toasts.progressiveOverloadSaved'), 1500);
        })
      ).subscribe()
    );

    const enabledControl = this.progressiveOverloadForm.get('enabled');
    const setupStrategyValidators = (strategies: ProgressiveOverloadStrategy[]) => {
      const weightControl = this.progressiveOverloadForm.get('weightIncrement');
      const repsControl = this.progressiveOverloadForm.get('repsIncrement');
      const distanceControl = this.progressiveOverloadForm.get('distanceIncrement');
      const durationControl = this.progressiveOverloadForm.get('durationIncrement');
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

    this.subscriptions.add(this.strategiesFormArray.valueChanges.subscribe(strategies => setupStrategyValidators(strategies)));
    this.subscriptions.add(enabledControl?.valueChanges.subscribe(enabled => setupStrategyValidators(enabled ? this.strategiesFormArray.value : [])));
  }

  loadProfileData(): void {
    const profile = this.userProfileService.getProfile();
    if (profile) {
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
        general: { username: null, gender: null, age: null },
        measurements: { height: null, weight: null, age: null, chest: null, waist: null, hips: null, rightArm: null }
      }, { emitEvent: false });
    }
  }

  loadProgressiveOverloadSettings(): void {
    const settings = this.progressiveOverloadService.getSettings();
    this.strategiesFormArray.clear();
    if (settings.strategies && settings.strategies.length > 0) {
      settings.strategies.forEach(strategy => {
        this.strategiesFormArray.push(this.fb.control(strategy), { emitEvent: false });
      });
    }
    this.progressiveOverloadForm.reset({ ...settings, strategies: this.strategiesFormArray.value }, { emitEvent: false });
  }

  async exportData(): Promise<void> {
    this.spinnerService.show(this.translate.instant('spinners.exporting'));
    const photos = await this.imageStorageService.getAllImagesForBackup();
    const backupData = {
      version: this.BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      profile: this.userProfileService.getDataForBackup(),
      progressPhotos: photos,
      appSettings: this.appSettingsService.getDataForBackup(),
      progressiveOverload: this.progressiveOverloadService.getDataForBackup(),
      routines: this.workoutService.getDataForBackup(),
      programs: this.trainingProgramService.getDataForBackup(),
      exercises: this.exerciseService.getDataForBackup(),
      workoutLogs: this.trackingService.getDataForBackup(),
      activityLogs: this.activityService.getLogsForBackup(),
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
    this.toastService.success(this.translate.instant('toasts.exportInitiated'), 3000);
  }

  importData(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.type !== 'application/json') {
      this.alertService.showAlert(this.translate.instant('common.error'), this.translate.instant('alerts.invalidFileType'));
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result as string;
        const importedData = JSON.parse(fileContent);
        if (typeof importedData !== 'object' || importedData === null) {
          this.alertService.showAlert(this.translate.instant('common.error'), this.translate.instant('alerts.invalidBackupFormat'));
          input.value = ''; return;
        }
        const version = importedData.version;
        if (version > this.BACKUP_VERSION) {
          this.alertService.showAlert(this.translate.instant('common.error'), this.translate.instant('alerts.backupVersionTooNew', { version: version, appVersion: this.BACKUP_VERSION }));
          input.value = ''; return;
        }
        this.alertService.showConfirm(this.translate.instant('common.warning'), this.translate.instant('alerts.importWarning')).then(async (result) => {
          if (result && result.data) {
            this.spinnerService.show(this.translate.instant('spinners.importing'));
            if (version >= 6 && importedData.progressPhotos) {
              await this.imageStorageService.importImages(importedData.progressPhotos);
            }
            if (version >= 5) {
              this.userProfileService.mergeData(importedData.profile as UserProfile | null);
            } else if (version >= 2) {
              this.userProfileService.replaceData(importedData.profile as UserProfile | null);
            } else {
              this.userProfileService.replaceData(null);
            }
            if (!this.subscriptionService.isPremium()) {
              const existingRoutines = this.workoutService.getCurrentRoutines().filter(r => !r.isDisabled);
              const importedRoutines = Array.isArray(importedData.routines) ? importedData.routines : [];
              const enabledImportedRoutines = importedRoutines.filter((r: any) => !r.isDisabled);
              const totalEnabledCount = existingRoutines.length + enabledImportedRoutines.length;
              if (totalEnabledCount > 4) {
                importedRoutines.forEach((r: any, index: number) => r.isDisabled = index > 3 ? true : false);
                this.toastService.veryImportant(this.translate.instant('toasts.routinesDisabledOnImport', { count: enabledImportedRoutines.length }), 10000, this.translate.instant('toasts.routinesDisabledTitle'));
                this.workoutService.mergeData(importedRoutines);
              }
            } else {
              this.workoutService.mergeData(importedData.routines);
            }
            if (importedData.workoutLogs) {
              this.trackingService.replaceLogs(importedData.workoutLogs || []);
              this.trackingService.replacePBs(importedData.personalBests || {});
            }
            const activityLogsToImport = importedData.activityLogs || importedData.activitiyLogs;
            if (Array.isArray(activityLogsToImport)) {
              this.activityService.mergeData(activityLogsToImport);
            }
            if (importedData.personalGym) {
              this.personalGymService.mergeData(importedData.personalGym);
            }
            if (version >= 4) this.progressiveOverloadService.replaceData(importedData.progressiveOverload);
            if (version >= 3) {
              this.exerciseService.mergeData(importedData.exercises);
              this.trainingProgramService.mergeData(importedData.programs);
            }
            if (version >= 2) this.appSettingsService.replaceData(importedData.appSettings);
            this.loadProfileData();
            this.loadProgressiveOverloadSettings();
            this.loadGoalsData();
            this.spinnerService.hide();
            this.toastService.success(this.translate.instant('toasts.importSuccess'), 5000, this.translate.instant('toasts.importComplete'));
          } else {
            this.toastService.info(this.translate.instant('toasts.importCancelled'), 2000);
          }
        });
      } catch (error) {
        console.error('Error processing imported file:', error);
        this.alertService.showAlert(this.translate.instant('common.error'), this.translate.instant('alerts.errorProcessingFile'));
      } finally {
        input.value = '';
      }
    };
    reader.onerror = () => {
      this.alertService.showAlert(this.translate.instant('common.error'), this.translate.instant('alerts.errorReadingFile'));
      input.value = '';
    };
    reader.readAsText(file);
  }

  async clearAllAppData(): Promise<void> {
    const initialConfirmation = await this.alertService.showConfirmationDialog(
      this.translate.instant('alerts.clearAllDataWarningTitle'),
      this.translate.instant('alerts.clearAllDataWarningMessage'),
      [
        { text: this.translate.instant('common.cancel'), role: "cancel", data: false, icon: 'cancel' } as AlertButton,
        { text: this.translate.instant('settings.dataManagement.resetButton'), role: "confirm", data: true, cssClass: "bg-red-600", icon: 'trash' } as AlertButton,
      ],
    );
    if (initialConfirmation && initialConfirmation.data) {
      const absoluteConfirmation = await this.alertService.showPromptDialog(
        this.translate.instant('alerts.clearAllDataConfirmationTitle'),
        this.translate.instant('alerts.clearAllDataConfirmationMessage'),
        [{
          name: 'confirmDialogInput',
          type: 'text',
          placeholder: this.translate.instant('alerts.clearAllDataConfirmationPlaceholder'),
          value: '',
          autofocus: true,
        }] as AlertInput[],
        this.translate.instant('alerts.clearAllDataButton')
      );
      const response: string | null = absoluteConfirmation && typeof absoluteConfirmation['confirmDialogInput'] === 'string' ? absoluteConfirmation['confirmDialogInput'] : null;
      if (!response || response.toUpperCase() !== 'DELETE') {
        this.alertService.showAlert(this.translate.instant('common.cancelled'), this.translate.instant('alerts.clearAllDataCancelledMessage'));
        return;
      }
      if (this.trackingService.clearAllWorkoutLogs_DEV_ONLY) await this.trackingService.clearAllWorkoutLogs_DEV_ONLY();
      if (this.trackingService.clearAllPersonalBests_DEV_ONLY) await this.trackingService.clearAllPersonalBests_DEV_ONLY();
      if (this.workoutService.clearAllRoutines_DEV_ONLY) await this.workoutService.clearAllRoutines_DEV_ONLY();
      if (this.activityService.clearAllActivities_DEV_ONLY) await this.activityService.clearAllActivities_DEV_ONLY();
      if (this.userProfileService.clearUserProfile_DEV_ONLY) this.userProfileService.clearUserProfile_DEV_ONLY();
      if (this.appSettingsService.clearAppSettings_DEV_ONLY) this.appSettingsService.clearAppSettings_DEV_ONLY();
      if (this.progressiveOverloadService.clearSettings_DEV_ONLY) this.progressiveOverloadService.clearSettings_DEV_ONLY();
      if (this.trainingProgramService.deactivateAllPrograms) this.trainingProgramService.deactivateAllPrograms();
      this.loadProfileData();
      this.loadProgressiveOverloadSettings();
      await this.alertService.showAlert(this.translate.instant('common.info'), this.translate.instant('alerts.clearAllDataSuccessMessage'));
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
    this.router.navigate(['/personal-gym']);
  }

  navigateToPersonalBests(): void {
    this.router.navigate(['/profile/personal-bests']);
  }

  navigateToBodyMeasurements(): void {
    this.router.navigate(['/profile/measurements']);
  }

  showSyncHistoryTooltip(): void {
    if (this.platformId === 'browser' && window.innerWidth <= 768) {
      this.workoutService.vibrate();
      this.alertService.showAlert(this.translate.instant('alerts.syncHistoryTitle'), this.syncHistoryTooltipString);
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

  async onSyncHistoryClick(): Promise<void> {
    const confirmation = await this.alertService.showConfirm(
      this.translate.instant('alerts.syncFullHistoryTitle'),
      this.translate.instant('alerts.syncFullHistoryMessage')
    );
    if (confirmation && confirmation.data) {
      await this.trackingService.syncAllHistory();
    }
  }

  get strategiesFormArray(): FormArray {
    return this.progressiveOverloadForm.get('strategies') as FormArray;
  }

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
    this.progressiveOverloadForm.markAsDirty();
  }

  isStrategySelected(strategy: ProgressiveOverloadStrategy): boolean {
    return this.strategiesFormArray.value.includes(strategy);
  }
  public ProgressiveOverloadStrategy = ProgressiveOverloadStrategy;

  onLanguageChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const lang = selectElement.value;
    if (lang) {
      this.workoutService.vibrate();
      this.languageService.setLanguage(lang);
      const translatedLangName = this.translate.instant(this.languageDisplayNames[lang] || lang);
      this.toastService.success(this.translate.instant('toasts.languageSet', { language: translatedLangName }), 2000);
    }
  }

  languageControl!: FormControl<string>;

}