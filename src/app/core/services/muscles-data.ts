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
  | 'thigh'
  | 'ankle'
  | 'neck';


export const MUSCLES_DATA: Muscle[] = [
  // Core
  { id: 'core', name: 'muscles.core', bodyPart: 'bodyParts.core' },
  { id: 'rectusAbdominis', name: 'muscles.rectusAbdominis', bodyPart: 'bodyParts.core' },
  { id: 'obliques', name: 'muscles.obliques', bodyPart: 'bodyParts.core' },
  { id: 'transverseAbdominis', name: 'muscles.transverseAbdominis', bodyPart: 'bodyParts.core' },

  // Back
  { id: 'back', name: 'muscles.back', bodyPart: 'bodyParts.back' },
  { id: 'lats', name: 'muscles.lats', bodyPart: 'bodyParts.back' },
  { id: 'traps', name: 'muscles.traps', bodyPart: 'bodyParts.back' },
  { id: 'trapsUpper', name: 'muscles.trapsUpper', bodyPart: 'bodyParts.back' },
  { id: 'trapsMiddle', name: 'muscles.trapsMiddle', bodyPart: 'bodyParts.back' },
  { id: 'trapsLower', name: 'muscles.trapsLower', bodyPart: 'bodyParts.back' },
  { id: 'rhomboids', name: 'muscles.rhomboids', bodyPart: 'bodyParts.back' },
  { id: 'lowerBack', name: 'muscles.lowerBack', bodyPart: 'bodyParts.back' },
  { id: 'erectorSpinae', name: 'muscles.erectorSpinae', bodyPart: 'bodyParts.back' },
  { id: 'upperBack', name: 'muscles.upperBack', bodyPart: 'bodyParts.back' },

  // Legs
  { id: 'legs', name: 'muscles.legs', bodyPart: 'bodyParts.legs' },
  { id: 'quadriceps', name: 'muscles.quadriceps', bodyPart: 'bodyParts.legs' },
  { id: 'hamstrings', name: 'muscles.hamstrings', bodyPart: 'bodyParts.legs' },
  { id: 'glutes', name: 'muscles.glutes', bodyPart: 'bodyParts.legs' },
  { id: 'gluteusMedius', name: 'muscles.gluteusMedius', bodyPart: 'bodyParts.legs' },
  { id: 'gluteusMinimus', name: 'muscles.gluteusMinimus', bodyPart: 'bodyParts.legs' },
  { id: 'calves', name: 'muscles.calves', bodyPart: 'bodyParts.legs' },
  { id: 'adductors', name: 'muscles.adductors', bodyPart: 'bodyParts.legs' },
  { id: 'abductors', name: 'muscles.abductors', bodyPart: 'bodyParts.legs' },
  { id: 'hipFlexors', name: 'muscles.hipFlexors', bodyPart: 'bodyParts.legs' },
  { id: 'hips', name: 'muscles.hips', bodyPart: 'bodyParts.legs' },
  { id: 'piriformis', name: 'muscles.piriformis', bodyPart: 'bodyParts.legs' },
  { id: 'tfl', name: 'muscles.tfl', bodyPart: 'bodyParts.legs' },
  { id: 'thigh', name: 'muscles.thigh', bodyPart: 'bodyParts.legs' },
  { id: 'ankle', name: 'muscles.ankle', bodyPart: 'bodyParts.legs' },

  // Chest
  { id: 'chest', name: 'muscles.chest', bodyPart: 'bodyParts.chest' },
  { id: 'chestUpper', name: 'muscles.chestUpper', bodyPart: 'bodyParts.chest' },
  { id: 'chestLower', name: 'muscles.chestLower', bodyPart: 'bodyParts.chest' },
  { id: 'serratusAnterior', name: 'muscles.serratusAnterior', bodyPart: 'bodyParts.chest' },

  // Arms
  { id: 'arms', name: 'muscles.arms', bodyPart: 'bodyParts.arms' },
  { id: 'biceps', name: 'muscles.biceps', bodyPart: 'bodyParts.arms' },
  { id: 'triceps', name: 'muscles.triceps', bodyPart: 'bodyParts.arms' },
  { id: 'forearms', name: 'muscles.forearms', bodyPart: 'bodyParts.arms' },
  { id: 'brachialis', name: 'muscles.brachialis', bodyPart: 'bodyParts.arms' },
  { id: 'wrists', name: 'muscles.wrists', bodyPart: 'bodyParts.arms' },

  // Shoulders
  { id: 'shoulders', name: 'muscles.shoulders', bodyPart: 'bodyParts.shoulders' },
  { id: 'anteriorDeltoid', name: 'muscles.anteriorDeltoid', bodyPart: 'bodyParts.shoulders' },
  { id: 'lateralDeltoid', name: 'muscles.lateralDeltoid', bodyPart: 'bodyParts.shoulders' },
  { id: 'posteriorDeltoid', name: 'muscles.posteriorDeltoid', bodyPart: 'bodyParts.shoulders' },
  { id: 'rotatorCuff', name: 'muscles.rotatorCuff', bodyPart: 'bodyParts.shoulders' },

  // Other/Full Body
  { id: 'fullBody', name: 'muscles.fullBody', bodyPart: 'bodyParts.fullBody' },
  { id: 'posteriorChain', name: 'muscles.posteriorChain', bodyPart: 'bodyParts.fullBody' },
  { id: 'cardio', name: 'muscles.cardio', bodyPart: 'bodyParts.fullBody' },
  
  // Neck
  { id: 'neck', name: 'muscles.neck', bodyPart: 'bodyParts.neck' }
];