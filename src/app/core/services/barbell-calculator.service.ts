import { Injectable } from '@angular/core';
import { PlateType } from '../models/personal-gym.model';

export interface Plate {
  weight: number;
  color?: string;
  type: PlateType;
  unit: 'kg' | 'lb';
  quantity?: number;
}

export interface Barbell {
  name: string;
  weight: number;
  unit: 'kg' | 'lb';
}

export interface PlateLoadout {
  plate: Plate;
  count: number;
}

export interface Collar {
  name: string;
  weight: number;
  unit: 'kg' | 'lb';
}

@Injectable({
  providedIn: 'root'
})
export class BarbellCalculatorService {

  private bumperPlatesKg: Plate[] = [
    { weight: 50, color: '#424242', type: 'bumper', unit: 'kg' },
    { weight: 25, color: '#d32f2f', type: 'bumper', unit: 'kg' },
    { weight: 20, color: '#1976d2', type: 'bumper', unit: 'kg' },
    { weight: 15, color: '#fdd835', type: 'bumper', unit: 'kg' },
    { weight: 10, color: '#43a047', type: 'bumper', unit: 'kg' },
    { weight: 5, color: '#fafafa', type: 'bumper', unit: 'kg' },
    { weight: 2.5, color: '#424242', type: 'bumper', unit: 'kg' },
    { weight: 2, color: '#424242', type: 'bumper', unit: 'kg' },
    { weight: 1.5, color: '#424242', type: 'bumper', unit: 'kg' },
    { weight: 1, color: '#424242', type: 'bumper', unit: 'kg' },
    { weight: 0.5, color: '#424242', type: 'bumper', unit: 'kg' }
  ];

  private standardIronPlatesKg: Plate[] = [
    { weight: 50, color: '#424242', type: 'iron', unit: 'kg' },
    { weight: 25, color: '#424242', type: 'iron', unit: 'kg' },
    { weight: 20, color: '#424242', type: 'iron', unit: 'kg' },
    { weight: 15, color: '#424242', type: 'iron', unit: 'kg' },
    { weight: 10, color: '#424242', type: 'iron', unit: 'kg' },
    { weight: 5, color: '#424242', type: 'iron', unit: 'kg' },
    { weight: 2.5, color: '#424242', type: 'iron', unit: 'kg' },
    { weight: 1.25, color: '#424242', type: 'iron', unit: 'kg' }
  ];

  private olympicPlatesKg: Plate[] = [
    { type: 'standard', weight: 50, color: '#000000ff', unit: 'kg' },
    { type: 'standard', weight: 25, color: '#ff0000', unit: 'kg' },
    { type: 'standard', weight: 20, color: '#0000ff', unit: 'kg' },
    { type: 'standard', weight: 15, color: '#ffff00', unit: 'kg' },
    { type: 'standard', weight: 10, color: '#00ff00', unit: 'kg' },
    { type: 'standard', weight: 5, color: '#ffffff', unit: 'kg' },
    { type: 'standard', weight: 2.5, color: '#ff0000', unit: 'kg' },
    { type: 'standard', weight: 2, color: '#0000ff', unit: 'kg' },
    { type: 'standard', weight: 1.5, color: '#ffff00', unit: 'kg' },
    { type: 'standard', weight: 1, color: '#00ff00', unit: 'kg' },
    { type: 'standard', weight: 0.5, color: '#ffffff', unit: 'kg' }
  ];

  private standardPlatesKg: Plate[] = [
    { type: 'standard', weight: 50, unit: 'kg' },
    { type: 'standard', weight: 20, unit: 'kg' },
    { type: 'standard', weight: 15, unit: 'kg' },
    { type: 'standard', weight: 10, unit: 'kg' },
    { type: 'standard', weight: 5, unit: 'kg' },
    { type: 'standard', weight: 2.5, unit: 'kg' },
    { type: 'standard', weight: 1.25, unit: 'kg' }
  ];

  private standardPlatesLb: Plate[] = [
    { type: 'standard', weight: 45, unit: 'lb' },
    { type: 'standard', weight: 35, unit: 'lb' },
    { type: 'standard', weight: 25, unit: 'lb' },
    { type: 'standard', weight: 10, unit: 'lb' },
    { type: 'standard', weight: 5, unit: 'lb' },
    { type: 'standard', weight: 2.5, unit: 'lb' }
  ];

  private barbells: Barbell[] = [
    { name: 'Men\'s Olympic Bar', weight: 20, unit: 'kg' },
    { name: 'Men\'s Olympic Bar', weight: 44, unit: 'lb' },
    { name: 'Women\'s Olympic Bar', weight: 15, unit: 'kg' },
    { name: 'Women\'s Olympic Bar', weight: 33, unit: 'lb' },
    { name: 'Standard Gym Bar', weight: 20, unit: 'kg' },
    { name: 'Standard Gym Bar', weight: 44, unit: 'lb' },
    { name: 'EZ Curl Bar', weight: 10, unit: 'kg' },
    { name: 'EZ Curl Bar', weight: 22, unit: 'lb' },
    { name: 'Tricep Bar', weight: 10, unit: 'kg' },
    { name: "Tricep Bar", "weight": 22, "unit": "lb" },
    { name: 'Trap/Hex Bar', weight: 25, unit: 'kg' },
    { name: 'Trap/Hex Bar', weight: 55, unit: 'lb' },
  ];

  private collars: Collar[] = [
    { name: 'No Collars', weight: 0, unit: 'kg' },
    { name: 'No Collars', weight: 0, unit: 'lb' },
    { name: 'Spring Clips', weight: 0.5, unit: 'kg' },
    { name: "Spring Clips", "weight": 1.1, "unit": "lb" },
    { name: 'Lock-Jaw / Pro Collars', weight: 1, unit: 'kg' },
    { name: "Lock-Jaw / Pro Collars", "weight": 2.2, "unit": "lb" },
    { name: 'Competition Collars', weight: 5, unit: 'kg' }, 
    { name: "Competition Collars", "weight": 11, "unit": "lb" }
  ];

  constructor() { }

  getAvailablePlates(unit: 'kg' | 'lb', plateType: PlateType): Plate[] {
    if (unit === 'kg') {
      switch (plateType) {
        case 'bumper':
          return this.bumperPlatesKg;
        case 'iron':
        default:
          return this.standardIronPlatesKg;
      }
    } else {
      // For LB, we will return the standard set regardless of the type for now.
      return this.standardPlatesLb;
    }
  }

  getBarbells(): Barbell[] {
    return this.barbells;
  }

  getCollars(): Collar[] {
    return this.collars;
  }

  calculatePlates(totalWeight: number, barbell: Barbell, collar: Collar, availablePlates: Plate[]): PlateLoadout[] {
    // Subtract the weight of the bar AND the collars first
    let weightToLoad = totalWeight - barbell.weight - collar.weight;

    if (weightToLoad < 0) {
      return [];
    }

    const loadout: PlateLoadout[] = [];
    // We calculate plates for one side of the bar
    let weightPerSide = weightToLoad / 2;

    for (const plate of availablePlates) {
      // Calculate how many of the current plate can fit on one side
      const plateCount = Math.floor(weightPerSide / plate.weight);
      if (plateCount > 0) {
        loadout.push({ plate, count: plateCount });
        weightPerSide -= plateCount * plate.weight;
      }
    }
    return loadout;
  }
}