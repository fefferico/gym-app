// src/app/features/workout-routines/routine-list/generate-workout-modal/generate-workout-modal.component.ts
import { Component, computed, EventEmitter, inject, Input, OnChanges, OnInit, Output, signal, SimpleChanges, effect, Inject, DOCUMENT } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { WorkoutGenerationOptions } from '../../../core/services/workout-generator.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { Equipment } from '../../../core/models/equipment.model';
import { PersonalGymService } from '../../../core/services/personal-gym.service';
import { FabAction, FabMenuComponent } from '../../../shared/components/fab-menu/fab-menu.component';
import { TranslateModule } from '@ngx-translate/core'; // +++ IMPORT TRANSLATE MODULE

@Component({
    selector: 'app-generate-workout-modal',
    standalone: true,
    imports: [CommonModule, IconComponent, FormsModule, TitleCasePipe, FabMenuComponent, TranslateModule], // +++ ADD TRANSLATE MODULE
    templateUrl: './generate-workout-modal.component.html',
})
export class GenerateWorkoutModalComponent implements OnInit, OnChanges {
    @Input() isOpen: boolean = false;
    @Output() close = new EventEmitter<void>();
    @Output() generate = new EventEmitter<WorkoutGenerationOptions | 'quick'>();

    private exerciseService = inject(ExerciseService);
    private personalGymService = inject(PersonalGymService);

    // --- START: SCROLL LOCK LOGIC ---
    constructor(@Inject(DOCUMENT) private document: Document) {
        effect(() => {
            if (this.isOpen) {
                this.document.body.classList.add('overflow-hidden');
            } else {
                this.document.body.classList.remove('overflow-hidden');
            }
        });
        effect((onCleanup) => {
            onCleanup(() => {
                this.document.body.classList.remove('overflow-hidden');
            });
        });
    }
    // --- END: SCROLL LOCK LOGIC ---

    allMuscleGroups = signal<string[]>([]);
    allAvailableEquipment = signal<string[]>([]);
    allPersonalGymEquipment = signal<string[]>([]);
    equipmentSearchTerm = signal<string>('');
    excludeEquipmentSearchTerm = signal<string>('');

    filteredAvailableEquipment = computed(() => {
        const term = this.equipmentSearchTerm().toLowerCase().trim();
        if (!term) {
            return [];
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

        this.updateEquipmentFromPersonalGym();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['isOpen'] && changes['isOpen'].currentValue === true) {
            this.resetOptions();
            this.updateEquipmentFromPersonalGym();
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
    }

    generateDetailed() {
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

    selectEquipment(equipment: string) {
        if (!this.options.equipment.includes(equipment)) {
            this.options.equipment.push(equipment);
        }
        this.equipmentSearchTerm.set('');
    }

    removeEquipment(equipment: string) {
        const index = this.options.equipment.indexOf(equipment);
        if (index > -1) {
            this.options.equipment.splice(index, 1);
        }
    }

    toggleExcludePersonalGymEquipment(equipment: string) {
        const index = this.options.excludeEquipment.indexOf(equipment.toLowerCase());
        if (index > -1) {
            this.options.excludeEquipment.splice(index, 1);
        } else {
            this.options.excludeEquipment.push(equipment.toLowerCase());
        }
        this.updateEquipmentFromPersonalGym();
    }

    filteredAvailableEquipmentToExclude = computed(() => {
        const term = this.excludeEquipmentSearchTerm().toLowerCase().trim();
        if (!term) {
            return [];
        }
        const allEq = this.allAvailableEquipment();
        const personalGymEq = this.allPersonalGymEquipment();

        const sourceList = this.options.usePersonalGym ? personalGymEq : allEq;

        return sourceList.filter(eq =>
            eq.toLowerCase().includes(term) && !this.options.excludeEquipment.includes(eq.toLowerCase())
        );
    });

    addExcludedEquipment(equipment: string) {
        const lowerCaseEquipment = equipment.toLowerCase();
        if (!this.options.excludeEquipment.includes(lowerCaseEquipment)) {
            this.options.excludeEquipment.push(lowerCaseEquipment);
        }
        this.excludeEquipmentSearchTerm.set('');
    }

    removeExcludedEquipment(equipment: string) {
        const index = this.options.excludeEquipment.indexOf(equipment);
        if (index > -1) {
            this.options.excludeEquipment.splice(index, 1);
        }
    }

    public fabActions: FabAction[] = [
        {
            actionKey: 'generate_detailed',
            label: 'generateWorkoutModal.fab.detailed', // <-- MODIFIED FOR TRANSLATION
            iconName: 'magic-wand',
            cssClass: 'bg-primary'
        },
        {
            actionKey: 'generate_quick',
            label: 'generateWorkoutModal.fab.quick', // <-- MODIFIED FOR TRANSLATION
            iconName: 'random',
            cssClass: 'bg-green-500'
        }
    ];

    public handleFabAction(actionKey: string): void {
        if (actionKey === 'generate_quick') {
            this.generateQuick();
        } else if (actionKey === 'generate_detailed') {
            this.generateDetailed();
        }
    }

    onUsePersonalGymChange() {
        this.options.excludeEquipment = [];
        this.equipmentSearchTerm.set('');
        this.updateEquipmentFromPersonalGym();
    }

    private updateEquipmentFromPersonalGym(): void {
        if (this.options.usePersonalGym) {
            const personalEquipment = this.allPersonalGymEquipment();
            const excludedEquipment = this.options.excludeEquipment;
            this.options.equipment = personalEquipment.filter(
                eq => !excludedEquipment.includes(eq.toLowerCase())
            );
        } else {
            this.options.equipment = [];
        }
    }
}