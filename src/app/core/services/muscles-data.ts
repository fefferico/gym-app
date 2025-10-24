// in a new file, e.g., muscles-data.ts

import { Muscle } from "../models/muscle.model";

export type MuscleValue =
  | 'core'
  | 'rectusAbdominis'
  | 'obliques'
  | 'transverseAbdominis'
  | 'back'
  | 'lats'
  | 'traps'
  | 'trapsUpper'
  | 'trapsMiddle'
  | 'trapsLower'
  | 'rhomboids'
  | 'lowerBack'
  | 'erectorSpinae'
  | 'upperBack'
  | 'legs'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'gluteusMedius'
  | 'gluteusMinimus'
  | 'calves'
  | 'adductors'
  | 'abductors'
  | 'hipFlexors'
  | 'hips'
  | 'piriformis'
  | 'tfl'
  | 'chest'
  | 'chestUpper'
  | 'chestLower'
  | 'serratusAnterior'
  | 'arms'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'brachialis'
  | 'wrists'
  | 'shoulders'
  | 'anteriorDeltoid'
  | 'lateralDeltoid'
  | 'posteriorDeltoid'
  | 'rotatorCuff'
  | 'fullBody'
  | 'posteriorChain'
  | 'cardio'
  | 'neck';


export const MUSCLES_DATA: Muscle[] = [
  // Core
  { id: 'core', name: 'Core', bodyPart: 'Core' },
  { id: 'rectusAbdominis', name: 'Abs (Rectus Abdominis)', bodyPart: 'Core' },
  { id: 'obliques', name: 'Obliques', bodyPart: 'Core' },
  { id: 'transverseAbdominis', name: 'Transverse Abdominis', bodyPart: 'Core' },

  // Back
  { id: 'back', name: 'Back', bodyPart: 'Back' },
  { id: 'lats', name: 'Lats', bodyPart: 'Back' },
  { id: 'traps', name: 'Traps', bodyPart: 'Back' },
  { id: 'trapsUpper', name: 'Upper Traps', bodyPart: 'Back' },
  { id: 'trapsMiddle', name: 'Middle Traps', bodyPart: 'Back' },
  { id: 'trapsLower', name: 'Lower Traps', bodyPart: 'Back' },
  { id: 'rhomboids', name: 'Rhomboids', bodyPart: 'Back' },
  { id: 'lowerBack', name: 'Lower Back', bodyPart: 'Back' },
  { id: 'erectorSpinae', name: 'Erector Spinae', bodyPart: 'Back' },
  { id: 'upperBack', name: 'Upper Back', bodyPart: 'Back' },

  // Legs
  { id: 'legs', name: 'Legs', bodyPart: 'Legs' },
  { id: 'quadriceps', name: 'Quadriceps', bodyPart: 'Legs' },
  { id: 'hamstrings', name: 'Hamstrings', bodyPart: 'Legs' },
  { id: 'glutes', name: 'Glutes', bodyPart: 'Legs' },
  { id: 'gluteusMedius', name: 'Gluteus Medius', bodyPart: 'Legs' },
  { id: 'gluteusMinimus', name: 'Gluteus Minimus', bodyPart: 'Legs' },
  { id: 'calves', name: 'Calves', bodyPart: 'Legs' },
  { id: 'adductors', name: 'Adductors', bodyPart: 'Legs' },
  { id: 'abductors', name: 'Abductors', bodyPart: 'Legs' },
  { id: 'hipFlexors', name: 'Hip Flexors', bodyPart: 'Legs' },
  { id: 'hips', name: 'Hips', bodyPart: 'Legs' },
  { id: 'piriformis', name: 'Piriformis', bodyPart: 'Legs' },
  { id: 'tfl', name: 'Tensor Fasciae Latae', bodyPart: 'Legs' },

  // Chest
  { id: 'chest', name: 'Chest', bodyPart: 'Chest' },
  { id: 'chestUpper', name: 'Upper Chest', bodyPart: 'Chest' },
  { id: 'chestLower', name: 'Lower Chest', bodyPart: 'Chest' },
  { id: 'serratusAnterior', name: 'Serratus Anterior', bodyPart: 'Chest' },

  // Arms
  { id: 'arms', name: 'Arms', bodyPart: 'Arms' },
  { id: 'biceps', name: 'Biceps', bodyPart: 'Arms' },
  { id: 'triceps', name: 'Triceps', bodyPart: 'Arms' },
  { id: 'forearms', name: 'Forearms', bodyPart: 'Arms' },
  { id: 'brachialis', name: 'Brachialis', bodyPart: 'Arms' },
  { id: 'wrists', name: 'Wrists', bodyPart: 'Arms' },

  // Shoulders
  { id: 'shoulders', name: 'Shoulders', bodyPart: 'Shoulders' },
  { id: 'anteriorDeltoid', name: 'Anterior Deltoid', bodyPart: 'Shoulders' },
  { id: 'lateralDeltoid', name: 'Lateral Deltoid', bodyPart: 'Shoulders' },
  { id: 'posteriorDeltoid', name: 'Posterior Deltoid', bodyPart: 'Shoulders' },
  { id: 'rotatorCuff', name: 'Rotator Cuff', bodyPart: 'Shoulders' },

  // Other/Full Body
  { id: 'fullBody', name: 'Full Body', bodyPart: 'Full Body' },
  { id: 'posteriorChain', name: 'Posterior Chain', bodyPart: 'Full Body' },
  { id: 'cardio', name: 'Cardiovascular System', bodyPart: 'Full Body' },
  { id: 'neck', name: 'Neck', bodyPart: 'Neck' }
];