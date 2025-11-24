// location.data.ts
import { LocationCategory, SpecificLocation, SurfaceType, SpaceSize } from './location.enums';
import { LocationConfig } from './location.model';

// Helper to create config
const createConf = (
  id: string, 
  translationKey: string, 
  category: LocationCategory, 
  type: SpecificLocation, 
  attrs: any
): LocationConfig => ({
  id,
  translationKey, // We store the key 'LOCATIONS.LIVING_ROOM'
  category,
  specificType: type,
  attributes: {
    isIndoors: true, 
    surface: SurfaceType.HARD, 
    space: SpaceSize.MODERATE, 
    allowsNoise: true, 
    allowsJumping: true, 
    hasPullUpBar: false, 
    equipmentTier: 'NONE', 
    ...attrs
  }
});

export const LOCATION_CONFIGS: LocationConfig[] = [
  // ==========================
  // 1. RESIDENTIAL (HOME)
  // ==========================
  createConf('res-living', 'LOCATIONS.SPECIFIC.LIVING_ROOM', LocationCategory.RESIDENTIAL, SpecificLocation.LIVING_ROOM, {
    surface: SurfaceType.SOFT, // Rugs/Carpet
    space: SpaceSize.MODERATE,
    equipmentTier: 'LIMITED'
  }),
  createConf('res-bed', 'LOCATIONS.SPECIFIC.BEDROOM', LocationCategory.RESIDENTIAL, SpecificLocation.BEDROOM, {
    surface: SurfaceType.SOFT,
    space: SpaceSize.TIGHT,
    allowsNoise: false, // Sleep hygiene/neighbors
    allowsJumping: false,
    equipmentTier: 'NONE'
  }),
  createConf('res-garage', 'LOCATIONS.SPECIFIC.GARAGE_GYM', LocationCategory.RESIDENTIAL, SpecificLocation.GARAGE_GYM, {
    surface: SurfaceType.HARD, // Concrete
    space: SpaceSize.MODERATE,
    allowsNoise: true, // Drop weights!
    equipmentTier: 'FULL',
    hasPullUpBar: true
  }),
  createConf('res-garden', 'LOCATIONS.SPECIFIC.BACKYARD', LocationCategory.RESIDENTIAL, SpecificLocation.BACKYARD, {
    isIndoors: false,
    surface: SurfaceType.SOFT, // Grass
    space: SpaceSize.OPEN,
    allowsNoise: true
  }),
  createConf('res-balcony', 'LOCATIONS.SPECIFIC.BALCONY', LocationCategory.RESIDENTIAL, SpecificLocation.BALCONY, {
    isIndoors: false,
    surface: SurfaceType.HARD,
    space: SpaceSize.TIGHT, // Very limited
    allowsJumping: false // Safety/Noise
  }),

  // ==========================
  // 2. COMMERCIAL FACILITIES
  // ==========================
  createConf('com-bigbox', 'LOCATIONS.SPECIFIC.COMMERCIAL_GYM', LocationCategory.COMMERCIAL, SpecificLocation.COMMERCIAL_GYM, {
    surface: SurfaceType.RUBBER,
    space: SpaceSize.OPEN,
    equipmentTier: 'FULL',
    hasPullUpBar: true
  }),
  createConf('com-crossfit', 'LOCATIONS.SPECIFIC.CROSSFIT_BOX', LocationCategory.COMMERCIAL, SpecificLocation.CROSSFIT_BOX, {
    surface: SurfaceType.RUBBER,
    space: SpaceSize.OPEN,
    equipmentTier: 'FULL',
    allowsNoise: true, // Grunting allowed
    hasPullUpBar: true
  }),
  createConf('com-yoga', 'LOCATIONS.SPECIFIC.BOUTIQUE_STUDIO', LocationCategory.COMMERCIAL, SpecificLocation.BOUTIQUE_STUDIO, {
    surface: SurfaceType.HARD, // Wood floors
    space: SpaceSize.MODERATE,
    allowsNoise: false, // Zen environment
    equipmentTier: 'LIMITED' // Blocks/Straps only
  }),

  // ==========================
  // 3. OUTDOOR & PUBLIC
  // ==========================
  createConf('out-park', 'LOCATIONS.SPECIFIC.PUBLIC_PARK', LocationCategory.OUTDOOR, SpecificLocation.PUBLIC_PARK, {
    isIndoors: false,
    surface: SurfaceType.SOFT, // Grass
    space: SpaceSize.OPEN,
    equipmentTier: 'NONE'
  }),
  createConf('out-cali', 'LOCATIONS.SPECIFIC.CALISTHENICS_PARK', LocationCategory.OUTDOOR, SpecificLocation.CALISTHENICS_PARK, {
    isIndoors: false,
    surface: SurfaceType.RUBBER,
    space: SpaceSize.OPEN,
    hasPullUpBar: true,
    equipmentTier: 'NONE'
  }),
  createConf('out-track', 'LOCATIONS.SPECIFIC.RUNNING_TRACK', LocationCategory.OUTDOOR, SpecificLocation.RUNNING_TRACK, {
    isIndoors: false,
    surface: SurfaceType.RUBBER,
    space: SpaceSize.OPEN
  }),
  createConf('out-trail', 'LOCATIONS.SPECIFIC.TRAIL', LocationCategory.OUTDOOR, SpecificLocation.TRAIL, {
    isIndoors: false,
    surface: SurfaceType.UNEVEN, // Dirt/Roots
    space: SpaceSize.OPEN
  }),
  createConf('out-beach', 'LOCATIONS.SPECIFIC.BEACH', LocationCategory.OUTDOOR, SpecificLocation.BEACH, {
    isIndoors: false,
    surface: SurfaceType.UNEVEN, // Sand (High resistance)
    space: SpaceSize.OPEN
  }),

  // ==========================
  // 4. TRAVEL & HOSPITALITY
  // ==========================
  createConf('trv-hotel-rm', 'LOCATIONS.SPECIFIC.HOTEL_ROOM', LocationCategory.TRAVEL, SpecificLocation.HOTEL_ROOM, {
    surface: SurfaceType.SOFT, // Carpet
    space: SpaceSize.TIGHT,
    allowsNoise: false, // Guests next door
    allowsJumping: false,
    equipmentTier: 'NONE'
  }),
  createConf('trv-hotel-gym', 'LOCATIONS.SPECIFIC.HOTEL_GYM', LocationCategory.TRAVEL, SpecificLocation.HOTEL_GYM, {
    surface: SurfaceType.RUBBER,
    space: SpaceSize.MODERATE,
    equipmentTier: 'LIMITED' // Usually dumbbells only, no squat racks
  }),

  // ==========================
  // 5. CORPORATE
  // ==========================
  createConf('corp-office', 'LOCATIONS.SPECIFIC.OFFICE_CUBICLE', LocationCategory.CORPORATE, SpecificLocation.OFFICE_CUBICLE, {
    surface: SurfaceType.HARD,
    space: SpaceSize.TIGHT,
    allowsNoise: false,
    allowsJumping: false,
    equipmentTier: 'NONE'
  }),

  // ==========================
  // 6. AQUATIC
  // ==========================
  createConf('aq-pool-in', 'LOCATIONS.SPECIFIC.INDOOR_POOL', LocationCategory.AQUATIC, SpecificLocation.INDOOR_POOL, {
    surface: SurfaceType.WATER,
    space: SpaceSize.OPEN,
    allowsNoise: true,
    equipmentTier: 'NONE'
  })
];