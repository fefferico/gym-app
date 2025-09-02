// src/app/core/services/units.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from './storage.service';
// --- Import toSignal ---
import { toSignal } from '@angular/core/rxjs-interop';

export type WeightUnit = 'kg' | 'lbs';
export type BodyWeightUnit = 'kg' | 'lbs';
export type BodyMeasureUnit = 'cm' | 'inches';

@Injectable({
  providedIn: 'root',
})
export class UnitsService {
  private storageService = inject(StorageService);
  private readonly UNIT_STORAGE_KEY = 'fitTrackPro_weightUnit';
  private readonly BODY_WEIGHT_UNIT_STORAGE_KEY = 'fitTrackPro_bodyWeightUnit';
  private readonly BODY_MEASURE_UNIT_STORAGE_KEY = 'fitTrackPro_bodyMeasureUnit';
  private readonly KG_TO_LBS_FACTOR = 2.20462;

  private weightUnitSubject = new BehaviorSubject<WeightUnit>(this.loadWeightUnitPreference());
  public weightUnit$: Observable<WeightUnit> = this.weightUnitSubject.asObservable();

  private bodyWeightUnitSubject = new BehaviorSubject<BodyWeightUnit>(this.loadBodyWeightUnitPreference());
  public bodyWeightUnit$: Observable<BodyWeightUnit> = this.bodyWeightUnitSubject.asObservable();

  private bodyMeasureUnitSubject = new BehaviorSubject<BodyMeasureUnit>(this.loadBodyMeasureUnitPreference());
  public bodyMeasureUnit$: Observable<BodyMeasureUnit> = this.bodyMeasureUnitSubject.asObservable();

  // --- Convert BehaviorSubject to Signal using toSignal ---
  public currentWeightUnit = toSignal(this.weightUnitSubject, { initialValue: 'kg' }); // Use toSignal
  public currentBodyWeightUnit = toSignal(this.bodyWeightUnitSubject, { initialValue: 'kg' }); // Use toSignal
  public currentBodyeMeasureUnit = toSignal(this.bodyMeasureUnitSubject, { initialValue: 'cm' }); // Use toSignal

  constructor() {
    // console.log('UnitsService: Initial unit loaded:', this.currentUnit());
  }

  private loadWeightUnitPreference(): WeightUnit {
    const storedUnit = this.storageService.getItem<WeightUnit>(this.UNIT_STORAGE_KEY);
    return (storedUnit === 'kg' || storedUnit === 'lbs') ? storedUnit : 'kg';
  }

  private loadBodyWeightUnitPreference(): BodyWeightUnit {
    const storedUnit = this.storageService.getItem<BodyWeightUnit>(this.BODY_WEIGHT_UNIT_STORAGE_KEY);
    return (storedUnit === 'kg' || storedUnit === 'lbs') ? storedUnit : 'kg';
  }

  private loadBodyMeasureUnitPreference(): BodyMeasureUnit {
    const storedUnit = this.storageService.getItem<BodyMeasureUnit>(this.BODY_MEASURE_UNIT_STORAGE_KEY);
    return (storedUnit === 'cm' || storedUnit === 'inches') ? storedUnit : 'cm';
  }

  setWeightUnitPreference(unit: WeightUnit): void {
    if (unit === 'kg' || unit === 'lbs') {
      this.storageService.setItem(this.UNIT_STORAGE_KEY, unit);
      this.weightUnitSubject.next(unit);
      console.log('UnitsService: Unit preference set to', unit);
    } else {
      console.warn('UnitsService: Attempted to set invalid unit preference:', unit);
    }
  }

  setBodyWeightUnitPreference(unit: BodyWeightUnit): void {
    if (unit === 'kg' || unit === 'lbs') {
      this.storageService.setItem(this.BODY_WEIGHT_UNIT_STORAGE_KEY, unit);
      this.bodyWeightUnitSubject.next(unit);
      console.log('BodyWeightUnitsService: Unit preference set to', unit);
    } else {
      console.warn('BodyWeightUnitsService: Attempted to set invalid unit preference:', unit);
    }
  }

  setBodyMeasurementUnitPreference(unit: BodyMeasureUnit): void {
    if (unit === 'cm' || unit === 'inches') {
      this.storageService.setItem(this.BODY_MEASURE_UNIT_STORAGE_KEY, unit);
      this.bodyMeasureUnitSubject.next(unit);
      console.log('BodyMeasurementUnitsService: Unit preference set to', unit);
    } else {
      console.warn('BodyMeasurementUnitsService: Attempted to set invalid unit preference:', unit);
    }
  }

  convertFromKg(kgValue: number | null | undefined, targetUnit?: WeightUnit | BodyWeightUnit): number | null | undefined {
    if (kgValue === null || kgValue === undefined) {
      return kgValue;
    }
    const unit = targetUnit || this.currentWeightUnit(); // Use the signal's value
    if (unit === 'kg') {
      return kgValue;
    } else if (unit === 'lbs') {
      // Check if kgValue is a finite number before toFixed
      if (!Number.isFinite(kgValue)) {
        console.warn('UnitsService: Invalid number passed to convertFromKg:', kgValue);
        return kgValue;
      }
      return parseFloat((kgValue * this.KG_TO_LBS_FACTOR).toFixed(2));
    }
    console.warn('UnitsService: Attempted conversion to invalid target unit:', targetUnit);
    return kgValue;
  }

  convertToKg(value: number | null | undefined, sourceUnit?: WeightUnit | BodyWeightUnit): number | null | undefined {
    if (value === null || value === undefined) {
      return value;
    }
    const unit = sourceUnit || this.currentWeightUnit(); // Use the signal's value
    if (unit === 'kg') {
      return value;
    } else if (unit === 'lbs') {
      if (!Number.isFinite(value)) {
        console.warn('UnitsService: Invalid number passed to convertToKg:', value);
        return value;
      }
      return parseFloat((value / this.KG_TO_LBS_FACTOR).toFixed(2));
    }
    console.warn('UnitsService: Attempted conversion from invalid source unit:', sourceUnit);
    return value;
  }

  getWeightUnitLabel(): WeightUnit { // Renamed from getUnitSuffix for clarity if it returns full 'kg' or 'lbs'
    return this.currentWeightUnit();
  }

  getBodyWeightUnitLabel(): WeightUnit { // Renamed from getUnitSuffix for clarity if it returns full 'kg' or 'lbs'
    return this.currentWeightUnit();
  }

  getBodyMeasureUnitLabel(): BodyMeasureUnit { // Renamed from getUnitSuffix for clarity if it returns full 'kg' or 'lbs'
    return this.currentBodyeMeasureUnit();
  }

  // NEW METHOD
  /**
   * Returns the current weight unit abbreviation (e.g., "kg", "lbs").
   * This is essentially the same as getUnitLabel but named for suffix usage.
   */
  getUnitSuffix(): WeightUnit {
    return this.currentWeightUnit();
  }
}