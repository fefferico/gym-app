// in a new file, e.g., muscles-data.ts

import { Muscle } from "../models/muscle.model";

export type MuscleValue =
  | 'core'
  | 'abs'
  | 'rectus-abdominis'
  | 'obliques'
  | 'transverse-abdominis'
  | 'finger-grip'
  | 'back'
  | 'lats'
  | 'traps'
  | 'traps-upper'
  | 'traps-middle'
  | 'traps-lower'
  | 'rhomboids'
  | 'lower-back'
  | 'erector-spinae'
  | 'upper-back'
  | 'legs'
  | 'lower-body'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'gluteus-medius'
  | 'gluteus-minimus'
  | 'calves'
  | 'adductors'
  | 'abductors'
  | 'hip-flexors'
  | 'hips'
  | 'piriformis'
  | 'tfl'
  | 'chest'
  | 'chest-upper'
  | 'chest-lower'
  | 'serratus-anterior'
  | 'arms'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'brachialis'
  | 'wrists'
  | 'shoulders'
  | 'anterior-deltoid'
  | 'lateral-deltoid'
  | 'posterior-deltoid'
  | 'rotator-cuff'
  | 'full-body'
  | 'upper-body'
  | 'posterior-chain'
  | 'cardio'
  | 'thigh'
  | 'ankle'
  | 'knee'
  | 'feet'
  | 'neck'
  | 'intercostals'
  | 'levator-scapulae'
  | 'teres-major'
  | 'teres-minor'
  | 'infraspinatus'
  | 'supraspinatus'
  | 'subscapularis'
  | 'sartorius'
  | 'popliteus'
  | 'plantaris'
  | 'soleus'
  | 'gastrocnemius'
  | 'rectus-femoris'
  | 'vastus-lateralis'
  | 'vastus-medialis'
  | 'vastus-intermedius'
  | 'semimembranosus'
  | 'semitendinosus'
  | 'biceps-femoris'
  | 'iliopsoas'
  | 'psoas-major'
  | 'iliacus'
  | 'tensor-fasciae-latae'
  | 'obturator-internus'
  | 'obturator-externus'
  | 'gemellus-superior'
  | 'gemellus-inferior'
  | 'quadratus-femoris'
  | 'gracilis'
  | 'pectineus'
  | 'adductor-longus'
  | 'adductor-brevis'
  | 'adductor-magnus'
  | 'sartorius'
  | 'palmaris-longus'
  | 'flexor-carpi-radialis'
  | 'flexor-carpi-ulnaris'
  | 'extensor-carpi-radialis'
  | 'extensor-carpi-ulnaris'
  | 'extensor-digitorum'
  | 'flexor-digitorum'
  | 'abductor-pollicis-longus'
  | 'extensor-pollicis-brevis'
  | 'extensor-pollicis-longus'
  | 'flexor-pollicis-longus'
  | 'thenar'
  | 'hypothenar'
  | 'lumbricals'
  | 'interossei'


