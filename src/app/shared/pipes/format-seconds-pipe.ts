// src/app/shared/pipes/format-seconds.pipe.ts

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatSeconds',
  standalone: true,
})
export class FormatSecondsPipe implements PipeTransform {
  /**
   * Transforms a total number of seconds into a HH:mm:ss or mm:ss time format.
   * @param totalSeconds The total number of seconds to format.
   * @param showHours A boolean flag to determine if the hours part should be displayed.
   *                  Defaults to true if the duration is an hour or more, or if explicitly set.
   * @param forceShowHours A boolean to always show the hours part, regardless of duration.
   */
  transform(
    totalSeconds: number | string | null | undefined,
    showHours: boolean | 'auto' = 'auto',
    forceShowHours: boolean = false
  ): string {
    const numericSeconds = Number(totalSeconds);
    if (totalSeconds === null || totalSeconds === undefined || isNaN(numericSeconds)) {
      // Return a default format based on the parameter
      return forceShowHours || showHours === true ? '00:00:00' : '00:00';
    }

    const positiveSeconds = Math.max(0, Math.abs(numericSeconds));

    const hours = Math.floor(positiveSeconds / 3600);
    const minutes = Math.floor((positiveSeconds % 3600) / 60);
    const seconds = Math.floor(positiveSeconds % 60);

    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    // Determine if we should show the hours part
    let shouldDisplayHours = forceShowHours;
    if (showHours === 'auto' && !forceShowHours) {
      // In 'auto' mode, only show hours if the time is >= 1 hour.
      shouldDisplayHours = hours > 0;
    } else if (showHours === true) {
      shouldDisplayHours = true;
    } else if (showHours === false) {
      // If explicitly set to false, we need to add the hours to the minutes.
      // This handles cases like 90 minutes being displayed as "90:00" instead of "30:00".
      const totalMinutes = Math.floor(positiveSeconds / 60);
      const remainingSeconds = Math.floor(positiveSeconds % 60);
      return `${String(totalMinutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    if (shouldDisplayHours) {
      const formattedHours = String(hours).padStart(2, '0');
      return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    } else {
      const totalMinutes = Math.floor(positiveSeconds / 60);
      return `${String(totalMinutes).padStart(2, '0')}:${formattedSeconds}`;
    }
  }
}