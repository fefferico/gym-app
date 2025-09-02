// src/app/core/services/data-conversion.service.ts
import { Injectable, inject } from '@angular/core';
import { UnitsService, WeightUnit, BodyWeightUnit, BodyMeasureUnit } from './units.service';
import { TrackingService } from './tracking.service';
import { WorkoutService } from './workout.service';
import { UserProfileService } from './user-profile.service';
import { PersonalGymService } from './personal-gym.service';
import { SpinnerService } from './spinner.service';
import { ToastService } from './toast.service';
import { ProgressiveOverloadService } from './progressive-overload.service.ts';
import { UserMeasurements } from '../models/user-profile.model';

@Injectable({
  providedIn: 'root'
})
export class DataConversionService {
  private unitsService = inject(UnitsService);
  private trackingService = inject(TrackingService);
  private workoutService = inject(WorkoutService);
  private userProfileService = inject(UserProfileService);
  private personalGymService = inject(PersonalGymService);
  private progressiveOverloadService = inject(ProgressiveOverloadService);
  private spinnerService = inject(SpinnerService);
  private toastService = inject(ToastService);

  constructor() { }

  /**
   * Converts all relevant weight data across the application.
   * @param fromUnit The unit to convert from.
   * @param toUnit The unit to convert to.
   */
  public async convertAllWeightData(fromUnit: WeightUnit, toUnit: WeightUnit): Promise<void> {
    this.spinnerService.show('Converting weight data...');

    // 1. Workout Logs & PBs (Unchanged)
    const logs = this.trackingService.getLogsForBackup();
    logs.forEach(log => {
      log.exercises.forEach(ex => {
        ex.sets.forEach(set => {
          if (set.weightUsed != null) {
            set.weightUsed = this.unitsService.convertWeight(set.weightUsed, fromUnit, toUnit);
          }
          if (set.targetWeight != null) {
            set.targetWeight = this.unitsService.convertWeight(set.targetWeight, fromUnit, toUnit);
          }
        });
      });
    });
    await this.trackingService.replaceLogs(logs);

    // 2. Routines (Unchanged)
    const routines = this.workoutService.getDataForBackup();
    routines.forEach(routine => {
      routine.exercises.forEach(ex => {
        ex.sets.forEach(set => {
          if (set.weight != null) {
            set.weight = this.unitsService.convertWeight(set.weight, fromUnit, toUnit);
          }
        });
      });
    });
    this.workoutService.mergeData(routines);

    // ==========================================================
    // START: CORRECTED PERSONAL GYM CONVERSION
    // ==========================================================
    const gymEquipment = this.personalGymService.getDataForBackup();
    gymEquipment.forEach(item => {
      // Use a type-safe switch on the category to access the correct properties
      switch (item.category) {
        case 'Dumbbell':
        case 'Kettlebell':
        case 'Macebell':
        case 'Club':
          if (item.weightType === 'fixed' && item.weight != null) {
            item.weight = this.unitsService.convertWeight(item.weight, fromUnit, toUnit);
          } else if (item.weightType === 'adjustable') {
            if (item.minweight != null) item.minweight = this.unitsService.convertWeight(item.minweight, fromUnit, toUnit);
            if (item.maxweight != null) item.maxweight = this.unitsService.convertWeight(item.maxweight, fromUnit, toUnit);
            if (item.incrementKg != null) item.incrementKg = this.unitsService.convertWeight(item.incrementKg, fromUnit, toUnit);
          }
          break;
        case 'Plate':
        case 'Barbell':
          if (item.weight != null) {
            item.weight = this.unitsService.convertWeight(item.weight, fromUnit, toUnit);
          }
          break;
        case 'Bag':
          if (item.maxweight != null) item.maxweight = this.unitsService.convertWeight(item.maxweight, fromUnit, toUnit);
          if (item.currentWeightKg != null) item.currentWeightKg = this.unitsService.convertWeight(item.currentWeightKg, fromUnit, toUnit);
          break;
        case 'Band':
          if (item.resistanceKg != null) item.resistanceKg = this.unitsService.convertWeight(item.resistanceKg, fromUnit, toUnit);
          break;
        case 'Machine':
          if (item.maxLoadKg != null) item.maxLoadKg = this.unitsService.convertWeight(item.maxLoadKg, fromUnit, toUnit);
          break;
      }
    });
    this.personalGymService.mergeData(gymEquipment);
    // ==========================================================
    // END: CORRECTED PERSONAL GYM CONVERSION
    // ==========================================================

    // 4. Progressive Overload Settings (Unchanged)
    const poSettings = this.progressiveOverloadService.getDataForBackup();
    if (poSettings.weightIncrement != null) {
      poSettings.weightIncrement = this.unitsService.convertWeight(poSettings.weightIncrement, fromUnit, toUnit);
      this.progressiveOverloadService.replaceData(poSettings);
    }

    this.spinnerService.hide();
    this.toastService.success('All weight data converted successfully!', 3000, "Conversion Complete");
  }

  /**
   * Converts all relevant body weight data across the application.
   * @param fromUnit The unit to convert from.
   * @param toUnit The unit to convert to.
   */
  public async convertAllBodyWeightData(fromUnit: BodyWeightUnit, toUnit: BodyWeightUnit): Promise<void> {
    this.spinnerService.show('Converting body weight data...');
    const profile = this.userProfileService.getDataForBackup();
    if (profile) {
      // Convert history
      if (profile.measurementHistory) {
        profile.measurementHistory.forEach(entry => {
          if (entry.weight != null) {
            entry.weight = this.unitsService.convertWeight(entry.weight, fromUnit, toUnit);
          }
        });
      }
      // Convert goals
      if (profile.measurementGoals?.weight != null) {
        profile.measurementGoals.weight = this.unitsService.convertWeight(profile.measurementGoals.weight, fromUnit, toUnit);
      }
      this.userProfileService.replaceData(profile);
    }
    this.spinnerService.hide();
    this.toastService.success('All body weight data converted successfully!', 3000, "Conversion Complete");
  }

  /**
   * Converts all relevant body measurement data (cm/in) across the application.
   * @param fromUnit The unit to convert from.
   * @param toUnit The unit to convert to.
   */
  public async convertAllBodyMeasureData(fromUnit: BodyMeasureUnit, toUnit: BodyMeasureUnit): Promise<void> {
    this.spinnerService.show('Converting body measurement data...');
    const profile = this.userProfileService.getDataForBackup();
    if (profile) {
      // CORRECTED: 'heightCm' is the correct property name, not 'height'.
      const keysToConvert: (keyof Omit<UserMeasurements, 'weight'>)[] = ['height', 'chest', 'neck', 'waist', 'hips', 'rightArm'];
      
      // Convert history
      if (profile.measurementHistory) {
        profile.measurementHistory.forEach(entry => {
          keysToConvert.forEach(key => {
            if ((entry as any)[key] != null) {
              (entry as any)[key] = this.unitsService.convertBodyMeasure((entry as any)[key] as number, fromUnit, toUnit);
            }
          });
        });
      }
      
      // Convert goals
      if (profile.measurementGoals) {
        keysToConvert.forEach(key => {
          const goalKey = key as keyof typeof profile.measurementGoals;
          if ((profile.measurementGoals as any)![goalKey] != null) {
            (profile.measurementGoals as any)![goalKey] = this.unitsService.convertBodyMeasure((profile.measurementGoals as any)![goalKey] as number, fromUnit, toUnit);
          }
        });
      }

      this.userProfileService.replaceData(profile);
    }
    this.spinnerService.hide();
    this.toastService.success('All body measurement data converted successfully!', 3000, "Conversion Complete");
  }
}