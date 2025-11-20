import { inject, Injectable, Renderer2, signal } from '@angular/core';
import { map, Observable, ObservableInput, of, shareReplay, startWith, switchMap } from 'rxjs';
import { Muscle } from '../models/muscle.model';
import { MUSCLES_DATA } from './muscles-data';
import { TranslateService } from '@ngx-translate/core';
import { toObservable } from '@angular/core/rxjs-interop';

export interface HydratedMuscle {
    id: string;
    name: string;
    bodyPart: string;
}

/**
 * Maps standardized muscle group names to the unique IDs of the paths in the SVG.
 * This is the central mapping used to connect exercise data to visual elements.
 */
const MUSCLE_TO_SVG_ID_MAP: Record<string, string[]> = {
    'shoulders': ['shoulders-front-left', 'shoulders-front-right', 'shoulder-back-left', 'shoulder-back-right'],
    'chest': ['chest-left', 'chest-right'],
    'abs': ['abs-upper', 'abs-middle', 'abs-lower'],
    'obliques': ['obliques-left', 'obliques-right', 'obliques-front-right', 'obliques-front-left'],
    'biceps': ['biceps-left', 'biceps-right'],
    'triceps': ['triceps-back-left', 'triceps-back-right'],
    'forearms': ['forearm-front-left', 'forearm-front-right', 'forearm-back-left', 'forearm-back-right'],
    'quadriceps': ['quads-left', 'quads-right'],
    'hamstrings': ['hamstrings-left', 'hamstrings-right'],
    'glutes': ['glutes-left', 'glutes-right'],
    'calves': ['calves-front-left', 'calves-front-right', 'calves-back-left', 'calves-back-right'],
    'adductors': ['adductors-left', 'adductors-right'],
    'traps': ['traps-upper', 'traps-middle'],
    'lats': ['lats-left', 'lats-right'],
    'lower back': ["backLower"],
    'upper back': ['upper-back-left', 'upper-back-right'] // Example for Rhomboids/Middle Back
};

/**
 * Defines the structure for the data required to highlight muscles.
 */
export interface MuscleHighlight {
    primary: string[];
    secondary: string[];
}

@Injectable({
    providedIn: 'root'
})
export class MuscleMapService {
    private readonly PRIMARY_COLOR = '#FF0000';   // Red
    private readonly SECONDARY_COLOR = '#FFFF00'; // Yellow
    private readonly DEFAULT_COLOR = '#808080';   // Grey for unworked muscles
    private readonly STROKE_COLOR = '#333333';    // Border color for muscles

    private translate = inject(TranslateService);



    constructor() {
        this.loadTranslations();

        // Reload translations on language change
        this.translate.onLangChange.subscribe(() => {
            this.loadTranslations();
        });
    }

    /**
     * Applies coloring to the SVG elements based on primary and secondary muscle groups.
     *
     * @param renderer The Renderer2 instance from the calling component.
     * @param svgElement The native SVG element to be manipulated.
     * @param muscles The object containing arrays of primary and secondary muscle names.
     */
    public colorMuscles(renderer: Renderer2, svgElement: SVGElement, muscles: MuscleHighlight): void {
        if (!svgElement || !muscles) {
            return;
        }

        // 1. Reset all muscle paths to their default state first.
        // This ensures that previous selections are cleared.
        const allPaths = svgElement.querySelectorAll('path[id]');
        allPaths.forEach((path: Element) => {
            renderer.setStyle(path, 'fill', this.DEFAULT_COLOR);
            renderer.setStyle(path, 'stroke', this.STROKE_COLOR);
        });

        // 2. Color secondary muscles first.
        const secondaryIds = this.getSvgIdsForMuscles(muscles.secondary);
        secondaryIds.forEach(id => {
            const element = svgElement.querySelector(`#${id}`);
            if (element) {
                renderer.setStyle(element, 'fill', this.SECONDARY_COLOR);
            }
        });

        // 3. Color primary muscles last.
        // This ensures that if a muscle is listed in both, it shows as primary.
        const primaryIds = this.getSvgIdsForMuscles(muscles.primary);
        primaryIds.forEach(id => {
            const element = svgElement.querySelector(`#${id}`);
            if (element) {
                renderer.setStyle(element, 'fill', this.PRIMARY_COLOR);
            }
        });
    }

    /**
     * Translates an array of muscle names into an array of corresponding SVG element IDs.
     *
     * @param muscleNames An array of muscle names (e.g., ['chest', 'triceps']).
     * @returns A flattened array of unique SVG IDs.
     */
    private getSvgIdsForMuscles(muscleNames: string[]): string[] {
        const ids = new Set<string>();
        if (!muscleNames) {
            return [];
        }

        muscleNames.forEach(name => {
            const normalizedName = name.toLowerCase();
            if (MUSCLE_TO_SVG_ID_MAP[normalizedName]) {
                MUSCLE_TO_SVG_ID_MAP[normalizedName].forEach(id => ids.add(id));
            }
        });

        return Array.from(ids);
    }

