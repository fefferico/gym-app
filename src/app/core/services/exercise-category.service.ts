import { Injectable, inject, Signal, signal, computed } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EXERCISE_CATEGORY_TYPES } from '../models/exercise-category.model';

export interface HydratedExerciseCategory {
  id: EXERCISE_CATEGORY_TYPES;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class ExerciseCategoryService {
  private translate = inject(TranslateService);

  // Signal for hydrated categories
  private hydratedCategories = signal<HydratedExerciseCategory[]>([]);
  hydratedCategories$ = toObservable(this.hydratedCategories);

  constructor() {
    this.loadTranslations();

    // Reload translations on language change
    this.translate.onLangChange.subscribe(() => {
      this.loadTranslations();
    });
  }

  // Loads translations for all categories
  private loadTranslations() {
    const keys = Object.values(EXERCISE_CATEGORY_TYPES).map(id => `categories.${id}`);
    this.translate.get(keys).subscribe(translations => {
      const hydrated = Object.values(EXERCISE_CATEGORY_TYPES).map(id => ({
        id: id as EXERCISE_CATEGORY_TYPES,
        name: translations[`categories.${id}`] || id
      }));
      this.hydratedCategories.set(hydrated);
    });
  }

  // Returns all hydrated categories
  getHydratedCategories(): HydratedExerciseCategory[] {
    return this.hydratedCategories();
  }

  // Returns all canonical category IDs
  getAllCategories(): EXERCISE_CATEGORY_TYPES[] {
    return Object.values(EXERCISE_CATEGORY_TYPES) as EXERCISE_CATEGORY_TYPES[];
  }

  // Returns a single hydrated category by ID
  getCategoryById(id: EXERCISE_CATEGORY_TYPES): HydratedExerciseCategory | undefined {
    return this.hydratedCategories().find(cat => cat.id === id);
  }
}

export const EXERCISE_CATEGORY_NORMALIZATION_MAP: Record<string, string> = (() => {
  // You can expand this with all your canonical categories and aliases
  const map: Record<string, string> = {};
const canonicalCategories = Object.values(EXERCISE_CATEGORY_TYPES);
  canonicalCategories.forEach(cat => {
    const catStr = String(cat);
    map[catStr.toLowerCase().trim()] = catStr;
  });
  // Add legacy/display/alias mappings
  map['bodyweightCalisthenics'] = 'bodyweightCalisthenics';
  map['rehabilitation/mobility'] = 'rehabilitationMobility';
  map['bodyweightCalisthenics'] = 'bodyweightCalisthenics';
  map['bodyweight'] = 'bodyweightCalisthenics';
  map['weightlifting'] = 'olympicWeightlifting';
  map['endurance'] = 'cardio';
  // ...add more as needed
  return map;
})();