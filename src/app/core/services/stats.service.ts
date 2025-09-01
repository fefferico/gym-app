// src/app/core/services/stats.service.ts
import { Injectable, inject } from '@angular/core';
import { WorkoutLog, LoggedWorkoutExercise, LoggedSet } from '../models/workout-log.model';
import { ExerciseService } from './exercise.service'; // Assuming Exercise model is separate
import { parseISO, differenceInCalendarDays, isSameDay, subDays, getYear, getWeek, startOfWeek, format, subWeeks, addWeeks, differenceInWeeks } from 'date-fns'; // Add subWeeks, addWeeks, differenceInWeeks
import { Exercise } from '../models/exercise.model';
import { take } from 'rxjs';

// Define interfaces for StatsService return types if not already global
export interface WeeklySummary {
  weekNumber: number;
  year: number;
  weekLabel: string; // e.g., "W23 2024" or "Jun 03 - Jun 09"
  weekLabelStart?: string; // Optional, for custom labels
  weekLabelEnd?: string; // Optional, for custom end labels
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
      const weekLabelStart = format(weekStartDate, 'dd/MM');
      const weekLabelEnd = format(subDays(weekStartDate, -6), 'dd/MM'); // 6 days after start gives the end of the week

      if (!summariesMap.has(weekKey)) {
        summariesMap.set(weekKey, {
          weekNumber: weekNum,
          year: year,
          weekLabel: weekLabel,
          weekLabelStart: weekLabelStart,
          weekLabelEnd: weekLabelEnd,
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
     * Calculates the current workout streak (consecutive weeks with at least one workout,
     * ending this week or last week), including its start and end dates.
     * @param logs All workout logs.
     * @returns StreakInfo object. If no current streak, length is 0 and dates are undefined.
     */
  calculateCurrentWorkoutStreak(logs: WorkoutLog[]): StreakInfo {
    const defaultStreak: StreakInfo = { length: 0 };
    if (!logs || logs.length === 0) {
      return defaultStreak;
    }
  
    // Get unique workout weeks, identified by the Monday of that week.
    const uniqueWorkoutWeeks = [
      ...new Set(
        logs.map(log => format(startOfWeek(parseISO(log.date), { weekStartsOn: 1 }), 'yyyy-MM-dd'))
      ),
    ]
      .map(dateStr => parseISO(dateStr))
      .sort((a, b) => b.getTime() - a.getTime()); // Newest unique workout weeks first
  
    if (uniqueWorkoutWeeks.length === 0) {
      return defaultStreak;
    }
  
    let streakLength = 0;
    let streakEndDate: Date | undefined = undefined;
    let streakStartDate: Date | undefined = undefined;
  
    const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const lastWeekStart = subWeeks(thisWeekStart, 1);
  
    let weekToMatch: Date;
  
    // Check if there was a workout this week.
    const workedOutThisWeek = uniqueWorkoutWeeks.some(week => isSameDay(week, thisWeekStart));
    if (workedOutThisWeek) {
      streakLength = 1;
      streakEndDate = thisWeekStart;
      streakStartDate = thisWeekStart;
      weekToMatch = subWeeks(thisWeekStart, 1); // Next week to check is last week.
    } else {
      // No workout this week. Check last week.
      const workedOutLastWeek = uniqueWorkoutWeeks.some(week => isSameDay(week, lastWeekStart));
      if (workedOutLastWeek) {
        streakLength = 1;
        streakEndDate = lastWeekStart;
        streakStartDate = lastWeekStart;
        weekToMatch = subWeeks(lastWeekStart, 1); // Next week to check is the week before last.
      } else {
        // No workout this week or last week, so the current streak is 0.
        return defaultStreak;
      }
    }
  
    // Continue checking backwards from `weekToMatch` through the sorted unique workout weeks.
    // We start from the second week in our sorted list because the first one started the streak.
    for (const logWeek of uniqueWorkoutWeeks.slice(1)) {
      if (isSameDay(logWeek, weekToMatch)) {
        streakLength++;
        streakStartDate = logWeek; // Update startDate as the streak extends backwards.
        weekToMatch = subWeeks(weekToMatch, 1); // Expect the next match on the week before this one.
      } else {
        // The sequence is broken. But first, check if the logWeek is from an even older week.
        // If the gap is larger than 1 week, the streak is definitely broken.
        if (differenceInWeeks(weekToMatch, logWeek) > 0) {
          break;
        }
      }
    }
  
    return {
      length: streakLength,
      startDate: streakStartDate,
      endDate: streakEndDate,
    };
  }
  
  /**
     * Calculates the longest workout streak (consecutive weeks with at least one workout)
     * found anywhere in the user's history, along with its start and end dates.
     * @param logs All workout logs.
     * @returns StreakInfo object with length, startDate, and endDate of the longest streak.
     */
  calculateLongestWorkoutStreak(logs: WorkoutLog[]): StreakInfo {
    const defaultStreak: StreakInfo = { length: 0 };
    if (!logs || logs.length < 1) {
      return defaultStreak;
    }
  
    // Get unique workout weeks, identified by the Monday of that week.
    const uniqueWorkoutWeeks = [
      ...new Set(
        logs.map(log => format(startOfWeek(parseISO(log.date), { weekStartsOn: 1 }), 'yyyy-MM-dd'))
      ),
    ]
      .map(dateStr => parseISO(dateStr))
      .sort((a, b) => a.getTime() - b.getTime()); // Oldest unique workout weeks first
  
    if (uniqueWorkoutWeeks.length === 0) {
      return defaultStreak;
    }
  
    let longestStreakInfo: StreakInfo = { length: 0 };
    let currentStreakLength = 0;
    let currentStreakStartDate: Date | undefined = undefined;
  
    for (let i = 0; i < uniqueWorkoutWeeks.length; i++) {
      const currentWeek = uniqueWorkoutWeeks[i];
  
      if (i === 0) {
        // First week in the history
        currentStreakLength = 1;
        currentStreakStartDate = currentWeek;
      } else {
        const previousWeek = uniqueWorkoutWeeks[i - 1];
        // Check if the current week is exactly one week after the previous one.
        const expectedNextWeek = addWeeks(previousWeek, 1);
        if (isSameDay(currentWeek, expectedNextWeek)) {
          // Streak continues
          currentStreakLength++;
        } else {
          // Streak is broken, start a new one
          currentStreakLength = 1;
          currentStreakStartDate = currentWeek;
        }
      }
  
      // Check if this current streak is longer than the longest found so far
      if (currentStreakLength > longestStreakInfo.length) {
        longestStreakInfo = {
          length: currentStreakLength,
          startDate: currentStreakStartDate,
          endDate: currentWeek, // The current week is the end of this current streak
        };
      }
    }
    return longestStreakInfo;
  }
}