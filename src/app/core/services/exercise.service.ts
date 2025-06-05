// src/app/core/services/exercise.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { Exercise } from '../models/exercise.model';

@Injectable({
  providedIn: 'root',
})
export class ExerciseService {
  private http = inject(HttpClient);
  private exercises$: Observable<Exercise[]> | undefined;
  private readonly exercisesUrl = 'assets/data/exercises.json'; // <--- CORRECTED
  constructor() {
    // Optionally pre-load exercises if you want them immediately available
    this.getExercises().subscribe();
  }

  // Gets all exercises, caches the result for subsequent calls
  getExercises(): Observable<Exercise[]> {
    if (!this.exercises$) {
      this.exercises$ = this.http.get<Exercise[]>(this.exercisesUrl).pipe(
        tap(data => console.log('Fetched exercises:', data)), // For debugging
        shareReplay(1) // Cache the result and replay for new subscribers
      );
    }
    return this.exercises$;
  }

  getExerciseById(id: string): Observable<Exercise | undefined> {
    return this.getExercises().pipe(
      map((exercises: Exercise[]) => exercises.find(exercise => exercise.id === id))
    );
  }

  getExercisesByCategory(category: string): Observable<Exercise[]> {
    return this.getExercises().pipe(
      map(exercises => exercises.filter(ex => ex.category === category))
    );
  }

  getExercisesByMuscleGroup(muscleGroup: string): Observable<Exercise[]> {
    return this.getExercises().pipe(
      map(exercises => exercises.filter(ex => ex.muscleGroups.includes(muscleGroup)))
    );
  }

  // Utility to get all unique categories
  getUniqueCategories(): Observable<string[]> {
    return this.getExercises().pipe(
      map(exercises => [...new Set(exercises.map(ex => ex.category))])
    );
  }

  // Utility to get all unique primary muscle groups
  getUniquePrimaryMuscleGroups(): Observable<string[]> {
    return this.getExercises().pipe(
      map(exercises => [...new Set(exercises.map(ex => ex.primaryMuscleGroup))].sort())
    );
  }
}