// src/app/core/models/personal-gym.model.ts

// --- ENUMS AND TYPES (Unchanged) ---
export type EquipmentCategory =
  | 'Dumbbell' | 'Kettlebell' | 'Plate' | 'Barbell' | 'Band' | 'Machine'
  | 'Accessory' | 'Bag' | 'Macebell' | 'Club' | 'Cardio' | 'Custom';
export type WeightType = 'fixed' | 'adjustable';
export type BandType = 'loop' | 'mini-loop' | 'handled' | 'therapy';
export type MachineLoadType = 'stack' | 'plate-loaded' | 'bodyweight';

// --- BASE INTERFACE (Unchanged) ---
export interface BaseEquipment {
  id: string;
  category: EquipmentCategory;
  name: string;
  quantity: number;
  isHidden?: boolean;
  notes?: string;
  brand?: string;
  purchaseDate?: string;
  unit: 'kg' | 'lb'
}

// ==========================================================
// START: THE CORE FIX - FLATTENING THE UNION
// ==========================================================

// --- SPECIFIC, UNAMBIGUOUS INTERFACES ---

export interface FixedWeightEquipment extends BaseEquipment {
  category: 'Dumbbell' | 'Kettlebell' | 'Macebell' | 'Club';
  weightType: 'fixed';
  weight: number;
}

export interface AdjustableWeightEquipment extends BaseEquipment {
  category: 'Dumbbell' | 'Kettlebell' | 'Macebell' | 'Club';
  weightType: 'adjustable';
  minweight: number;
  maxweight: number;
  increment: number;
}

export interface WeightPlate extends BaseEquipment {
  category: 'Plate';
  weight: number;
  isOlympic: boolean;
  color: string;
}

export interface Barbell extends BaseEquipment {
  category: 'Barbell';
  weight: number;
  barType?: 'olympic' | 'standard' | 'ez-curl' | 'hex' | 'swiss' | 'custom';
}

export interface Sandbag extends BaseEquipment {
  category: 'Bag';
  maxweight: number;
  isFilled: boolean;
  currentWeightKg?: number;
}

export interface ResistanceBand extends BaseEquipment {
  category: 'Band';
  bandType: BandType;
  resistanceLevel?: 'extra-light' | 'light' | 'medium' | 'heavy' | 'extra-heavy';
  resistance?: number;
  color?: string;
  length?: number;
}

export interface Machine extends BaseEquipment {
  category: 'Machine';
  loadType: MachineLoadType;
  maxLoad?: number;
}

export interface Accessory extends BaseEquipment {
  category: 'Accessory';
  isAdjustable?: boolean;
}

export interface CardioEquipment extends BaseEquipment {
  category: 'Cardio';
}

export interface CustomEquipment extends BaseEquipment {
  category: 'Custom';
  customCategoryName: string;
  properties: {
    key: string;
    value: string | number;
  }[];
}

/**
 * A flattened union of all possible equipment types.
 * The 'SelectableWeightEquipment' union has been removed, and its members
 * are now first-class citizens of this main union type.
 */
export type PersonalGymEquipment =
  | FixedWeightEquipment      // <-- Now a direct member
  | AdjustableWeightEquipment // <-- Now a direct member
  | WeightPlate
  | Barbell
  | Sandbag
  | ResistanceBand
  | Machine
  | Accessory
  | CardioEquipment
  | CustomEquipment;

// ==========================================================
// END: THE CORE FIX
// ==========================================================