import { Component, OnInit, inject, computed, signal, Output, EventEmitter, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Barbell, BarbellCalculatorService, PlateLoadout, Collar, Plate } from '../../../core/services/barbell-calculator.service';
import { PersonalGymService } from '../../../core/services/personal-gym.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../icon/icon.component';
import { PlateSummaryComponent } from './plate-summary/plate-summary.component';


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

// --- TYPE DEFINITIONS for new pages ---
type ActivePage = 'calculator' | 'percentage' | 'oneRepMax' | 'rpe' | 'scores';

interface PercentageResult {
  percentage: number;
  targetWeight: number;
  achievableWeight: number;
  loadout: PlateLoadout[];
}

interface PowerliftingScores {
  wilks: number;
  dots: number;
  glPoints: number;
  sinclair: number;
}

// RPE Chart: [Reps @ RPE] -> % of 1RM
const RPE_CHART: { [rpe: number]: { [reps: number]: number } } = {
  10: { 1: 100, 2: 96, 3: 92, 4: 89, 5: 86, 6: 84, 7: 81, 8: 79, 9: 76, 10: 74 },
  9.5: { 1: 98, 2: 94, 3: 91, 4: 88, 5: 85, 6: 82, 7: 80, 8: 77, 9: 75, 10: 72 },
  9: { 1: 96, 2: 92, 3: 89, 4: 86, 5: 84, 6: 81, 7: 79, 8: 76, 9: 74, 10: 71 },
  8.5: { 1: 94, 2: 91, 3: 88, 4: 85, 5: 82, 6: 80, 7: 77, 8: 75, 9: 72, 10: 69 },
  8: { 1: 92, 2: 89, 3: 86, 4: 84, 5: 81, 6: 79, 7: 76, 8: 74, 9: 71, 10: 68 },
  7.5: { 1: 91, 2: 88, 3: 85, 4: 82, 5: 80, 6: 77, 7: 75, 8: 72, 9: 69, 10: 67 },
  7: { 1: 89, 2: 86, 3: 84, 4: 81, 5: 79, 6: 76, 7: 74, 8: 71, 9: 68, 10: 65 },
  6.5: { 1: 88, 2: 85, 3: 82, 4: 80, 5: 77, 6: 75, 7: 72, 8: 69, 9: 67, 10: 64 },
  6: { 1: 86, 2: 84, 3: 81, 4: 79, 5: 76, 6: 74, 7: 71, 8: 68, 9: 65, 10: 62 }
};

