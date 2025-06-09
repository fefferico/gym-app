// src/app/core/services/exercise.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, take, tap } from 'rxjs/operators';
import { Exercise } from '../models/exercise.model'; // Ensure this path is correct
import { StorageService } from './storage.service';
import { TrackingService } from './tracking.service'; // Ensure this path is correct
import { v4 as uuidv4 } from 'uuid';
import { EXERCISES_DATA } from './exercises-data';

@Injectable({
  providedIn: 'root',
})
export class ExerciseService {
  private http = inject(HttpClient);
  private storageService = inject(StorageService);
  private trackingService = inject(TrackingService);

  private readonly EXERCISES_STORAGE_KEY = 'fitTrackPro_exercises';
  private readonly EXERCISES_JSON_PATH = 'assets/data/exercises.json'; // Relative path for HttpClient

  private exercisesSubject: BehaviorSubject<Exercise[]>;
  public exercises$: Observable<Exercise[]>;

  constructor() {
    const initialExercises = this._loadExercisesFromStorage();
    this.exercisesSubject = new BehaviorSubject<Exercise[]>(initialExercises);
    this.exercises$ = this.exercisesSubject.asObservable().pipe(
      shareReplay(1) // Cache the last emitted list of exercises
    );

    // If storage is empty, attempt to seed from the JSON file.
    if (initialExercises.length === 0) {
      this._seedExercisesFromAssets();
    }
  }

  private _loadExercisesFromStorage(): Exercise[] {
    const exercises = this.storageService.getItem<Exercise[]>(this.EXERCISES_STORAGE_KEY);
    return exercises ? exercises.sort((a, b) => a.name.localeCompare(b.name)) : [];
  }

  private _saveExercisesToStorage(exercises: Exercise[]): void {
    this.storageService.setItem(this.EXERCISES_STORAGE_KEY, exercises);
    // Emit a new sorted array to trigger subscribers
    this.exercisesSubject.next([...exercises].sort((a, b) => a.name.localeCompare(b.name)));
  }

  private _seedExercisesFromAssets(): void {
    // Use the imported EXERCISES_DATA constant instead of loading from JSON
    const exercisesFromData = EXERCISES_DATA as Exercise[];
    if (this.exercisesSubject.getValue().length === 0 && exercisesFromData && exercisesFromData.length > 0) {
      this._saveExercisesToStorage(exercisesFromData);
      console.log('ExerciseService: Seed exercises loaded successfully from EXERCISES_DATA and saved to storage.');
    } else if (this.exercisesSubject.getValue().length > 0) {
      console.log('ExerciseService: Exercises already present in storage, skipping seed from EXERCISES_DATA.');
    } else {
      console.warn('ExerciseService: EXERCISES_DATA was empty or contained no exercises.');
    }
  }

  getExercises(): Observable<Exercise[]> {
    return this.exercises$;
  }

  getExerciseById(id: string): Observable<Exercise | undefined> {
    return this.exercises$.pipe(
      // `first()` or `take(1)` is good here if you only need the current state once.
      // If this method is called before `exercises$` has emitted (e.g., during initial seeding),
      // `first()` will wait for the first emission.
      map(exercises => exercises.find(exercise => exercise.id === id)),
      take(1) // Ensures the observable completes after finding (or not finding) the exercise.
    );
  }

  addExercise(exerciseData: Omit<Exercise, 'id'>): Observable<Exercise> {
    // Ensure exercises are loaded before trying to add.
    // This could also be handled by an app initializer if seeding is critical before app start.
    const currentExercises = this.exercisesSubject.getValue();
    const newExercise: Exercise = {
      ...exerciseData,
      id: uuidv4(),
    };
    const updatedExercises = [...currentExercises, newExercise];
    this._saveExercisesToStorage(updatedExercises);
    return of(newExercise);
  }

  updateExercise(updatedExercise: Exercise): Observable<Exercise> {
    const currentExercises = this.exercisesSubject.getValue();
    const index = currentExercises.findIndex(ex => ex.id === updatedExercise.id);
    if (index > -1) {
      const newExercisesArray = [...currentExercises];
      newExercisesArray[index] = { ...updatedExercise };
      this._saveExercisesToStorage(newExercisesArray);
      return of(updatedExercise);
    }
    return throwError(() => new Error(`Exercise with id ${updatedExercise.id} not found for update.`));
  }

