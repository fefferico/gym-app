// src/app/core/services/stats.service.ts
import { Injectable, inject } from '@angular/core';
import { WorkoutLog, LoggedWorkoutExercise, LoggedSet } from '../models/workout-log.model';
import { ExerciseService } from './exercise.service'; // Assuming Exercise model is separate
import { parseISO, differenceInCalendarDays, isSameDay, subDays, getYear, getWeek, startOfWeek, format } from 'date-fns'; // Add subDays
import { Exercise } from '../models/exercise.model';
import { take } from 'rxjs';

// Define interfaces for StatsService return types if not already global
export interface WeeklySummary {
  weekNumber: number;
  year: number;
  weekLabel: string; // e.g., "W23 2024" or "Jun 03 - Jun 09"
  workoutCount: number;
  totalVolume: number;
}

export interface MuscleGroupPerformance {
  muscleGroup: string;
  volume: number;
  workoutCount: number; // How many workouts targeted this muscle group
  // exerciseCount?: number; // How many different exercises hit this group
}

// For weekly volume chart
export interface DatedVolume {
  date: Date; // or string
  weekLabel: string; // Could be the start date of the week or a label "W1 '24"
  totalVolume: number;
}

export interface StreakInfo {
  length: number;
  startDate?: Date; // Store as Date object for easier manipulation
  endDate?: Date;   // Store as Date object
}

@Injectable({
  providedIn: 'root',
})
export class StatsService {
  private exerciseService = inject(ExerciseService);

  constructor() { }

  calculateSetVolume(set: LoggedSet): number {
    return (set.repsAchieved || 0) * (set.weightUsed || 0);
  }

  calculateWorkoutVolume(log: WorkoutLog): number {
    let workoutVolume = 0;
    log.exercises.forEach(ex => {
      ex.sets.forEach(set => {
        workoutVolume += this.calculateSetVolume(set);
      });
    });
    return workoutVolume;
  }

  calculateTotalVolumeForAllLogs(logs: WorkoutLog[]): number {
    return logs.reduce((total, log) => total + this.calculateWorkoutVolume(log), 0);
  }

