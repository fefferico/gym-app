import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule, TitleCasePipe, NgClass } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormControl } from '@angular/forms';
import { switchMap, take, startWith, debounceTime, map } from 'rxjs/operators';
import { firstValueFrom, of } from 'rxjs';
import { ExerciseService } from '../../../core/services/exercise.service';
import { AlertService } from '../../../core/services/alert.service';
import { Exercise, ExerciseCategory } from '../../../core/models/exercise.model';
import { Muscle } from '../../../core/models/muscle.model';
import { MUSCLES_DATA } from '../../../core/services/muscles-data';
import { Equipment } from '../../../core/models/equipment.model';
import { EQUIPMENT_DATA } from '../../../core/services/equipment-data';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { MuscleMapService } from '../../../core/services/muscle-map.service';
import { EquipmentService } from '../../../core/services/equipment.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-exercise-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TitleCasePipe, NgClass, IconComponent, TranslateModule],
  templateUrl: './exercise-form.html',
  styleUrls: ['./exercise-form.scss']
})
export class ExerciseFormComponent implements OnInit {
  // --- Service Injections ---
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private exerciseService = inject(ExerciseService);
  private alertService = inject(AlertService);
  private muscleMapService = inject(MuscleMapService);
  private equipmentService = inject(EquipmentService);
  private translate = inject(TranslateService);

  // --- Component State Signals ---
  exerciseForm!: FormGroup;
  isEditMode = signal(false);
  editingExerciseId: string | null = null;
  pageTitle = signal('');

  // --- Data & Autocomplete Signals ---
  allMuscles = toSignal(this.muscleMapService.translatedMuscles$, { initialValue: [] });
  allEquipment = signal<Equipment[]>([]);
  
  muscleSearchCtrl = new FormControl('');
  equipmentSearchCtrl = new FormControl('');

  filteredMuscles = signal<Muscle[]>([]);
  highlightedMuscleIndex = signal(-1);
  filteredEquipment = signal<Equipment[]>([]);
  highlightedEquipmentIndex = signal(-1);
  
  // --- Data Maps for Efficient Lookups ---
  private muscleMap = new Map<string, string>(); // <id, translatedName>
  private equipmentMap = new Map<string, string>(); // <id, translatedName>

