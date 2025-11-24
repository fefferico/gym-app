// src/app/core/models/personal-gym.model.ts

import { Equipment, EquipmentCategory, EquipmentValue } from "../services/equipment-data";

// --- ENUMS AND TYPES (Unchanged) ---

export type WeightType = 'fixed' | 'adjustable';
export type BandType = 'loop' | 'mini-loop' | 'handled' | 'therapy';
export type MachineLoadType = 'stack' | 'plate-loaded' | 'bodyweight';

// --- BASE INTERFACE (Unchanged) ---
export interface BaseEquipment extends Equipment {
  id: EquipmentValue;
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
  category: EquipmentCategory.dumbbell | EquipmentCategory.kettlebell | EquipmentCategory.macebell | EquipmentCategory.club;
  weightType: 'fixed';
  weight: number;
}

export interface AdjustableWeightEquipment extends BaseEquipment {
  category: EquipmentCategory.dumbbell | EquipmentCategory.kettlebell | EquipmentCategory.macebell | EquipmentCategory.club;
  weightType: 'adjustable';
  minweight: number;
  maxweight: number;
  increment: number;
}

export type PlateType = 'bumper' | 'iron' | 'standard' | 'olympic';

export interface WeightPlate extends BaseEquipment {
  category: EquipmentCategory.plate;
  weight: number;
  type: PlateType;
  color: string;
}

export interface Barbell extends BaseEquipment {
  category: EquipmentCategory.barbell;
  weight: number;
  barType?: 'olympic' | 'standard' | 'ez-curl' | 'hex' | 'swiss' | 'custom';
}

export interface Sandbag extends BaseEquipment {
  category: EquipmentCategory.bag;
  maxweight: number;
  isFilled: boolean;
  currentWeightKg?: number;
}

export interface ResistanceBand extends BaseEquipment {
  category: EquipmentCategory.band;
  bandType: BandType;
  resistanceLevel?: 'extra-light' | 'light' | 'medium' | 'heavy' | 'extra-heavy';
  resistance?: number;
  color?: string;
  length?: number;
}

export interface Machine extends BaseEquipment {
  category: EquipmentCategory.machine;
  loadType: MachineLoadType;
  maxLoad?: number;
}

export interface Accessory extends BaseEquipment {
  category: EquipmentCategory.accessory;
  isAdjustable?: boolean;
}

export interface CardioEquipment extends BaseEquipment {
  category: EquipmentCategory.cardio;
}

export interface CustomEquipment extends BaseEquipment {
  category: EquipmentCategory.custom;
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