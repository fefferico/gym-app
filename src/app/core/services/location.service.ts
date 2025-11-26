// location.service.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { TranslateService, LangChangeEvent } from '@ngx-translate/core'; // Or your preferred lib
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs/operators';
import { LocationConfig, WorkoutLocation } from '../models/location.model';
import { LOCATION_CONFIGS } from '../models/location.data';
import { ActivityService } from './activity.service';


@Injectable({ providedIn: 'root' })
export class LocationService {
  private _translate = inject(TranslateService);
  private activityService = inject(ActivityService);

  // 1. The Static Data (Private)
  private readonly _configs = signal<LocationConfig[]>(LOCATION_CONFIGS);

  // 2. Signal that tracks Language Changes
  // We convert the TranslateService observable stream into a Signal
  private readonly _currentLang = toSignal(
    this._translate.onLangChange.pipe(
      map((event: LangChangeEvent) => event.lang),
      startWith(this._translate.currentLang || 'en')
    )
  );

  // 3. The Hydrated List (Public & Reactive)
  // Whenever _currentLang changes, this re-runs automatically.
  readonly allLocationTypes = computed<WorkoutLocation[]>(() => {
    // Dependency tracking: accessing this signal registers the dependency
    const lang = this._currentLang(); 
    const configs = this._configs();

    return configs.map(config => this.hydrateLocation(config));
  });

  // 4. Grouped List (Reactive)
  readonly locationsByCategory = computed(() => {
    const groups = new Map<string, WorkoutLocation[]>();
    
    this.allLocationTypes().forEach(loc => {
      // Group by the TRANSLATED category label
      const catLabel = loc.categoryLabel;
      const current = groups.get(catLabel) || [];
      groups.set(catLabel, [...current, loc]);
    });
    
    return groups;
  });

  // --- Helper: Performs the synchronous translation ---
  private hydrateLocation(config: LocationConfig): WorkoutLocation {
    // NOTE: instant() works because we subscribed to onLangChange, 
    // ensuring translations are loaded before this computes.
    
    // 1. Translate the specific location name
    const label = this._translate.instant(config.translationKey);
    
    // 2. Translate the category name (e.g., "COMMERCIAL" -> "Palestra")
    const categoryKey = `LOCATIONS.CATEGORY.${config.category}`;
    const categoryLabel = this._translate.instant(categoryKey);

    // 3. Return the object with strings, removing the key
    const { translationKey, ...rest } = config;
    
    return {
      ...rest,
      label,
      categoryLabel
    };
  }
  
  // --- Selection Logic ---
  readonly selectedLocationId = signal<string | null>(null);

  readonly selectedLocation = computed(() => {
    const id = this.selectedLocationId();
    return this.allLocationTypes().find(l => l.id === id) || null;
  });

  selectLocation(id: string) {
    this.selectedLocationId.set(id);
  }

  getHydratedLocationByLocationId(locationId: string): any {
     const location = this.allLocationTypes().find(l => l.id === locationId);
     return location ? location.label : locationId;
  }
}