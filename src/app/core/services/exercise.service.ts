import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, combineLatest, forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, take, tap, finalize, filter, switchMap } from 'rxjs/operators'; // Added finalize
import { Exercise } from '../models/exercise.model';
import { StorageService } from './storage.service';
import { TrackingService } from './tracking.service';
import { v4 as uuidv4 } from 'uuid';
import { EXERCISES_DATA, ExerciseWithMuscleIds } from './exercises-data';
import { WorkoutExercise } from '../models/workout.model';
import { ToastService } from './toast.service';
import { TranslateService } from '@ngx-translate/core';
import { Muscle } from '../models/muscle.model';
import { Equipment } from '../models/equipment.model';
import { EQUIPMENT_NORMALIZATION_MAP, EquipmentService, HydratedEquipment } from './equipment.service';
import { MUSCLE_NORMALIZATION_MAP, MuscleMapService } from './muscle-map.service';
import { MUSCLES_DATA, MuscleValue } from './muscles-data';
import { EquipmentValue } from './equipment-data';
import { EXERCISE_CATEGORY_NORMALIZATION_MAP, ExerciseCategoryService, HydratedCategory } from './exercise-category.service';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Maps standardized muscle group names to the unique IDs of the paths in muscle-anatomy.svg.
 * This allows the service to return the correct SVG element IDs for highlighting.
 */
const MUSCLE_GROUP_TO_ID_MAP: Record<string, string[]> = {
  'shoulders': ['shoulders-front-left', 'shoulders-front-right', 'shoulders-back-left', 'shoulders-back-right'],
  'chest': ['chest-left', 'chest-right'],
  'abs': ['abs-upper', 'abs-middle', 'abs-lower'],
  'obliques': ['obliques-left', 'obliques-right'],
  'biceps': ['biceps-left', 'biceps-right'],
  'triceps': ['triceps-left', 'triceps-right'],
  'forearms': ['forearms-left', 'forearms-right', 'forearms-back-left', 'forearms-back-right'],
  'quadriceps': ['quads-left', 'quads-right'],
  'hamstrings': ['hamstrings-left', 'hamstrings-right'],
  'glutes': ['glutes-left', 'glutes-right'],
  'calves': ['calves-front-left', 'calves-front-right', 'calves-back-left', 'calves-back-right'],
  'adductors': ['adductors-left', 'adductors-right'],
  'traps': ['traps-upper', 'traps-middle', 'traps-lower'],
  'lats': ['lats-left', 'lats-right'],
  'lower back': ['lower-back'],
  'neck': ['neck-front']
};

export interface MuscleHighlightData {
  primary: string[];
  secondary: string[];
}

export interface HydratedExercise extends Omit<Exercise, 'primaryMuscleGroup' | 'muscleGroups' | 'equipmentNeeded'> {
  primaryMuscleGroup?: Muscle;
  muscleGroups: Muscle[];
  equipmentNeeded: HydratedEquipment[];
}

@Injectable({
  providedIn: 'root',
})
export class ExerciseService {
  private http = inject(HttpClient);
  private storageService = inject(StorageService);
  private trackingService = inject(TrackingService);
  private toastService = inject(ToastService);
  private translate = inject(TranslateService);
  private equipmentService = inject(EquipmentService);
  private muscleMapService = inject(MuscleMapService);
  private exerciseCategoryService = inject(ExerciseCategoryService);

  private readonly EXERCISES_STORAGE_KEY = 'fitTrackPro_exercises';
  // private readonly EXERCISES_JSON_PATH = 'assets/data/exercises.json'; // Not used if EXERCISES_DATA is primary

  private exercisesSubject: BehaviorSubject<Exercise[]>;
  public exercises$: Observable<Exercise[]>;

  // New BehaviorSubject for loading state
  private isLoadingExercisesSubject = new BehaviorSubject<boolean>(true); // Start as true
  public isLoadingExercises$: Observable<boolean> = this.isLoadingExercisesSubject.asObservable();
  protected exerciseCategories: HydratedCategory[];

