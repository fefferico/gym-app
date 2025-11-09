// src/app/core/services/equipment.service.ts

import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

import { Equipment } from '../models/equipment.model';
import { EQUIPMENT_DATA, EquipmentValue } from './equipment-data';
import { toObservable } from '@angular/core/rxjs-interop';
import { EXERCISE_CATEGORIES_DATA } from './exercise-categories-data';

export interface HydratedEquipment {
  id: EquipmentValue;
  name: string;
  category: string;
}

// Build a map: legacyNameOrId (lowercase, trimmed) => canonicalId
export const EQUIPMENT_NORMALIZATION_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const eq of EQUIPMENT_DATA) {
    const kebabId = eq.id.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    map[kebabId] = kebabId;
    map[eq.id.toLowerCase().trim()] = kebabId;
    if (eq.name) {
      map[eq.name.toLowerCase().trim()] = kebabId;
    }
  }

  // --- Custom/legacy mappings ---
  map['hyperextension bench/machine'] = 'hyperextension-bench'; // or 'hyperextension-machine' if that's your canonical id
  map['hyperextension bench'] = 'hyperextension-bench';
  map['hyperextension machine'] = 'hyperextension-machine';
  // Add more as needed...

  return map;
})();

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

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

  constructor() {
    this.loadTranslations();

    // Reload translations on language change
    this.translate.onLangChange.subscribe(() => {
      this.loadTranslations();
    });
  }

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

  public getTranslatedEquipment(): Observable<Equipment[]> {
    return this.allEquipment$.pipe(
      switchMap(equipment => {
        if (!equipment || equipment.length === 0) {
          return of([]);
        }

        // Build translation keys for each equipment
        const translationKeys = equipment.map(eq => `equipments.${eq.id}`);

        return this.translate.stream(translationKeys).pipe(
          map(translations => {
            return equipment.map(eq => ({
              ...eq,
              name: translations[`equipments.${eq.id}`] || eq.id
            }));
          })
        );
      }),
      shareReplay(1)
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

  // Signal for hydrated equipments
  private hydratedEquipments = signal<HydratedEquipment[]>([]);
  hydratedEquipments$ = toObservable(this.hydratedEquipments);

  // Loads translations for all equipments
private loadTranslations() {
  const equipmentKeys = EQUIPMENT_DATA.map(eq => `equipments.${eq.id}`);
  // Filter out nulls so categoryKeys is string[]
  const categoryKeys = EQUIPMENT_DATA
    .map(eq => eq.category ? `categories.${eq.category}` : null)
    .filter((key): key is string => !!key);

  const allKeys = [...equipmentKeys, ...categoryKeys];

  this.translate.get(allKeys).subscribe(translations => {
    const hydrated = EQUIPMENT_DATA.map(eq => ({
      id: eq.id as EquipmentValue,
      name: translations[`equipments.${eq.id}`] || eq.id,
      category: eq.category ? translations[`categories.${eq.category}`] || eq.category : ''
    }));
    this.hydratedEquipments.set(hydrated);
  });
}

  // Returns all hydrated categories
  getHydratedCategories(): HydratedEquipment[] {
    return this.hydratedEquipments();
  }

  // Returns all canonical equipment IDs
  getAllEquipments(): Equipment[] {
    return EQUIPMENT_DATA;
  }

  // Returns a single hydrated equipment by ID
  getEquipmentById(id: string): HydratedEquipment | undefined {
    return this.hydratedEquipments().find(eq => eq.id === id);
  }

}