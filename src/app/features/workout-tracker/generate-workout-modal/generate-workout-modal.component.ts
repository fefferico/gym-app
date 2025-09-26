// src/app/features/workout-routines/routine-list/generate-workout-modal/generate-workout-modal.component.ts
import { Component, computed, EventEmitter, inject, Input, OnChanges, OnInit, Output, Signal, signal, SimpleChanges } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { WorkoutGenerationOptions } from '../../../core/services/workout-generator.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { Equipment } from '../../../core/models/equipment.model';
import { PersonalGymService } from '../../../core/services/personal-gym.service';
import { FabAction, FabMenuComponent } from '../../../shared/components/fab-menu/fab-menu.component';

@Component({
    selector: 'app-generate-workout-modal',
    standalone: true,
    imports: [CommonModule, IconComponent, FormsModule, TitleCasePipe, FabMenuComponent],
    templateUrl: './generate-workout-modal.component.html',
})
export class GenerateWorkoutModalComponent implements OnInit, OnChanges {
    @Input() isOpen: boolean = false;
    @Output() close = new EventEmitter<void>();
    @Output() generate = new EventEmitter<WorkoutGenerationOptions | 'quick'>();

    private exerciseService = inject(ExerciseService);
    private personalGymService = inject(PersonalGymService);

    allMuscleGroups = signal<string[]>([]);
    allAvailableEquipment = signal<string[]>([]);
    allPersonalGymEquipment = signal<string[]>([]);
    equipmentSearchTerm = signal<string>('');

    filteredAvailableEquipment = computed(() => {
        const term = this.equipmentSearchTerm().toLowerCase().trim();
        if (!term) {
            return []; // Return an empty array if there's no search term to avoid showing a long list
        }
        return this.allAvailableEquipment().filter(eq =>
            eq.toLowerCase().includes(term) && !this.options.equipment.includes(eq)
        );
    });

    options: WorkoutGenerationOptions = {
        duration: 45,
        goal: 'hypertrophy',
        split: 'full-body',
        targetMuscles: [],
        avoidMuscles: [],
        usePersonalGym: true,
        equipment: [],
        excludeEquipment: []
    };

    async ngOnInit() {
        const muscles = await firstValueFrom(this.exerciseService.getUniquePrimaryMuscleGroups());
        this.allMuscleGroups.set(muscles);
        const equipment = await firstValueFrom(this.exerciseService.getUniqueEquipment());
        this.allAvailableEquipment.set(equipment);

        const personalGymEquipment = await firstValueFrom(this.personalGymService.getAllEquipment());
        this.allPersonalGymEquipment.set(personalGymEquipment.map((eq: Equipment) => eq.category));
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['isOpen'] && changes['isOpen'].currentValue === true) {
            this.resetOptions(); // Reset options when the modal is opened
        }
    }

    toggleMuscle(type: 'target' | 'avoid', muscle: string) {
        const list = type === 'target' ? this.options.targetMuscles : this.options.avoidMuscles;
        const index = list.indexOf(muscle);
        if (index > -1) {
            list.splice(index, 1);
        } else {
            list.push(muscle);
        }
    }

    generateQuick() {
        this.generate.emit('quick');
        // The modal no longer closes itself; the parent will handle it.
    }

    generateDetailed() {
        // We emit a copy of the options object
        this.generate.emit({ ...this.options });
    }

    public resetOptions() {
        this.options = {
            duration: 45,
            goal: 'hypertrophy',
            split: 'full-body',
            targetMuscles: [],
            avoidMuscles: [],
            usePersonalGym: true,
            equipment: [],
            excludeEquipment: []
        };
        this.equipmentSearchTerm.set('');
        this.excludeEquipmentSearchTerm.set('');
    }

    // NEW: Method to toggle equipment selection when not using personal gym
    selectEquipment(equipment: string) {
        if (!this.options.equipment.includes(equipment)) {
            this.options.equipment.push(equipment);
        }
        this.equipmentSearchTerm.set(''); // Clear search input after selection
    }

    removeEquipment(equipment: string) {
        const index = this.options.equipment.indexOf(equipment);
        if (index > -1) {
            this.options.equipment.splice(index, 1);
        }
    }

    // NEW: Handle change for 'Use Personal Gym Equipment' checkbox
    onUsePersonalGymChange() {
        this.options.equipment = [];
        this.options.excludeEquipment = []; // Clear exclusions when toggling
        this.equipmentSearchTerm.set('');
    }

    // Handles clicking on a personal gym equipment item
    toggleExcludePersonalGymEquipment(equipment: string) {
        const index = this.options.excludeEquipment.indexOf(equipment.toLowerCase());
        if (index > -1) {
            // If it's already excluded, remove it from the exclusion list (re-enabling it)
            this.options.excludeEquipment.splice(index, 1);
        } else {
            // If it's not excluded, add it to the exclusion list
            // add the equipment to the exclusion list, not jsut the equipment name
            this.options.excludeEquipment.push(equipment.toLowerCase());
        }
    }

    excludeEquipmentSearchTerm = signal<string>(''); // NEW

    filteredAvailableEquipmentToExclude = computed(() => { // NEW
        const term = this.excludeEquipmentSearchTerm().toLowerCase().trim();
        if (!term) {
            return [];
        }
        const allEq = this.allAvailableEquipment();
        const personalGymEq = this.allPersonalGymEquipment(); // Get personal gym eq

        // Filter from either all available or personal gym equipment based on 'usePersonalGym'
        const sourceList = this.options.usePersonalGym ? personalGymEq : allEq;

        return sourceList.filter(eq =>
            eq.toLowerCase().includes(term) && !this.options.excludeEquipment.includes(eq)
        );
    });

    addExcludedEquipment(equipment: string) {
        if (!this.options.excludeEquipment.includes(equipment)) {
            this.options.excludeEquipment.push(equipment);
        }
        this.excludeEquipmentSearchTerm.set('');
    }

    removeExcludedEquipment(equipment: string) {
        const index = this.options.excludeEquipment.indexOf(equipment);
        if (index > -1) {
            this.options.excludeEquipment.splice(index, 1);
        }
    }

    // Define the actions for the FAB menu
    public fabActions: FabAction[] = [
        {
            actionKey: 'generate_detailed',
            label: 'GENERATE CUSTOM WORKOUT',
            iconName: 'magic-wand',
            cssClass: 'bg-primary'
        },
        {
            actionKey: 'generate_quick',
            label: 'SURPRISE ME!',
            iconName: 'random',
            cssClass: 'bg-green-500'
        }
    ];

    /**
     * Handles the click event from the FAB menu.
     * @param actionKey The key of the action that was clicked.
     */
    public handleFabAction(actionKey: string): void {
        if (actionKey === 'generate_quick') {
            this.generateQuick();
        } else if (actionKey === 'generate_detailed') {
            this.generateDetailed();
        }
    }
}