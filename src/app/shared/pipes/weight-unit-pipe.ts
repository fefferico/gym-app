// src/app/shared/pipes/weight-unit.pipe.ts
import { Pipe, PipeTransform, inject } from '@angular/core';
import { UnitsService, WeightUnit } from '../../core/services/units.service';
import { DecimalPipe } from '@angular/common'; // Import DecimalPipe for formatting

@Pipe({
  name: 'weightUnit', // Use this name in templates
  standalone: true,   // Make it a standalone pipe
})
export class WeightUnitPipe implements PipeTransform {
  // Inject services needed by the pipe
  private decimalPipe = inject(DecimalPipe); // For numerical formatting
  private unitsService = inject(UnitsService);

  /**
   * Transforms a weight value from kilograms (the stored unit) to the user's preferred unit.
   * @param kgValue The weight value in kilograms (stored format).
   * @param digitsInfo Decimal pipe formatting string (e.g., '1.0-2' for 2 decimal places).
   * @returns The formatted weight value in the preferred unit, followed by the unit label (e.g., "100.00 kg" or "220.46 lbs"). Returns null for null/undefined input.
   */
  transform(kgValue: number | null | undefined, digitsInfo: string = '1.0-2'): string | null {
    if (kgValue === null || kgValue === undefined) {
      return null; // Return null if the input is null or undefined
    }

    // Use the service to convert from the stored unit (kg) to the current preferred unit
    const convertedValue = this.unitsService.convertWeight(kgValue, 'kg', this.unitsService.currentWeightUnit());

    // Use DecimalPipe for formatting the number itself
    const formattedValue = this.decimalPipe.transform(convertedValue, digitsInfo);

    // Get the preferred unit label
    const unitLabel = this.unitsService.getWeightUnitSuffix();

    // Combine formatted value and unit label
    return `${formattedValue} ${unitLabel}`;
  }
}