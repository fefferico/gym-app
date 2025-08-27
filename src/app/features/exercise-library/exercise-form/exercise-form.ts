import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, TitleCasePipe, NgClass } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormControl } from '@angular/forms';
import { switchMap, take, startWith, debounceTime, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { ExerciseService } from '../../../core/services/exercise.service';
import { AlertService } from '../../../core/services/alert.service';
import { Exercise, ExerciseCategory } from '../../../core/models/exercise.model';
import { Muscle } from '../../../core/models/muscle.model';
import { MUSCLES_DATA } from '../../../core/services/muscles-data';
import { Equipment } from '../../../core/models/equipment.model';
import { EQUIPMENT_DATA } from '../../../core/services/equipment-data';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-exercise-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TitleCasePipe, NgClass, IconComponent],
  templateUrl: './exercise-form.html',
  styleUrls: ['./exercise-form.scss']
})
export class ExerciseFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private exerciseService = inject(ExerciseService);
  private alertService = inject(AlertService);

  exerciseForm!: FormGroup;
  isEditMode = signal(false);
  editingExerciseId: string | null = null;
  pageTitle = signal('Add New Exercise');

  // --- Muscle Autocomplete ---
  muscleSearchCtrl = new FormControl('');
  allMuscles: Muscle[] = MUSCLES_DATA;
  filteredMuscles = signal<Muscle[]>([]);
  highlightedMuscleIndex = signal(-1);

  // --- Equipment Autocomplete ---
  equipmentSearchCtrl = new FormControl('');
  allEquipment: Equipment[] = EQUIPMENT_DATA;
  filteredEquipment = signal<Equipment[]>([]);
  highlightedEquipmentIndex = signal(-1);

  categories: ExerciseCategory[] = ['barbells', 'dumbbells', 'bodyweight/calisthenics', 'machines', 'cables', 'kettlebells', 'bands', 'other', 'stretching', 'cardio'];
  availableMuscleGroups = computed(() => {
    return this.allMuscles
      .map(m => m.name)
      .filter(name => !name.includes('(') && !name.includes('&'))
      .sort((a, b) => a.localeCompare(b));
  });

  constructor() {
    this.exerciseForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      category: ['bodyweight/calisthenics' as ExerciseCategory, Validators.required],
      primaryMuscleGroup: ['', Validators.required],
      muscleGroups: this.fb.array([]),
      equipmentNeeded: this.fb.array([]),
      imageUrls: this.fb.array([]),
      videoUrl: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    // Existing logic for edit mode
    this.route.paramMap.pipe(
      switchMap(params => {
        this.editingExerciseId = params.get('id');
        if (this.editingExerciseId) {
          this.isEditMode.set(true);
          this.pageTitle.set('Edit Exercise');
          return this.exerciseService.getExerciseById(this.editingExerciseId);
        }
        return of(null);
      }),
      take(1)
    ).subscribe(exercise => {
      if (exercise && this.isEditMode()) {
        this.patchFormForEditing(exercise);
      }
    });

    // Muscle Autocomplete Logic
    this.muscleSearchCtrl.valueChanges.pipe(
      debounceTime(200),
      map(value => this._filterMuscles(value || ''))
    ).subscribe(muscles => {
      this.filteredMuscles.set(muscles);
      this.highlightedMuscleIndex.set(-1);
    });

    // Equipment Autocomplete Logic
    this.equipmentSearchCtrl.valueChanges.pipe(
      debounceTime(200),
      map(value => this._filterEquipment(value || ''))
    ).subscribe(equipment => {
      this.filteredEquipment.set(equipment);
      this.highlightedEquipmentIndex.set(-1);
    });
  }

  // --- Muscle Methods ---
  onMuscleInputClick(): void {
    if (!this.muscleSearchCtrl.value) {
      const currentMuscles = this.getFormArray('muscleGroups').value;
      this.filteredMuscles.set(this.allMuscles.filter(m => !currentMuscles.includes(m.name)));
    }
  }

  hideMuscleSuggestions(): void {
    setTimeout(() => this.filteredMuscles.set([]), 150);
  }

  onMuscleSearchKeydown(event: KeyboardEvent): void {
    const key = event.key;
    const muscles = this.filteredMuscles();
    if (muscles.length === 0) return;
    if (key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedMuscleIndex.update(i => (i + 1) % muscles.length);
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedMuscleIndex.update(i => (i - 1 + muscles.length) % muscles.length);
    } else if (key === 'Enter') {
      event.preventDefault();
      const index = this.highlightedMuscleIndex();
      if (index > -1) this.selectMuscle(muscles[index]);
    }
  }

  private _filterMuscles(query: string): Muscle[] {
    if (!query) return [];
    const lowerCaseQuery = query.toLowerCase();
    const currentMuscles = this.getFormArray('muscleGroups').value;
    return this.allMuscles.filter(m => m.name.toLowerCase().includes(lowerCaseQuery) && !currentMuscles.includes(m.name));
  }

  selectMuscle(muscle: Muscle): void {
    this.getFormArray('muscleGroups').push(this.fb.control(muscle.name));
    this.muscleSearchCtrl.setValue('');
    this.filteredMuscles.set([]);
  }

  removeMuscle(index: number): void {
    this.getFormArray('muscleGroups').removeAt(index);
  }

  // --- Equipment Methods ---
  onEquipmentInputClick(): void {
    if (!this.equipmentSearchCtrl.value) {
      const currentEquipment = this.getFormArray('equipmentNeeded').value;
      this.filteredEquipment.set(this.allEquipment.filter(e => !currentEquipment.includes(e.name)));
    }
  }

  hideEquipmentSuggestions(): void {
    setTimeout(() => this.filteredEquipment.set([]), 150);
  }

  onEquipmentSearchKeydown(event: KeyboardEvent): void {
    const key = event.key;
    const equipmentList = this.filteredEquipment();
    const inputValue = this.equipmentSearchCtrl.value?.trim();

    if (key === 'Enter') {
        event.preventDefault();
        const index = this.highlightedEquipmentIndex();
        if (index > -1) {
            this.selectEquipment(equipmentList[index].name);
        } else if (inputValue) {
            this.selectEquipment(inputValue); // Add custom equipment
        }
    } else if (equipmentList.length > 0) {
        if (key === 'ArrowDown') {
            event.preventDefault();
            this.highlightedEquipmentIndex.update(i => (i + 1) % equipmentList.length);
        } else if (key === 'ArrowUp') {
            event.preventDefault();
            this.highlightedEquipmentIndex.update(i => (i - 1 + equipmentList.length) % equipmentList.length);
        }
    }
  }

  private _filterEquipment(query: string): Equipment[] {
    if (!query) return [];
    const lowerCaseQuery = query.toLowerCase();
    const currentEquipment = this.getFormArray('equipmentNeeded').value;
    return this.allEquipment.filter(e => e.name.toLowerCase().includes(lowerCaseQuery) && !currentEquipment.includes(e.name));
  }

  selectEquipment(equipmentName: string): void {
    const currentEquipment = this.getFormArray('equipmentNeeded').value;
    if (!currentEquipment.includes(equipmentName)) {
        this.getFormArray('equipmentNeeded').push(this.fb.control(equipmentName));
    }
    this.equipmentSearchCtrl.setValue('');
    this.filteredEquipment.set([]);
  }

  removeEquipment(index: number): void {
    this.getFormArray('equipmentNeeded').removeAt(index);
  }

  // --- General Form Methods ---
  patchFormForEditing(exercise: Exercise): void {
    this.exerciseForm.patchValue({
      name: exercise.name,
      description: exercise.description,
      category: exercise.category,
      primaryMuscleGroup: exercise.primaryMuscleGroup,
      videoUrl: exercise.videoUrl || '',
      notes: exercise.notes || ''
    });
    this.setFormArrayControls('muscleGroups', exercise.muscleGroups);
    this.setFormArrayControls('equipmentNeeded', exercise.equipmentNeeded || []);
    this.setFormArrayControls('imageUrls', exercise.imageUrls || []);
  }

  getFormArray(name: 'muscleGroups' | 'equipmentNeeded' | 'imageUrls'): FormArray {
    return this.exerciseForm.get(name) as FormArray;
  }

  private setFormArrayControls(arrayName: 'muscleGroups' | 'equipmentNeeded' | 'imageUrls', values: string[]): void {
    const formArray = this.getFormArray(arrayName);
    formArray.clear();
    values.forEach(value => formArray.push(this.fb.control(value, Validators.required)));
  }

  async onSubmit(): Promise<void> {
    // ... existing submit logic
    if (this.exerciseForm.invalid) {
      this.exerciseForm.markAllAsTouched();
      this.alertService.showAlert('Error', 'Please fill in all required fields.');
      return;
    }
    const formValue = this.exerciseForm.value;
    const exerciseData = { ...formValue };

    try {
      if (this.isEditMode() && this.editingExerciseId) {
        await this.exerciseService.updateExercise({ id: this.editingExerciseId, ...exerciseData }).toPromise();
        this.alertService.showAlert('Success', 'Exercise updated successfully!');
        this.router.navigate(['/library', this.editingExerciseId]);
      } else {
        const newExercise = await this.exerciseService.addExercise(exerciseData).toPromise();
        if (newExercise) {
          this.alertService.showAlert('Success', 'Exercise added successfully!');
          this.router.navigate(['/library', newExercise.id]);
        }
      }
    } catch (error) {
      console.error('Error saving exercise:', error);
      this.alertService.showAlert('Error', `Failed to save exercise: ${(error as Error).message}`);
    }
  }
}