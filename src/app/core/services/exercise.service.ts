// src/app/core/services/exercise.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, first, map, shareReplay, take, tap } from 'rxjs/operators';
import { Exercise } from '../models/exercise.model';
import { StorageService } from './storage.service';
import { TrackingService } from './tracking.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root',
})
export class ExerciseService {
  private http = inject(HttpClient); // Still useful if you ever load initial from JSON
  private storageService = inject(StorageService);
  private trackingService = inject(TrackingService); // Inject TrackingService

  private readonly EXERCISES_STORAGE_KEY = 'fitTrackPro_exercises';
  private exercisesJsonUrl = 'assets/data/exercises.json'; // Initial load

  // Use BehaviorSubject for managing exercises in memory, loaded from storage
  private exercisesSubject: BehaviorSubject<Exercise[]>;
  public exercises$: Observable<Exercise[]>;

  private serviceInitializedPromise: Promise<void>; // For ensuring seeding completes
  private serviceInitializedResolve!: () => void; // Resolver for the promise

  constructor() {
    this.serviceInitializedPromise = new Promise(resolve => {
      this.serviceInitializedResolve = resolve;
    });

    const initialExercises = this.loadExercisesFromStorage();
    this.exercisesSubject = new BehaviorSubject<Exercise[]>(initialExercises);
    this.exercises$ = this.exercisesSubject.asObservable().pipe(
      shareReplay(1)
    );

    if (initialExercises.length === 0) {
      this.seedExercisesFromAssets();
    } else {
      this.serviceInitializedResolve(); // Resolve immediately if not seeding
    }
  }

  private loadExercisesFromStorage(): Exercise[] {
    return this.storageService.getItem<Exercise[]>(this.EXERCISES_STORAGE_KEY) || [];
  }

  private saveExercisesToStorage(exercises: Exercise[]): void {
    this.storageService.setItem(this.EXERCISES_STORAGE_KEY, exercises);
    this.exercisesSubject.next([...exercises].sort((a, b) => a.name.localeCompare(b.name))); // Emit sorted
  }

  private seedExercisesFromAssets(): void {
    this.http.get<Exercise[]>(this.exercisesJsonUrl).pipe(
      take(1),
      catchError(err => {
        console.error('ExerciseService: Failed to load seed exercises from JSON file:', err);
        return of([]);
      })
    ).subscribe(exercisesFromJson => {
      if (exercisesFromJson && exercisesFromJson.length > 0) {
        const currentExercises = this.exercisesSubject.getValue(); // Check current value again
        if (currentExercises.length === 0) {
          this.saveExercisesToStorage(exercisesFromJson);
        } else {
        }
      } else {
      }
      this.serviceInitializedResolve(); // Resolve after seeding attempt (success or fail)
    });
  }

  // Public method to await initialization if needed externally
  public ensureInitialized(): Promise<void> {
    return this.serviceInitializedPromise;
  }

  getExercises(): Observable<Exercise[]> {
    return this.exercises$; // Return the observable from BehaviorSubject
  }

  getExerciseById(id: string): Observable<Exercise | undefined> {
    return this.exercises$.pipe(
      first(), // IMPORTANT: Take only the first emission. BehaviorSubject emits immediately.
      // If exercises$ hasn't emitted (e.g., due to seeding delay and this being called too early),
      // 'first()' will wait. If 'exercises$' is stuck, 'first()' will also be stuck.
      map(exercises => {
        const found = exercises.find(exercise => exercise.id === id);
        return found;
      }),
    );
  }

  addExercise(exerciseData: Omit<Exercise, 'id'>): Observable<Exercise> {
    const currentExercises = this.exercisesSubject.getValue();
    const newExercise: Exercise = {
      ...exerciseData,
      id: uuidv4(),
    };
    const updatedExercises = [...currentExercises, newExercise];
    this.saveExercisesToStorage(updatedExercises);
    return of(newExercise); // Return as an observable
  }

  updateExercise(updatedExercise: Exercise): Observable<Exercise> {
    const currentExercises = this.exercisesSubject.getValue();
    const index = currentExercises.findIndex(ex => ex.id === updatedExercise.id);
    if (index > -1) {
      const newExercisesArray = [...currentExercises];
      newExercisesArray[index] = { ...updatedExercise };
      this.saveExercisesToStorage(newExercisesArray);
      return of(updatedExercise);
    }
    return throwError(() => new Error(`Exercise with id ${updatedExercise.id} not found for update.`));
  }

