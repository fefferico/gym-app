// src/app/core/models/user-profile.model.ts
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface UserMeasurements {
  height?: number | null;
  weight?: number | null;
  // Body measurements (optional, in cm or inches based on user preference - store in a consistent unit like cm)
  chest?: number | null;
  waist?: number | null;
  neck?: number | null;
  hips?: number | null;
  rightArm?: number | null;
  leftArm?: number | null;
  rightThigh?: number | null;
  leftThigh?: number | null;
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
  height?: number | null; // <-- MOVED height here, it's a profile constant
  measurementGoals?: Partial<UserMeasurements>; // <-- ADDED for goal setting
}