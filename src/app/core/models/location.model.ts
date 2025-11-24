// location.interfaces.ts
import { LocationCategory, SpecificLocation, SpaceSize, SurfaceType } from './location.enums';

// 1. The Static Configuration (Stores Keys)
export interface LocationConfig {
  id: string;
  translationKey: string; // e.g., "LOCATIONS.SPECIFIC.LIVING_ROOM"
  category: LocationCategory;
  specificType: SpecificLocation;
  attributes: LocationAttributes;
}

// 2. The Hydrated Object (Stores Text)
export interface WorkoutLocation extends Omit<LocationConfig, 'translationKey'> {
  label: string;       // e.g., "Living Room" or "Soggiorno"
  categoryLabel: string; // e.g., "Residential" or "Residenziale"
}

export interface LocationAttributes {
  isIndoors: boolean;
  surface: SurfaceType;
  space: SpaceSize;
  allowsNoise: boolean;
  allowsJumping: boolean;
  hasPullUpBar: boolean;
  equipmentTier: 'NONE' | 'LIMITED' | 'FULL';
}