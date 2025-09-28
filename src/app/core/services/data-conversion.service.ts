// src/app/core/services/data-conversion.service.ts
import { Injectable, inject } from '@angular/core';
import { UnitsService, WeightUnit, BodyWeightUnit, BodyMeasureUnit, MeasureUnit, DistanceMeasureUnit } from './units.service';
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
    const logs = this.trackingService.getDataForBackup();
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
          if (set.targetWeight != null) {
            set.targetWeight = this.unitsService.convertWeight(set.targetWeight, fromUnit, toUnit);
          }
        });
      });
    });
    this.workoutService.mergeData(routines);

    // 3. Personal Gym (CORRECTED)
    const gymEquipment = this.personalGymService.getDataForBackup();
    gymEquipment.forEach(item => {
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
            // CORRECTED: Property is 'increment' in the model
            if (item.increment != null) item.increment = this.unitsService.convertWeight(item.increment, fromUnit, toUnit);
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
           // CORRECTED: Property is 'resistance' in the model
          if (item.resistance != null) item.resistance = this.unitsService.convertWeight(item.resistance, fromUnit, toUnit);
          break;
        case 'Machine':
          // CORRECTED: Property is 'maxLoad' in the model
          if (item.maxLoad != null) item.maxLoad = this.unitsService.convertWeight(item.maxLoad, fromUnit, toUnit);
          break;
      }
    });
    this.personalGymService.mergeData(gymEquipment);

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
      if (profile.measurementHistory) {
        profile.measurementHistory.forEach(entry => {
          if (entry.weight != null) {
            entry.weight = this.unitsService.convertWeight(entry.weight, fromUnit, toUnit);
          }
        });
      }
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
      // CORRECTED: 'height' is the correct property, not 'height'
      const keysToConvert: (keyof Omit<UserMeasurements, 'weight'>)[] = ['height', 'chest', 'neck', 'waist', 'hips', 'rightArm'];
      
      if (profile.measurementHistory) {
        profile.measurementHistory.forEach(entry => {
          keysToConvert.forEach(key => {
            if ((entry as any)[key] != null) {
              (entry as any)[key] = this.unitsService.convertMeasure((entry as any)[key] as number, fromUnit, toUnit);
            }
          });
        });
      }
      
      if (profile.measurementGoals) {
        keysToConvert.forEach(key => {
          const goalKey = key as keyof typeof profile.measurementGoals;
          if ((profile.measurementGoals as any)![goalKey] != null) {
            (profile.measurementGoals as any)![goalKey] = this.unitsService.convertMeasure((profile.measurementGoals as any)![goalKey] as number, fromUnit, toUnit);
          }
        });
      }

      this.userProfileService.replaceData(profile);
    }
    this.spinnerService.hide();
    this.toastService.success('All body measurement data converted successfully!', 3000, "Conversion Complete");
  }

  /**
   * Converts all relevant general measurement data (cm/in) across the application.
   * This is primarily for equipment like resistance bands.
   * @param fromUnit The unit to convert from.
   * @param toUnit The unit to convert to.
   */
  public async convertAllMeasureData(fromUnit: MeasureUnit, toUnit: MeasureUnit): Promise<void> {
    this.spinnerService.show('Converting measurement data...');

    // Convert Personal Gym Equipment
    const gymEquipment = this.personalGymService.getDataForBackup();
    gymEquipment.forEach(item => {
      // Currently, only ResistanceBands have a 'length' property.
      if (item.category === 'Band' && item.length != null) {
        item.length = this.unitsService.convertMeasure(item.length, fromUnit, toUnit);
      }
    });
    this.personalGymService.mergeData(gymEquipment);
    
    // Add other data conversions here if needed in the future

    this.spinnerService.hide();
    this.toastService.success('All measurement data converted successfully!', 3000, "Conversion Complete");
  }

  /**
   * Converts all relevant general measurement data (km/mi) across the application.
   * This is primarily for cardio exercises logged with distance.
   * @param fromUnit The unit to convert from.
   * @param toUnit The unit to convert to.
   */
  public async convertAllDistanceMeasureData(fromUnit: DistanceMeasureUnit, toUnit: DistanceMeasureUnit): Promise<void> {
    this.spinnerService.show('Converting distance data...');

    // 1. Convert Workout Logs
    const logs = this.trackingService.getDataForBackup();
    logs.forEach(log => {
      log.exercises.forEach(ex => {
        ex.sets.forEach(set => {
          // Convert the actual distance performed
          if (set.distanceAchieved != null) {
            set.distanceAchieved = this.unitsService.convertDistance(set.distanceAchieved, fromUnit, toUnit);
          }
          // Convert the target distance, if one was set
          if (set.targetDistance != null) {
            set.targetDistance = this.unitsService.convertDistance(set.targetDistance, fromUnit, toUnit);
          }
        });
      });
    });
    // Save the updated logs back to storage
    await this.trackingService.replaceLogs(logs);

    // 2. Convert Routines
    const routines = this.workoutService.getDataForBackup();
    routines.forEach(routine => {
      routine.exercises.forEach(ex => {
        ex.sets.forEach(set => {
          // In routines, we only care about the target distance
          if (set.targetDistance != null) {
            set.targetDistance = this.unitsService.convertDistance(set.targetDistance, fromUnit, toUnit);
          }
        });
      });
    });
    // Save the updated routines back to storage
    this.workoutService.mergeData(routines);

    // 3. Convert Progressive Overload Settings
    const poSettings = this.progressiveOverloadService.getDataForBackup();
    if (poSettings.distanceIncrement != null) {
      poSettings.distanceIncrement = this.unitsService.convertDistance(poSettings.distanceIncrement, fromUnit, toUnit);
      this.progressiveOverloadService.replaceData(poSettings);
    }

    this.spinnerService.hide();
    this.toastService.success('All distance data converted successfully!', 3000, "Conversion Complete");
  }
}