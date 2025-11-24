// in a new file, e.g., muscles-data.ts

import { Muscle } from "../models/muscle.model";

export type MuscleValue =
  | 'abductors'
  | 'abs'
  | 'adductors'
  | 'adductorBrevis'
  | 'adductorLongus'
  | 'adductorMagnus'
  | 'deltoidAnterior'
  | 'ankle'
  | 'arms'
  | 'back'
  | 'biceps'
  | 'bicepsFemoris'
  | 'brachialis'
  | 'calves'
  | 'cardio'
  | 'chest'
  | 'chestLower'
  | 'chestUpper'
  | 'core'
  | 'erectorSpinae'
  | 'extensorCarpiRadialis'
  | 'extensorCarpiUlnaris'
  | 'extensorDigitorum'
  | 'extensorPollicisBrevis'
  | 'extensorPollicisLongus'
  | 'feet'
  | 'fingerGrip'
  | 'flexorCarpiRadialis'
  | 'flexorCarpiUlnaris'
  | 'flexorDigitorum'
  | 'flexorPollicisLongus'
  | 'forearms'
  | 'fullBody'
  | 'gastrocnemius'
  | 'gemellusInferior'
  | 'gemellusSuperior'
  | 'gluteusMedius'
  | 'gluteusMinimus'
  | 'glutes'
  | 'gracilis'
  | 'groin'
  | 'hamstrings'
  | 'hipFlexors'
  | 'hips'
  | 'hypothenar'
  | 'iliacus'
  | 'iliopsoas'
  | 'infraspinatus'
  | 'intercostals'
  | 'interossei'
  | 'knee'
  | 'deltoidLateral'
  | 'lats'
  | 'legs'
  | 'levatorScapulae'
  | 'backLower'
  | 'lowerBody'
  | 'lumbricals'
  | 'muscles'
  | 'neck'
  | 'obliques'
  | 'obturatorExternus'
  | 'obturatorInternus'
  | 'palmarisLongus'
  | 'pectineus'
  | 'piriformis'
  | 'plantaris'
  | 'popliteus'
  | 'posteriorChain'
  | 'deltoidPosterior'
  | 'psoasMajor'
  | 'quadratusFemoris'
  | 'quadriceps'
  | 'rectusAbdominis'
  | 'rectusFemoris'
  | 'rhomboids'
  | 'rotatorCuff'
  | 'sartorius'
  | 'semimembranosus'
  | 'semitendinosus'
  | 'serratusAnterior'
  | 'shoulders'
  | 'soleus'
  | 'subscapularis'
  | 'supraspinatus'
  | 'tfl'
  | 'teresMajor'
  | 'teresMinor'
  | 'thenar'
  | 'thigh'
  | 'traps'
  | 'trapsLower'
  | 'trapsMiddle'
  | 'trapsUpper'
  | 'triceps'
  | 'transverseAbdominis'
  | 'backUpper'
  | 'upperBody'
  | 'vastusIntermedius'
  | 'vastusLateralis'
  | 'vastusMedialis'
  | 'wrists'


