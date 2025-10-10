// src/app/core/services/stats.service.ts
import { Injectable, inject } from '@angular/core';
import { WorkoutLog, LoggedSet } from '../models/workout-log.model';
import { ExerciseService } from './exercise.service'; // Assuming Exercise model is separate
import { parseISO, subDays, startOfWeek, format, differenceInWeeks, endOfWeek, isSameWeek, addDays } from 'date-fns'; // Add subWeeks, addWeeks, differenceInWeeks
import { Exercise } from '../models/exercise.model';
import { take } from 'rxjs';
import { ActivityLog } from '../models/activity-log.model';
import { TranslateService } from '@ngx-translate/core';

// Define interfaces for StatsService return types if not already global
export interface WeeklySummary {
  weekLabel: string;
  workoutCount: number;
  totalVolume: number;
  weekStartDate: Date; // Use Date object
  weekEndDate: Date;   // Use Date object
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
  private translate = inject(TranslateService);

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
    if (!logs || logs.length === 0) {
      return [];
    }

    const weeklyData: { [week: string]: { logs: WorkoutLog[], startDate: Date, endDate: Date } } = {};

    logs.forEach(log => {
      const logDate = parseISO(log.date);
      const weekStartDate = startOfWeek(logDate, { weekStartsOn: 1 }); // Monday start
      const weekEndDate = endOfWeek(logDate, { weekStartsOn: 1 });
      const weekKey = format(weekStartDate, 'yyyy-MM-dd');

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { logs: [], startDate: weekStartDate, endDate: weekEndDate };
      }
      weeklyData[weekKey].logs.push(log);
    });

    const weekOfText = this.translate.instant('statsService.weekOf');

    return Object.entries(weeklyData)
      .map(([weekKey, data]) => {
        const totalVolume = this.calculateTotalVolumeForAllLogs(data.logs);
        return {
          weekLabel: `${weekOfText} ${format(data.startDate, 'MMM d')}`,
          workoutCount: data.logs.length,
          totalVolume: totalVolume,
          weekStartDate: data.startDate, // Return the full Date object
          weekEndDate: data.endDate,     // Return the full Date object
        };
      })
      .sort((a, b) => b.weekStartDate.getTime() - a.weekStartDate.getTime()); // Sort descending
  }

  calculateTotalVolume(log: WorkoutLog): number {
    return log.exercises.reduce((total, exercise) => {
      const exerciseVolume = exercise.sets.reduce((setTotal, set) => {
        return setTotal + ((set.weightUsed ?? 0) * (set.repsAchieved ?? 0));
      }, 0);
      return total + exerciseVolume;
    }, 0);
  }

  // New method for chart data
  getWeeklyVolumeForChart(logs: WorkoutLog[]): DatedVolume[] {
    if (!logs || logs.length === 0) {
      return [];
    }

    const weeklyData: { [weekKey: string]: { totalVolume: number, weekLabel: string } } = {};
    const weekPrefix = this.translate.instant('statsService.weekPrefix');

    logs.forEach(log => {
      const logDate = parseISO(log.date);
      const weekStartDate = startOfWeek(logDate, { weekStartsOn: 1 });
      const weekKey = format(weekStartDate, 'yyyy-MM-dd'); // Use date string as a key

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          totalVolume: 0,
          // Create a more readable label, e.g., "W29 '24"
          weekLabel: `${weekPrefix}${format(weekStartDate, 'w')} '${format(weekStartDate, 'yy')}`
        };
      }
      weeklyData[weekKey].totalVolume += this.calculateTotalVolume(log);
    });

    // Sort by the weekKey (which is a date string) to ensure chronological order
    const sortedWeekKeys = Object.keys(weeklyData).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // Map the sorted keys to the final DatedVolume[] array structure
    return sortedWeekKeys.map(weekKey => ({
      date: parseISO(weekKey), // Add the missing 'date' property
      weekLabel: weeklyData[weekKey].weekLabel,
      totalVolume: weeklyData[weekKey].totalVolume
    }));
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
   * Calculates the current workout/activity streak (consecutive weeks with at least one entry),
   * ending this week or last week.
   * @param workoutLogs All workout logs.
   * @param activityLogs All activity logs.
   * @returns StreakInfo object.
   */
  calculateCurrentWorkoutStreak(workoutLogs: WorkoutLog[], activityLogs: ActivityLog[]): StreakInfo {
    // Combine dates from both workout and activity logs
    const allActivityDates = [
      ...workoutLogs.map(log => parseISO(log.date)),
      ...activityLogs.map(log => parseISO(log.date))
    ];

    if (allActivityDates.length === 0) return { length: 0 };

    // Sort all dates in descending order to easily find the most recent one
    allActivityDates.sort((a, b) => b.getTime() - a.getTime());

    const today = new Date();
    let currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    let streak = 0;
    let streakEndDate: Date | undefined = undefined;

    // Check if the most recent activity is in the current or previous week to start the streak
    const lastLogDate = allActivityDates[0];
    const lastWeek = subDays(today, 7);
    if (!isSameWeek(lastLogDate, today, { weekStartsOn: 1 }) && !isSameWeek(lastLogDate, lastWeek, { weekStartsOn: 1 })) {
      return { length: 0 };
    }

    // Iterate backwards week by week
    for (let i = 0; i < 52 * 5; i++) { // Limit search to 5 years
      const weekHasActivity = allActivityDates.some(logDate =>
        isSameWeek(logDate, currentWeekStart, { weekStartsOn: 1 })
      );

      if (weekHasActivity) {
        if (!streakEndDate) {
          streakEndDate = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
        }
        streak++;
        currentWeekStart = subDays(currentWeekStart, 7); // Go to the previous week
      } else {
        break; // The streak is broken
      }
    }

    if (streak === 0) return { length: 0 };

    const streakStartDate = startOfWeek(addDays(currentWeekStart, 7), { weekStartsOn: 1 });
    return { length: streak, startDate: streakStartDate, endDate: streakEndDate };
  }

  /**
   * Calculates the longest workout/activity streak from the entire log history.
   * @param workoutLogs All workout logs.
   * @param activityLogs All activity logs.
   * @returns StreakInfo object for the longest streak.
   */
  calculateLongestWorkoutStreak(workoutLogs: WorkoutLog[], activityLogs: ActivityLog[]): StreakInfo {
    const allActivityDates = [
      ...workoutLogs.map(log => parseISO(log.date)),
      ...activityLogs.map(log => parseISO(log.date))
    ];

    if (allActivityDates.length < 2) return this.calculateCurrentWorkoutStreak(workoutLogs, activityLogs);

    // Get a unique, sorted list of all weeks that have any activity
    const weeksWithActivities = Array.from(new Set(allActivityDates.map(logDate =>
      format(startOfWeek(logDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    )))
      .map(dateStr => new Date(dateStr))
      .sort((a, b) => a.getTime() - b.getTime());

    if (weeksWithActivities.length === 0) return { length: 0 };

    let longestStreak = 0;
    let currentStreak = 0;
    let longestStreakStartDate: Date | undefined;
    let longestStreakEndDate: Date | undefined;
    let currentStreakStartDate: Date | undefined;

    for (let i = 0; i < weeksWithActivities.length; i++) {
      if (i === 0) {
        currentStreak = 1;
        currentStreakStartDate = weeksWithActivities[i];
      } else {
        const prevWeek = weeksWithActivities[i - 1];
        const currentWeek = weeksWithActivities[i];

        // Check if the current week is exactly one week after the previous one
        if (differenceInWeeks(currentWeek, prevWeek) === 1) {
          currentStreak++;
        } else {
          // Streak is broken
          if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
            longestStreakStartDate = currentStreakStartDate;
            longestStreakEndDate = endOfWeek(prevWeek, { weekStartsOn: 1 });
          }
          // Start a new streak
          currentStreak = 1;
          currentStreakStartDate = currentWeek;
        }
      }
    }

    // Check the last streak after the loop finishes
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
      longestStreakStartDate = currentStreakStartDate;
      longestStreakEndDate = endOfWeek(weeksWithActivities[weeksWithActivities.length - 1], { weekStartsOn: 1 });
    }

    return { length: longestStreak, startDate: longestStreakStartDate, endDate: longestStreakEndDate };
  }
}