@Component({
  selector: 'app-barbell-calculator-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, PlateSummaryComponent],
  templateUrl: './barbell-calculator-modal.component.html',
  styleUrls: ['./barbell-calculator-modal.component.scss']
})
export class BarbellCalculatorModalComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  private barbellCalculatorService = inject(BarbellCalculatorService);
  private personalGymService = inject(PersonalGymService);
  private subscriptionService = inject(SubscriptionService);
  private toastService = inject(ToastService);

  // --- Main Page Navigation ---
  activePage = signal<ActivePage>('calculator');

  // --- State Signals for PAGE 1: CALCULATOR (Existing logic) ---
  mode = signal<'calculate' | 'reverse'>('calculate');
  unit = signal<'kg' | 'lb'>('kg');
  isOlympic = signal(true);
  usePersonalGym = signal(false);
  enable50kgPlate = signal(false);
  isPremiumUser = signal(false);
  barbells = signal<Barbell[]>([]);
  collars = signal<Collar[]>([]);
  selectedBarbell = signal<Barbell | undefined>(undefined);
  selectedCollar = signal<Collar | undefined>(undefined);
  targetWeight = signal(0);
  loadout = signal<PlateLoadout[]>([]);

  // --- State Signals for PAGE 2: PERCENTAGE CALCULATOR ---
  percentagePresets = [90, 80, 75, 70, 60, 50];
  customPercentage = signal<number>(95);

  // --- State Signals for PAGE 3: 1RM CALCULATOR ---
  oneRmWeight = signal<number | null>(null);
  oneRmReps = signal<number | null>(null);

  // --- State Signals for PAGE 4: RPE CALCULATOR ---
  rpeWeight = signal<number | null>(null);
  rpeReps = signal<number | null>(null);
  rpeValue = signal<number>(8);
  rpeOptions = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6];

  // --- State Signals for PAGE 5: POWERLIFTING SCORES ---
  plBodyweight = signal<number | null>(null);
  plTotal = signal<number | null>(null);
  plGender = signal<'male' | 'female'>('male');
  plUnit = signal<'kg' | 'lb'>('kg');

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
    });
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
    if (newUnit === 'lb') {
      this.enable50kgPlate.set(false);
    }
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
  getPlateClass(weight: number, unit: 'kg' | 'lb' = 'kg'): string {
    if (unit === 'lb') {
      return `plate-lb plate-lb-${String(weight).replace('.', '-')}`;
    }
    return `plate plate-${String(weight).replace('.', '-')}`;
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
      return '#FFFFFF'; // Default dark text for uncolored plates
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









  // --- COMPUTED SIGNALS (New) ---

  // For Percentage Page
  percentageResults = computed<PercentageResult[]>(() => {
    const baseWeight = this.totalWeight();
    if (baseWeight <= 0) return [];

    const allPercentages = [...new Set([...this.percentagePresets, this.customPercentage()])].sort((a, b) => b - a);

    return allPercentages.map(p => {
      const target = baseWeight * (p / 100);
      return this.calculateNearestLoadableWeight(target);
    });
  });

  // For 1RM Page
  estimated1RM = computed(() => {
    const w = this.oneRmWeight();
    const r = this.oneRmReps();
    if (!w || !r || w <= 0 || r <= 0) return { epley: 0, brzycki: 0 };

    const epley = w * (1 + (r / 30));
    const brzycki = w / (1.0278 - (0.0278 * r));
    return { epley, brzycki };
  });

  oneRmProjectionTable = computed(() => {
    const oneRM = this.estimated1RM().epley;
    if (oneRM <= 0) return [];
    const projections = [
      { reps: 1, percent: 100 }, { reps: 2, percent: 95 }, { reps: 3, percent: 90 },
      { reps: 5, percent: 85 }, { reps: 8, percent: 75 }, { reps: 10, percent: 70 },
      { reps: 12, percent: 65 }
    ];
    return projections.map(p => ({
      reps: p.reps,
      weight: oneRM * (p.percent / 100)
    }));
  });

  // For RPE Page
  estimated1RMFromRpe = computed(() => {
    const w = this.rpeWeight();
    const r = this.rpeReps();
    const rpe = this.rpeValue();
    if (!w || !r || w <= 0 || r <= 0) return 0;

    const percent = RPE_CHART[rpe]?.[r];
    if (!percent) return 0; // Reps/RPE combo not in chart

    return w / (percent / 100);
  });

  // For Powerlifting Scores Page
  powerliftingScores = computed<PowerliftingScores>(() => {
    const bw = this.plBodyweight();
    const total = this.plTotal();
    const gender = this.plGender();
    const unit = this.plUnit();

    if (!bw || !total || bw <= 0 || total <= 0) {
      return { wilks: 0, dots: 0, glPoints: 0, sinclair: 0 };
    }

    // Formulas require KG, so convert if necessary
    const bwKg = unit === 'lb' ? bw * 0.453592 : bw;
    const totalKg = unit === 'lb' ? total * 0.453592 : total;

    return {
      wilks: this.calculateWilks(bwKg, totalKg, gender),
      dots: this.calculateDots(bwKg, totalKg, gender),
      glPoints: this.calculateGlPoints(bwKg, totalKg, gender),
      sinclair: this.calculateSinclair(bwKg, totalKg, gender)
    };
  });






  // --- NEW PUBLIC METHODS ---

  setPage(page: ActivePage): void {
    this.activePage.set(page);
  }

  /**
   * For the percentage calculator, finds the nearest loadable weight for a given target.
   */
  private calculateNearestLoadableWeight(targetWeight: number): PercentageResult {
    const bar = this.selectedBarbell();
    const collar = this.selectedCollar();
    if (!bar || !collar) {
      return { percentage: (targetWeight / this.totalWeight() * 100), targetWeight, achievableWeight: 0, loadout: [] };
    }

    // Calculate the ideal loadout for the target weight
    const loadout = this.barbellCalculatorService.calculatePlates(targetWeight, bar, collar, this.availablePlates());

    // Recalculate the *actual* weight based on this loadout
    const platesWeight = loadout.reduce((acc, item) => acc + (item.plate.weight * item.count * 2), 0);
    const achievableWeight = bar.weight + collar.weight + platesWeight;
    const percentage = this.totalWeight() > 0 ? (targetWeight / this.totalWeight() * 100) : 0;

    return { percentage, targetWeight, achievableWeight, loadout };
  }


  // --- POWERLIFTING FORMULA HELPERS ---

  private calculateWilks(bodyweight: number, total: number, gender: 'male' | 'female'): number {
    const a = gender === 'male' ? -216.0475144 : 594.31747775582;
    const b = gender === 'male' ? 16.2606339 : -27.23842536447;
    const c = gender === 'male' ? -0.002388645 : 0.82112226871;
    const d = gender === 'male' ? -0.00113732 : -0.00930733913;
    const e = gender === 'male' ? 7.01863e-6 : 4.731582e-5;
    const f = gender === 'male' ? -1.291e-8 : -2.04619e-8;
    const denominator = a + b * bodyweight + c * Math.pow(bodyweight, 2) + d * Math.pow(bodyweight, 3) + e * Math.pow(bodyweight, 4) + f * Math.pow(bodyweight, 5);
    const coefficient = 500 / denominator;
    return total * coefficient;
  }

  private calculateDots(bodyweight: number, total: number, gender: 'male' | 'female'): number {
    const a = gender === 'male' ? -307.75076 : -130.43246;
    const b = gender === 'male' ? 24.0900756 : 13.38698;
    const c = gender === 'male' ? -0.19187592 : -0.093864;
    const d = gender === 'male' ? 0.0007391293 : 0.000233;
    const e = gender === 'male' ? -0.000001093 : 0;
    const denominator = a + b * bodyweight + c * Math.pow(bodyweight, 2) + d * Math.pow(bodyweight, 3) + e * Math.pow(bodyweight, 4);
    const coefficient = 500 / denominator;
    return total * coefficient;
  }

  private calculateGlPoints(bodyweight: number, total: number, gender: 'male' | 'female'): number {
    const a = gender === 'male' ? 1199.72839 : 382.16616;
    const b = gender === 'male' ? 1025.18162 : 197.88418;
    const c = gender === 'male' ? 0.00921 : 0.02594;
    const d = gender === 'male' ? 6.48e-6 : 1.2e-5;
    const coefficient = 100 / (a - b * Math.exp(-c * bodyweight) + d * Math.pow(bodyweight, 3));
    return total * coefficient;
  }

  private calculateSinclair(bodyweight: number, total: number, gender: 'male' | 'female'): number {
    if ((gender === 'male' && bodyweight > 182.2) || (gender === 'female' && bodyweight > 153.1)) return total;
    const A = gender === 'male' ? 0.751945030 : 0.897260740;
    const B = gender === 'male' ? 175.508 : 148.026;
    const x = Math.log10(bodyweight / B);
    const coefficient = Math.pow(10, A * Math.pow(x, 2));
    return total * coefficient;
  }


  ngOnDestroy(): void {
    this.stopChangingWeight();
  }
}