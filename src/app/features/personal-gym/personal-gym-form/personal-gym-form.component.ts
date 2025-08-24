// src/app/features/personal-gym/personal-gym-form/personal-gym-form.component.ts
import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap, take } from 'rxjs/operators';
import { of, Subscription } from 'rxjs';

import { PersonalGymService } from '../../../core/services/personal-gym.service';
import { ToastService } from '../../../core/services/toast.service';
import { 
  EquipmentCategory, 
  WeightType, 
  BandType, 
  MachineLoadType, 
  PersonalGymEquipment 
} from '../../../core/models/personal-gym.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PressDirective } from '../../../shared/directives/press.directive';

@Component({
  selector: 'app-personal-gym-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, PressDirective, RouterLink],
  templateUrl: './personal-gym-form.component.html',
})
export class PersonalGymFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private personalGymService = inject(PersonalGymService);
  private toastService = inject(ToastService);

  equipmentForm!: FormGroup;
  isEditMode = signal(false);
  editingEquipmentId: string | null = null;
  
  pageTitle = computed(() => this.isEditMode() ? 'Edit Equipment' : 'Add New Equipment');

  private subscriptions = new Subscription();

  readonly categories: EquipmentCategory[] = [
    'Dumbbell', 'Kettlebell', 'Plate', 'Barbell', 'Band', 'Machine', 
    'Accessory', 'Bag', 'Macebell', 'Club', 'Cardio', 'Custom'
  ];
  readonly weightTypes: WeightType[] = ['fixed', 'adjustable'];
  readonly bandTypes: BandType[] = ['loop', 'mini-loop', 'handled', 'therapy'];
  readonly machineLoadTypes: MachineLoadType[] = ['stack', 'plate-loaded', 'bodyweight'];
  readonly barTypes = ['olympic', 'standard', 'ez-curl', 'hex', 'swiss', 'custom'];
  readonly resistanceLevels = ['extra-light', 'light', 'medium', 'heavy', 'extra-heavy'];

  constructor() {
    this.equipmentForm = this.fb.group({
      name: ['', Validators.required],
      category: [null as EquipmentCategory | null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      brand: [''],
      notes: [''],
    });
  }

  ngOnInit(): void {
    const routeSub = this.route.paramMap.pipe(
      switchMap(params => {
        this.editingEquipmentId = params.get('id');
        if (this.editingEquipmentId) {
          this.isEditMode.set(true);
          return this.personalGymService.getEquipmentById(this.editingEquipmentId);
        }
        return of(null);
      }),
      take(1)
    ).subscribe(equipment => {
      if (equipment) {
        this.patchFormForEditing(equipment);
      }
    });
    this.subscriptions.add(routeSub);

    const categorySub = this.equipmentForm.get('category')?.valueChanges.subscribe(category => {
      this.updateFormForCategory(category);
    });
    this.subscriptions.add(categorySub!);

    // ** THE FIX for dangling subscriptions **: 
    // We only need one subscription that listens to weightType changes.
    // However, the weightType control itself is dynamic. We must handle this carefully.
    // Instead of subscribing here, the logic to add/remove controls will be handled synchronously.
    // The previous implementation was buggy. Let's simplify.
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private updateFormForCategory(category: EquipmentCategory | null): void {
    const dynamicControls = [
      'weightType', 'weightKg', 'minWeightKg', 'maxWeightKg', 'incrementKg',
      'barType', 'bandType', 'resistanceLevel', 'resistanceKg', 'color', 'lengthCm',
      'loadType', 'maxLoadKg', 'customCategoryName', 'properties'
    ];
    dynamicControls.forEach(ctrl => this.removeControl(ctrl));
    
    switch (category) {
      case 'Dumbbell':
      case 'Kettlebell':
      case 'Macebell':
      case 'Club':
        this.addControl('weightType', 'fixed', Validators.required);
        // This is the key change to prevent dangling subscriptions.
        // We now listen for changes on a control that we know exists.
        if (!this.subscriptions.closed) { // Ensure we don't re-subscribe on destroy
            const weightTypeSub = this.equipmentForm.get('weightType')?.valueChanges.subscribe(wt => {
                this.updateFormForWeightType(wt);
            });
            if(weightTypeSub) this.subscriptions.add(weightTypeSub);
        }
        this.updateFormForWeightType('fixed'); // Initialize with fixed fields
        break;
      case 'Plate':
      case 'Barbell':
        this.addControl('weightKg', null, [Validators.required, Validators.min(0)]);
        if (category === 'Barbell') {
          this.addControl('barType', 'olympic');
        }
        break;
      case 'Band':
        this.addControl('bandType', 'loop', Validators.required);
        this.addControl('resistanceLevel', 'medium');
        this.addControl('resistanceKg', null, [Validators.min(0)]);
        this.addControl('color', '');
        this.addControl('lengthCm', null, [Validators.min(0)]);
        break;
      case 'Machine':
        this.addControl('loadType', 'stack', Validators.required);
        this.addControl('maxLoadKg', null, Validators.min(0));
        break;
      case 'Custom':
        this.addControl('customCategoryName', '', Validators.required);
        this.addControl('properties', this.fb.array([]));
        break;
    }
  }
  
  private updateFormForWeightType(weightType: WeightType | null): void {
    this.removeControl('weightKg');
    this.removeControl('minWeightKg');
    this.removeControl('maxWeightKg');
    this.removeControl('incrementKg');

    if (weightType === 'fixed') {
      this.addControl('weightKg', null, [Validators.required, Validators.min(0)]);
    } else if (weightType === 'adjustable') {
      this.addControl('minWeightKg', null, [Validators.required, Validators.min(0)]);
      this.addControl('maxWeightKg', null, [Validators.required, Validators.min(0)]);
      this.addControl('incrementKg', null, [Validators.required, Validators.min(0.1)]);
    }
  }
  
  private patchFormForEditing(equipment: PersonalGymEquipment): void {
    // ** THE FIX for the race condition **:
    // 1. Synchronously build the form's structure based on the category.
    this.updateFormForCategory(equipment.category);
    
    // 2. NOW that all controls exist, patch their values.
    this.equipmentForm.patchValue(equipment);

    if (equipment.category === 'Custom') {
      const propertiesArray = this.equipmentForm.get('properties') as FormArray;
      propertiesArray.clear();
      equipment.properties.forEach(prop => {
        propertiesArray.push(this.fb.group({
          key: [prop.key, Validators.required],
          value: [prop.value, Validators.required]
        }));
      });
    }
  }

  private addControl(name: string, value: any, validators?: any): void {
    this.equipmentForm.addControl(name, this.fb.control(value, validators));
  }

  private removeControl(name: string): void {
    if (this.equipmentForm.get(name)) {
      this.equipmentForm.removeControl(name);
    }
  }

  get customProperties(): FormArray {
    return this.equipmentForm.get('properties') as FormArray;
  }

  addCustomProperty(): void {
    this.customProperties.push(this.fb.group({
      key: ['', Validators.required],
      value: ['', Validators.required]
    }));
  }

  removeCustomProperty(index: number): void {
    this.customProperties.removeAt(index);
  }

  onSubmit(): void {
    if (this.equipmentForm.invalid) {
      this.toastService.error('Please fill out all required fields.', 0, 'Invalid Form');
      this.equipmentForm.markAllAsTouched();
      return;
    }

    const formValue = this.equipmentForm.getRawValue();

    if (this.isEditMode() && this.editingEquipmentId) {
      const updatedEquipment: PersonalGymEquipment = {
        ...formValue,
        id: this.editingEquipmentId,
      };
      this.personalGymService.updateEquipment(updatedEquipment);
    } else {
      this.personalGymService.addEquipment(formValue as Omit<PersonalGymEquipment, 'id'>);
    }

    this.router.navigate(['/personal-gym']);
  }
}