export const MUSCLES_DATA: Muscle[] = [
  // Core
  { id: 'core', name: 'muscles.core', bodyPart: 'bodyParts.core' },
  { id: 'abs', name: 'muscles.abs', bodyPart: 'bodyParts.core' },
  { id: 'rectus-abdominis', name: 'muscles.rectusAbdominis', bodyPart: 'bodyParts.core' },
  { id: 'obliques', name: 'muscles.obliques', bodyPart: 'bodyParts.core' },
  { id: 'transverse-abdominis', name: 'muscles.transverseAbdominis', bodyPart: 'bodyParts.core' },

  // Back
  { id: 'back', name: 'muscles.back', bodyPart: 'bodyParts.back' },
  { id: 'lats', name: 'muscles.lats', bodyPart: 'bodyParts.back' },
  { id: 'traps', name: 'muscles.traps', bodyPart: 'bodyParts.back' },
  { id: 'traps-upper', name: 'muscles.trapsUpper', bodyPart: 'bodyParts.back' },
  { id: 'traps-middle', name: 'muscles.trapsMiddle', bodyPart: 'bodyParts.back' },
  { id: 'traps-lower', name: 'muscles.trapsLower', bodyPart: 'bodyParts.back' },
  { id: 'rhomboids', name: 'muscles.rhomboids', bodyPart: 'bodyParts.back' },
  { id: 'lower-back', name: 'muscles.lowerBack', bodyPart: 'bodyParts.back' },
  { id: 'erector-spinae', name: 'muscles.erectorSpinae', bodyPart: 'bodyParts.back' },
  { id: 'upper-back', name: 'muscles.upperBack', bodyPart: 'bodyParts.back' },

  // Legs
  { id: 'legs', name: 'muscles.legs', bodyPart: 'bodyParts.legs' },
  { id: 'lower-body', name: 'muscles.lowerBody', bodyPart: 'bodyParts.legs' },
  { id: 'quadriceps', name: 'muscles.quadriceps', bodyPart: 'bodyParts.legs' },
  { id: 'hamstrings', name: 'muscles.hamstrings', bodyPart: 'bodyParts.legs' },
  { id: 'glutes', name: 'muscles.glutes', bodyPart: 'bodyParts.legs' },
  { id: 'gluteus-medius', name: 'muscles.gluteusMedius', bodyPart: 'bodyParts.legs' },
  { id: 'gluteus-minimus', name: 'muscles.gluteusMinimus', bodyPart: 'bodyParts.legs' },
  { id: 'calves', name: 'muscles.calves', bodyPart: 'bodyParts.legs' },
  { id: 'adductors', name: 'muscles.adductors', bodyPart: 'bodyParts.legs' },
  { id: 'abductors', name: 'muscles.abductors', bodyPart: 'bodyParts.legs' },
  { id: 'hip-flexors', name: 'muscles.hipFlexors', bodyPart: 'bodyParts.legs' },
  { id: 'hips', name: 'muscles.hips', bodyPart: 'bodyParts.legs' },
  { id: 'piriformis', name: 'muscles.piriformis', bodyPart: 'bodyParts.legs' },
  { id: 'tfl', name: 'muscles.tfl', bodyPart: 'bodyParts.legs' },
  { id: 'thigh', name: 'muscles.thigh', bodyPart: 'bodyParts.legs' },
  { id: 'ankle', name: 'muscles.ankle', bodyPart: 'bodyParts.legs' },
  { id: 'knee', name: 'muscles.knee', bodyPart: 'bodyParts.legs' },
  { id: 'feet', name: 'muscles.feet', bodyPart: 'bodyParts.legs' },

  // Chest
  { id: 'chest', name: 'muscles.chest', bodyPart: 'bodyParts.chest' },
  { id: 'chest-upper', name: 'muscles.chestUpper', bodyPart: 'bodyParts.chest' },
  { id: 'chest-lower', name: 'muscles.chestLower', bodyPart: 'bodyParts.chest' },
  { id: 'serratus-anterior', name: 'muscles.serratusAnterior', bodyPart: 'bodyParts.chest' },
  { id: 'upper-body', name: 'muscles.upperBody', bodyPart: 'bodyParts.chest' },

  // Arms
  { id: 'arms', name: 'muscles.arms', bodyPart: 'bodyParts.arms' },
  { id: 'biceps', name: 'muscles.biceps', bodyPart: 'bodyParts.arms' },
  { id: 'triceps', name: 'muscles.triceps', bodyPart: 'bodyParts.arms' },
  { id: 'forearms', name: 'muscles.forearms', bodyPart: 'bodyParts.arms' },
  { id: 'brachialis', name: 'muscles.brachialis', bodyPart: 'bodyParts.arms' },
  { id: 'wrists', name: 'muscles.wrists', bodyPart: 'bodyParts.arms' },
  { id: 'finger-grip', name: 'muscles.fingerGrip', bodyPart: 'bodyParts.arms' },

  // Shoulders
  { id: 'shoulders', name: 'muscles.shoulders', bodyPart: 'bodyParts.shoulders' },
  { id: 'anterior-deltoid', name: 'muscles.anteriorDeltoid', bodyPart: 'bodyParts.shoulders' },
  { id: 'lateral-deltoid', name: 'muscles.lateralDeltoid', bodyPart: 'bodyParts.shoulders' },
  { id: 'posterior-deltoid', name: 'muscles.posteriorDeltoid', bodyPart: 'bodyParts.shoulders' },
  { id: 'rotator-cuff', name: 'muscles.rotatorCuff', bodyPart: 'bodyParts.shoulders' },

  // Other/Full Body
  { id: 'full-body', name: 'muscles.fullBody', bodyPart: 'bodyParts.fullBody' },
  { id: 'posterior-chain', name: 'muscles.posteriorChain', bodyPart: 'bodyParts.fullBody' },
  { id: 'cardio', name: 'muscles.cardio', bodyPart: 'bodyParts.fullBody' },
  
  // Neck
  { id: 'neck', name: 'muscles.neck', bodyPart: 'bodyParts.neck' },


  { id: 'intercostals', name: 'muscles.intercostals', bodyPart: 'bodyParts.neck' },
  { id: 'levator-scapulae', name: 'muscles.levatorScapulae', bodyPart: 'bodyParts.neck' },
  { id: 'teres-major', name: 'muscles.teresMajor', bodyPart: 'bodyParts.neck' },
  { id: 'teres-minor', name: 'muscles.teresMinor', bodyPart: 'bodyParts.neck' },
  { id: 'infraspinatus', name: 'muscles.infraspinatus', bodyPart: 'bodyParts.neck' },
  { id: 'supraspinatus', name: 'muscles.supraspinatus', bodyPart: 'bodyParts.neck' },
  { id: 'subscapularis', name: 'muscles.subscapularis', bodyPart: 'bodyParts.neck' },
  
];