    muscles$: Observable<Muscle[]> = of(MUSCLES_DATA);



    /**
    * An observable stream that provides the complete list of muscles with all names
    * fully translated. This stream automatically updates whenever the application's
    * language changes.
    */
    public readonly translatedMuscles$: Observable<Muscle[]> = this.translate.onLangChange.pipe(
        startWith(null), // Trigger immediately
        switchMap(() => {
            return this.muscles$.pipe(
                switchMap(muscles => {
                    // This now correctly gets an array of keys like ['muscles.core', 'muscles.lats', ...]
                    const translationKeys = muscles.map(m => m.name);

                    return this.translate.get(translationKeys).pipe(
                        map(translations => {
                            return muscles.map(muscle => ({
                                ...muscle,
                                // It finds 'muscles.lats' in the translations object and returns "Dorsali"
                                name: translations[muscle.name] || muscle.name
                            }));
                        })
                    );
                })
            );
        }),
        shareReplay(1)
    );

    // Create a quick-lookup map for muscles
    musclesMap$: Observable<Map<string, Muscle>> = this.translatedMuscles$.pipe(
        map(muscles => new Map(muscles.map(m => [m.id, m])))
    );

    // The old method can be removed or kept for non-reactive scenarios,
    // but using translatedMuscles$ is now the recommended approach.
    public getTranslatedMuscles(): Observable<Muscle[]> {
        return this.translatedMuscles$;
    }

    private hydratedMuscles = signal<HydratedMuscle[]>([]);
    hydratedMuscles$ = toObservable(this.hydratedMuscles);

    // Loads translations for all muscles
    private loadTranslations() {
        const keys = MUSCLES_DATA.map(m => m.name);
        this.translate.get(keys).subscribe(translations => {
            const hydrated = MUSCLES_DATA.map(muscle => ({
                ...muscle,
                name: translations[muscle.name] || muscle.name
            }));
            this.hydratedMuscles.set(hydrated);
        });
    }

    // Returns all hydrated muscles
    getHydratedMuscles(): HydratedMuscle[] {
        return this.hydratedMuscles();
    }

    // Returns all canonical muscle IDs
    getAllMuscleIds(): string[] {
        return MUSCLES_DATA.map(m => m.id);
    }

    // Returns a single hydrated muscle by ID
    getMuscleById(id: string): HydratedMuscle | undefined {
        return this.hydratedMuscles().find(muscle => muscle.id === id);
    }

    public normalizeMuscleName(name: string): string {
        return name.trim().toLowerCase().replace(/[\s_]+/g, '-');
    }

    public getCanonicalMuscleId(name: string): string {
        const normalized = this.normalizeMuscleName(name);
        return MUSCLE_NORMALIZATION_MAP[normalized] || normalized;
    }
}

export const MUSCLE_NORMALIZATION_MAP: Record<string, string> = (() => {
    const map: Record<string, string> = {};
    for (const muscle of MUSCLES_DATA) {
        const id = muscle.id.toLowerCase().trim();
        const name = muscle.name?.toLowerCase().trim();

        // Canonical id
        map[id] = muscle.id;

        // Display name
        if (name) {
            map[name] = muscle.id;
        }

        // Variants: replace dashes/underscores with spaces, and vice versa
        if (id.includes('-')) {
            map[id.replace(/-/g, ' ')] = muscle.id;
            map[id.replace(/-/g, '')] = muscle.id;
        }
        if (id.includes(' ')) {
            map[id.replace(/\s+/g, '-')] = muscle.id;
            map[id.replace(/\s+/g, '')] = muscle.id;
        }
        if (id.endsWith('s')) {
            // Singular
            map[id.slice(0, -1)] = muscle.id;
        } else {
            // Plural
            map[id + 's'] = muscle.id;
        }
        // Repeat for display name if different
        if (name && name !== id) {
            if (name.includes('-')) {
                map[name.replace(/-/g, ' ')] = muscle.id;
                map[name.replace(/-/g, '')] = muscle.id;
            }
            if (name.includes(' ')) {
                map[name.replace(/\s+/g, '-')] = muscle.id;
                map[name.replace(/\s+/g, '')] = muscle.id;
            }
            if (name.endsWith('s')) {
                map[name.slice(0, -1)] = muscle.id;
            } else {
                map[name + 's'] = muscle.id;
            }
        }
    }
    // Add custom/legacy mappings if needed
    map['upper chest'] = 'chestUpper';
    map['upper back'] = 'backUpper';
    map['traps (upper)'] = 'trapsUpper';
    map['lower back'] = 'backLower';
    map['lower back (erector spinae)'] = 'backLower';
    map['abs (rectus abdominis)'] = 'abs';
    return map;
})();