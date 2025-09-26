import { Injectable } from '@angular/core';

export interface Plate {
  weight: number;
  color?: string;
  isOlympic: boolean;
  unit: 'kg' | 'lb';
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
  weight: number; // Combined weight for the pair
  unit: 'kg' | 'lb';
}

@Injectable({
  providedIn: 'root'
})
export class BarbellCalculatorService {

  private olympicPlatesKg: Plate[] = [
    { weight: 25, color: '#ff0000', isOlympic: true, unit: 'kg' },
    { weight: 20, color: '#0000ff', isOlympic: true, unit: 'kg' },
    { weight: 15, color: '#ffff00', isOlympic: true, unit: 'kg' },
    { weight: 10, color: '#00ff00', isOlympic: true, unit: 'kg' },
    { weight: 5, color: '#ffffff', isOlympic: true, unit: 'kg' },
    { weight: 2.5, color: '#ff0000', isOlympic: true, unit: 'kg' },
    { weight: 2, color: '#0000ff', isOlympic: true, unit: 'kg' },
    { weight: 1.5, color: '#ffff00', isOlympic: true, unit: 'kg' },
    { weight: 1, color: '#00ff00', isOlympic: true, unit: 'kg' },
    { weight: 0.5, color: '#ffffff', isOlympic: true, unit: 'kg' }
  ];

  private standardPlatesKg: Plate[] = [
    { weight: 20, isOlympic: false, unit: 'kg' },
    { weight: 15, isOlympic: false, unit: 'kg' },
    { weight: 10, isOlympic: false, unit: 'kg' },
    { weight: 5, isOlympic: false, unit: 'kg' },
    { weight: 2.5, isOlympic: false, unit: 'kg' },
    { weight: 1.25, isOlympic: false, unit: 'kg' }
  ];

  private standardPlatesLb: Plate[] = [
    { weight: 45, isOlympic: false, unit: 'lb' },
    { weight: 35, isOlympic: false, unit: 'lb' },
    { weight: 25, isOlympic: false, unit: 'lb' },
    { weight: 10, isOlympic: false, unit: 'lb' },
    { weight: 5, isOlympic: false, unit: 'lb' },
    { weight: 2.5, isOlympic: false, unit: 'lb' }
  ];

  private barbells: Barbell[] = [
    { name: 'Men\'s Olympic Bar', weight: 20, unit: 'kg' },
    { name: 'Women\'s Olympic Bar', weight: 15, unit: 'kg' },
    { name: 'EZ Curl Bar', weight: 10, unit: 'kg' },
    { name: 'Tricep Bar', weight: 10, unit: 'kg' },
    { name: 'Trap/Hex Bar', weight: 25, unit: 'kg' },
    { name: 'Standard Gym Bar', weight: 20, unit: 'kg' }
  ];

  private collars: Collar[] = [
    { name: 'No Collars', weight: 0, unit: 'kg' },
    { name: 'Spring Clips', weight: 0.5, unit: 'kg' },
    { name: 'Lock-Jaw / Pro Collars', weight: 1, unit: 'kg' },
    { name: 'Competition Collars', weight: 5, unit: 'kg' }
  ];

  constructor() { }

  getAvailablePlates(unit: 'kg' | 'lb', isOlympic: boolean): Plate[] {
    if (unit === 'kg') {
      return isOlympic ? this.olympicPlatesKg : this.standardPlatesKg;
    } else {
      // For simplicity, we'll just use the standard lb plates for both olympic and standard in this example
      return this.standardPlatesLb;
    }
  }

  getBarbells(): Barbell[] {
    return this.barbells;
  }

  getCollars(): Collar[] {
    return this.collars;
  }

  calculatePlates(totalWeight: number, barbell: Barbell, collar: Collar, unit: 'kg' | 'lb', isOlympic: boolean): PlateLoadout[] {
    const availablePlates = this.getAvailablePlates(unit, isOlympic);
    
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