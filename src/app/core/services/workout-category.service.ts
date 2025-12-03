// src/app/core/services/category.service.ts

import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { WorkoutCategory } from '../models/workout-category.model';
import { WORKOUT_CATEGORY_DATA } from './workout-category-data';

@Injectable({
  providedIn: 'root'
})
export class WorkoutCategoryService {
  private translate = inject(TranslateService);

  /**
   * An observable stream of the raw category data with untranslated names (keys).
   */
  public readonly allCategories$: Observable<WorkoutCategory[]> = of(WORKOUT_CATEGORY_DATA);

  /**
   * An observable stream that provides a Map for efficient lookups of categories by ID.
   * This is useful for data hydration.
   */
  public readonly categoryMap$: Observable<Map<string, WorkoutCategory>> = this.allCategories$.pipe(
    map(categories => new Map(categories.map(cat => [cat.id, cat]))),
    shareReplay(1) // Cache the last emitted map
  );

  /**
   * A reactive observable stream that provides the list of all categories with their
   * names translated to the current application language. It automatically updates
   * when the language changes.
   */
    public readonly translatedCategories$: Observable<WorkoutCategory[]> = this.translate.onLangChange.pipe(
    startWith(null),
    switchMap(() => {
      return this.allCategories$.pipe(
        switchMap(categories => {
          if (!categories.length) {
            return of([]);
          }
          // Use translation keys like 'workoutCategories.{id}'
          const translationKeys = categories.map(cat => `workoutCategories.${cat.id}`);
          return this.translate.get(translationKeys).pipe(
            map(translations =>
              categories.map(cat => ({
                ...cat,
                name: translations[`workoutCategories.${cat.id}`] || cat.name // fallback to original name
              }))
            )
          );
        })
      );
    }),
    shareReplay(1)
  );

  /**
   * A helper method to easily get the translated categories stream.
   * @returns An Observable emitting an array of translated Category objects.
   */
  public getTranslatedCategories(): Observable<WorkoutCategory[]> {
    return this.translatedCategories$;
  }
}