  async deleteExercise(exerciseId: string): Promise<void> {
    const currentExercises = this.exercisesSubject.getValue();
    const exerciseToDelete = currentExercises.find(ex => ex.id === exerciseId);

    if (!exerciseToDelete) {
      console.warn(`ExerciseService: Exercise with id ${exerciseId} not found for deletion.`);
      return Promise.reject(new Error('Exercise not found'));
    }

    try {
      await this.trackingService.handleExerciseDeletion(exerciseId);
      const updatedExercises = currentExercises.filter(ex => ex.id !== exerciseId);
      this._saveExercisesToStorage(updatedExercises);
    } catch (error) {
      console.error(`Error during exercise deletion process for ${exerciseId}:`, error);
      throw error; // Re-throw to be caught by the caller
    }
  }

  getExercisesByCategory(category: string): Observable<Exercise[]> {
    return this.exercises$.pipe(
      map(exercises => exercises.filter(ex => ex.category === category))
    );
  }

  getExercisesByMuscleGroup(muscleGroup: string): Observable<Exercise[]> {
    return this.exercises$.pipe(
      map(exercises => exercises.filter(ex => ex.muscleGroups.includes(muscleGroup)))
    );
  }

  getUniqueCategories(): Observable<string[]> {
    return this.exercises$.pipe(
      map(exercises => [...new Set(exercises.map(ex => ex.category))].sort())
    );
  }

  getUniquePrimaryMuscleGroups(): Observable<string[]> {
    return this.exercises$.pipe(
      map(exercises => [...new Set(exercises.map(ex => ex.primaryMuscleGroup))].sort())
    );
  }

  determineExerciseIcon(baseExercise: Exercise | null, exerciseName: string): string {
    const nameLower = exerciseName.toLowerCase();

    if (baseExercise && baseExercise.equipment) {
      const equipmentLower = baseExercise.equipment.toLowerCase();
      if (equipmentLower.includes('barbell')) return 'barbell';
      if (equipmentLower.includes('dumbbell')) return 'dumbbell';
      if (equipmentLower.includes('machine') || equipmentLower.includes('cable')) return 'machine';
      if (equipmentLower.includes('body') || equipmentLower.includes('none')) return 'bodyweight';
      if (equipmentLower.includes('kettlebell')) return 'kettlebell';
      if (equipmentLower.includes('resistance band')) return 'resistance-band';
    }

    if (nameLower.includes('barbell')) return 'barbell';
    if (nameLower.includes('dumbbell') || nameLower.includes('db ')) return 'dumbbell';
    if (nameLower.includes('squat') && nameLower.includes('barbell')) return 'barbell';
    if (nameLower.includes('squat') && !nameLower.includes('barbell') && !nameLower.includes('dumbbell')) return 'bodyweight';
    if (nameLower.includes('deadlift')) return 'barbell';
    if (nameLower.includes('bench press')) return 'barbell';
    if (nameLower.includes('row') && (nameLower.includes('barbell') || !nameLower.includes('dumbbell'))) return 'barbell';
    if (nameLower.includes('curl') && nameLower.includes('barbell')) return 'barbell';
    if (nameLower.includes('curl') && nameLower.includes('dumbbell')) return 'dumbbell';
    if (nameLower.includes('machine') || nameLower.includes('cable')) return 'machine';
    if (nameLower.includes('body') || nameLower.includes('none')) return 'bodyweight';
    if (nameLower.includes('kettlebell')) return 'kettlebell';
    if (nameLower.includes('run') || nameLower.includes('cardio') || nameLower.includes('tapis') || nameLower.includes('jog')) return 'cardio';
    if (nameLower.includes('resistance band')) return 'resistance-band';

    if (baseExercise?.category) {
      const categoryLower = baseExercise.category.toLowerCase();
      if (categoryLower === 'strength' || categoryLower === 'powerlifting' || categoryLower === 'olympic weightlifting') {
        if (nameLower.includes('squat') || nameLower.includes('deadlift') || nameLower.includes('bench')) return 'barbell';
      }
      if (categoryLower === 'cardio') return 'cardio';
      if (categoryLower === 'calisthenics' || categoryLower === 'plyometrics' || categoryLower === 'bodyweight') return 'bodyweight'; // Added bodyweight category check
    }
    return 'default-exercise';
  }

  getIconPath(iconName: string | undefined): string {
    return `assets/icons/${iconName || 'default-exercise'}.svg`;
  }
}