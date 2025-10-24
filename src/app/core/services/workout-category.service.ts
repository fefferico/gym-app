// src/app/core/services/category.service.ts

import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { Category } from '../models/workout-category.model';
import { CATEGORY_DATA } from './workout-category-data';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private translate = inject(TranslateService);

  /**
   * An observable stream of the raw category data with untranslated names (keys).
   */
  public readonly allCategories$: Observable<Category[]> = of(CATEGORY_DATA);

  /**
   * An observable stream that provides a Map for efficient lookups of categories by ID.
   * This is useful for data hydration.
   */
  public readonly categoryMap$: Observable<Map<string, Category>> = this.allCategories$.pipe(
    map(categories => new Map(categories.map(cat => [cat.id, cat]))),
    shareReplay(1) // Cache the last emitted map
  );

  /**
   * A reactive observable stream that provides the list of all categories with their
   * names translated to the current application language. It automatically updates
   * when the language changes.
   */
  public readonly translatedCategories$: Observable<Category[]> = this.translate.onLangChange.pipe(
    startWith(null), // Trigger immediately on subscription
    switchMap(() => {
      return this.allCategories$.pipe(
        switchMap(categories => {
          if (!categories.length) {
            return of([]);
          }
          const translationKeys = categories.map(cat => cat.name);
          return this.translate.get(translationKeys).pipe(
            map(translations => 
              categories.map(cat => ({
                ...cat,
                name: translations[cat.name] || cat.name // Fallback to key if not found
              }))
            )
          );
        })
      );
    }),
    shareReplay(1) // Cache the latest translated list
  );

  /**
   * A helper method to easily get the translated categories stream.
   * @returns An Observable emitting an array of translated Category objects.
   */
  public getTranslatedCategories(): Observable<Category[]> {
    return this.translatedCategories$;
  }
}