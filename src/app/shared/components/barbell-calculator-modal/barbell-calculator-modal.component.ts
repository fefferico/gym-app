import { Component, OnInit, inject, computed, signal, Output, EventEmitter, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Barbell, BarbellCalculatorService, PlateLoadout, Collar, Plate } from '../../../core/services/barbell-calculator.service';
import { PersonalGymService } from '../../../core/services/personal-gym.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../icon/icon.component';


interface GymPlate {
  weight?: number;
  unit?: string;
  isOlympic?: boolean;
  color?: string;
  quantity?: number;
}

interface GymBarbell {
  name: string;
  weight?: number;
  unit?: string;
}

@Component({
  selector: 'app-barbell-calculator-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './barbell-calculator-modal.component.html',
  styleUrls: ['./barbell-calculator-modal.component.scss']
})
export class BarbellCalculatorModalComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  private barbellCalculatorService = inject(BarbellCalculatorService);

  private personalGymService = inject(PersonalGymService);
  private subscriptionService = inject(SubscriptionService);
  private toastService = inject(ToastService);

  // --- State Signals ---
  mode = signal<'calculate' | 'reverse'>('calculate');
  unit = signal<'kg' | 'lb'>('kg');
  isOlympic = signal(true);

  usePersonalGym = signal(false);
  enable50kgPlate = signal(false);
  isPremiumUser = signal(false);

  // --- Data from Service ---
  barbells = signal<Barbell[]>([]);
  collars = signal<Collar[]>([]);

  availablePlates = computed<Plate[]>(() => {
    let plates: Plate[];
    if (this.usePersonalGym() && this.isPremiumUser()) {
      plates = this.personalGymService.getDataForBackup()
        .filter(eq => eq.category === 'Plate')
        // +++ FIX: Assert the type here to inform TypeScript that 'eq' now has plate-like properties.
        .map(eq => {
          const plateData = eq as GymPlate;
          return {
            weight: plateData.weight ?? 0,
            unit: plateData.unit as 'kg' | 'lb',
            isOlympic: plateData.isOlympic ?? true,
            color: plateData.color,
            quantity: eq.quantity ?? 1
          };
        });
    } else {
      plates = this.barbellCalculatorService.getAvailablePlates(this.unit(), this.isOlympic());
    }

    if (!this.enable50kgPlate()) {
      plates = plates.filter(p => p.weight !== 50);
    }

    return plates.sort((a, b) => b.weight - a.weight);
  });

  // --- User Selections ---
  selectedBarbell = signal<Barbell | undefined>(undefined);
  selectedCollar = signal<Collar | undefined>(undefined);
  targetWeight = signal(0);

  // --- Calculation Results ---
  loadout = signal<PlateLoadout[]>([]);

  totalWeight = computed(() => {
    const bar = this.selectedBarbell();
    const collar = this.selectedCollar();
    if (!bar || !collar) return 0;

    const platesWeight = this.loadout().reduce((acc, item) => {
      return acc + (item.plate.weight * item.count * 2);
    }, 0);

    return bar.weight + collar.weight + platesWeight;
  });

  constructor() {
    effect(() => {
      const currentTarget = this.targetWeight();
      const maxWeight = this.maxPossibleWeight();
      // Only adjust if maxWeight is plausible and target is higher
      if (maxWeight > 0 && currentTarget > maxWeight) {
        this.toastService.warning(`Weight exceeds available plates. Setting to max: ${maxWeight} ${this.unit()}`, 4000, "Max Weight Reached");
        this.targetWeight.set(maxWeight);
        this.calculateFromTargetWeight();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.isPremiumUser.set(this.subscriptionService.isPremium());
    this.collars.set(this.barbellCalculatorService.getCollars());
    this.updateDataSource(); // Initial data load
    this.selectedCollar.set(this.collars()[0]);
  }

  // --- Public Methods for Template ---

  onClose(): void {
    this.close.emit();
  }

  setMode(newMode: 'calculate' | 'reverse'): void {
    if (this.mode() === newMode) return;

    if (newMode === 'calculate') {
      this.targetWeight.set(this.totalWeight());
    }
    this.mode.set(newMode);
  }

  setUnit(newUnit: 'kg' | 'lb'): void {
    if (this.unit() === newUnit) return;
    this.unit.set(newUnit);
    this.recalculateBasedOnMode();
  }

  // +++ FIX: Renamed for clarity +++
  handleBarChange(bar: Barbell): void {
    this.selectedBarbell.set(bar);
    this.recalculateBasedOnMode();
  }

  /**
   * Generates a CSS-friendly class name from a plate's weight.
   * e.g., 2.5 becomes 'plate-2-5'
   */
  getPlateClass(weight: number): string {
    return `plate-${String(weight).replace('.', '-')}`;
  }

  // +++ FIX: New method to handle collar changes without resetting the bar in reverse mode +++
  handleCollarChange(collar: Collar): void {
    this.selectedCollar.set(collar);
    // In 'calculate' mode, we must re-run the calculation
    if (this.mode() === 'calculate') {
      this.calculateFromTargetWeight();
    }
    // In 'reverse' mode, we do nothing else. The `totalWeight` computed signal will update automatically.
  }

  recalculateBasedOnMode(): void {
    if (this.mode() === 'calculate') {
      this.calculateFromTargetWeight();
    } else {
      this.clearLoadout();
    }
  }

  calculateFromTargetWeight(): void {
    const bar = this.selectedBarbell();
    const collar = this.selectedCollar();
    if (!bar || !collar || this.targetWeight() <= 0) {
      this.loadout.set([]);
      return;
    }
    // +++ Use the new availablePlates computed signal
    const newLoadout = this.barbellCalculatorService.calculatePlates(this.targetWeight(), bar, collar, this.availablePlates());
    this.loadout.set(newLoadout);
  }

  // --- Reverse Mode Methods ---

  /**
   * +++ FIX: Rewritten to be fully immutable.
   * Instead of modifying an existing plate object in the array, this creates a new
   * array with a new or updated plate object, ensuring reactivity works correctly.
   */
  addPlate(plateToAdd: Plate): void {
    this.loadout.update(currentLoadout => {
      const index = currentLoadout.findIndex(p => p.plate.weight === plateToAdd.weight);

      let newLoadout: PlateLoadout[];

      if (index > -1) {
        // Plate exists, create a new array with the updated item
        newLoadout = currentLoadout.map((item, i) => {
          if (i === index) {
            return { ...item, count: item.count + 1 }; // Create new object with incremented count
          }
          return item;
        });
      } else {
        // Plate is new, add it to a new array
        newLoadout = [...currentLoadout, { plate: plateToAdd, count: 1 }];
      }

      // Sort the new array and return it
      return newLoadout.sort((a, b) => b.plate.weight - a.plate.weight);
    });
  }

  /**
   * +++ FIX: Rewritten to be fully immutable.
   * This now correctly returns a new array with either an updated object (decremented count)
   * or a filtered list, which reliably triggers the `totalWeight` computed signal to update.
   */
  removePlate(plateToRemove: Plate): void {
    this.loadout.update(currentLoadout => {
      const index = currentLoadout.findIndex(p => p.plate.weight === plateToRemove.weight);

      if (index === -1) {
        return currentLoadout; // No change
      }

      const item = currentLoadout[index];

      if (item.count > 1) {
        // If count is more than 1, create a new array with the count decremented
        return currentLoadout.map((loadoutItem, i) => {
          if (i === index) {
            return { ...loadoutItem, count: loadoutItem.count - 1 };
          }
          return loadoutItem;
        });
      } else {
        // If count is 1, return a new array with the item filtered out
        return currentLoadout.filter((_, i) => i !== index);
      }
    });
  }

  clearLoadout(): void {
    this.loadout.set([]);
  }

  /**
   * Determines if the text on a plate should be light or dark based on its background color.
   * @param plateColor The hex color string of the plate's background.
   * @returns '#FFFFFF' for light text (on dark plates) or '#111111' for dark text.
   */
  getPlateTextColor(plateColor: string | undefined): string {
    if (!plateColor) {
      return '#111111'; // Default dark text for uncolored plates
    }
    // List of dark background colors that need light text for contrast
    const darkColors = ['#D32F2F', '#FF0000', '#1976D2', '#424242', '#111111', '#000000FF', '#0000FF'];

    if (darkColors.includes(plateColor.toUpperCase())) {
      return '#FFFFFF'; // Return white text for dark plates
    }

    return '#111111'; // Return dark text for light plates (yellow, white)
  }

  maxPossibleWeight = computed(() => {
    const bar = this.selectedBarbell();
    const collar = this.selectedCollar();
    if (!bar || !collar) return 0;

    let totalPlateWeight = 0;
    if (this.usePersonalGym() && this.isPremiumUser()) {
      // Accurately sum all plates from the user's inventory for the current unit
      totalPlateWeight = this.availablePlates().reduce((acc, plate) => {
        return acc + (plate.weight * (plate.quantity ?? 0));
      }, 0);
    } else {
      // For default mode, use a high but reasonable limit as inventory is "infinite"
      const heaviestPlate = this.availablePlates()[0]?.weight ?? 0;
      totalPlateWeight = heaviestPlate * 10 * 2; // Approx. 10 of the heaviest plates per side
    }

    return bar.weight + collar.weight + totalPlateWeight;
  });

  // +++ NEW: Method to toggle the personal gym setting
  togglePersonalGym(useGym: boolean): void {
    if (!this.isPremiumUser()) {
      this.subscriptionService.showUpgradeModal("To use equipment from your Personal Gym, please upgrade to Premium.");
      this.usePersonalGym.set(false);
      return;
    }
    this.usePersonalGym.set(useGym);
    this.updateDataSource();
  }

  /**
  * +++ FIX: This method has been refactored to correctly handle cases where
  * the user's Personal Gym is missing required equipment (barbells).
  *
  * Instead of automatically reverting the 'Use Personal Gym' toggle, it now
  * correctly empties the list of available barbells. This causes the calculator
  * to show a state of '0' and allows the `availablePlates` computed signal
  * to correctly return an empty array, thus hiding the plate loadout as intended.
  */
  private updateDataSource(): void {
    let sourceBarbells: Barbell[] = [];

    if (this.usePersonalGym()) {
      const personalEquipment = this.personalGymService.getDataForBackup();

      sourceBarbells = personalEquipment
        .filter(eq => eq.category === 'Barbell')
        .map(eq => {
          const barData = eq as GymBarbell;
          return {
            name: barData.name,
            weight: barData.weight ?? 0,
            unit: barData.unit as 'kg' | 'lb'
          };
        });

      if (sourceBarbells.length === 0) {
        this.toastService.error(`No ${this.unit().toUpperCase()} barbells found in your Personal Gym.`, 5000, "Equipment Missing");
      } else {
        // Optional: Warn if there are no plates, but still proceed.
        const hasPlates = personalEquipment.some(eq => eq.category === 'Plate');
        if (!hasPlates) {
          this.toastService.info('No plates found in your gym for this unit.', 3000, 'Heads Up');
        }
      }
    } else {
      // Fallback to the default service list
      sourceBarbells = this.barbellCalculatorService.getBarbells().filter(b => b.unit === this.unit());
    }

    this.barbells.set(sourceBarbells);

    // If barbells are available from the chosen source, select the first one. Otherwise, clear the selection.
    if (this.barbells().length > 0) {
      this.selectedBarbell.set(this.barbells()[0]);
      this.targetWeight.set(this.selectedBarbell()?.weight ?? 0);
    } else {
      this.selectedBarbell.set(undefined);
      this.targetWeight.set(0);
    }

    // Always recalculate based on the new state
    this.recalculateBasedOnMode();
  }

  // +++ NEW: Method to toggle the 50kg plate and recalculate
  toggle50kgPlate(enabled: boolean): void {
    this.enable50kgPlate.set(enabled);

    // Only trigger a full recalculation if in the correct mode.
    if (this.mode() === 'calculate') {
      this.calculateFromTargetWeight();
    }
    // In reverse mode, no extra action is needed. The `availablePlates` computed
    // signal will automatically update, and the UI will reflect the change.
  }

  platesWeightPerSide = computed(() => {
    return this.loadout().reduce((acc, item) => {
      return acc + (item.plate.weight * item.count);
    }, 0);
  });

  plateCountMap = computed(() => {
    return new Map(this.loadout().map(item => [item.plate.weight, item.count]));
  });

  private holdTimeout: any = null;
  private holdInterval: any = null;
  weightStep = computed(() => this.unit() === 'kg' ? 0.25 : 1.25);
  minPossibleWeight = computed(() => {
    const bar = this.selectedBarbell();
    const collar = this.selectedCollar();
    return (bar?.weight ?? 0) + (collar?.weight ?? 0);
  });

  /**
   * Handles a single weight change, respecting min/max boundaries.
   * @param direction 'increase' or 'decrease'
   */
  changeWeight(direction: 'increase' | 'decrease'): void {
    const step = this.weightStep();
    const currentWeight = this.targetWeight();
    const minWeight = this.minPossibleWeight();
    const maxWeight = this.maxPossibleWeight();

    let newWeight = direction === 'increase' ? currentWeight + step : currentWeight - step;

    // Clamp the new weight within the valid range
    if (newWeight < minWeight) newWeight = minWeight;
    if (newWeight > maxWeight) newWeight = maxWeight;

    // Round to the nearest step to prevent floating point errors
    const roundedWeight = Math.round(newWeight / step) * step;

    this.targetWeight.set(parseFloat(roundedWeight.toFixed(2)));
    this.calculateFromTargetWeight();
  }

  /**
   * Starts the process of changing weight, called on mousedown/touchstart.
   * It changes the weight once immediately, then starts timers for repeated changes.
   */
  startChangingWeight(direction: 'increase' | 'decrease'): void {
    this.stopChangingWeight(); // Clear any existing timers
    this.changeWeight(direction); // Change once immediately

    this.holdTimeout = setTimeout(() => {
      this.holdInterval = setInterval(() => {
        this.changeWeight(direction);
      }, 100); // Repeat every 100ms
    }, 500); // Initial delay of 500ms
  }

  /**
   * Stops the timers for changing weight, called on mouseup/mouseleave/touchend.
   */
  stopChangingWeight(): void {
    clearTimeout(this.holdTimeout);
    clearInterval(this.holdInterval);
  }

  ngOnDestroy(): void {
    this.stopChangingWeight();
  }

}