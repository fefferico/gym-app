// src/app/features/workout-routines/routine-list/generate-workout-modal/generate-workout-modal.component.ts
import { Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, Signal, signal, SimpleChanges } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { WorkoutGenerationOptions } from '../../../core/services/workout-generator.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { Equipment } from '../../../core/models/equipment.model';
import { PersonalGymService } from '../../../core/services/personal-gym.service';

@Component({
    selector: 'app-generate-workout-modal',
    standalone: true,
    imports: [CommonModule, IconComponent, FormsModule, TitleCasePipe],
    templateUrl: './generate-workout-modal.component.html',
})
export class GenerateWorkoutModalComponent implements OnInit, OnChanges  {
    @Input() isOpen: boolean = false;
    @Output() close = new EventEmitter<void>();
    @Output() generate = new EventEmitter<WorkoutGenerationOptions | 'quick'>();

    private exerciseService = inject(ExerciseService);
    private personalGymService = inject(PersonalGymService);

    allMuscleGroups = signal<string[]>([]);
    allAvailableEquipment = signal<string[]>([]); 
    allPersonalGymEquipment = signal<string[]>([]); 


    options: WorkoutGenerationOptions = {
        duration: 45,
        goal: 'hypertrophy',
        split: 'full-body',
        targetMuscles: [],
        avoidMuscles: [],
        usePersonalGym: true,
        equipment: [],
    };

    async ngOnInit() {
        const muscles = await firstValueFrom(this.exerciseService.getUniquePrimaryMuscleGroups());
        this.allMuscleGroups.set(muscles);
        const equipment = await firstValueFrom(this.exerciseService.getUniqueEquipment());
        this.allAvailableEquipment.set(equipment);

        const personalGymEquipment = await firstValueFrom(this.personalGymService.getAllEquipment());
        this.allPersonalGymEquipment.set(personalGymEquipment.map((eq: Equipment) => eq.name));
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
        };
    }

    // NEW: Method to toggle equipment selection when not using personal gym
    toggleEquipment(equipment: string) {
        const index = this.options.equipment.indexOf(equipment);
        if (index > -1) {
            this.options.equipment.splice(index, 1); // Remove
        } else {
            this.options.equipment.push(equipment); // Add
        }
    }

    // NEW: Handle change for 'Use Personal Gym Equipment' checkbox
    onUsePersonalGymChange() {
        if (this.options.usePersonalGym) {
            // If using personal gym, clear any previously selected equipment from the 'all available' list
            this.options.equipment = []; 
        } else {
            // If NOT using personal gym, pre-select personal gym equipment in the 'all available' list
            // This assumes personalGymEquipment is a subset of allAvailableEquipment
            this.options.equipment = [...this.allAvailableEquipment()];
        }
    }
}