  categories: ExerciseCategory[] = ['barbells', 'dumbbells', 'bodyweight/calisthenics', 'machines', 'cables', 'kettlebells', 'bands', 'other', 'stretching', 'cardio'];

constructor() {
    this.exerciseForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      category: ['bodyweight/calisthenics' as ExerciseCategory, Validators.required],
      primaryMuscleGroup: ['', Validators.required], // Will store muscle ID
      muscleGroups: this.fb.array([]), // Will store muscle IDs
      equipmentNeeded: this.fb.array([]), // Will store equipment IDs
      videoUrl: [''],
      notes: ['']
    });

    effect(() => {
      const muscles = this.allMuscles();
      this.muscleNameMap = new Map(muscles.map(m => [m.id, m.name]));
      
      const equipment = this.allEquipment();
      this.equipmentNameMap = new Map(equipment.map(e => [e.id, e.name]));
    });
  }

  async ngOnInit(): Promise<void> {
    // --- Handle Edit vs. Create Mode ---
    this.route.paramMap.pipe(
      switchMap(params => {
        this.editingExerciseId = params.get('id');
        if (this.editingExerciseId) {
          this.isEditMode.set(true);
          this.pageTitle.set(this.translate.instant('exerciseForm.editTitle'));
          return this.exerciseService.getExerciseById(this.editingExerciseId); // Fetch raw exercise
        }
        this.pageTitle.set(this.translate.instant('exerciseForm.addTitle'));
        return of(null);
      }),
      take(1)
    ).subscribe(exercise => {
      if (exercise && this.isEditMode()) {
        this.patchFormForEditing(exercise);
      }
    });
    this.muscleSearchCtrl.valueChanges.subscribe(value => this.filterMuscles(value || ''));
    this.equipmentSearchCtrl.valueChanges.subscribe(value => this.filterEquipment(value || ''));
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

  hideEquipmentSuggestions(): void {
    setTimeout(() => this.filteredEquipment.set([]), 150);
  }

  // --- General Form Methods ---
  patchFormForEditing(exercise: Exercise): void {
    this.exerciseForm.patchValue({
      name: exercise.name,
      description: exercise.description,
      category: exercise.category,
      primaryMuscleGroup: exercise.primaryMuscleGroup, // Patch with ID
      videoUrl: exercise.videoUrl || '',
      notes: exercise.notes || ''
    });
    this.setFormArrayControls('muscleGroups', exercise.muscleGroups); // Patch with IDs
    this.setFormArrayControls('equipmentNeeded', exercise.equipmentNeeded || []); // Patch with IDs
  }

  async onSubmit(): Promise<void> {
    if (this.exerciseForm.invalid) {
      this.exerciseForm.markAllAsTouched();
      return;
    }
    const formValue = this.exerciseForm.value;

    try {
      if (this.isEditMode() && this.editingExerciseId) {
        await firstValueFrom(this.exerciseService.updateExercise({ id: this.editingExerciseId, ...formValue }));
        this.router.navigate(['/library', this.editingExerciseId]);
      } else {
        const newExercise = await firstValueFrom(this.exerciseService.addExercise(formValue));
        if (newExercise) {
          this.router.navigate(['/library', newExercise.id]);
        }
      }
    } catch (error) {
      console.error('Error saving exercise:', error);
    }
  }


private muscleNameMap = new Map<string, string>(); // <id, translatedName>
  private equipmentNameMap = new Map<string, string>(); // <id, translatedName>
  // --- FormArray Helpers ---
  getFormArray(name: 'muscleGroups' | 'equipmentNeeded'): FormArray {
    return this.exerciseForm.get(name) as FormArray;
  }

  private setFormArrayControls(arrayName: 'muscleGroups' | 'equipmentNeeded', ids: string[]): void {
    const formArray = this.getFormArray(arrayName);
    formArray.clear();
    ids.forEach(id => formArray.push(this.fb.control(id, Validators.required)));
  }

  getMuscleNameById = (id: string): string => this.muscleNameMap.get(id) || id;
  getEquipmentNameById = (id: string): string => this.equipmentNameMap.get(id) || id;

  // --- START: CORRECTED FILTER METHODS ---
  private filterMuscles(query: string): void {
    if (!query) {
        this.filteredMuscles.set([]);
        return;
    }
    const lowerCaseQuery = query.toLowerCase().trim();
    const currentMuscleIds = this.getFormArray('muscleGroups').value as string[];
    const filtered = this.allMuscles().filter(muscle => {
        const nameMatches = muscle.name.toLowerCase().includes(lowerCaseQuery);
        const idMatches = muscle.id.toLowerCase().includes(lowerCaseQuery);
        const isAlreadySelected = currentMuscleIds.includes(muscle.id);
        return (nameMatches || idMatches) && !isAlreadySelected;
    });
    this.filteredMuscles.set(filtered);
    this.highlightedMuscleIndex.set(-1);
  }

  private filterEquipment(query: string): void {
    if (!query) {
        this.filteredEquipment.set([]);
        return;
    }
    const lowerCaseQuery = query.toLowerCase().trim();
    const currentEquipmentIds = this.getFormArray('equipmentNeeded').value as string[];
    const filtered = this.allEquipment().filter(equipment => {
        const nameMatches = equipment.name.toLowerCase().includes(lowerCaseQuery);
        const idMatches = equipment.id.toLowerCase().includes(lowerCaseQuery);
        const isAlreadySelected = currentEquipmentIds.includes(equipment.id);
        return (nameMatches || idMatches) && !isAlreadySelected;
    });
    this.filteredEquipment.set(filtered);
    this.highlightedEquipmentIndex.set(-1);
  }

  selectMuscle(muscle: Muscle): void {
    this.getFormArray('muscleGroups').push(this.fb.control(muscle.id));
    this.muscleSearchCtrl.setValue('');
  }
  
  removeMuscle(index: number): void {
    this.getFormArray('muscleGroups').removeAt(index);
  }

  selectEquipment(equipment: Equipment): void {
    this.getFormArray('equipmentNeeded').push(this.fb.control(equipment.id));
    this.equipmentSearchCtrl.setValue('');
  }

  removeEquipment(index: number): void {
    this.getFormArray('equipmentNeeded').removeAt(index);
  }

  hideSuggestions(): void {
    setTimeout(() => {
      this.filteredMuscles.set([]);
      this.filteredEquipment.set([]);
    }, 150);
  }
}