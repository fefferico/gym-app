// src/app/core/services/workout.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

import { Routine } from '../models/workout.model'; // Ensure this path is correct
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root',
})
export class WorkoutService {
  private storageService = inject(StorageService);
  private readonly ROUTINES_STORAGE_KEY = 'fitTrackPro_routines';

  // Using a BehaviorSubject to make routines reactively available and to update them
  // It's initialized by loading routines from storage.
  private routinesSubject = new BehaviorSubject<Routine[]>(this.loadRoutinesFromStorage());

  // Public observable that components can subscribe to
  public routines$: Observable<Routine[]> = this.routinesSubject.asObservable();

  constructor() {
    // You could log the initial routines loaded for debugging
    // console.log('Initial routines loaded:', this.routinesSubject.getValue());
  }

  private loadRoutinesFromStorage(): Routine[] {
    const routines = this.storageService.getItem<Routine[]>(this.ROUTINES_STORAGE_KEY);
    return routines ? routines : [];
  }

  private saveRoutinesToStorage(routines: Routine[]): void {
    this.storageService.setItem(this.ROUTINES_STORAGE_KEY, routines);
    this.routinesSubject.next([...routines]); // Emit a new array reference to trigger change detection
  }

  // Expose the current value if needed synchronously, though observable is preferred
  public getCurrentRoutines(): Routine[] {
    return this.routinesSubject.getValue();
  }

  getRoutineById(id: string): Observable<Routine | undefined> {
    return this.routines$.pipe(
      map(routines => routines.find(r => r.id === id))
    );
  }

  addRoutine(newRoutineData: Omit<Routine, 'id'>): Routine {
    const currentRoutines = this.routinesSubject.getValue();
    const newRoutine: Routine = {
      ...newRoutineData,
      id: uuidv4(), // Generate a unique ID
    };
    const updatedRoutines = [...currentRoutines, newRoutine];
    this.saveRoutinesToStorage(updatedRoutines);
    console.log('Added routine:', newRoutine);
    return newRoutine;
  }

  updateRoutine(updatedRoutine: Routine): Routine | undefined {
    let currentRoutines = this.routinesSubject.getValue();
    const index = currentRoutines.findIndex(r => r.id === updatedRoutine.id);

    if (index > -1) {
      // Create a new array for immutability and to ensure change detection
      const updatedRoutinesArray = [...currentRoutines];
      updatedRoutinesArray[index] = { ...updatedRoutine }; // Also clone the routine object
      this.saveRoutinesToStorage(updatedRoutinesArray);
      console.log('Updated routine:', updatedRoutine);
      return updatedRoutine;
    }
    console.warn(`WorkoutService: Routine with id ${updatedRoutine.id} not found for update.`);
    return undefined;
  }

  deleteRoutine(id: string): void {
    const currentRoutines = this.routinesSubject.getValue();
    const updatedRoutines = currentRoutines.filter(r => r.id !== id);

    if (updatedRoutines.length < currentRoutines.length) {
      this.saveRoutinesToStorage(updatedRoutines);
      console.log('Deleted routine with id:', id);
    } else {
      console.warn(`WorkoutService: Routine with id ${id} not found for deletion.`);
    }
  }

  // Utility to create a new WorkoutExercise ID
  // These could also be part of the WorkoutBuilderComponent logic if preferred
  generateWorkoutExerciseId(): string {
    return uuidv4();
  }

  // Utility to create a new ExerciseSetParams ID
  generateExerciseSetId(): string {
    return uuidv4();
  }
}