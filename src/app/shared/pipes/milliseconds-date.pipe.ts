import { Pipe, PipeTransform } from '@angular/core';
import { format } from 'date-fns';

@Pipe({
  name: 'millisecondsDate',
  standalone: true // Make the pipe standalone for easy import
})
export class MillisecondsDatePipe implements PipeTransform {

  /**
   * Transforms a millisecond timestamp into a formatted date string.
   * @param value The timestamp in milliseconds.
   * @param formatString The desired output format (e.g., 'dd/MM/yy HH:mm').
   * @returns The formatted date string.
   */
  transform(value: number | undefined | null, formatString: string = 'dd/MM/yy HH:mm'): string {
    if (value === null || value === undefined || !isFinite(value)) {
      return ''; // Return an empty string for null, undefined, or non-finite values
    }

    try {
      const date = new Date(value);
      return format(date, formatString);
    } catch (error) {
      console.error(`Error formatting date from milliseconds value: ${value}`, error);
      return 'Invalid Date'; // Return a fallback string on error
    }
  }
}