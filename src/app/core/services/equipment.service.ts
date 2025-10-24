// src/app/core/services/equipment.service.ts

import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

import { Equipment } from '../models/equipment.model';
import { EQUIPMENT_DATA } from './equipment-data';

/**
 * Manages and provides access to all equipment data.
 * This service acts as the single source of truth for equipment definitions,
 * provides efficient lookup maps, and handles translations.
 */
@Injectable({
  providedIn: 'root'
})
export class EquipmentService {
  private translate = inject(TranslateService);

  /**
   * An observable stream of the raw equipment data with untranslated names (keys).
   * This is the base stream from which other streams are derived.
   */
  public readonly allEquipment$: Observable<Equipment[]> = of(EQUIPMENT_DATA);

  /**
   * An observable stream that provides a Map for efficient, O(1) average time complexity
   * lookups of equipment by its ID. This is ideal for data hydration in other services.
   * The result is cached and shared among subscribers using shareReplay.
   */
  public readonly equipmentMap$: Observable<Map<string, Equipment>> = this.allEquipment$.pipe(
    map(equipment => new Map(equipment.map(eq => [eq.id, eq]))),
    shareReplay(1) // Cache the last emitted map and share it
  );

  /**
   * An observable stream that provides the complete list of equipment with all names
   * fully translated into the current application language.
   * Ideal for displaying lists of equipment in the UI.
   * @returns An Observable emitting an array of translated Equipment objects.
   */
  public getTranslatedEquipment(): Observable<Equipment[]> {
    return this.allEquipment$.pipe(
      switchMap(equipment => {
        if (!equipment || equipment.length === 0) {
          return of([]);
        }

        // Collect all the translation keys from the equipment names
        const translationKeys = equipment.map(eq => eq.name);

        // Use the translate service to get the translated strings
        return this.translate.get(translationKeys).pipe(
          map(translations => {
            // Map the original equipment data to a new array with the translated names
            return equipment.map(eq => ({
              ...eq,
              // Replace the key with its translated value
              name: translations[eq.name] || eq.name 
            }));
          })
        );
      }),
      shareReplay(1) // Also cache the translated list
    );
  }

  /**
   * An observable stream that provides a Map for efficient lookups of translated
   * equipment. This can be useful for components that need to quickly find a
   * translated name by ID.
   */
  public getTranslatedEquipmentMap(): Observable<Map<string, Equipment>> {
    return this.getTranslatedEquipment().pipe(
      map(equipment => new Map(equipment.map(eq => [eq.id, eq]))),
      shareReplay(1)
    );
  }
}