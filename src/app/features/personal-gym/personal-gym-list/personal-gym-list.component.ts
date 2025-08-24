// src/app/features/personal-gym/personal-gym-list/personal-gym-list.component.ts
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PersonalGymService } from '../../../core/services/personal-gym.service';

import {
  PersonalGymEquipment,
  EquipmentCategory,
  FixedWeightEquipment,
  AdjustableWeightEquipment,
  WeightPlate,
  ResistanceBand,
  CustomEquipment
} from '../../../core/models/personal-gym.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-personal-gym-list',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './personal-gym-list.component.html',
})
export class PersonalGymListComponent implements OnInit {
  private router = inject(Router);
  private personalGymService = inject(PersonalGymService);

  allEquipment = signal<PersonalGymEquipment[]>([]);
  
  searchTerm = signal<string>('');
  selectedCategory = signal<EquipmentCategory | null>(null);
  
  readonly categories: EquipmentCategory[] = [
    'Dumbbell', 'Kettlebell', 'Plate', 'Barbell', 'Band', 'Machine', 
    'Accessory', 'Bag', 'Macebell', 'Club', 'Cardio', 'Custom'
  ];

  filteredEquipment = computed(() => {
    let equipment = this.allEquipment();
    const term = this.searchTerm().toLowerCase();
    const category = this.selectedCategory();

    if (category) {
      equipment = equipment.filter(item => item.category === category);
    }
    if (term) {
      equipment = equipment.filter(item => 
        item.name.toLowerCase().includes(term) || 
        (item.brand && item.brand.toLowerCase().includes(term))
      );
    }
    return equipment;
  });

  ngOnInit(): void {
    this.personalGymService.getAllEquipment().subscribe(equipment => {
      this.allEquipment.set(equipment);
    });
  }

  onSearchChange(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  onCategoryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedCategory.set(value as EquipmentCategory | null);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedCategory.set(null);
    const searchInput = document.getElementById('search-term') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
    const categorySelect = document.getElementById('category-filter') as HTMLSelectElement;
    if (categorySelect) categorySelect.value = '';
  }

  trackById(index: number, item: PersonalGymEquipment): string {
    return item.id;
  }

  navigateToForm(id?: string): void {
    const route = id ? ['/personal-gym/edit', id] : ['/personal-gym/new'];
    this.router.navigate(route);
  }

  async deleteEquipment(id: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    await this.personalGymService.deleteEquipment(id);
  }

  // ==========================================================
  // START: TYPE GUARD HELPER FUNCTIONS
  // These functions will fix the template errors definitively.
  // ==========================================================
  
  isFixedWeight(item: PersonalGymEquipment): item is FixedWeightEquipment {
    return 'weightType' in item && item.weightType === 'fixed';
  }

  isAdjustableWeight(item: PersonalGymEquipment): item is AdjustableWeightEquipment {
    return 'weightType' in item && item.weightType === 'adjustable';
  }

  isWeightPlate(item: PersonalGymEquipment): item is WeightPlate {
    return item.category === 'Plate';
  }

  isBand(item: PersonalGymEquipment): item is ResistanceBand {
    return item.category === 'Band';
  }
  
  isCustom(item: PersonalGymEquipment): item is CustomEquipment {
    return item.category === 'Custom';
  }
  // ==========================================================
  // END: TYPE GUARD HELPER FUNCTIONS
  // ==========================================================
}