  getWeeklySummaries(logs: WorkoutLog[]): WeeklySummary[] {
    if (!logs || logs.length === 0) return [];

    const summariesMap = new Map<string, WeeklySummary>();

    logs.forEach(log => {
      const logDate = new Date(log.startTime); // Use startTime for more accurate week placement
      const year = getYear(logDate);
      const weekNum = getWeek(logDate, { weekStartsOn: 1 }); // Monday as first day of week
      const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`;

      const weekStartDate = startOfWeek(logDate, { weekStartsOn: 1 });
      // const weekEndDate = endOfWeek(logDate, { weekStartsOn: 1 });
      // const weekLabel = `${format(weekStartDate, 'MMM dd')} - ${format(weekEndDate, 'MMM dd, yyyy')}`;
      const weekLabel = `Week ${weekNum}, ${year}`;


      if (!summariesMap.has(weekKey)) {
        summariesMap.set(weekKey, {
          weekNumber: weekNum,
          year: year,
          weekLabel: weekLabel,
          workoutCount: 0,
          totalVolume: 0,
        });
      }

      const summary = summariesMap.get(weekKey)!;
      summary.workoutCount++;
      summary.totalVolume += this.calculateWorkoutVolume(log);
    });

    return Array.from(summariesMap.values()).sort((a, b) => {
      if (a.year === b.year) {
        return a.weekNumber - b.weekNumber; // Sort by week number within the same year
      }
      return a.year - b.year; // Sort by year
    });
  }

  // New method for chart data
  getWeeklyVolumeForChart(logs: WorkoutLog[]): DatedVolume[] {
    const summaries = this.getWeeklySummaries(logs); // Reuse existing logic
    return summaries.map(s => ({
      date: new Date(s.year, 0, (s.weekNumber * 7) - 6), // Approximate start date of week for sorting/display
      weekLabel: s.weekLabel,
      totalVolume: s.totalVolume
    })).sort((a, b) => a.date.getTime() - b.date.getTime()); // Ensure sorted by date for line chart
  }


  async getPerformanceByMuscleGroup(logs: WorkoutLog[]): Promise<MuscleGroupPerformance[]> {
    if (!logs || logs.length === 0) return [];

    const performanceMap = new Map<string, { volume: number; workoutCountSet: Set<string> }>();
    const allExercisesFromLibrary = await new Promise<Exercise[]>(resolve => {
      this.exerciseService.getExercises().pipe(take(1)).subscribe(exs => resolve(exs));
    });
    const exerciseMap = new Map(allExercisesFromLibrary.map(ex => [ex.id, ex]));


    logs.forEach(log => {
      const distinctMuscleGroupsInWorkout = new Set<string>();
      log.exercises.forEach(loggedEx => {
        const baseExercise = exerciseMap.get(loggedEx.exerciseId);
        if (baseExercise && baseExercise.muscleGroups) {
          const exerciseVolume = loggedEx.sets.reduce((sum, set) => sum + this.calculateSetVolume(set), 0);
          baseExercise.muscleGroups.forEach(group => {
            const normalizedGroup = group.toLowerCase().trim();
            if (!performanceMap.has(normalizedGroup)) {
              performanceMap.set(normalizedGroup, { volume: 0, workoutCountSet: new Set() });
            }
            const perf = performanceMap.get(normalizedGroup)!;
            perf.volume += exerciseVolume; // Could be divided by number of muscle groups if splitting volume
            distinctMuscleGroupsInWorkout.add(normalizedGroup);
          });
        }
      });
      distinctMuscleGroupsInWorkout.forEach(group => {
        performanceMap.get(group)?.workoutCountSet.add(log.id);
      });
    });

    return Array.from(performanceMap.entries()).map(([muscleGroup, data]) => ({
      muscleGroup: muscleGroup,
      volume: Math.round(data.volume),
      workoutCount: data.workoutCountSet.size,
    })).sort((a, b) => b.volume - a.volume); // Sort by highest volume
  }

  /**
   * Calculates the current workout streak (consecutive days with at least one workout).
   * Assumes logs are sorted newest first or will be sorted.
   */
  /**
     * Calculates the current workout streak (consecutive days with at least one workout,
     * ending today or yesterday), including its start and end dates.
     * @param logs All workout logs.
     * @returns StreakInfo object. If no current streak, length is 0 and dates are undefined.
     */
  calculateCurrentWorkoutStreak(logs: WorkoutLog[]): StreakInfo { // Return type changed
    const defaultStreak: StreakInfo = { length: 0 };
    if (!logs || logs.length === 0) {
      return defaultStreak;
    }

    // Get unique workout days, sorted newest first
    const uniqueWorkoutDays = [...new Set(logs.map(log => format(parseISO(log.date), 'yyyy-MM-dd')))]
      .map(dateStr => parseISO(dateStr))
      .sort((a, b) => b.getTime() - a.getTime()); // Newest unique workout days first

    if (uniqueWorkoutDays.length === 0) {
      return defaultStreak;
    }

    let streakLength = 0;
    let streakEndDate: Date | undefined = undefined;
    let streakStartDate: Date | undefined = undefined;
    let dateToMatch = new Date(); // Start checking from today
    dateToMatch.setHours(0, 0, 0, 0);

    // Check if there was a workout today
    const workedOutToday = uniqueWorkoutDays.some(day => isSameDay(day, dateToMatch));

    if (workedOutToday) {
      streakLength = 1;
      streakEndDate = new Date(dateToMatch); // Clone the date
      streakStartDate = new Date(dateToMatch); // Initially, start and end are the same
      dateToMatch = subDays(dateToMatch, 1); // Next day to check is yesterday
    } else {
      // No workout today. Check if there was a workout yesterday.
      const yesterday = subDays(dateToMatch, 1);
      const workedOutYesterday = uniqueWorkoutDays.some(day => isSameDay(day, yesterday));
      if (workedOutYesterday) {
        streakLength = 1;
        streakEndDate = new Date(yesterday);
        streakStartDate = new Date(yesterday);
        dateToMatch = subDays(yesterday, 1); // Next day to check is day before yesterday
      } else {
        // No workout today or yesterday, so the current streak is 0.
        return defaultStreak;
      }
    }

    // Continue checking backwards from `dateToMatch` through the sorted unique workout days
    // We need to find the first uniqueWorkoutDay that matches our streak start (today or yesterday)
    // and then iterate from there.

    let foundStartOfConsecutiveDays = false;
    for (const logDay of uniqueWorkoutDays) {
      if (!foundStartOfConsecutiveDays) {
        // Skip logs until we find the day that established the streak (today or yesterday)
        if (isSameDay(logDay, streakEndDate!)) { // streakEndDate is guaranteed to be set if streakLength > 0
          foundStartOfConsecutiveDays = true;
        }
        continue; // Continue to the next logDay if we haven't found the start yet, or if it's the first day.
      }

      // Now we are looking at days *before* the streakEndDate
      if (isSameDay(logDay, dateToMatch)) {
        streakLength++;
        streakStartDate = new Date(logDay); // Update startDate as the streak extends backwards
        dateToMatch = subDays(dateToMatch, 1); // Expect the next match on the day before this one
      } else {
        // The sequence is broken
        break;
      }
    }

    return {
      length: streakLength,
      startDate: streakStartDate,
      endDate: streakEndDate,
    };
  }

  /**
     * Calculates the longest workout streak (consecutive days with at least one workout)
     * found anywhere in the user's history, along with its start and end dates.
     * @param logs All workout logs.
     * @returns StreakInfo object with length, startDate, and endDate of the longest streak.
     */
  calculateLongestWorkoutStreak(logs: WorkoutLog[]): StreakInfo { // Return type changed
    const defaultStreak: StreakInfo = { length: 0 };
    if (!logs || logs.length < 1) {
      return defaultStreak;
    }

    const uniqueWorkoutDays = [...new Set(logs.map(log => format(parseISO(log.date), 'yyyy-MM-dd')))]
      .map(dateStr => parseISO(dateStr))
      .sort((a, b) => a.getTime() - b.getTime()); // Oldest unique workout days first

    if (uniqueWorkoutDays.length === 0) {
      return defaultStreak;
    }

    let longestStreakInfo: StreakInfo = { length: 0 };
    let currentStreakLength = 0;
    let currentStreakStartDate: Date | undefined = undefined;

    for (let i = 0; i < uniqueWorkoutDays.length; i++) {
      const currentDay = uniqueWorkoutDays[i];

      if (i === 0 || differenceInCalendarDays(currentDay, uniqueWorkoutDays[i - 1]) !== 1) {
        // Streak is broken or this is the first day in uniqueWorkoutDays
        // Start a new streak
        currentStreakLength = 1;
        currentStreakStartDate = currentDay;
      } else {
        // Streak continues
        currentStreakLength++;
      }

      // Check if this current streak is longer than the longest found so far
      if (currentStreakLength > longestStreakInfo.length) {
        longestStreakInfo = {
          length: currentStreakLength,
          startDate: currentStreakStartDate,
          endDate: currentDay, // The current day is the end of this current streak
        };
      }
    }
    return longestStreakInfo;
  }
}