export const MUSCLES_DATA: Muscle[] = [
  // Core
  { id: 'core', name: 'muscles.core', bodyPart: 'bodyParts.core' },
  { id: 'abs', name: 'muscles.abs', bodyPart: 'bodyParts.core' },
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
  { id: 'backLower', name: 'muscles.backLower', bodyPart: 'bodyParts.back' },
  { id: 'erectorSpinae', name: 'muscles.erectorSpinae', bodyPart: 'bodyParts.back' },
  { id: 'backUpper', name: 'muscles.backUpper', bodyPart: 'bodyParts.back' },

  // Legs
  { id: 'legs', name: 'muscles.legs', bodyPart: 'bodyParts.legs' },
  { id: 'lowerBody', name: 'muscles.lowerBody', bodyPart: 'bodyParts.legs' },
  { id: 'quadriceps', name: 'muscles.quadriceps', bodyPart: 'bodyParts.legs' },
  { id: 'hamstrings', name: 'muscles.hamstrings', bodyPart: 'bodyParts.legs' },
  { id: 'glutes', name: 'muscles.glutes', bodyPart: 'bodyParts.legs' },
  { id: 'gluteusMedius', name: 'muscles.gluteusMedius', bodyPart: 'bodyParts.legs' },
  { id: 'gluteusMinimus', name: 'muscles.gluteusMinimus', bodyPart: 'bodyParts.legs' },
  { id: 'groin', name: 'muscles.groin', bodyPart: 'bodyParts.legs' },
  { id: 'calves', name: 'muscles.calves', bodyPart: 'bodyParts.legs' },
  { id: 'adductors', name: 'muscles.adductors', bodyPart: 'bodyParts.legs' },
  { id: 'abductors', name: 'muscles.abductors', bodyPart: 'bodyParts.legs' },
  { id: 'hipFlexors', name: 'muscles.hipFlexors', bodyPart: 'bodyParts.legs' },
  { id: 'hips', name: 'muscles.hips', bodyPart: 'bodyParts.legs' },
  { id: 'piriformis', name: 'muscles.piriformis', bodyPart: 'bodyParts.legs' },
  { id: 'tfl', name: 'muscles.tfl', bodyPart: 'bodyParts.legs' },
  { id: 'thigh', name: 'muscles.thigh', bodyPart: 'bodyParts.legs' },
  { id: 'ankle', name: 'muscles.ankle', bodyPart: 'bodyParts.legs' },
  { id: 'knee', name: 'muscles.knee', bodyPart: 'bodyParts.legs' },
  { id: 'feet', name: 'muscles.feet', bodyPart: 'bodyParts.legs' },

  // Chest
  { id: 'chest', name: 'muscles.chest', bodyPart: 'bodyParts.chest' },
  { id: 'chestUpper', name: 'muscles.chestUpper', bodyPart: 'bodyParts.chest' },
  { id: 'chestLower', name: 'muscles.chestLower', bodyPart: 'bodyParts.chest' },
  { id: 'serratusAnterior', name: 'muscles.serratusAnterior', bodyPart: 'bodyParts.chest' },
  { id: 'upperBody', name: 'muscles.upperBody', bodyPart: 'bodyParts.chest' },

  // Arms
  { id: 'arms', name: 'muscles.arms', bodyPart: 'bodyParts.arms' },
  { id: 'biceps', name: 'muscles.biceps', bodyPart: 'bodyParts.arms' },
  { id: 'triceps', name: 'muscles.triceps', bodyPart: 'bodyParts.arms' },
  { id: 'forearms', name: 'muscles.forearms', bodyPart: 'bodyParts.arms' },
  { id: 'brachialis', name: 'muscles.brachialis', bodyPart: 'bodyParts.arms' },
  { id: 'wrists', name: 'muscles.wrists', bodyPart: 'bodyParts.arms' },
  { id: 'fingerGrip', name: 'muscles.fingerGrip', bodyPart: 'bodyParts.arms' },

  // Shoulders
  { id: 'shoulders', name: 'muscles.shoulders', bodyPart: 'bodyParts.shoulders' },
  { id: 'deltoidAnterior', name: 'muscles.deltoidAnterior', bodyPart: 'bodyParts.shoulders' },
  { id: 'deltoidLateral', name: 'muscles.deltoidLateral', bodyPart: 'bodyParts.shoulders' },
  { id: 'deltoidPosterior', name: 'muscles.deltoidPosterior', bodyPart: 'bodyParts.shoulders' },
  { id: 'rotatorCuff', name: 'muscles.rotatorCuff', bodyPart: 'bodyParts.shoulders' },

  // Other/Full Body
  { id: 'fullBody', name: 'muscles.fullBody', bodyPart: 'bodyParts.fullBody' },
  { id: 'posteriorChain', name: 'muscles.posteriorChain', bodyPart: 'bodyParts.fullBody' },
  { id: 'cardio', name: 'muscles.cardio', bodyPart: 'bodyParts.fullBody' },

  // Neck
  { id: 'neck', name: 'muscles.neck', bodyPart: 'bodyParts.neck' },
  { id: 'intercostals', name: 'muscles.intercostals', bodyPart: 'bodyParts.neck' },
  { id: 'levatorScapulae', name: 'muscles.levatorScapulae', bodyPart: 'bodyParts.neck' },
  { id: 'teresMajor', name: 'muscles.teresMajor', bodyPart: 'bodyParts.neck' },
  { id: 'teresMinor', name: 'muscles.teresMinor', bodyPart: 'bodyParts.neck' },
  { id: 'infraspinatus', name: 'muscles.infraspinatus', bodyPart: 'bodyParts.neck' },
  { id: 'supraspinatus', name: 'muscles.supraspinatus', bodyPart: 'bodyParts.neck' },
  { id: 'subscapularis', name: 'muscles.subscapularis', bodyPart: 'bodyParts.neck' },
];