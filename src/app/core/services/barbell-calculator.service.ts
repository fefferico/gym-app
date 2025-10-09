import { Injectable } from '@angular/core';
import { PlateType } from '../models/personal-gym.model';

export interface CalculationResult {
  loadout: PlateLoadout[];
  achievedWeight: number; // The actual weight achieved with the plates that fit
  totalWidthPerSideMm: number;
  sleeveLengthMm: number;
  warning?: 'weight' | 'width'; // Optional warning flag
}

export interface Plate {
  weight: number;
  width: number;
  color?: string;
  type: PlateType;
  unit: 'kg' | 'lb';
  quantity?: number;
}

export interface Barbell {
  name: string;
  weight: number;
  unit: 'kg' | 'lb';
  isOlympic?: boolean;
  lengthCm?: number;
  lengthInch?: number;
  sleeveCm?: number;
  sleeveInch?: number;
  maxLoadableWeightPerSideKg?: number;
  maxLoadableWeightPerSideLb?: number;
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
    { weight: 50, color: '#424242', type: 'bumper', unit: 'kg', width: 80 }, // Approximate, less common size
    { weight: 25, color: '#d32f2f', type: 'bumper', unit: 'kg', width: 88 },
    { weight: 20, color: '#1976d2', type: 'bumper', unit: 'kg', width: 75 },
    { weight: 15, color: '#fdd835', type: 'bumper', unit: 'kg', width: 62 },
    { weight: 10, color: '#43a047', type: 'bumper', unit: 'kg', width: 45 },
    { weight: 5, color: '#fafafa', type: 'bumper', unit: 'kg', width: 25 },
    // Fractional and change plates are much thinner
    { weight: 2.5, color: '#424242', type: 'bumper', unit: 'kg', width: 22 },
    { weight: 2, color: '#424242', type: 'bumper', unit: 'kg', width: 19 },
    { weight: 1.5, color: '#424242', type: 'bumper', unit: 'kg', width: 18 },
    { weight: 1, color: '#424242', type: 'bumper', unit: 'kg', width: 15 },
    { weight: 0.5, color: '#424242', type: 'bumper', unit: 'kg', width: 12 }
  ];

  private standardIronPlatesKg: Plate[] = [
    { weight: 50, color: '#424242', type: 'iron', unit: 'kg', width: 50 },
    { weight: 25, color: '#424242', type: 'iron', unit: 'kg', width: 45 },
    { weight: 20, color: '#424242', type: 'iron', unit: 'kg', width: 40 },
    { weight: 15, color: '#424242', type: 'iron', unit: 'kg', width: 35 },
    { weight: 10, color: '#424242', type: 'iron', unit: 'kg', width: 30 },
    { weight: 5, color: '#424242', type: 'iron', unit: 'kg', width: 25 },
    { weight: 2.5, color: '#424242', type: 'iron', unit: 'kg', width: 20 },
    { weight: 1.25, color: '#424242', type: 'iron', unit: 'kg', width: 15 }
  ];

  private olympicPlatesKg: Plate[] = [
    { type: 'standard', weight: 50, color: '#000000ff', unit: 'kg', width: 58 }, // Not an IWF color, but an example
    { type: 'standard', weight: 25, color: '#ff0000', unit: 'kg', width: 60 },
    { type: 'standard', weight: 20, color: '#0000ff', unit: 'kg', width: 50 },
    { type: 'standard', weight: 15, color: '#ffff00', unit: 'kg', width: 40 },
    { type: 'standard', weight: 10, color: '#00ff00', unit: 'kg', width: 29 },
    { type: 'standard', weight: 5, color: '#ffffff', unit: 'kg', width: 25 },
    // Change Plates (smaller diameter, not bumpers)
    { type: 'standard', weight: 2.5, color: '#ff0000', unit: 'kg', width: 22 },
    { type: 'standard', weight: 2, color: '#0000ff', unit: 'kg', width: 19 },
    { type: 'standard', weight: 1.5, color: '#ffff00', unit: 'kg', width: 18 },
    { type: 'standard', weight: 1, color: '#00ff00', unit: 'kg', width: 15 },
    { type: 'standard', weight: 0.5, color: '#ffffff', unit: 'kg', width: 12 }
  ];

  private standardPlatesKg: Plate[] = [
    { type: 'standard', weight: 50, unit: 'kg', width: 50 },
    { type: 'standard', weight: 20, unit: 'kg', width: 40 },
    { type: 'standard', weight: 15, unit: 'kg', width: 35 },
    { type: 'standard', weight: 10, unit: 'kg', width: 30 },
    { type: 'standard', weight: 5, unit: 'kg', width: 25 },
    { type: 'standard', weight: 2.5, unit: 'kg', width: 20 },
    { type: 'standard', weight: 1.25, unit: 'kg', width: 15 }
  ];

  private standardPlatesLb: Plate[] = [
    { type: 'standard', weight: 45, unit: 'lb', width: 38 }, // Approx 1.5 inches
    { type: 'standard', weight: 35, unit: 'lb', width: 35 }, // Approx 1.38 inches
    { type: 'standard', weight: 25, unit: 'lb', width: 32 }, // Approx 1.25 inches
    { type: 'standard', weight: 10, unit: 'lb', width: 25 }, // Approx 1 inch
    { type: 'standard', weight: 5, unit: 'lb', width: 20 },  // Approx 0.79 inches
    { type: 'standard', weight: 2.5, unit: 'lb', width: 15 } // Approx 0.59 inches
  ];

  private barbells: Barbell[] = [
    // Standard Olympic Barbells with IWF specs
    { name: 'barbellData.barbells.mensOlympic', weight: 20, unit: 'kg', sleeveCm: 41.5 },
    { name: 'barbellData.barbells.mensOlympic', weight: 44, unit: 'lb', sleeveInch: 16.3 },
    { name: 'barbellData.barbells.womensOlympic', weight: 15, unit: 'kg', sleeveCm: 32 },
    { name: 'barbellData.barbells.womensOlympic', weight: 33, unit: 'lb', sleeveInch: 12.6 },

    // A common non-competition "gym" bar
    { name: 'barbellData.barbells.standardGym', weight: 20, unit: 'kg', sleeveCm: 40 },
    { name: 'barbellData.barbells.standardGym', weight: 44, unit: 'lb', sleeveInch: 15.75 },

    // Specialty Bars (sleeves are typically shorter)
    { name: 'barbellData.barbells.ezCurl', weight: 10, unit: 'kg', sleeveCm: 17 },
    { name: 'barbellData.barbells.ezCurl', weight: 22, unit: 'lb', sleeveInch: 6.7 },
    { name: 'barbellData.barbells.tricep', weight: 10, unit: 'kg', sleeveCm: 17 },
    { name: 'barbellData.barbells.tricep', weight: 22, unit: 'lb', sleeveInch: 6.7 },
    { name: 'barbellData.barbells.trapHex', weight: 25, unit: 'kg', sleeveCm: 25 },
    { name: 'barbellData.barbells.trapHex', weight: 55, unit: 'lb', sleeveInch: 9.8 },
    // New barbell data
    {
      isOlympic: true,
      name: 'barbellData.barbells.olympic120',
      lengthCm: 120,
      weight: 7.4,
      unit: 'kg',
      sleeveCm: 17,
      maxLoadableWeightPerSideKg: 75,
    },
    {
      isOlympic: true,
      name: 'barbellData.barbells.olympic152',
      lengthCm: 152,
      weight: 11.3,
      unit: 'kg',
      sleeveCm: 27,
      maxLoadableWeightPerSideKg: 150,
    },
    {
      isOlympic: true,
      name: 'barbellData.barbells.olympic182',
      lengthCm: 182,
      weight: 13,
      unit: 'kg',
      sleeveCm: 32,
      maxLoadableWeightPerSideKg: 150,
    },
    {
      isOlympic: true,
      name: 'barbellData.barbells.olympic186',
      lengthCm: 186,
      weight: 14,
      unit: 'kg',
      sleeveCm: 25,
      maxLoadableWeightPerSideKg: 150,
    },
    {
      isOlympic: true,
      name: 'barbellData.barbells.olympic219',
      lengthCm: 219,
      weight: 20,
      unit: 'kg',
      sleeveCm: 40,
      maxLoadableWeightPerSideKg: 317.5,
    },
    // New barbell data - LB versions
    {
      isOlympic: true,
      name: 'barbellData.barbells.olympic47in', // Changed name for clarity in lb version
      lengthInch: 47.24,
      weight: 16.31,
      unit: 'lb',
      sleeveInch: 6.69,
      maxLoadableWeightPerSideLb: 165.35
    },
    {
      isOlympic: true,
      name: 'barbellData.barbells.olympic60in',
      lengthInch: 59.84,
      weight: 24.91,
      unit: 'lb',
      sleeveInch: 10.63,
      maxLoadableWeightPerSideLb: 330.69
    },
    {
      isOlympic: true,
      name: 'barbellData.barbells.olympic72in',
      lengthInch: 71.65,
      weight: 28.66,
      unit: 'lb',
      sleeveInch: 12.6,
      maxLoadableWeightPerSideLb: 330.69
    },
    {
      isOlympic: true,
      name: 'barbellData.barbells.olympic73in',
      lengthInch: 73.23,
      weight: 30.86,
      unit: 'lb',
      sleeveInch: 9.84,
      maxLoadableWeightPerSideLb: 330.69
    },
    {
      isOlympic: true,
      name: 'barbellData.barbells.olympic86in',
      lengthInch: 86.22,
      weight: 44.09,
      unit: 'lb',
      sleeveInch: 15.75,
      maxLoadableWeightPerSideLb: 700
    }
    // Adding the 'lb' versions for the new barbells if desired, for now keeping only 'kg' for simplicity.
    // If you need explicit 'lb' versions for these new barbells, you'd add them similarly.
  ];

  private collars: Collar[] = [
    { name: 'barbellData.collars.none', weight: 0, unit: 'kg' },
    { name: 'barbellData.collars.none', weight: 0, unit: 'lb' },
    { name: 'barbellData.collars.spring', weight: 0.5, unit: 'kg' },
    { name: "barbellData.collars.spring", "weight": 1.1, "unit": "lb" },
    { name: 'barbellData.collars.lockjaw', weight: 1, unit: 'kg' },
    { name: "barbellData.collars.lockjaw", "weight": 2.2, "unit": "lb" },
    { name: 'barbellData.collars.competition', weight: 5, unit: 'kg' },
    { name: "barbellData.collars.competition", "weight": 11, "unit": "lb" }
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