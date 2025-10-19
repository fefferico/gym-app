// src/app/pipes/is-weighted.pipe.ts

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'isWeighted',
  // standalone: true // Use this if you are on a new standalone component architecture
})
export class IsWeightedPipe implements PipeTransform {

  /**
   * Checks if an exercise has any sets with a valid weight.
   * @param exercise The exercise object to check.
   * @returns `true` if it's a weighted exercise, otherwise `false`.
   */
  transform(exercise: any): boolean {
    // Guard against null/undefined exercise object or missing/empty sets array.
    if (!exercise?.sets?.length) {
      return false;
    }

    // Return true if ANY set in the array has a weightLogged property that is a number.
    // `set.weightLogged != null` also covers cases where it's 0.
    const weighted = exercise.sets.some((set: any) => 
      (typeof set.weightLogged === 'number' && set.weightLogged > 0 ) ||
      (typeof set.weight === 'number' && set.weight > 0 ) ||
      (typeof set.targetWeight === 'number' && set.targetWeight > 0 )
    );
    return weighted;
  }
}