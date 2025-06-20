import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, take, tap, finalize } from 'rxjs/operators'; // Added finalize
import { Exercise } from '../models/exercise.model';
import { StorageService } from './storage.service';
import { TrackingService } from './tracking.service';
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
  // private readonly EXERCISES_JSON_PATH = 'assets/data/exercises.json'; // Not used if EXERCISES_DATA is primary

  private exercisesSubject: BehaviorSubject<Exercise[]>;
  public exercises$: Observable<Exercise[]>;

  // New BehaviorSubject for loading state
  private isLoadingExercisesSubject = new BehaviorSubject<boolean>(true); // Start as true
  public isLoadingExercises$: Observable<boolean> = this.isLoadingExercisesSubject.asObservable();

  constructor() {
    this.isLoadingExercisesSubject.next(true); // Explicitly set loading to true at the start
    const initialExercises = this._loadExercisesFromStorage();
    this.exercisesSubject = new BehaviorSubject<Exercise[]>(initialExercises);
    this.exercises$ = this.exercisesSubject.asObservable().pipe(
      shareReplay(1)
    );

    if (initialExercises.length === 0) {
      this._seedExercisesFromAssets(); // This method will set loading to false
    } else {
      this.isLoadingExercisesSubject.next(false); // Loaded from storage, set loading to false
    }
  }

  private _loadExercisesFromStorage(): Exercise[] {
    const exercises = this.storageService.getItem<Exercise[]>(this.EXERCISES_STORAGE_KEY);
    return exercises ? exercises.sort((a, b) => a.name.localeCompare(b.name)) : [];
  }

  private _saveExercisesToStorage(exercises: Exercise[]): void {
    this.storageService.setItem(this.EXERCISES_STORAGE_KEY, exercises);
    this.exercisesSubject.next([...exercises].sort((a, b) => a.name.localeCompare(b.name)));
  }

  private _seedExercisesFromAssets(): void {
    this.isLoadingExercisesSubject.next(true); // Ensure loading is true during seeding
    // Simulate async operation if needed, or just proceed
    try {
      const exercisesFromData = EXERCISES_DATA as Exercise[];
      if (this.exercisesSubject.getValue().length === 0 && exercisesFromData && exercisesFromData.length > 0) {
        this._saveExercisesToStorage(exercisesFromData);
        console.log('ExerciseService: Seed exercises loaded successfully from EXERCISES_DATA.');
      } else if (this.exercisesSubject.getValue().length > 0) {
        console.log('ExerciseService: Exercises already present, skipping seed.');
      } else {
        console.warn('ExerciseService: EXERCISES_DATA was empty.');
      }
    } catch (error) {
      console.error("Error seeding exercises from assets:", error);
      // Potentially set an error state here if needed
    } finally {
      this.isLoadingExercisesSubject.next(false); // Set loading to false after seeding attempt
    }
  }

  getExercises(): Observable<Exercise[]> {
    // If you want to show loading every time getExercises is called and it's the first time
    // or if exercises are empty, you could add logic here, but constructor handles initial load.
    return this.exercises$;
  }

  getExerciseById(id: string): Observable<Exercise | undefined> {
    return this.exercises$.pipe(
      map(exercises => exercises.find(exercise => exercise.id === id)),
      take(1)
    );
  }

  addExercise(exerciseData: Omit<Exercise, 'id'>): Observable<Exercise> {
    // For local operations, loading state might be too quick to notice unless it was an API call.
    // If it were an API call:
    // this.isLoadingExercisesSubject.next(true);
    const currentExercises = this.exercisesSubject.getValue();
    const newExercise: Exercise = {
      ...exerciseData,
      id: uuidv4(),
    };
    const updatedExercises = [...currentExercises, newExercise];
    this._saveExercisesToStorage(updatedExercises);
    // if API call: .pipe(finalize(() => this.isLoadingExercisesSubject.next(false)))
    return of(newExercise);
  }

  updateExercise(updatedExercise: Exercise): Observable<Exercise> {
    // Similar to addExercise, set loading if it were an async API operation
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
    // You could set a specific "isDeleting" flag or use the general loading flag.
    // For this example, let's assume delete is quick enough locally after trackingService.
    this.isLoadingExercisesSubject.next(true); // Or a more specific isDeletingSubject
    try {
      const currentExercises = this.exercisesSubject.getValue();
      const exerciseToDelete = currentExercises.find(ex => ex.id === exerciseId);

      if (!exerciseToDelete) {
        console.warn(`ExerciseService: Exercise with id ${exerciseId} not found for deletion.`);
        throw new Error('Exercise not found'); // Throw to be caught by finalize and caller
      }

      await this.trackingService.handleExerciseDeletion(exerciseId);
      const updatedExercises = currentExercises.filter(ex => ex.id !== exerciseId);
      this._saveExercisesToStorage(updatedExercises);
    } catch (error) {
      console.error(`Error during exercise deletion process for ${exerciseId}:`, error);
      throw error;
    } finally {
      this.isLoadingExercisesSubject.next(false);
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

    if (baseExercise && (baseExercise.equipment || baseExercise.equipmentNeeded)) {
      // Prefer equipmentNeeded if present, else fallback to equipment
      const equipmentList = [
        ...(Array.isArray(baseExercise.equipmentNeeded) ? baseExercise.equipmentNeeded : baseExercise.equipmentNeeded ? [baseExercise.equipmentNeeded] : []),
        ...(Array.isArray(baseExercise.equipment) ? baseExercise.equipment : baseExercise.equipment ? [baseExercise.equipment] : [])
      ];
      const equipmentLower = equipmentList.join(' ').toLowerCase();

      // Find the index of each equipment type
      const barbellIndex = equipmentLower.indexOf('barbell');
      const kettlebellIndex = equipmentLower.indexOf('kettlebell');
      const dumbbellIndex = equipmentLower.indexOf('dumbbell');
      const machineIndex = equipmentLower.indexOf('machine');
      const cableIndex = equipmentLower.indexOf('cable');
      const bodyweightIndex = equipmentLower.indexOf('body');
      const noneIndex = equipmentLower.indexOf('none');
      const resistanceBandIndex = equipmentLower.indexOf('resistance band');

      // Collect all found equipment types with their indices
      const equipmentPriority: { type: string; index: number }[] = [
        { type: 'barbell', index: barbellIndex },
        { type: 'kettlebell', index: kettlebellIndex },
        { type: 'dumbbell', index: dumbbellIndex },
        { type: 'machine', index: machineIndex },
        { type: 'machine', index: cableIndex }, // treat cable as machine
        { type: 'bodyweight/calisthenics', index: bodyweightIndex },
        { type: 'bodyweight/calisthenics', index: noneIndex },
        { type: 'resistance-band', index: resistanceBandIndex }
      ].filter(e => e.index !== -1);

      if (equipmentPriority.length > 0) {
        // Return the type with the lowest index (first occurrence)
        equipmentPriority.sort((a, b) => a.index - b.index);
        return equipmentPriority[0].type;
      }
    }

    if (nameLower.includes('barbell')) return 'barbell';
    if (nameLower.includes('dumbbell') || nameLower.includes('db ')) return 'dumbbell';
    if (nameLower.includes('kettlebell')) return 'kettlebell';
    if (nameLower.includes('squat') && nameLower.includes('barbell')) return 'barbell';
    if (nameLower.includes('squat') && !nameLower.includes('barbell') && !nameLower.includes('dumbbell')) return 'bodyweight/calisthenics';
    if (nameLower.includes('deadlift')) return 'barbell';
    if (nameLower.includes('bench press')) return 'barbell';
    if (nameLower.includes('row') && (nameLower.includes('barbell') || !nameLower.includes('dumbbell'))) return 'barbell';
    if (nameLower.includes('curl') && nameLower.includes('barbell')) return 'barbell';
    if (nameLower.includes('curl') && nameLower.includes('dumbbell')) return 'dumbbell';
    if (nameLower.includes('machine') || nameLower.includes('cable')) return 'machine';
    if (nameLower.includes('body') || nameLower.includes('none')) return 'bodyweight/calisthenics';
    if (nameLower.includes('run') || nameLower.includes('cardio') || nameLower.includes('tapis') || nameLower.includes('jog')) return 'cardio';
    if (nameLower.includes('resistance band')) return 'resistance-band';

    if (baseExercise?.category) {
      const categoryLower = baseExercise.category.toLowerCase();
      if (categoryLower === 'strength' || categoryLower === 'powerlifting' || categoryLower === 'olympic weightlifting') {
        if (nameLower.includes('squat') || nameLower.includes('deadlift') || nameLower.includes('bench')) return 'barbell';
      }
      if (categoryLower === 'cardio') return 'cardio';
      if (categoryLower === 'calisthenics' || categoryLower === 'plyometrics' || categoryLower === 'bodyweight/calisthenics') return 'bodyweight/calisthenics'; // Added bodyweight category check
    }
    return 'default-exercise';
  }

  getIconPath(iconName: string | undefined): string {
    return `assets/icons/${iconName || 'default-exercise'}.svg`;
  }
}