  async deleteExercise(exerciseId: string): Promise<void> { // Make it async
    const currentExercises = this.exercisesSubject.getValue();
    const exerciseToDelete = currentExercises.find(ex => ex.id === exerciseId);

    if (!exerciseToDelete) {
      console.warn(`ExerciseService: Exercise with id ${exerciseId} not found for deletion.`);
      return Promise.reject(new Error('Exercise not found'));
    }

    // Call TrackingService to handle implications on workout logs BEFORE deleting the exercise definition
    try {
      await this.trackingService.handleExerciseDeletion(exerciseId); // This method needs to be created

      // If handleExerciseDeletion is successful, proceed to delete the exercise definition
      const updatedExercises = currentExercises.filter(ex => ex.id !== exerciseId);
      this.saveExercisesToStorage(updatedExercises);
      // No need to return anything for void Promise if successful
    } catch (error) {
      console.error(`Error during exercise deletion process for ${exerciseId}:`, error);
      throw error; // Re-throw the error to be caught by the caller
    }
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

  // Helper function to determine the icon based on exercise details
  determineExerciseIcon(baseExercise: Exercise | null, exerciseName: string): string {
    const nameLower = exerciseName.toLowerCase();

    if (baseExercise && baseExercise.equipment) { // Ideal: if you have an equipment field
      const equipmentLower = baseExercise.equipment.toLowerCase();
      if (equipmentLower.includes('barbell')) return 'barbell';
      if (equipmentLower.includes('dumbbell')) return 'dumbbell';
      if (equipmentLower.includes('machine') || equipmentLower.includes('cable')) return 'machine';
      if (equipmentLower.includes('body') || equipmentLower.includes('none')) return 'bodyweight';
      if (equipmentLower.includes('kettlebell')) return 'kettlebell'; // Add more as needed
      if (equipmentLower.includes('resistance band')) return 'resistance-band';
    }

    // Fallback to checking name or category if equipment field is not reliable/present
    if (nameLower.includes('barbell')) return 'barbell';
    if (nameLower.includes('dumbbell') || nameLower.includes('db ')) return 'dumbbell';
    if (nameLower.includes('squat') && nameLower.includes('barbell')) return 'barbell'; // Assumption
    if (nameLower.includes('squat') && !nameLower.includes('dumbbell') && !nameLower.includes('dumbbell')) return 'bodyweight'; // Assumption
    if (nameLower.includes('deadlift')) return 'barbell'; // Assumption
    if (nameLower.includes('bench press')) return 'barbell'; // Assumption
    if (nameLower.includes('row') && (nameLower.includes('barbell') || !nameLower.includes('dumbbell'))) return 'barbell';
    if (nameLower.includes('curl') && nameLower.includes('barbell')) return 'barbell';
    if (nameLower.includes('curl') && nameLower.includes('dumbbell')) return 'dumbbell';
    if (nameLower.includes('machine') || nameLower.includes('cable')) return 'machine';
    if (nameLower.includes('body') || nameLower.includes('none')) return 'bodyweight';
    if (nameLower.includes('kettlebell')) return 'kettlebell'; // Add more as needed
    if (nameLower.includes('run') || nameLower.includes('cardio') || nameLower.includes('tapis') || nameLower.includes('jog')) return 'cardio'; // Add more as needed
    if (nameLower.includes('resistance band')) return 'resistance-band';


    if (baseExercise?.category) {
      const categoryLower = baseExercise.category.toLowerCase();
      if (categoryLower === 'strength' || categoryLower === 'powerlifting' || categoryLower === 'olympic weightlifting') {
        // Could infer based on common exercises in these categories
        if (nameLower.includes('squat') || nameLower.includes('deadlift') || nameLower.includes('bench')) return 'barbell';
      }
      if (categoryLower === 'cardio') return 'cardio';
      if (categoryLower === 'calisthenics' || categoryLower === 'plyometrics') return 'bodyweight';
    }
    // Add more keywords as needed: 'cable', 'machine', 'smith machine', 'ez bar'
    // 'pull-up', 'push-up', 'dip' -> bodyweight
    // 'run', 'jog', 'cycle', 'elliptical' -> cardio

    return 'default-exercise'; // Fallback icon
  }

  getIconPath(iconName: string | undefined): string {
    return `assets/icons/${iconName || 'default-exercise'}.svg`;
  }
}