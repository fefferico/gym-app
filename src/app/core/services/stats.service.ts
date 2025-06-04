// src/app/core/services/stats.service.ts
import { Injectable, inject } from '@angular/core';
import { WorkoutLog, LoggedWorkoutExercise, LoggedSet } from '../models/workout-log.model';
import { ExerciseService } from './exercise.service'; // Assuming Exercise model is separate
import { getWeek, getYear, startOfWeek, format } from 'date-fns'; // Date utility
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

@Injectable({
  providedIn: 'root',
})
export class StatsService {
  private exerciseService = inject(ExerciseService);

  constructor() {}

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
    })).sort((a,b) => a.date.getTime() - b.date.getTime()); // Ensure sorted by date for line chart
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
}