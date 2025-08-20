// src/app/core/models/user-profile.model.ts
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface UserMeasurements {
  heightCm?: number | null;
  weightKg?: number | null;
  // Body measurements (optional, in cm or inches based on user preference - store in a consistent unit like cm)
  chestCm?: number | null;
  waistCm?: number | null;
  neckCm?: number | null;
  hipsCm?: number | null;
  rightArmCm?: number | null;
  leftArmCm?: number | null;
  rightThighCm?: number | null;
  leftThighCm?: number | null;
}

export interface MeasurementEntry extends UserMeasurements {
  date: string; // ISO 8601 format: "YYYY-MM-DD"
  // You can add more fields here later, like photos or notes
  // photoId?: string; // An ID to link to a photo stored in IndexedDB
  notes?: string;
}

export interface UserProfile {
  username?: string | null;
  gender?: Gender | null;
  age?: Gender | null;
  measurements?: UserMeasurements;
  hideWipDisclaimer?: boolean;
  measurementHistory?: MeasurementEntry[];
  // You can add more profile-specific fields here like fitness goals, experience level, etc.
  heightCm?: number | null; // <-- MOVED height here, it's a profile constant
  measurementGoals?: Partial<UserMeasurements>; // <-- ADDED for goal setting
}