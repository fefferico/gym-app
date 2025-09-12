// src/app/features/workout-routines/routine-list/generate-workout-modal/generate-workout-modal.component.ts
import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { Routine } from '../../../core/models/workout.model';
import { WorkoutGenerationOptions, WorkoutGeneratorService } from '../../../core/services/workout-generator.service';
import { ExerciseService } from '../../../core/services/exercise.service';

@Component({
  selector: 'app-generate-workout-modal',
  standalone: true,
  imports: [CommonModule, IconComponent, FormsModule, TitleCasePipe],
  templateUrl: './generate-workout-modal.component.html',
})
export class GenerateWorkoutModalComponent implements OnInit {
    @Input() isOpen: boolean = false;
    @Output() close = new EventEmitter<void>();
    @Output() generated = new EventEmitter<Routine>();

    private generatorService = inject(WorkoutGeneratorService);
    private exerciseService = inject(ExerciseService);

    allMuscleGroups = signal<string[]>([]);
    
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
    
    async generateQuick() {
        const routine = await this.generatorService.generateQuickWorkout();
        // --- START MODIFICATION ---
        if (routine && routine.exercises.length > 0) {
            this.generated.emit(routine);
            this.close.emit();
        } else {
             // Let the parent component handle the toast message
            this.generated.emit(undefined);
        }
        // --- END MODIFICATION ---
    }

    async generateDetailed() {
        const routine = await this.generatorService.generateWorkout(this.options);
        // --- START MODIFICATION ---
        if (routine && routine.exercises.length > 0) {
            this.generated.emit(routine);
            this.close.emit();
        } else {
            // Let the parent component handle the toast message
            this.generated.emit(undefined);
        }
        // --- END MODIFICATION ---
    }
}