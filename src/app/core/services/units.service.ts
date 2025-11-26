// src/app/core/services/units.service.ts
import { inject, Injectable, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { TranslateService } from '@ngx-translate/core';

export type WeightUnit = 'kg' | 'lbs';
export type MeasureUnit = 'cm' | 'in';
export type DistanceMeasureUnit = 'km' | 'mi';
export type BodyWeightUnit = 'kg' | 'lbs';
export type BodyMeasureUnit = 'cm' | 'in';

@Injectable({
  providedIn: 'root'
})
export class UnitsService {
  private readonly WEIGHT_UNIT_KEY = 'fitTrackPro_weightUnit';
  private readonly MEASURE_UNIT_KEY = 'fitTrackPro_measureUnit';
  private readonly DISTANCE_MEASURE_UNIT_KEY = 'fitTrackPro_distanceMeasureUnit';
  private readonly BODY_WEIGHT_UNIT_KEY = 'fitTrackPro_bodyWeightUnit';
  private readonly BODY_MEASURE_UNIT_KEY = 'fitTrackPro_bodyMeasureUnit';

  // --- SIGNALS for reactive unit preferences ---
  currentWeightUnit = signal<WeightUnit>('kg');
  currentMeasureUnit = signal<MeasureUnit>('cm');
  currentDistanceMeasureUnit = signal<DistanceMeasureUnit>('km');
  currentBodyWeightUnit = signal<BodyWeightUnit>('kg');
  currentBodyMeasureUnit = signal<BodyMeasureUnit>('cm');
  private translate = inject(TranslateService);

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

    const storedDistanceMeasureUnit = this.storageService.getItem<DistanceMeasureUnit>(this.DISTANCE_MEASURE_UNIT_KEY);
    this.currentDistanceMeasureUnit.set(storedDistanceMeasureUnit || 'km');

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

  public setDistanceMeasureUnitPreference(unit: DistanceMeasureUnit): void {
    this.storageService.setItem(this.DISTANCE_MEASURE_UNIT_KEY, unit);
    this.currentDistanceMeasureUnit.set(unit);
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
    const key = this.currentWeightUnit() === 'kg' ? 'units.weight.kg' : 'units.weight.lbs';
    return this.translate.instant(key);
  }

  public getMeasureUnitSuffix(): string {
    const key = this.currentMeasureUnit() === 'cm' ? 'units.measure.cm' : 'units.measure.in';
    return this.translate.instant(key);
  }

  public getDistanceUnitSuffix(): string {
    const key = this.currentDistanceMeasureUnit() === 'km' ? 'units.distance.km' : 'units.distance.mi';
    return this.translate.instant(key);
  }

  public getBodyWeightUnitSuffix(): string {
    const key = this.currentBodyWeightUnit() === 'kg' ? 'units.weight.kg' : 'units.weight.lbs';
    return this.translate.instant(key);
  }

  public getBodyMeasureUnitSuffix(): string {
    const key = this.currentBodyMeasureUnit() === 'cm' ? 'units.measure.cm' : 'units.measure.in';
    return this.translate.instant(key);

  }



  // --- CONVERSION LOGIC ---

  // Weight Conversions
  public convertWeight(value: number | null | undefined, from: WeightUnit, to: WeightUnit): number {
    if (!value) return 0;
    if (from === to) return value;
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

  // Distance Measurement Conversions
  public convertDistance(value: number, from: DistanceMeasureUnit, to: DistanceMeasureUnit): number {
    if (from === to || !value) return value;
    const kmToMi = 0.621371;
    const result = from === 'km' ? value * kmToMi : value / kmToMi;
    // Round to 3 decimal places for better precision with distance
    return parseFloat(result.toFixed(3));
  }
}