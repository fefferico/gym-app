// src/app/core/services/stats.service.ts
import { Injectable, inject } from '@angular/core';
import { WorkoutLog, LoggedWorkoutExercise, LoggedSet } from '../models/workout-log.model';
import { ExerciseService } from './exercise.service'; // Assuming Exercise model is separate
import { parseISO, differenceInCalendarDays, isSameDay, subDays, getYear, getWeek, startOfWeek, format, subWeeks, addWeeks, differenceInWeeks, endOfWeek, isSameWeek } from 'date-fns'; // Add subWeeks, addWeeks, differenceInWeeks
import { Exercise } from '../models/exercise.model';
import { take } from 'rxjs';

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

    return Object.entries(weeklyData)
      .map(([weekKey, data]) => {
        const totalVolume = this.calculateTotalVolumeForAllLogs(data.logs);
        return {
          weekLabel: `Week of ${format(data.startDate, 'MMM d')}`,
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

    logs.forEach(log => {
      const logDate = parseISO(log.date);
      const weekStartDate = startOfWeek(logDate, { weekStartsOn: 1 });
      const weekKey = format(weekStartDate, 'yyyy-MM-dd'); // Use date string as a key

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          totalVolume: 0,
          // Create a more readable label, e.g., "W29 '24"
          weekLabel: `W${format(weekStartDate, 'w')} '${format(weekStartDate, 'yy')}`
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
     * Calculates the current workout streak (consecutive weeks with at least one workout,
     * ending this week or last week), including its start and end dates.
     * @param logs All workout logs.
     * @returns StreakInfo object. If no current streak, length is 0 and dates are undefined.
     */
  calculateCurrentWorkoutStreak(logs: WorkoutLog[]): StreakInfo {
    if (!logs || logs.length === 0) return { length: 0 };
    const sortedLogs = [...logs].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

    const today = new Date();
    let currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });

    let streak = 0;
    let streakEndDate: Date | undefined = undefined;

    // Check if there's a workout in the current week or last week to start the streak
    const lastLogDate = parseISO(sortedLogs[0].date);
    if (!isSameWeek(lastLogDate, today, { weekStartsOn: 1 }) && !isSameWeek(lastLogDate, new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 })) {
      return { length: 0 };
    }

    for (let i = 0; i < 52 * 5; i++) { // Limit search to 5 years
      const weekHasWorkout = sortedLogs.some(log => isSameWeek(parseISO(log.date), currentWeekStart, { weekStartsOn: 1 }));
      if (weekHasWorkout) {
        if (!streakEndDate) {
          streakEndDate = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
        }
        streak++;
        currentWeekStart = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        break;
      }
    }

    if (streak === 0) return { length: 0 };
    const streakStartDate = startOfWeek(new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 });
    return { length: streak, startDate: streakStartDate, endDate: streakEndDate };
  }

  calculateLongestWorkoutStreak(logs: WorkoutLog[]): StreakInfo {
    if (!logs || logs.length < 2) return this.calculateCurrentWorkoutStreak(logs);

    const sortedLogs = [...logs].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

    let longestStreak = 0;
    let currentStreak = 0;
    let longestStreakStartDate: Date | undefined, longestStreakEndDate: Date | undefined;
    let currentStreakStartDate: Date | undefined;

    const weeksWithWorkouts = Array.from(new Set(sortedLogs.map(log => format(startOfWeek(parseISO(log.date), { weekStartsOn: 1 }), 'yyyy-MM-dd'))))
      .map(dateStr => new Date(dateStr))
      .sort((a, b) => a.getTime() - b.getTime());

    for (let i = 0; i < weeksWithWorkouts.length; i++) {
      if (i === 0) {
        currentStreak = 1;
        currentStreakStartDate = weeksWithWorkouts[i];
      } else {
        const prevWeek = weeksWithWorkouts[i - 1];
        const currentWeek = weeksWithWorkouts[i];
        const expectedPrevWeek = new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000);

        if (isSameWeek(prevWeek, expectedPrevWeek, { weekStartsOn: 1 })) {
          currentStreak++;
        } else {
          if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
            longestStreakStartDate = currentStreakStartDate;
            longestStreakEndDate = endOfWeek(prevWeek, { weekStartsOn: 1 });
          }
          currentStreak = 1;
          currentStreakStartDate = currentWeek;
        }
      }
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
      longestStreakStartDate = currentStreakStartDate;
      longestStreakEndDate = endOfWeek(weeksWithWorkouts[weeksWithWorkouts.length - 1], { weekStartsOn: 1 });
    }

    return { length: longestStreak, startDate: longestStreakStartDate, endDate: longestStreakEndDate };
  }
}