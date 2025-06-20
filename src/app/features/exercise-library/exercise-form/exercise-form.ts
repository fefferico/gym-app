import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { switchMap, take } from 'rxjs/operators';
import { of } from 'rxjs';
import { ExerciseService } from '../../../core/services/exercise.service';
import { AlertService } from '../../../core/services/alert.service';
import { Exercise, ExerciseCategory } from '../../../core/models/exercise.model';

@Component({
  selector: 'app-exercise-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TitleCasePipe],
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

  // Populate these from constants or a service if they become dynamic
  categories: ExerciseCategory[] = ['barbells', 'dumbbells', 'bodyweight/calisthenics', 'machines', 'cables', 'kettlebells', 'bands', 'other'];
  // Example muscle groups - ideally, make this more dynamic or a multi-select component
  availableMuscleGroups: string[] = [ /* ... populate this array ... */ 'Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Abs', 'Calves', 'Forearms', 'Glutes', 'Hamstrings', 'Lats', 'Quads', 'Traps'];


  constructor() {
    this.exerciseForm = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      category: ['bodyweight/calisthenics' as ExerciseCategory, Validators.required],
      primaryMuscleGroup: ['', Validators.required],
      muscleGroups: this.fb.array([]), // For simplicity, start with primary; multi-select is more UI work
      equipmentNeeded: this.fb.array([]),
      imageUrls: this.fb.array([]), // Manage as simple string inputs for now
      videoUrl: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
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
  }

  patchFormForEditing(exercise: Exercise): void {
    this.exerciseForm.patchValue({
      name: exercise.name,
      description: exercise.description,
      category: exercise.category,
      primaryMuscleGroup: exercise.primaryMuscleGroup,
      videoUrl: exercise.videoUrl || '',
      notes: exercise.notes || ''
    });
    // For FormArrays (muscleGroups, equipmentNeeded, imageUrls), you'd clear and push controls
    this.setFormArrayControls('muscleGroups', exercise.muscleGroups);
    this.setFormArrayControls('equipmentNeeded', exercise.equipmentNeeded || []);
    this.setFormArrayControls('imageUrls', exercise.imageUrls);
  }

  // Helper for FormArrays
  getFormArray(name: 'muscleGroups' | 'equipmentNeeded' | 'imageUrls'): FormArray {
    return this.exerciseForm.get(name) as FormArray;
  }

  private setFormArrayControls(arrayName: 'muscleGroups' | 'equipmentNeeded' | 'imageUrls', values: string[]): void {
    const formArray = this.getFormArray(arrayName);
    formArray.clear();
    values.forEach(value => formArray.push(this.fb.control(value, Validators.required)));
  }

  addControlToFormArray(arrayName: 'muscleGroups' | 'equipmentNeeded' | 'imageUrls'): void {
    this.getFormArray(arrayName).push(this.fb.control('', Validators.required));
  }

  removeControlFromFormArray(arrayName: 'muscleGroups' | 'equipmentNeeded' | 'imageUrls', index: number): void {
    this.getFormArray(arrayName).removeAt(index);
  }


  async onSubmit(): Promise<void> {
    if (this.exerciseForm.invalid) {
      this.exerciseForm.markAllAsTouched();
      this.alertService.showAlert('Error', 'Please fill in all required fields.');
      return;
    }

    const formValue = this.exerciseForm.value;
    const exerciseData = { // Construct the Exercise object
      ...formValue,
      // Ensure arrays are correctly formatted if necessary
    };

    try {
      if (this.isEditMode() && this.editingExerciseId) {
        await this.exerciseService.updateExercise({ id: this.editingExerciseId, ...exerciseData }).toPromise();
        this.alertService.showAlert('Success', 'Exercise updated successfully!');
        this.router.navigate(['/library', this.editingExerciseId]);
      } else {
        const newExercise = await this.exerciseService.addExercise(exerciseData).toPromise();
        // Add a check or use non-null assertion if you are sure newExercise is always defined
        if (newExercise) {
          this.alertService.showAlert('Success', 'Exercise added successfully!');
          this.router.navigate(['/library', newExercise.id]);
        } else {
          // This case should ideally not happen based on your current service impl.
          console.error('Failed to add exercise, newExercise is undefined.');
          this.alertService.showAlert('Error', 'Failed to add exercise. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error saving exercise:', error);
      this.alertService.showAlert('Error', `Failed to save exercise: ${(error as Error).message}`);
    }
  }

  get f() { return this.exerciseForm.controls; }
}