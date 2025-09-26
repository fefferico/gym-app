import { Component, OnInit, inject, computed, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Barbell, BarbellCalculatorService, PlateLoadout, Collar, Plate } from '../../../core/services/barbell-calculator.service';

@Component({
  selector: 'app-barbell-calculator-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './barbell-calculator-modal.component.html',
  styleUrls: ['./barbell-calculator-modal.component.scss']
})
export class BarbellCalculatorModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  private barbellCalculatorService = inject(BarbellCalculatorService);

  // --- State Signals ---
  mode = signal<'calculate' | 'reverse'>('calculate');
  unit = signal<'kg' | 'lb'>('kg');
  isOlympic = signal(true);

  // --- Data from Service ---
  barbells: Barbell[] = [];
  collars: Collar[] = [];
  availablePlates = computed<Plate[]>(() => 
    // The service already sorts these from heaviest to lightest
    this.barbellCalculatorService.getAvailablePlates(this.unit(), this.isOlympic())
  );
  
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

  ngOnInit(): void {
    this.barbells = this.barbellCalculatorService.getBarbells();
    this.collars = this.barbellCalculatorService.getCollars();
    this.selectedBarbell.set(this.barbells[0]);
    this.selectedCollar.set(this.collars[0]);
    this.targetWeight.set(this.selectedBarbell()?.weight ?? 0);
    this.calculateFromTargetWeight();
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
    const newLoadout = this.barbellCalculatorService.calculatePlates(this.targetWeight(), bar, collar, this.unit(), this.isOlympic());
    this.loadout.set(newLoadout);
  }

  // --- Reverse Mode Methods ---

  addPlate(plateToAdd: Plate): void {
    this.loadout.update(currentLoadout => {
      const existingPlate = currentLoadout.find(p => p.plate.weight === plateToAdd.weight);
      if (existingPlate) {
        existingPlate.count++;
      } else {
        currentLoadout.push({ plate: plateToAdd, count: 1 });
      }
      // +++ FIX: Ensure loadout is always sorted heaviest to lightest for consistent rendering +++
      return currentLoadout.sort((a, b) => b.plate.weight - a.plate.weight);
    });
  }

  // +++ FIX: This method is now called from the plates on the bar itself +++
  removePlate(plateToRemove: Plate): void {
     this.loadout.update(currentLoadout => {
        const existing = currentLoadout.find(p => p.plate.weight === plateToRemove.weight);
        if (existing) {
            existing.count--;
            if (existing.count <= 0) {
                return currentLoadout.filter(p => p.plate.weight !== plateToRemove.weight);
            }
        }
        return [...currentLoadout];
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
    const darkColors = ['#D32F2F','#FF0000', '#1976D2', '#424242', '#111111', '#000000FF', '#0000FF']; 
    
    if (darkColors.includes(plateColor.toUpperCase())) {
      return '#FFFFFF'; // Return white text for dark plates
    }
    
    return '#111111'; // Return dark text for light plates (yellow, white)
  }
}