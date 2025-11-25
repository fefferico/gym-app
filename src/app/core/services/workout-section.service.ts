import { inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WorkoutSection } from '../models/workout-section.model';
import { WorkoutSectionType } from '../models/workout-section-type.model';
import { AlertService } from './alert.service';
import { WorkoutExercise } from '../models/workout.model';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
    providedIn: 'root'
})
export class WorkoutSectionService {
    // Holds the currently selected section (for session or definition)
    private selectedSectionSubject = new BehaviorSubject<WorkoutSection | null>(null);
    selectedSection$ = this.selectedSectionSubject.asObservable();

    private alertService = inject(AlertService);
    private translate = inject(TranslateService);

    // Select a section
    selectSection(section: WorkoutSection) {
        this.selectedSectionSubject.next(section);
    }

    // Deselect section
    clearSelection() {
        this.selectedSectionSubject.next(null);
    }

    // Get current selected section (snapshot)
    getSelectedSection(): WorkoutSection | null {
        return this.selectedSectionSubject.value;
    }

    // Retrieve the WorkoutSectionType from the selected section
    getSelectedSectionType(): WorkoutSectionType | null {
        const section = this.getSelectedSection();
        return section ? section.type : null;
    }

    async addSectionToExerciseModal(exercise: WorkoutExercise): Promise<WorkoutExercise | null> {
        const sectionOptions = Object.values(WorkoutSectionType).map(type => ({
            label: type === WorkoutSectionType.NONE ? this.translate.instant('workoutSection.assignToSectionNone') : this.getSectionColorAndLabel(type).label,
            value: type
        }));

        const result = await this.alertService.showPromptDialog(
            this.translate.instant('workoutSection.assignToSectionTitle'),
            this.translate.instant('workoutSection.assignToSectionDescription'),
            [{
                name: 'sectionType',
                type: 'select',
                label: this.translate.instant('workoutSection.assignToSectionLabel'),
                placeholder: this.translate.instant('workoutSection.assignToSectionNone'),
                options: sectionOptions,
                required: true
            }],
            this.translate.instant('workoutSection.assignToSectionAction')
        );

        if (!result) {
            return null;
        }
        if (result && result['sectionType']) {
            const selectedType = result['sectionType'] === 'none' ? undefined : result['sectionType'];
            // if it's not a string return null
            if (typeof selectedType !== 'string') {
                return null;
            }
            return {
                ...exercise,
                section: this.mapStringToWorkoutSectionType(selectedType),
            };
        }
        return null;
    }

    /**
     * Helper to get color and label for a section type.
     */
    private getSectionColorAndLabel(type: WorkoutSectionType): { label: string, color: string } {
        switch (type) {
            case WorkoutSectionType.WARM_UP: return { label: this.translate.instant('workoutSection.sectionLabels.WarmUp'), color: '#f59e0b' }; // Amber-500
            case WorkoutSectionType.MAIN_LIFT: return { label: this.translate.instant('workoutSection.sectionLabels.MainLift'), color: '#ef4444' }; // Red-500
            case WorkoutSectionType.CARDIO: return { label: this.translate.instant('workoutSection.sectionLabels.Cardio'), color: '#3b82f6' }; // Blue-500
            case WorkoutSectionType.FINISHER: return { label: this.translate.instant('workoutSection.sectionLabels.Finisher'), color: '#a855f7' }; // Purple-500
            case WorkoutSectionType.COOL_DOWN: return { label: this.translate.instant('workoutSection.sectionLabels.CoolDown'), color: '#10b981' }; // Emerald-500
            default: return { label: type, color: '#6b7280' }; // Gray-500
        }
    }

    /**
* Maps a string to a WorkoutSectionType, or returns null if not found.
*/
    private mapStringToWorkoutSectionType(value: string): WorkoutSectionType | undefined {
        if (!value) return undefined;
        const normalized = value.trim().toLowerCase();
        const types = Object.values(WorkoutSectionType) as string[];
        const found = types.find(type => type.toLowerCase() === normalized);
        return found as WorkoutSectionType || null;
    }


}