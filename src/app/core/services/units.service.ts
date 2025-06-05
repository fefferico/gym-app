// src/app/core/services/units.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from './storage.service';
// --- Import toSignal ---
import { toSignal } from '@angular/core/rxjs-interop';

export type WeightUnit = 'kg' | 'lbs';

@Injectable({
  providedIn: 'root',
})
export class UnitsService {
  private storageService = inject(StorageService);
  private readonly UNIT_STORAGE_KEY = 'fitTrackPro_weightUnit';
  private readonly KG_TO_LBS_FACTOR = 2.20462;

  private unitSubject = new BehaviorSubject<WeightUnit>(this.loadUnitPreference());
  public unit$: Observable<WeightUnit> = this.unitSubject.asObservable();

  // --- Convert BehaviorSubject to Signal using toSignal ---
  public currentUnit = toSignal(this.unitSubject, { initialValue: 'kg' }); // Use toSignal

  constructor() {
    // console.log('UnitsService: Initial unit loaded:', this.currentUnit());
  }

  private loadUnitPreference(): WeightUnit {
    const storedUnit = this.storageService.getItem<WeightUnit>(this.UNIT_STORAGE_KEY);
    return (storedUnit === 'kg' || storedUnit === 'lbs') ? storedUnit : 'kg';
  }

  setUnitPreference(unit: WeightUnit): void {
    if (unit === 'kg' || unit === 'lbs') {
      this.storageService.setItem(this.UNIT_STORAGE_KEY, unit);
      this.unitSubject.next(unit);
      console.log('UnitsService: Unit preference set to', unit);
    } else {
      console.warn('UnitsService: Attempted to set invalid unit preference:', unit);
    }
  }

  convertFromKg(kgValue: number | null | undefined, targetUnit?: WeightUnit): number | null | undefined {
    if (kgValue === null || kgValue === undefined) {
      return kgValue;
    }
    const unit = targetUnit || this.currentUnit(); // Use the signal's value
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

  convertToKg(value: number | null | undefined, sourceUnit?: WeightUnit): number | null | undefined {
     if (value === null || value === undefined) {
      return value;
    }
    const unit = sourceUnit || this.currentUnit(); // Use the signal's value
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

  getUnitLabel(): WeightUnit {
    return this.currentUnit(); // Return the signal's value
  }
}