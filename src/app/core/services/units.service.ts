// src/app/core/services/units.service.ts
import { Injectable, signal } from '@angular/core';
import { StorageService } from './storage.service';

export type WeightUnit = 'kg' | 'lbs';
export type MeasureUnit = 'cm' | 'in';
export type BodyWeightUnit = 'kg' | 'lbs';
export type BodyMeasureUnit = 'cm' | 'in';

@Injectable({
  providedIn: 'root'
})
export class UnitsService {
  private readonly WEIGHT_UNIT_KEY = 'fitTrackPro_weightUnit';
  private readonly MEASURE_UNIT_KEY = 'fitTrackPro_measureUnit';
  private readonly BODY_WEIGHT_UNIT_KEY = 'fitTrackPro_bodyWeightUnit';
  private readonly BODY_MEASURE_UNIT_KEY = 'fitTrackPro_bodyMeasureUnit';

  // --- SIGNALS for reactive unit preferences ---
  currentWeightUnit = signal<WeightUnit>('kg');
  currentMeasureUnit = signal<MeasureUnit>('cm');
  currentBodyWeightUnit = signal<BodyWeightUnit>('kg');
  currentBodyMeasureUnit = signal<BodyMeasureUnit>('cm');

  constructor(private storageService: StorageService) {
    this._loadPreferences();
  }

  /**
   * Loads all unit preferences from storage, defaulting if not found.
   */
  private _loadPreferences(): void {
    const storedWeightUnit = this.storageService.getItem<WeightUnit>(this.WEIGHT_UNIT_KEY);
    this.currentWeightUnit.set(storedWeightUnit || 'kg');

    const storedMeasureUnit = this.storageService.getItem<MeasureUnit>(this.MEASURE_UNIT_KEY);
    this.currentMeasureUnit.set(storedMeasureUnit || 'cm');

    const storedBodyWeightUnit = this.storageService.getItem<BodyWeightUnit>(this.BODY_WEIGHT_UNIT_KEY);
    this.currentBodyWeightUnit.set(storedBodyWeightUnit || 'kg');

    const storedBodyMeasureUnit = this.storageService.getItem<BodyMeasureUnit>(this.BODY_MEASURE_UNIT_KEY);
    this.currentBodyMeasureUnit.set(storedBodyMeasureUnit || 'cm');


  }

  // --- Public Methods to Set Preferences ---

  public setWeightUnitPreference(unit: WeightUnit): void {
    this.storageService.setItem(this.WEIGHT_UNIT_KEY, unit);
    this.currentWeightUnit.set(unit);
  }

  public setMeasureUnitPreference(unit: MeasureUnit): void {
    this.storageService.setItem(this.MEASURE_UNIT_KEY, unit);
    this.currentMeasureUnit.set(unit);
  }

  public setBodyWeightUnitPreference(unit: BodyWeightUnit): void {
    this.storageService.setItem(this.BODY_WEIGHT_UNIT_KEY, unit);
    this.currentBodyWeightUnit.set(unit);
  }

  public setBodyMeasureUnitPreference(unit: BodyMeasureUnit): void {
    this.storageService.setItem(this.BODY_MEASURE_UNIT_KEY, unit);
    this.currentBodyMeasureUnit.set(unit);
  }

  // --- Unit Labels for UI Display ---

  public getWeightUnitSuffix(): string {
    return this.currentWeightUnit() === 'kg' ? 'kg' : 'lbs';
  }

  public getMeasureUnitSuffix(): string {
    return this.currentMeasureUnit() === 'cm' ? 'cm' : 'in';
  }

  public getBodyWeightUnitSuffix(): string {
    return this.currentBodyWeightUnit() === 'kg' ? 'kg' : 'lbs';
  }

  public getBodyMeasureUnitSuffix(): string {
    return this.currentBodyMeasureUnit() === 'cm' ? 'cm' : 'in';
  }



  // --- CONVERSION LOGIC ---

  // Weight Conversions
  public convertWeight(value: number | null | undefined, from: WeightUnit, to: WeightUnit): number {
    if (from === to || !value) return 0;
    const kgToLbs = 2.20462;
    const result = from === 'kg' ? value * kgToLbs : value / kgToLbs;
    // Round to a reasonable number of decimal places
    return parseFloat(result.toFixed(2));
  }

  // Body Measurement Conversions
  public convertMeasure(value: number, from: BodyMeasureUnit | MeasureUnit, to: BodyMeasureUnit | MeasureUnit): number {
    if (from === to || !value) return value;
    const cmToIn = 0.393701;
    const result = from === 'cm' ? value * cmToIn : value / cmToIn;
    return parseFloat(result.toFixed(2));
  }
}