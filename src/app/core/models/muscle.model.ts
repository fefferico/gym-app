import { MuscleValue } from "../services/muscles-data";

export interface Muscle {
  id: MuscleValue; // Unique identifier (e.g., UUID or a slug like 'push-up')
  name: string;
  bodyPart: string;
}