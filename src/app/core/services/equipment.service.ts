// src/app/core/services/equipment.service.ts

import { Injectable, inject, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

import { Equipment, EQUIPMENT_DATA, EquipmentCategory, EquipmentValue } from './equipment-data';
import { toObservable } from '@angular/core/rxjs-interop';

export interface HydratedEquipment {
  id: EquipmentValue;
  name: string;
  categories: string[];
}

export interface HydratedEquipmentCategory {
  id: EquipmentCategory;
  name: string;
}

// Build a map: legacyNameOrId (lowercase, trimmed) => canonicalId
export const EQUIPMENT_NORMALIZATION_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const eq of EQUIPMENT_DATA) {
    const camelId = eq.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    map[camelId] = camelId;
    map[eq.id.toLowerCase().trim()] = camelId;
    if (eq.name) {
      map[eq.name.toLowerCase().trim()] = camelId;
    }
  }

  // --- Custom/legacy mappings ---
  map['hyperextension bench/machine'] = 'hyperextensionBench'; // or 'hyperextensionMachine' if that's your canonical id
  map['hyperextension bench'] = 'hyperextensionBench';
  map['hyperextension machine'] = 'hyperextensionMachine';
  // Add more as needed...

  return map;
})();

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^(.)/, (m) => m.toLowerCase());
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
            return equipment
              .map(eq => ({
                ...eq,
                name: translations[`equipments.${eq.id}`] || eq.id
              }))
              .sort((a, b) => a.name.localeCompare(b.name));
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

  private hydratedEquipmentCategories = signal<string[]>([]);
  hydratedEquipmentCategories$ = toObservable(this.hydratedEquipmentCategories);

  // Loads translations for all equipments
  private loadTranslations() {
    const equipmentKeys = EQUIPMENT_DATA.map(eq => `equipments.${eq.id}`);
    // Filter out nulls so categoryKeys is string[]
    const categoryKeys = EQUIPMENT_DATA
      .map(eq => eq.categories ? eq.categories.map(cat => `categories.${cat}`) : null)
      .filter((key): key is string[] => !!key);

    const allKeys = [...equipmentKeys, ...categoryKeys.flat()];

    this.translate.get(allKeys).subscribe(translations => {
      const hydrated = EQUIPMENT_DATA.map(eq => ({
        id: eq.id as EquipmentValue,
        name: translations[`equipments.${eq.id}`] || eq.id,
        categories: eq.categories ? eq.categories.map(cat => translations[`categories.${cat}`] || cat) : []
      }));
      this.hydratedEquipments.set(hydrated);
    });
  }

  // Returns all hydrated categories
  getEquipmentHydratedCategories(): HydratedEquipmentCategory[] {
    return Object.values(EquipmentCategory)
      .map((catId): HydratedEquipmentCategory => ({
        id: catId,
        name: this.translate.instant(`equipments.categories.${catId}`) || catId
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
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