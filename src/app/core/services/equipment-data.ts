export type EquipmentValue =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'ezCurlBar'
  | 'plates'
  | 'machine'
  | 'cableMachine'
  | 'abductorMachine'
  | 'adductorMachine'
  | 'pecDeckMachine'
  | 'chestPressMachine'
  | 'inclineChestPressMachine'
  | 'latPulldownMachine'
  | 'seatedRowMachine'
  | 'legPressMachine'
  | 'legExtensionMachine'
  | 'legCurlMachine'
  | 'shoulderPressMachine'
  | 'reversePecDeckMachine'
  | 'calfRaiseMachine'
  | 'hackSquatMachine'
  | 'seatedCalfRaiseMachine'
  | 'abdominalCrunchMachine'
  | 'hyperextensionMachine'
  | 'treadmill'
  | 'stationaryBike'
  | 'ellipticalTrainer'
  | 'stairClimbingMachine'
  | 'bodyweight'
  | 'pull-up-bar'
  | 'dipStation'
  | 'parallettes'
  | 'gymnasticRings'
  | 'bench'
  | 'inclineBench'
  | 'rack'
  | 'resistanceBand'
  | 'plyoBox'
  | 'medicineBall'
  | 'jumpRope'
  | 'padding'
  | 'towel'
  | 'prowlerSled'
  | 'largeTire'
  | 'battleRopes'
  | 'sandbag'
  | 'bulgarianBag'
  | 'steelMace'
  | 'steelClubs'
  | 'indianClubs'
  | 'vipr'
  | 'doorway'
  | 'anchorPoint'
  | 'stairs';

