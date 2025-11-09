import { Injectable, inject, Signal, signal, computed } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { EXERCISE_CATEGORIES_DATA } from './exercise-categories-data';
import { toObservable } from '@angular/core/rxjs-interop';

export interface HydratedCategory {
  id: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class ExerciseCategoryService {
  private translate = inject(TranslateService);

  // Signal for hydrated categories
  private hydratedCategories = signal<HydratedCategory[]>([]);
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
    const keys = EXERCISE_CATEGORIES_DATA.map(id => `categories.${id}`);
    this.translate.get(keys).subscribe(translations => {
      const hydrated = EXERCISE_CATEGORIES_DATA.map(id => ({
        id,
        label: translations[`categories.${id}`] || id
      }));
      this.hydratedCategories.set(hydrated);
    });
  }

  // Returns all hydrated categories
  getHydratedCategories(): HydratedCategory[] {
    return this.hydratedCategories();
  }

  // Returns all canonical category IDs
  getAllCategories(): string[] {
    return EXERCISE_CATEGORIES_DATA;
  }

  // Returns a single hydrated category by ID
  getCategoryById(id: string): HydratedCategory | undefined {
    return this.hydratedCategories().find(cat => cat.id === id);
  }
}

export const EXERCISE_CATEGORY_NORMALIZATION_MAP: Record<string, string> = (() => {
  // You can expand this with all your canonical categories and aliases
  const map: Record<string, string> = {};
const canonicalCategories = EXERCISE_CATEGORIES_DATA;
  canonicalCategories.forEach(cat => {
    map[cat.toLowerCase().trim()] = cat;
  });
  // Add legacy/display/alias mappings
  map['bodyweight/calisthenics'] = 'bodyweight-calisthenics';
  map['rehabilitation/mobility'] = 'rehabilitation-mobility';
  map['bodyweight-calisthenics'] = 'bodyweight-calisthenics';
  map['bodyweight'] = 'bodyweight-calisthenics';
  map['weightlifting'] = 'olympic-weightlifting';
  map['endurance'] = 'cardio';
  // ...add more as needed
  return map;
})();