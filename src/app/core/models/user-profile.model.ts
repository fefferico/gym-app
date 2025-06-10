// src/app/core/models/user-profile.model.ts
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface UserMeasurements {
  heightCm?: number | null;
  weightKg?: number | null;
  age?: number | null;
  // Body measurements (optional, in cm or inches based on user preference - store in a consistent unit like cm)
  chestCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  rightArmCm?: number | null;
  leftArmCm?: number | null;
  rightThighCm?: number | null;
  leftThighCm?: number | null;
  // Add more as needed
}

export interface UserProfile {
  username?: string | null;
  gender?: Gender | null;
  measurements?: UserMeasurements;
  // You can add more profile-specific fields here like fitness goals, experience level, etc.
}