export const EQUIPMENT_DATA = [
    {
        "id": "abdominal-crunch-machine",
        "name": "Abdominal Crunch Machine",
        "category": "Machines"
    },
    {
        "id": "ab-roller-coaster",
        "name": "Ab Roller Coaster",
        "category": "Machines"
    },
    {
        "id": "ab-wheel",
        "name": "Ab Wheel",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "adjustable-bench",
        "name": "Adjustable Bench",
        "category": "Accessories"
    },
    {
        "id": "aerobic-stepper",
        "name": "Aerobic Stepper",
        "category": "Cardio"
    },
    {
        "id": "air-bike",
        "name": "Air Bike (Assault/Echo)",
        "category": "Cardio"
    },
    {
        "id": "anchor-point",
        "name": "Anchor Point",
        "category": "Accessories"
    },
    {
        "id": "ankle-weights",
        "name": "Ankle Weights",
        "category": "Accessories"
    },
    {
        "id": "arm-blaster",
        "name": "Arm Blaster",
        "category": "Accessories"
    },
    {
        "id": "atlas-stone",
        "name": "Atlas Stone",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "axel-bar",
        "name": "Axel Bar (Thick Bar)",
        "category": "Free Weights"
    },
    {
        "id": "back-extension-machine",
        "name": "Back Extension Machine",
        "category": "Machines"
    },
    {
        "id": "barbell",
        "name": "Barbell",
        "category": "Free Weights"
    },
    {
        "id": "battle-ropes",
        "name": "Battle Ropes",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "bench",
        "name": "Bench",
        "category": "Accessories"
    },
    {
        "id": "bicycle",
        "name": "Bicycle (Outdoor)",
        "category": "Cardio"
    },
    {
        "id": "bosu-ball",
        "name": "Bosu Ball",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "bumper-plates",
        "name": "Bumper Plates",
        "category": "Free Weights"
    },
    {
        "id": "cable-machine",
        "name": "Cable Machine",
        "category": "Machines"
    },
    {
        "id": "calf-raise-machine",
        "name": "Calf Raise Machine",
        "category": "Machines"
    },
    {
        "id": "cambered-bar",
        "name": "Cambered Bar",
        "category": "Free Weights"
    },
    {
        "id": "captains-of-crush-grippers",
        "name": "Captains of Crush Grippers",
        "category": "Accessories"
    },
    {
        "id": "chains",
        "name": "Chains",
        "category": "Free Weights"
    },
    {
        "id": "chalk",
        "name": "Chalk",
        "category": "Accessories"
    },
    {
        "id": "chest-press-machine",
        "name": "Chest Press Machine",
        "category": "Machines"
    },
    {
        "id": "circus-dumbbell",
        "name": "Circus Dumbbell",
        "category": "Free Weights"
    },
    {
        "id": "climbing-rope",
        "name": "Climbing Rope",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "d-handle",
        "name": "D-Handle / Stirrup Handle",
        "category": "Accessories"
    },
    {
        "id": "decline-bench",
        "name": "Decline Bench",
        "category": "Accessories"
    },
    {
        "id": "dip-belt",
        "name": "Dip Belt",
        "category": "Accessories"
    },
    {
        "id": "dip-station",
        "name": "Dip Station / Parallel Bars",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "doorway",
        "name": "Doorway",
        "category": "Accessories"
    },
    {
        "id": "dumbbell",
        "name": "Dumbbell",
        "category": "Free Weights"
    },
    {
        "id": "elliptical-trainer",
        "name": "Elliptical Trainer",
        "category": "Cardio"
    },
    {
        "id": "ez-curl-bar",
        "name": "EZ-Curl Bar",
        "category": "Free Weights"
    },
    {
        "id": "farmers-walk-handles",
        "name": "Farmer's Walk Handles",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "fat-gripz",
        "name": "Fat Gripz",
        "category": "Accessories"
    },
    {
        "id": "flat-bench",
        "name": "Flat Bench",
        "category": "Accessories"
    },
    {
        "id": "foam-roller",
        "name": "Foam Roller",
        "category": "Accessories"
    },
    {
        "id": "ghd",
        "name": "GHD (Glute-Ham Developer)",
        "category": "Machines"
    },
    {
        "id": "gymnastic-rings",
        "name": "Gymnastic Rings",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "hack-squat-machine",
        "name": "Hack Squat Machine",
        "category": "Machines"
    },
    {
        "id": "harness-straps",
        "name": "Harness / Straps",
        "category": "Accessories"
    },
    {
        "id": "head-harness",
        "name": "Head Harness (Neck Training)",
        "category": "Accessories"
    },
    {
        "id": "hex-bar",
        "name": "Hex Bar (Trap Bar)",
        "category": "Free Weights"
    },
    {
        "id": "hip-abduction-machine",
        "name": "Hip Abduction Machine",
        "category": "Machines"
    },
    {
        "id": "hip-adduction-machine",
        "name": "Hip Adduction Machine",
        "category": "Machines"
    },
    {
        "id": "hyperextension-bench",
        "name": "Hyperextension Bench",
        "category": "Machines"
    },
    {
        "id": "incline-bench",
        "name": "Incline Bench",
        "category": "Benches & Racks"
    },
    {
        "id": "inversion-table",
        "name": "Inversion Table",
        "category": "Accessories"
    },
    {
        "id": "jump-rope",
        "name": "Jump Rope",
        "category": "Cardio"
    },
    {
        "id": "keg",
        "name": "Keg",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "kettlebell",
        "name": "Kettlebell",
        "category": "Free Weights"
    },
    {
        "id": "lacrosse-massage-ball",
        "name": "Lacrosse Ball / Massage Ball",
        "category": "Accessories"
    },
    {
        "id": "landmine-attachment",
        "name": "Landmine Attachment",
        "category": "Accessories"
    },
    {
        "id": "large-tire",
        "name": "Large Tire",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "lat-pulldown-machine",
        "name": "Lat Pulldown Machine",
        "category": "Machines"
    },
    {
        "id": "leg-curl-machine",
        "name": "Leg Curl Machine",
        "category": "Machines"
    },
    {
        "id": "leg-extension-machine",
        "name": "Leg Extension Machine",
        "category": "Machines"
    },
    {
        "id": "leg-press-machine",
        "name": "Leg Press Machine",
        "category": "Machines"
    },
    {
        "id": "lifting-belt",
        "name": "Lifting Belt",
        "category": "Accessories"
    },
    {
        "id": "log-bar",
        "name": "Log Bar",
        "category": "Free Weights"
    },
    {
        "id": "medicine-ball",
        "name": "Medicine Ball",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "mini-bands",
        "name": "Mini Bands (Hip Circles)",
        "category": "Accessories"
    },
    {
        "id": "parallettes",
        "name": "Parallettes",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "pegboard",
        "name": "Pegboard",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "pec-deck-machine",
        "name": "Pec Deck Machine",
        "category": "Machines"
    },
    {
        "id": "pilates-reformer",
        "name": "Pilates Reformer",
        "category": "Machines"
    },
    {
        "id": "plyo-box",
        "name": "Plyo Box / Platform",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "power-rack-squat-rack",
        "name": "Power Rack / Squat Rack",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "preacher-curl-bench",
        "name": "Preacher Curl Bench",
        "category": "Machines"
    },
    {
        "id": "prowler-sled",
        "name": "Prowler Sled",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "pull-up-bar",
        "name": "Pull-up Bar",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "resistance-bands-loop",
        "name": "Resistance Bands (Loop)",
        "category": "Accessories"
    },
    {
        "id": "resistance-bands-handles",
        "name": "Resistance Bands (with Handles)",
        "category": "Accessories"
    },
    {
        "id": "reverse-hyperextension-machine",
        "name": "Reverse Hyperextension Machine",
        "category": "Machines"
    },
    {
        "id": "rope-attachment-cables",
        "name": "Rope Attachment (for cables)",
        "category": "Accessories"
    },
    {
        "id": "rower-erg",
        "name": "Rower (Erg)",
        "category": "Cardio"
    },
    {
        "id": "safety-squat-bar",
        "name": "Safety Squat Bar",
        "category": "Free Weights"
    },
    {
        "id": "sandbag",
        "name": "Sandbag",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "seated-calf-raise-machine",
        "name": "Seated Calf Raise Machine",
        "category": "Machines"
    },
    {
        "id": "seated-row-machine",
        "name": "Seated Row Machine",
        "category": "Machines"
    },
    {
        "id": "shoulder-press-machine",
        "name": "Shoulder Press Machine",
        "category": "Machines"
    },
    {
        "id": "skierg",
        "name": "SkiErg",
        "category": "Cardio"
    },
    {
        "id": "slam-ball",
        "name": "Slam Ball",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "sledgehammer",
        "name": "Sledgehammer",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "smith-machine",
        "name": "Smith Machine",
        "category": "Machines"
    },
    {
        "id": "stability-ball",
        "name": "Stability Ball (Swiss Ball)",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "stair-climber",
        "name": "Stair Climber / StairMaster",
        "category": "Cardio"
    },
    {
        "id": "stationary-bike",
        "name": "Stationary Bike",
        "category": "Cardio"
    },
    {
        "id": "steel-clubs",
        "name": "Steel Clubs",
        "category": "Free Weights"
    },
    {
        "id": "steel-mace",
        "name": "Steel Mace",
        "category": "Free Weights"
    },
    {
        "id": "stretching-strap",
        "name": "Stretching Strap",
        "category": "Accessories"
    },
    {
        "id": "suspension-trainer",
        "name": "Suspension Trainer (TRX)",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "swiss-bar",
        "name": "Swiss Bar (Multi-Grip Bar)",
        "category": "Free Weights"
    },
    {
        "id": "t-bar-row-machine",
        "name": "T-Bar Row Machine",
        "category": "Machines"
    },
    {
        "id": "thera-band",
        "name": "TheraBand",
        "category": "Accessories"
    },
    {
        "id": "towel",
        "name": "Towel",
        "category": "Accessories"
    },
    {
        "id": "treadmill",
        "name": "Treadmill",
        "category": "Cardio"
    },
    {
        "id": "v-bar-handle",
        "name": "V-Bar Handle (for cables)",
        "category": "Accessories"
    },
    {
        "id": "vibration-plate",
        "name": "Vibration Plate",
        "category": "Machines"
    },
    {
        "id": "wall-ball",
        "name": "Wall Ball",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "weight-plates",
        "name": "Weight Plates",
        "category": "Free Weights"
    },
    {
        "id": "weight-releasers",
        "name": "Weight Releasers",
        "category": "Accessories"
    },
    {
        "id": "weight-vest",
        "name": "Weight Vest",
        "category": "Accessories"
    },
    {
        "id": "wrist-roller",
        "name": "Wrist Roller",
        "category": "Accessories"
    },
    {
        "id": "wrist-wraps",
        "name": "Wrist Wraps",
        "category": "Accessories"
    },
    {
        "id": "yoga-block",
        "name": "Yoga Block",
        "category": "Accessories"
    },
    {
        "id": "yoga-mat",
        "name": "Yoga Mat",
        "category": "Accessories"
    },
    {
        "id": "yoke",
        "name": "Yoke",
        "category": "Functional & Bodyweight"
    },

    // Free Weights
  { id: 'ezCurlBar', name: 'EZ-Curl Bar', category: 'Free Weights' },

  // Machines
  { id: 'machine', name: 'Machine', category: 'Machines' },
  { id: 'cableMachine', name: 'Cable Machine', category: 'Machines' },
  { id: 'abductorMachine', name: 'Abductor Machine', category: 'Machines' },
  { id: 'adductorMachine', name: 'Adductor Machine', category: 'Machines' },
  { id: 'pecDeckMachine', name: 'Pec Deck Machine', category: 'Machines' },
  { id: 'chestPressMachine', name: 'Chest Press Machine', category: 'Machines' },
  { id: 'inclineChestPressMachine', name: 'Incline Chest Press Machine', category: 'Machines' },
  { id: 'latPulldownMachine', name: 'Lat Pulldown Machine', category: 'Machines' },
  { id: 'seatedRowMachine', name: 'Seated Row Machine', category: 'Machines' },
  { id: 'legPressMachine', name: 'Leg Press Machine', category: 'Machines' },
  { id: 'legExtensionMachine', name: 'Leg Extension Machine', category: 'Machines' },
  { id: 'legCurlMachine', name: 'Leg Curl Machine', category: 'Machines' },
  { id: 'shoulderPressMachine', name: 'Shoulder Press Machine', category: 'Machines' },
  { id: 'reversePecDeckMachine', name: 'Reverse Pec Deck Machine', category: 'Machines' },
  { id: 'calfRaiseMachine', name: 'Calf Raise Machine', category: 'Machines' },
  { id: 'hackSquatMachine', name: 'Hack Squat Machine', category: 'Machines' },
  { id: 'seatedCalfRaiseMachine', name: 'Seated Calf Raise Machine', category: 'Machines' },
  { id: 'abdominalCrunchMachine', name: 'Abdominal Crunch Machine', category: 'Machines' },
  { id: 'hyperextensionMachine', name: 'Hyperextension Machine', category: 'Machines' },
  { id: 'treadmill', name: 'Treadmill', category: 'Machines' },
  { id: 'stationaryBike', name: 'Stationary Bike', category: 'Machines' },
  { id: 'ellipticalTrainer', name: 'Elliptical Trainer', category: 'Machines' },
  { id: 'stairClimbingMachine', name: 'Stair Climbing Machine', category: 'Machines' },

  // Bodyweight & Calisthenics
  { id: 'bodyweight', name: 'Bodyweight', category: 'Bodyweight' },

  // Benches & Racks
  { id: 'bench', name: 'Bench', category: 'Benches & Racks' },
  { id: 'rack', name: 'Rack / Squat Rack', category: 'Benches & Racks' },

  // Accessories
  { id: 'medicineBall', name: 'Medicine Ball / Slam Ball', category: 'Accessories' },
  { id: 'padding', name: 'Padding', category: 'Accessories' },
  
  // Strongman & Other
  { id: 'bulgarianBag', name: 'Bulgarian Bag', category: 'Other' },
  { id: 'indianClubs', name: 'Indian Clubs', category: 'Other' },
  { id: 'vipr', name: 'ViPR', category: 'Other' },

  // General
  { id: 'stairs', name: 'Stairs', category: 'General' }
]