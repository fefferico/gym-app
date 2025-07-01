import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, take, tap, finalize } from 'rxjs/operators'; // Added finalize
import { Exercise } from '../models/exercise.model';
import { StorageService } from './storage.service';
import { TrackingService } from './tracking.service';
import { v4 as uuidv4 } from 'uuid';
import { EXERCISES_DATA } from './exercises-data';
import { WorkoutExercise } from '../models/workout.model';

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

  constructor(
  ) {
    this.isLoadingExercisesSubject.next(true);

    // Load initial exercises from storage
    const exercisesFromStorage = this._loadExercisesFromStorage();

    // Initialize the BehaviorSubject with exercises from storage
    this.exercisesSubject = new BehaviorSubject<Exercise[]>(exercisesFromStorage);
    this.exercises$ = this.exercisesSubject.asObservable().pipe(
      shareReplay(1)
    );

    // Call the new, synchronous seeding method
    this._seedAndMergeExercisesFromStaticData(exercisesFromStorage);
  }

  /**
   * Merges exercises from the static EXERCISE_DATA constant with existing exercises from storage.
   * This is a synchronous operation and does not involve HTTP requests.
   * @param existingExercises Exercises already loaded from storage.
   */
  private _seedAndMergeExercisesFromStaticData(existingExercises: Exercise[]): void {
    try {
      // Cast the imported data to the Exercise[] type for type safety.
      const assetExercises = EXERCISES_DATA as Exercise[];

      // Create a Set of existing exercise IDs for efficient lookup.
      const existingExerciseIds = new Set(existingExercises.map(r => r.id));

      // Filter the asset exercises to only include those that are NOT already in storage.
      const newExercisesToSeed = assetExercises.filter(
        assetExercise => !existingExerciseIds.has(assetExercise.id)
      );

      // If there are new exercises to add, merge them and update the state.
      if (newExercisesToSeed.length > 0) {
        console.log(`Seeding ${newExercisesToSeed.length} new exercises from static data.`);
        const mergedExercises = [...existingExercises, ...newExercisesToSeed];

        // Update the subject with the full, merged list.
        this.exercisesSubject.next(mergedExercises);
        // Save the merged list back to storage for the next session.
        this._saveExercisesToStorage(mergedExercises);
      } else {
        console.log("No new exercises to seed from static data. All are present in storage.");
      }
    } catch (error) {
      console.error('Failed to process or seed exercises from static data:', error);
    } finally {
      // This logic now happens synchronously, so we can set loading to false right after.
      this.isLoadingExercisesSubject.next(false);
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

  /**
   * Adds a new exercise to the collection, preventing duplicates by ID or name.
   * 
   * - If `exerciseData.id` is provided, it will be used. The method will fail if an
   *   exercise with this ID already exists.
   * - If `exerciseData.id` is not provided, a new UUID will be generated.
   * - The method will also fail if an exercise with the same name (case-insensitive)
   *   already exists to prevent user-created duplicates.
   *
   * @param exerciseData - A partial Exercise object. Must contain at least a `name`.
   * @returns An Observable emitting the newly created Exercise, or `null` if the
   *          exercise was not added due to a duplicate ID or name.
   */
  addExercise(exerciseData: Partial<Exercise>): Observable<Exercise | null> {
    const currentExercises = this.exercisesSubject.getValue();

    // 1. Check for a valid name - an exercise must have a name.
    if (!exerciseData.name || exerciseData.name.trim() === '') {
      console.error('Exercise name is required and cannot be empty.');
      return of(null);
    }

    // 2. Check for duplicate ID if an ID is provided
    if (exerciseData.id && currentExercises.some(ex => ex.id === exerciseData.id)) {
      console.warn(`An exercise with the ID '${exerciseData.id}' already exists. Add operation aborted.`);
      return of(null);
    }

    // 3. Check for duplicate name (case-insensitive check for better UX)
    const normalizedName = exerciseData.name.trim().toLowerCase();
    if (currentExercises.some(ex => ex.name.trim().toLowerCase() === normalizedName)) {
      console.warn(`An exercise with the name '${exerciseData.name}' already exists. Add operation aborted.`);
      return of(null);
    }

    // 4. All checks passed. Create the new exercise.
    const newExercise: Exercise = {
      // Provide default values for required fields to ensure type safety
      description: '',
      category: 'custom',
      muscleGroups: [],
      primaryMuscleGroup: '',
      imageUrls: [],
      ...exerciseData, // Spread the provided data, which will overwrite defaults
      name: exerciseData.name,
      id: exerciseData.id || uuidv4(), // Use the provided ID or generate a new one
    };

    // 5. Update state and persist
    const updatedExercises = [...currentExercises, newExercise];
    this._saveExercisesToStorage(updatedExercises); // Assuming this updates the subject internally

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
    let tmpIconName = iconName;
    if (tmpIconName && (tmpIconName.indexOf('/') >= 0 || tmpIconName?.indexOf('custom-exercise') >= 0)) {
      tmpIconName = 'default-exercise';
    }
    return `assets/icons/${tmpIconName || 'default-exercise'}.svg`;
  }

  /**
 * Maps a WorkoutExercise instance to its corresponding definitive Exercise object.
 * 
 * This function essentially acts as a "lookup" and returns the base definition
 * of an exercise. It correctly uses the definitive ID and other properties from the
 * baseExercise, ignoring instance-specific data like sets, reps, and routine notes
 * from the workoutExercise.
 *
 * @param workoutExercise The instance of the exercise within a routine.
 * @param baseExercise The complete, definitive Exercise object to use as the source of truth.
 * @returns A complete Exercise object.
 */
  public mapWorkoutExerciseToExercise(
    workoutExercise: WorkoutExercise,
    baseExercise: Exercise
  ): Exercise {

    // The exerciseId on workoutExercise should match the id on baseExercise.
    // We can add a check for robustness.
    if (workoutExercise.exerciseId !== baseExercise.id) {
      console.warn(
        `Mismatched IDs in mapWorkoutExerciseToExercise: workoutExercise.exerciseId is "${workoutExercise.exerciseId}" but baseExercise.id is "${baseExercise.id}".`
      );
      // Depending on requirements, you could throw an error or proceed cautiously.
    }

    // The primary purpose is to return the clean, definitive exercise data.
    // We spread the baseExercise to ensure all definitional properties are included.
    // We don't map any instance-specific properties (like sets, superset info, etc.)
    // because they do not belong on the Exercise model.
    return {
      ...baseExercise,
    };
  }

  /**
   * Creates a partial Exercise object from a WorkoutExercise when the full
   * definition is not available.
   *
   * This is useful for scenarios where you only have the routine data and need to
   * display basic information (like the name) before the full exercise details are loaded.
   *
   * @param workoutExercise The instance of the exercise within a routine.
   * @returns A partial Exercise object, containing at least the id and name.
   */
  public mapWorkoutExerciseToPartialExercise(
    workoutExercise: WorkoutExercise
  ): Partial<Exercise> {
    return {
      id: workoutExercise.exerciseId,
      name: workoutExercise.exerciseName || 'Unknown Exercise',
      // All other Exercise properties will be undefined.
    };
  }
}