  constructor() {
    this.exerciseCategories = this.exerciseCategoryService.getHydratedCategories();

    this.isLoadingExercisesSubject.next(true);
    const exercisesFromStorage = this._loadExercisesFromStorage();
    this.exercisesSubject = new BehaviorSubject<Exercise[]>(exercisesFromStorage);

    this.exercises$ = this.exercisesSubject.asObservable().pipe(
      shareReplay(1)
    );

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
      const existingExerciseIds = new Set(existingExercises.map(r => r.id));
      const newExercisesToSeed = assetExercises.filter(
        assetExercise => !existingExerciseIds.has(assetExercise.id)
      );

      // --- Normalize muscle groups and primaryMuscleGroup here ---
      const normalizedExercises = newExercisesToSeed.map(ex => ({
        ...ex,
        primaryMuscleGroup: ex.primaryMuscleGroup
          ? (MUSCLE_NORMALIZATION_MAP[ex.primaryMuscleGroup.toLowerCase().trim()] ||
            ex.primaryMuscleGroup.toLowerCase().trim()) as MuscleValue
          : undefined,
        muscleGroups: Array.isArray(ex.muscleGroups)
          ? ex.muscleGroups.map(muscle =>
            (MUSCLE_NORMALIZATION_MAP[muscle.toLowerCase().trim()] || muscle.toLowerCase().trim()) as MuscleValue
          )
          : [],
      }));

      if (normalizedExercises.length > 0) {
        const mergedExercises = [...existingExercises, ...normalizedExercises];
        this.exercisesSubject.next(mergedExercises);
        this._saveExercisesToStorage(mergedExercises);
      } else {
        // If there are new exercises to add, merge them and update the state.
        if (newExercisesToSeed.length > 0) {
          console.log(`Seeding ${newExercisesToSeed.length} new exercises from static data`);
          const mergedExercises = [...existingExercises, ...newExercisesToSeed];

          // Update the subject with the full, merged list.
          this.exercisesSubject.next(mergedExercises);
          // Save the merged list back to storage for the next session.
          this._saveExercisesToStorage(mergedExercises);
        } else {
          console.log("No new exercises to seed from static data. All are present in storage");
        }
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
    if (!exercises) {
      return [];
    }
    const validExercises = exercises.filter(exercise => exercise && typeof exercise.name === 'string');
    return validExercises.sort((a, b) => a.name.localeCompare(b.name));
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
      map(exercises => {
        const exercise = exercises.find(ex => ex.id === id);
        if (!exercise) return undefined;

        // Normalize primaryMuscleGroup
        let normalizedPrimary: string | undefined = exercise.primaryMuscleGroup;
        if (normalizedPrimary && typeof normalizedPrimary === 'string') {
          normalizedPrimary =
            MUSCLE_NORMALIZATION_MAP[normalizedPrimary.toLowerCase().trim()] ||
            normalizedPrimary.toLowerCase().trim();
        }

        // Normalize muscleGroups
        let normalizedGroups: string[] = [];
        if (Array.isArray(exercise.muscleGroups)) {
          normalizedGroups = exercise.muscleGroups.map(muscle =>
            MUSCLE_NORMALIZATION_MAP[muscle.toLowerCase().trim()] || muscle.toLowerCase().trim()
          );
        }

        // Normalize equipmentNeeded
        let normalizedEquipment: string[] = [];
        if (Array.isArray(exercise.equipmentNeeded)) {
          normalizedEquipment = exercise.equipmentNeeded.map(eq =>
            EQUIPMENT_NORMALIZATION_MAP[eq.toLowerCase().trim()] || eq.toLowerCase().trim()
          );
        }

        // Return a new object with normalized muscle groups
        return {
          ...exercise,
          primaryMuscleGroup: normalizedPrimary as MuscleValue | undefined,
          muscleGroups: normalizedGroups as MuscleValue[],
          equipmentNeeded: normalizedEquipment as EquipmentValue[],
        };
      }),
      take(1)
    );
  }

  /**
   * Adds a new user-defined exercise to the collection.
   * The new exercise is automatically marked as `isCustom: true`.
   * It will fail if an exercise with the same name already exists.
   *
   * @param exerciseData - A partial Exercise object, must contain at least a `name`.
   * @returns An Observable emitting the newly created Exercise or `null` if it wasn't added.
   */
  addExercise(exerciseData: Partial<Exercise>): Observable<Exercise | null> {
    const currentExercises = this.exercisesSubject.getValue();

    if (!exerciseData.name || exerciseData.name.trim() === '') {
      console.error('Exercise name is required.');
      return of(null);
    }

    if (exerciseData.id && currentExercises.some(ex => ex.id === exerciseData.id)) {
      console.warn(`An exercise with the ID '${exerciseData.id}' already exists.`);
      return of(null);
    }

    const normalizedName = exerciseData.name.trim().toLowerCase();
    if (currentExercises.some(ex => ex.name.trim().toLowerCase() === normalizedName)) {
      console.warn(`An exercise with the name '${exerciseData.name}' already exists.`);
      return of(null);
    }

    const now = new Date().toISOString(); // --- Get current timestamp ---

    const newExercise: Exercise = {
      description: '',
      category: 'custom',
      muscleGroups: [],
      primaryMuscleGroup: undefined,
      imageUrls: [],
      ...exerciseData,
      name: exerciseData.name.trim(),
      id: exerciseData.id || uuidv4(),
      isCustom: true,
      isHidden: false,
      // --- NEW: Set timestamps on creation ---
      createdAt: now,
      updatedAt: now,
      lastUsedAt: undefined // A new exercise has not been used yet
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
      // --- Ensure original createdAt is preserved and set new updatedAt ---
      const exerciseToUpdate = {
        ...currentExercises[index], // Preserve original fields like createdAt
        ...updatedExercise,        // Apply incoming changes
        updatedAt: new Date().toISOString() // Set new updated timestamp
      };
      newExercisesArray[index] = exerciseToUpdate;
      this._saveExercisesToStorage(newExercisesArray);
      return of(exerciseToUpdate);
    }

    return throwError(() => new Error(`Exercise with id ${updatedExercise.id} not found for update.`));
  }

