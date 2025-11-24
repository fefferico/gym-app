// src/app/features/personal-gym/personal-gym-list/personal-gym-list.component.ts
import { Component, OnInit, inject, signal, computed, PLATFORM_ID, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { PersonalGymService } from '../../../core/services/personal-gym.service';

import {
  PersonalGymEquipment,
  FixedWeightEquipment,
  AdjustableWeightEquipment,
  WeightPlate,
  ResistanceBand,
  CustomEquipment
} from '../../../core/models/personal-gym.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { UnitsService } from '../../../core/services/units.service';
import { PremiumFeature, SubscriptionService } from '../../../core/services/subscription.service';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { ActionMenuComponent } from '../../../shared/components/action-menu/action-menu';
import { MenuMode } from '../../../core/models/app-settings.model';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { deleteBtn, editBtn, hideBtn, unhideBtn, viewBtn } from '../../../core/services/buttons-data';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FabAction, FabMenuComponent } from '../../../shared/components/fab-menu/fab-menu.component';
import { EquipmentCategory } from '../../../core/services/equipment-data';

@Component({
  selector: 'app-personal-gym-list',
  standalone: true,
  imports: [CommonModule, IconComponent, ActionMenuComponent, TranslateModule, FabMenuComponent],
  templateUrl: './personal-gym-list.component.html',
  animations: [
    trigger('fabSlideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(200%)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(100%)' }))
      ])
    ]),
    trigger('slideInOutActions', [
      state('void', style({
        height: '0px',
        opacity: 0,
        overflow: 'hidden',
        paddingTop: '0',
        paddingBottom: '0',
        marginTop: '0',
        marginBottom: '0'
      })),
      state('*', style({
        height: '*',
        opacity: 1,
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem'
      })),
      transition('void <=> *', animate('200ms ease-in-out'))
    ]),
    trigger('dropdownMenu', [
      state('void', style({
        opacity: 0,
        transform: 'scale(0.75) translateY(-10px)',
        transformOrigin: 'top right'
      })),
      state('*', style({
        opacity: 1,
        transform: 'scale(1) translateY(0)',
        transformOrigin: 'top right'
      })),
      transition('void => *', [
        animate('150ms cubic-bezier(0.25, 0.8, 0.25, 1)')
      ]),
      transition('* => void', [
        animate('100ms cubic-bezier(0.25, 0.8, 0.25, 1)')
      ])
    ])
  ]
})
export class PersonalGymListComponent implements OnInit {
  private router = inject(Router);
  private personalGymService = inject(PersonalGymService);
  unitService = inject(UnitsService);
  protected subscriptionService = inject(SubscriptionService);
  private platformId = inject(PLATFORM_ID);
  private appSettingsService = inject(AppSettingsService);
  allEquipment = signal<PersonalGymEquipment[]>([]);
  private translate = inject(TranslateService);

  menuModeDropdown: boolean = false;
  menuModeCompact: boolean = false;
  menuModeModal: boolean = false;


  searchTerm = signal<string>('');
  selectedCategory = signal<EquipmentCategory | null>(null);

  readonly categories: EquipmentCategory[] = Object.values(EquipmentCategory);

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
    if (!this.subscriptionService.canAccess(PremiumFeature.PERSONAL_GYM)) {
      this.subscriptionService.showUpgradeModal().then(() => {
        this.router.navigate(['profile']);
      });
    }
    this.menuModeDropdown = this.appSettingsService.isMenuModeDropdown();
    this.menuModeCompact = this.appSettingsService.isMenuModeCompact();
    this.menuModeModal = this.appSettingsService.isMenuModeModal();
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

  async deleteEquipment(id: string, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();
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
    return item.category === EquipmentCategory.plate;
  }

  isBand(item: PersonalGymEquipment): item is ResistanceBand {
    return item.category === EquipmentCategory.band;
  }

  isCustom(item: PersonalGymEquipment): item is CustomEquipment {
    return item.category === EquipmentCategory.custom;
  }
  // ==========================================================
  // END: TYPE GUARD HELPER FUNCTIONS
  // ==========================================================


  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  activeEquipmentIdActions = signal<string | null>(null);
  toggleActions(equipmentId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeEquipmentIdActions.update(current => (current === equipmentId ? null : equipmentId));
  }

  areActionsVisible(equipmentId: string): boolean {
    return this.activeEquipmentIdActions() === equipmentId;
  }

  onCloseActionMenu() {
    this.activeEquipmentIdActions.set(null);
  }

  getGymActionItems(equipmentId: string, mode: MenuMode): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';

    // --- NEW: Find the current exercise to check its status ---
    const currentExercise = this.allEquipment().find(eq => eq.id === equipmentId);
    // --------------------------------------------------------

    const actionsArray: ActionMenuItem[] = [
      {
        ...viewBtn,
        data: { equipmentId: equipmentId }
      },
      {
        ...editBtn,
        data: { equipmentId: equipmentId }
      }
    ];

    // --- NEW: Conditionally add Hide/Unhide button ---
    if (currentExercise?.isHidden) {
      actionsArray.push({
        ...unhideBtn,
        data: { equipmentId: equipmentId }
      });
    } else {
      actionsArray.push({
        ...hideBtn,
        data: { equipmentId: equipmentId }
      });
    }
    // ---------------------------------------------

    // Add Delete button at the end
    actionsArray.push({
      ...deleteBtn,
      data: { equipmentId: equipmentId }
    });

    return actionsArray;
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }, originalMouseEvent?: MouseEvent): void {
    const equipmentId = event.data?.equipmentId;
    if (!equipmentId) return;

    switch (event.actionKey) {
      case 'view':
        this.navigateToForm(equipmentId);
        break;
      case 'edit':
        this.navigateToForm(equipmentId);
        break;
      case 'delete':
        this.deleteEquipment(equipmentId);
        break;
      // --- NEW: Handle hide/unhide actions ---
      case 'hide':
        this.hideEquipment(equipmentId);
        break;
      case 'unhide':
        this.unhideEquipment(equipmentId);
        break;
      // -------------------------------------
    }
    this.activeEquipmentIdActions.set(null); // Close the menu
  }

  hideEquipment(equipmentId: string): void {
    this.personalGymService.hideEquipment(equipmentId).subscribe();
    this.activeEquipmentIdActions.set(null);
  }

  unhideEquipment(equipmentId: string): void {
    this.personalGymService.unhideEquipment(equipmentId).subscribe();
    this.activeEquipmentIdActions.set(null);
  }

  fabMenuItems: FabAction[] = [
    {
      actionKey: 'add_equipment',
      label: 'personalGym.list.createEquipment', // Using translation key
      iconName: 'plus-circle', // A suitable icon for adding
      cssClass: 'bg-primary'
    }
  ];

  /**
   * Handles the action emitted from the reusable FAB menu component.
   * @param actionKey The unique key of the clicked action.
   */
  onFabAction(actionKey: string): void {
    if (actionKey === 'add_equipment') {
      this.navigateToForm();
    }
  }

    filtersVisible = signal(false);
toggleFiltersVisibility(): void {
    this.filtersVisible.update(visible => !visible);
  }

}