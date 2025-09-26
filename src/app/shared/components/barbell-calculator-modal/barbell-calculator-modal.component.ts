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
    this.barbellCalculatorService.getAvailablePlates(this.unit(), this.isOlympic())
  );
  
  // --- User Selections ---
  selectedBarbell = signal<Barbell | undefined>(undefined);
  selectedCollar = signal<Collar | undefined>(undefined);
  targetWeight = signal(0);
  
  // --- Calculation Results ---
  // In reverse mode, this is the source of truth. In calculate mode, it's a result.
  loadout = signal<PlateLoadout[]>([]);

  // The final calculated total weight. It's computed from the loadout.
  totalWeight = computed(() => {
    const bar = this.selectedBarbell();
    const collar = this.selectedCollar();
    if (!bar || !collar) return 0;

    const platesWeight = this.loadout().reduce((acc, item) => {
      // item.count is per side, so multiply by 2 for total
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
    
    // When switching, sync the states
    if (newMode === 'calculate') {
      // Update the target weight from the visually built loadout
      this.targetWeight.set(this.totalWeight());
    }
    this.mode.set(newMode);
  }

  setUnit(newUnit: 'kg' | 'lb'): void {
    if (this.unit() === newUnit) return;
    this.unit.set(newUnit);
    // When unit changes, we must recalculate everything
    this.recalculateBasedOnMode();
  }

  recalculateBasedOnMode(): void {
    if (this.mode() === 'calculate') {
      this.calculateFromTargetWeight();
    } else {
      // In reverse mode, changing units or bar clears the loadout
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
    const currentLoadout = this.loadout();
    const existingPlate = currentLoadout.find(p => p.plate.weight === plateToAdd.weight);

    if (existingPlate) {
      existingPlate.count++;
      this.loadout.set([...currentLoadout]);
    } else {
      this.loadout.set([...currentLoadout, { plate: plateToAdd, count: 1 }]);
    }
  }

  removePlate(plateToRemove: Plate): void {
     this.loadout.update(currentLoadout => {
        const existing = currentLoadout.find(p => p.plate.weight === plateToRemove.weight);
        if (existing) {
            existing.count--;
            if (existing.count <= 0) {
                // Filter out the plate if its count drops to 0
                return currentLoadout.filter(p => p.plate.weight !== plateToRemove.weight);
            }
        }
        return [...currentLoadout];
    });
  }

  clearLoadout(): void {
    this.loadout.set([]);
  }
}