  /**
   * --- NEW METHOD ---
   * Specifically updates the `lastUsedAt` timestamp for one or more exercises.
   * This should be called by the TrackingService when a workout is logged.
   * @param exerciseIds An array of exercise IDs that were used.
   */
  public updateLastUsedTimestamp(exerciseIds: string[]): void {
    const uniqueExerciseIds = [...new Set(exerciseIds)]; // Ensure no duplicates
    if (uniqueExerciseIds.length === 0) {
      return;
    }

    const currentExercises = this.exercisesSubject.getValue();
    let exercisesWereUpdated = false;
    const now = new Date().toISOString();

    const updatedExercises = currentExercises.map(ex => {
      if (uniqueExerciseIds.includes(ex.id)) {
        exercisesWereUpdated = true;
        return { ...ex, lastUsedAt: now, lastUsedLogId: ex.lastUsedLogId };
      }
      return ex;
    });

    if (exercisesWereUpdated) {
      console.log(`Updating lastUsedAt for exercises:`, uniqueExerciseIds);
      this._saveExercisesToStorage(updatedExercises);
    }
  }

  async deleteExercise(exerciseId: string): Promise<void> {
    // You could set a specific "isDeleting" flag or use the general loading flag.
    // For this example, let's assume delete is quick enough locally after trackingService.
    this.isLoadingExercisesSubject.next(true); // Or a more specific isDeletingSubject
    try {
      const currentExercises = this.exercisesSubject.getValue();
      const exerciseToDelete = currentExercises.find(ex => ex.id === exerciseId);

      if (!exerciseToDelete) {
        console.warn(`ExerciseService: Exercise with id ${exerciseId} not found for deletion`);
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
      map(exercises => exercises.filter(ex => ex.muscleGroups.toString().includes(muscleGroup)))
    );
  }

  getUniqueCategories(): Observable<HydratedCategory[]> {
    return combineLatest([
      this.exercises$,
      this.exerciseCategoryService.hydratedCategories$
    ]).pipe(
      map(([exercises, hydratedCategories]) => {
        // 1. Collect unique, normalized category IDs from exercises
        const uniqueCategoryIds = [
          ...new Set(
            exercises
              .map(ex =>
                EXERCISE_CATEGORY_NORMALIZATION_MAP[ex.category?.toLowerCase().trim() || ''] ||
                ex.category?.toLowerCase().trim()
              )
              .filter((cat): cat is string => !!cat)
          )
        ].sort();
  
        // 2. Map those IDs to hydrated categories with translated labels
        return uniqueCategoryIds
          .map(id => hydratedCategories.find(cat => cat.id === id))
          .filter((cat): cat is HydratedCategory => !!cat);
      })
    );
  }

  getUniquePrimaryMuscleGroups(): Observable<Muscle[]> {
    return combineLatest([
      this.exercises$,
      this.muscleMapService.translatedMuscles$
    ]).pipe(
      map(([exercises, translatedMuscles]) => {
        // 1. Collect unique, normalized MuscleValue IDs from exercises
        const uniqueIds = [
          ...new Set(
            exercises
              .map(ex => {
                const raw = ex.primaryMuscleGroup;
                if (typeof raw === 'string' && raw.trim() !== '') {
                  return MUSCLE_NORMALIZATION_MAP[raw.toLowerCase().trim()] || raw.toLowerCase().trim();
                }
                return undefined;
              })
              .filter((group): group is MuscleValue => !!group)
          )
        ].sort();

        // 2. Map those IDs to Muscle objects, filtering out any missing ones
        return uniqueIds
          .map(id => translatedMuscles.find(m => m.id === id))
          .filter((m): m is Muscle => !!m);
      })
    );
  }

  /**
   * Retrieves a list of similar exercises based on matching muscle groups.
   *
   * The similarity is determined by a scoring system:
   * - A significant score is awarded if the primary muscle group matches.
   * - A smaller score is awarded for each shared secondary muscle group.
   *
   * The method returns a specified number of the highest-scoring exercises.
   *
   * @param baseExercise The exercise to find similar matches for.
   * @param count The number of similar exercises to return.
   * @returns An Observable emitting an array of similar Exercise objects.
   */
  getSimilarExercises(baseExercise: Exercise, count: number): Observable<Exercise[]> {
    return this.exercises$.pipe(
      map(allExercises => {
        // 1. Filter out the base exercise itself to avoid self-matching
        const otherExercises = allExercises.filter(ex => ex.id !== baseExercise.id);

        // 2. Score each exercise based on muscle group similarity
        const scoredExercises = otherExercises.map(candidateExercise => {
          let score = 0;

          // Award a high score for a matching primary muscle group
          if (candidateExercise.primaryMuscleGroup && baseExercise.primaryMuscleGroup &&
            candidateExercise.primaryMuscleGroup === baseExercise.primaryMuscleGroup) {
            score += 3;
          }

          // Award a smaller score for each overlapping secondary muscle group
          if (candidateExercise.muscleGroups && baseExercise.muscleGroups) {
            const baseMuscleGroups = new Set(baseExercise.muscleGroups);
            candidateExercise.muscleGroups.forEach(group => {
              if (baseMuscleGroups.has(group)) {
                score += 1;
              }
            });
          }

          return { exercise: candidateExercise, score };
        });

        // 3. Filter out exercises with no matching muscles and sort by score
        const relevantExercises = scoredExercises
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score);

        // 4. Return the top 'count' exercises
        return relevantExercises.slice(0, count).map(item => item.exercise);
      }),
      take(1) // Ensures the observable completes after emitting the list once
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
        { type: 'bodyweight-calisthenics', index: bodyweightIndex },
        { type: 'bodyweight-calisthenics', index: noneIndex },
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
    if (nameLower.includes('squat') && !nameLower.includes('barbell') && !nameLower.includes('dumbbell')) return 'bodyweight-calisthenics';
    if (nameLower.includes('deadlift')) return 'barbell';
    if (nameLower.includes('bench press')) return 'barbell';
    if (nameLower.includes('row') && (nameLower.includes('barbell') || !nameLower.includes('dumbbell'))) return 'barbell';
    if (nameLower.includes('curl') && nameLower.includes('barbell')) return 'barbell';
    if (nameLower.includes('curl') && nameLower.includes('dumbbell')) return 'dumbbell';
    if (nameLower.includes('machine') || nameLower.includes('cable')) return 'machine';
    if (nameLower.includes('body') || nameLower.includes('none')) return 'bodyweight-calisthenics';
    if (nameLower.includes('run') || nameLower.includes('cardio') || nameLower.includes('tapis') || nameLower.includes('jog')) return 'cardio';
    if (nameLower.includes('resistance band')) return 'resistance-band';

    if (baseExercise?.category) {
      const categoryLower = baseExercise.category.toLowerCase();
      if (categoryLower === 'strength' || categoryLower === 'powerlifting' || categoryLower === 'olympic weightlifting') {
        if (nameLower.includes('squat') || nameLower.includes('deadlift') || nameLower.includes('bench')) return 'barbell';
      }
      if (categoryLower === 'cardio') return 'cardio';
      if (categoryLower === 'calisthenics' || categoryLower === 'plyometrics' || categoryLower === 'bodyweight-calisthenics') return 'bodyweight-calisthenics'; // Added bodyweight category check
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
      name: workoutExercise.exerciseName || this.translate.instant('exerciseService.unknownExercise'),
      // All other Exercise properties will be undefined.
    };
  }

  /** Returns the current list of programs for backup */
  public getDataForBackup(): Exercise[] {
    return this.exercisesSubject.getValue(); // Get current value from BehaviorSubject
  }

  /**
     * Merges imported exercise data with the current data.
     * - If an imported exercise has an ID that already exists, it will be updated.
     * - If an imported exercise has a new ID, it will be added.
     * - Exercises that exist locally but are not in the imported data will be preserved.
     *
     * @param newExercises The array of Exercise objects to merge.
     */
  public mergeData(newExercises: Exercise[]): void {
    // 1. Basic validation
    if (!Array.isArray(newExercises)) {
      console.error('ExerciseService: Imported data for exercises is not an array.');
      const errorTitle = this.translate.instant('exerciseService.importErrorTitle');
      const errorMessage = this.translate.instant('exerciseService.importFailed');
      this.toastService.error(errorMessage, 0, errorTitle);
      return;
    }

    // +++ START of new merge logic +++

    // 2. Get current state
    const currentExercises = this.exercisesSubject.getValue();

    // 3. Create a map of current exercises for efficient lookup and update
    const exerciseMap = new Map<string, Exercise>(
      currentExercises.map(ex => [ex.id, ex])
    );

    let updatedCount = 0;
    let addedCount = 0;

    // 4. Iterate over the imported exercises and merge them into the map
    newExercises.forEach(importedExercise => {
      if (!importedExercise.id || !importedExercise.name) {
        // Skip invalid entries in the import file
        console.warn('Skipping invalid exercise during import:', importedExercise);
        return;
      }

      if (exerciseMap.has(importedExercise.id)) {
        updatedCount++;
      } else {
        addedCount++;
      }
      // Whether it's new or an update, set it in the map.
      // This overwrites existing entries and adds new ones.
      exerciseMap.set(importedExercise.id, importedExercise);
    });

    // 5. Convert the map back to an array
    const mergedExercises = Array.from(exerciseMap.values());

    // 6. Save the new merged array
    this._saveExercisesToStorage(mergedExercises);

    // 7. Provide user feedback
    console.log(`ExerciseService: Merged imported data. Updated: ${updatedCount}, Added: ${addedCount}`);
    const successTitle = this.translate.instant('exerciseService.mergeSuccessTitle');
    const successMessage = this.translate.instant('exerciseService.mergeSuccessMessage', { updatedCount, addedCount });
    this.toastService.success(successMessage, 6000, successTitle);
    // +++ END of new merge logic +++
  }

  /**
  * Returns the SVG path IDs for given primary and secondary muscle groups
  * for highlighting on the muscle anatomy chart.
  *
  * @param primaryMuscle The main muscle group worked (will be highlighted distinctly).
  * @param secondaryMuscles An array of supporting muscle groups.
  * @returns An object containing arrays of SVG path IDs for primary and secondary muscles.
  */
  public getMuscleHighlightData(primaryMuscle: string, secondaryMuscles: string[]): MuscleHighlightData {
    const highlightData: MuscleHighlightData = {
      primary: [],
      secondary: []
    };

    const normalizedPrimary = primaryMuscle.toLowerCase();
    if (MUSCLE_GROUP_TO_ID_MAP[normalizedPrimary]) {
      highlightData.primary = MUSCLE_GROUP_TO_ID_MAP[normalizedPrimary];
    }

    const secondaryIds = new Set<string>();
    secondaryMuscles.forEach(muscle => {
      const normalizedSecondary = muscle.toLowerCase();
      if (MUSCLE_GROUP_TO_ID_MAP[normalizedSecondary]) {
        MUSCLE_GROUP_TO_ID_MAP[normalizedSecondary].forEach(id => {
          // Avoid adding a path to secondary if it's already in primary
          if (!highlightData.primary.includes(id)) {
            secondaryIds.add(id);
          }
        });
      }
    });
    highlightData.secondary = Array.from(secondaryIds);

    return highlightData;
  }

  normalizeExerciseNameForSearch(term: string): string {
    if (!term) {
      return '';
    }
    // Normalize the term to lowercase and trim whitespace
    term = term.trim().toLowerCase();

    // Replace common abbreviations with full terms
    term = term.replace(/\bkb\b/g, 'kettlebell');
    term = term.replace(/\bdb\b/g, 'dumbbell');
    term = term.replace(/\bbb\b/g, 'barbell');
    term = term.replace(/\bdl\b/g, 'deadlift');
    term = term.replace(/\bdrl\b/g, 'romanian deadlift');
    term = term.replace(/\bbp\b/g, 'bench press');
    term = term.replace(/\bsq\b/g, 'squat');
    term = term.replace(/\bbw\b/g, 'bodyweight');

    // Return the modified search term
    return term;
  }

  /**
   * Hides an exercise by setting its `isHidden` flag to true.
   * The exercise is filtered out from the main `exercises$` observable but remains in storage.
   * @param exerciseId The ID of the exercise to hide.
   * @returns An Observable of the updated exercise or undefined if not found.
   */
  public hideExercise(exerciseId: string): Observable<Exercise | undefined> {
    const currentExercises = this.exercisesSubject.getValue();
    const exerciseIndex = currentExercises.findIndex(ex => ex.id === exerciseId);

    if (exerciseIndex === -1) {
      const errorTitle = this.translate.instant('exerciseService.hideErrorTitle');
      const errorMessage = this.translate.instant('exerciseService.hideFailed');
      this.toastService.error(errorMessage, 0, errorTitle);
      return of(undefined);
    }

    const updatedExercises = [...currentExercises];
    const exerciseToUpdate = { ...updatedExercises[exerciseIndex], isHidden: true };
    updatedExercises[exerciseIndex] = exerciseToUpdate;

    this._saveExercisesToStorage(updatedExercises);
    const infoTitle = this.translate.instant('exerciseService.hiddenTitle');
    const infoMessage = this.translate.instant('exerciseService.hiddenMessage', { name: exerciseToUpdate.name });
    this.toastService.info(infoMessage, 3000, infoTitle);
    return of(exerciseToUpdate);
  }

  /**
   * Un-hides an exercise by setting its `isHidden` flag to false.
   * The exercise will reappear in the main `exercises$` observable.
   * @param exerciseId The ID of the exercise to make visible.
   * @returns An Observable of the updated exercise or undefined if not found.
   */
  public unhideExercise(exerciseId: string): Observable<Exercise | undefined> {
    const currentExercises = this.exercisesSubject.getValue();
    const exerciseIndex = currentExercises.findIndex(ex => ex.id === exerciseId);

    if (exerciseIndex === -1) {
      const errorTitle = this.translate.instant('exerciseService.hideErrorTitle');
      const errorMessage = this.translate.instant('exerciseService.unhideFailed');
      this.toastService.error(errorMessage, 0, errorTitle);
      return of(undefined);
    }

    const updatedExercises = [...currentExercises];
    const exerciseToUpdate = { ...updatedExercises[exerciseIndex], isHidden: false };
    updatedExercises[exerciseIndex] = exerciseToUpdate;

    this._saveExercisesToStorage(updatedExercises);
    const successTitle = this.translate.instant('exerciseService.visibleTitle');
    const successMessage = this.translate.instant('exerciseService.visibleMessage', { name: exerciseToUpdate.name });
    this.toastService.success(successMessage, 3000, successTitle);
    return of(exerciseToUpdate);
  }

  /**
   * Returns an observable list of ONLY the exercises that are currently hidden.
   * This is useful for a management page where a user can un-hide them.
   * @returns An Observable emitting an array of hidden Exercise objects.
   */
  public getHiddenExercises(): Observable<Exercise[]> {
    return this.exercisesSubject.asObservable().pipe(
      map(exercises => exercises.filter(ex => ex.isHidden))
    );
  }

  /**
 * --- REWRITTEN for Full Synchronization ---
 * Clears the `lastUsedAt` and `lastUsedLogId` for ALL exercises, then updates
 * only the exercises present in the provided map. This ensures exercises
 * that are no longer used have their timestamps correctly removed.
 * @param lastUsedMap A Map where the key is the exerciseId and the value contains the new timestamp and logId.
 */
  public async batchUpdateLastUsedTimestamps(lastUsedMap: Map<string, { lastUsedTimestamp: string, lastUsedLogId: string }>): Promise<void> {
    const currentExercises = this.exercisesSubject.getValue();
    let exercisesWereUpdated = false;

    const updatedExercises = currentExercises.map(exercise => {
      // Create a mutable copy of the exercise to work with
      const mutableExercise = { ...exercise };
      let needsUpdate = false;

      // Check if this exercise should be updated with a new date
      if (lastUsedMap.has(exercise.id)) {
        const { lastUsedTimestamp, lastUsedLogId } = lastUsedMap.get(exercise.id)!;
        // Update if the timestamp or logId is different
        if (mutableExercise.lastUsedAt !== lastUsedTimestamp || mutableExercise.lastUsedLogId !== lastUsedLogId) {
          mutableExercise.lastUsedAt = lastUsedTimestamp;
          mutableExercise.lastUsedLogId = lastUsedLogId;
          needsUpdate = true;
        }
      } else {
        // This exercise was NOT in the logs. If it has a stale timestamp, clear it.
        if (mutableExercise.lastUsedAt || mutableExercise.lastUsedLogId) {
          mutableExercise.lastUsedAt = undefined;
          mutableExercise.lastUsedLogId = undefined;
          mutableExercise.usageCount = 0;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        exercisesWereUpdated = true;
      }

      return mutableExercise;
    });

    if (exercisesWereUpdated) {
      this._saveExercisesToStorage(updatedExercises);
    }
  }

  /**
   * --- NEW METHOD ---
   * Scans all exercises and returns a sorted list of unique equipment names.
   * It cleans up the equipment names by removing suffixes like (optional) and standardizing common names.
   * @returns An Observable emitting a string array of unique equipment.
   */
  getUniqueEquipment(): Observable<string[]> {
    return this.exercises$.pipe(
      map(exercises => {
        const equipments = new Set<string>();
        exercises.forEach(exercise => {
          const processEquip = (equip: string) => {
            if (!equip) return;
            // remove noise from equipment string
            // and reduce any KB-relates exercise to just 'Kettlebell'
            const altIndex = equip.indexOf(' (alternative)');
            const optIndex = equip.indexOf(' (optional)');
            const dbIndex = equip.indexOf('Dumbbells');
            const dbsIndex = equip.indexOf('Dumbbell(s)');
            const kbIndex = equip.indexOf('Kettlebells');
            const kbsIndex = equip.indexOf('Kettlebell(s)');
            if (altIndex >= 0) {
              equip = equip.substring(0, altIndex);
            }
            if (optIndex >= 0) {
              equip = equip.substring(0, optIndex);
            }
            if (kbsIndex >= 0 || kbIndex >= 0) {
              equip = 'Kettlebell';
            }
            if (dbIndex >= 0 || dbsIndex >= 0) {
              equip = 'Dumbbell';
            }
            equipments.add(equip.trim());
          };

          if (exercise.equipment) {
            processEquip(exercise.equipment);
          }
          if (Array.isArray(exercise.equipmentNeeded)) {
            exercise.equipmentNeeded.forEach(processEquip);
          }
        });
        return Array.from(equipments).sort();
      }),
      take(1) // Ensure the observable completes after emitting the list once
    );
  }

  /**
   * Takes a base exercise object and returns an Observable of the same exercise
   * with its text properties (name, description, notes) translated to the current language.
   * If a translation is not found for a property, it gracefully falls back to the
   * original (English) text from the base object.
   *
   * @param exercise The base Exercise object with default (English) text.
   * @returns An Observable that emits a single, translated Exercise object.
   */
  /**
 * Takes a static Exercise object and returns an Observable of that
 * exercise with its 'name' and 'description' fields translated to the
 * currently active language.
 *
 * @param exercise The static Exercise object to translate.
 * @returns An Observable<Exercise> that emits the fully translated exercise.
 */
  getTranslatedExercise(exercise: Exercise): Observable<Exercise> {
    if (!exercise || !exercise.id) {
      return of(exercise); // Return original if invalid
    }

    // 1. Construct the translation key for this specific exercise
    const translationKey = `exercises.${exercise.id}`;

    // 2. Use ngx-translate to fetch the translation object for this key
    return this.translate.get(translationKey).pipe(
      map(translations => {
        // 3. Create a new object, merging the original static data
        //    with the fetched translated name and description.
        return {
          ...exercise, // Spread all original properties (id, category, images, etc.)
          name: translations.name || exercise.name, // Fallback to original name if translation is missing
          description: translations.description || exercise.description, // Fallback to original description
        };
      })
    );
  }

  /**
  * --- NEW METHOD TO BE ADDED ---
  * Translates the names of all exercises in a given list by calling
  * getTranslatedExercise for each and waiting for all to complete.
  *
  * @param exercises The array of Exercise objects to translate.
  * @returns An Observable that emits an array of translated Exercise objects.
  */
  public getTranslatedExerciseList(exercises: Exercise[]): Observable<Exercise[]> {
    // If the input array is null or empty, there's nothing to do.
    // Return an observable that immediately emits an empty array.
    if (!exercises || exercises.length === 0) {
      return of([]);
    }

    // Create an array of observables. Each observable in the array is a call
    // to translate a single exercise from the input list.
    const translationObservables = exercises.map(exercise =>
      this.getTranslatedExercise(exercise)
    );

    // Use forkJoin to execute all the translation observables in parallel.
    // forkJoin will wait until every observable in the array has emitted a value
    // and completed. It will then emit a single value: an array containing the
    // results (the translated exercises) from each of the inner observables.
    return forkJoin(translationObservables);
  }

  public getHydratedExercises(): Observable<HydratedExercise[]> {
    return combineLatest([
      this.getTranslatedExerciseList(this.exercisesSubject.getValue()), // Observable<Exercise[]>
      this.muscleMapService.musclesMap$,                                // Observable<Map<string, Muscle>>
      this.equipmentService.hydratedEquipments$,                        // Observable<Equipment[]>
      this.exerciseCategoryService.hydratedCategories$                  // Observable<HydratedCategory[]>
    ]).pipe(
      map(([exercises, musclesMap, equipments, categories]) => {
        // Build fast lookup maps
        const equipmentMap = new Map(equipments.map(eq => [eq.id, eq]));
        const categoryMap = new Map(categories.map(cat => [cat.id, cat]));

        return exercises.map(ex => {
          // Hydrate primary muscle group
          const normalizedPrimary = ex.primaryMuscleGroup
            ? MUSCLE_NORMALIZATION_MAP[ex.primaryMuscleGroup.toLowerCase().trim()] || ex.primaryMuscleGroup.toLowerCase().trim()
            : undefined;
          const primaryMuscleGroup = normalizedPrimary ? musclesMap.get(normalizedPrimary) : undefined;

          // Hydrate muscle groups
          const muscleGroups = (ex.muscleGroups || [])
            .map(muscleId => {
              const normId = MUSCLE_NORMALIZATION_MAP[muscleId.toLowerCase().trim()] || muscleId.toLowerCase().trim();
              return musclesMap.get(normId);
            })
            .filter((m): m is Muscle => !!m);

          // Hydrate equipment
          const equipmentNeeded = (ex.equipmentNeeded || [])
            .map(eqRaw => {
              if (!eqRaw) return undefined;
              const eqKey = EQUIPMENT_NORMALIZATION_MAP[eqRaw.toLowerCase().trim()] || eqRaw.toLowerCase().trim();
              return equipmentMap.get(eqKey as EquipmentValue);
            })
            .filter((eq): eq is HydratedEquipment => !!eq);

          // Hydrate category
          const normalizedCategory = ex.category
            ? EXERCISE_CATEGORY_NORMALIZATION_MAP[ex.category.toLowerCase().trim()] || ex.category.toLowerCase().trim()
            : undefined;
          const hydratedCategory = normalizedCategory ? categoryMap.get(normalizedCategory) : undefined;

          return {
            ...ex,
            primaryMuscleGroup,
            muscleGroups,
            equipmentNeeded,
            category: (hydratedCategory?.id || ex.category) as HydratedExercise['category'],
            categoryLabel: hydratedCategory?.label || ex.category
          };
        });
      })
    );
  }

  /**
   * Retrieves a single exercise by its ID and returns a "hydrated" version
   * with fully resolved and translated muscle and equipment objects.
   * @param id The ID of the exercise to retrieve.
   * @returns An Observable of the HydratedExercise.
   */
  getHydratedExerciseById(id: string): Observable<HydratedExercise | null> {
    return this.getExerciseById(id).pipe(
      switchMap(exercise => {
        if (!exercise) {
          return of(null);
        }

        // Build translation keys
        const nameKey = `exercises.${exercise.id}.name`;
        const descKey = `exercises.${exercise.id}.description`;

        // Use translated equipment
        return combineLatest([
          this.muscleMapService.musclesMap$,
          this.equipmentService.getTranslatedEquipment(), // <-- Use translated equipment here
          this.translate.get([nameKey, descKey])
        ]).pipe(
          map(([musclesMap, translatedEquipments, translations]) => {
            // Build a map for fast lookup
            const translatedEquipmentMap = new Map(translatedEquipments.map(eq => [eq.id, eq]));

            // Hydrate Primary Muscle Group
            // --- Normalize and hydrate primaryMuscleGroup ---
            const primaryMuscleGroup = exercise.primaryMuscleGroup
              ? musclesMap.get(
                MUSCLE_NORMALIZATION_MAP[exercise.primaryMuscleGroup.toLowerCase().trim()] ||
                exercise.primaryMuscleGroup.toLowerCase().trim()
              )
              : undefined;

            // --- Normalize and hydrate muscleGroups ---
            const muscleGroups = (exercise.muscleGroups || [])
              .map(muscleId => {
                const normId = MUSCLE_NORMALIZATION_MAP[muscleId.toLowerCase().trim()] || muscleId.toLowerCase().trim();
                return musclesMap.get(normId);
              })
              .filter((m): m is Muscle => !!m);

            // HYDRATE EQUIPMENT (with normalization and translation)
            const equipmentNeeded = (exercise.equipmentNeeded || [])
              .map(eqRaw => {
                if (!eqRaw) return undefined;
                const eqKey = EQUIPMENT_NORMALIZATION_MAP[eqRaw.toLowerCase().trim()] || eqRaw.toLowerCase().trim();
                return translatedEquipmentMap.get(eqKey);
              })
              .filter((eq): eq is HydratedEquipment => !!eq);

            // Assemble the final hydrated object
            return {
              ...exercise,
              name: translations[nameKey] || exercise.name,
              description: translations[descKey] || exercise.description,
              primaryMuscleGroup,
              muscleGroups,
              equipmentNeeded
            };
          })
        );
      })
    );
  }

  public mapHydratedExerciseToExercise(hydrated: HydratedExercise): Exercise {
    return {
      ...hydrated,
      primaryMuscleGroup: hydrated.primaryMuscleGroup?.id as MuscleValue ?? undefined,
      muscleGroups: hydrated.muscleGroups.map(m => m.id) as MuscleValue[],
      equipmentNeeded: hydrated.equipmentNeeded.map(eq => eq.id) as EquipmentValue[],
      // Remove hydrated-only fields if needed (e.g., categoryLabel)
    };
  }



}
const EXERCISE_NORMALIZATION_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const ex of EXERCISES_DATA) {
    map[ex.id.toLowerCase().trim()] = ex.id;
    map[ex.name.toLowerCase().trim()] = ex.id;
    // Add more aliases if needed
  }
  return map;
})();



