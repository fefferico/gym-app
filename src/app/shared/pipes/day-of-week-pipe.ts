// src/app/shared/pipes/day-of-week.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'dayOfWeek',
  standalone: true
})
export class DayOfWeekPipe implements PipeTransform {
  transform(value: number | string | null | undefined, isCycleDay: boolean = false): string {
    if (value === null || value === undefined) return '';
    const dayNum = Number(value);

    if (isCycleDay) {
      return `Day ${dayNum}`;
    }

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNum] || `Day ${dayNum}`; // Fallback if somehow out of range for weekly
  }
}