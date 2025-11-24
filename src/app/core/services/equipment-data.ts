export type EquipmentValue =
    | "abdominalCrunchMachine"
    | "abductorMachine"
    | "adductorMachine"
    | "abRollerCoaster"
    | "abWheel"
    | "accessories"
    | "adjustableBench"
    | "aerobicStepper"
    | "airBike"
    | "anchorPoint"
    | "ankleWeights"
    | "armBlaster"
    | "atlasStone"
    | "axelBar"
    | "backExtensionMachine"
    | "bar"
    | "barbell"
    | "battleRopes"
    | "bench"
    | "bicycle"
    | "boards"
    | "blocks"
    | "bodyweight"
    | "bosuBall"
    | "box"
    | "bulgarianBag"
    | "bumperPlates"
    | "cableMachine"
    | "calfRaiseMachine"
    | "camberedBar"
    | "captainsOfCrushGrippers"
    | "chains"
    | "chalk"
    | "chestPressMachine"
    | "circusDumbbell"
    | "climbingRope"
    | "dHandle"
    | "declineBench"
    | "dipBelt"
    | "dipStation"
    | "doorway"
    | "dumbbell"
    | "ellipticalTrainer"
    | "ezCurlBar"
    | "farmersWalkHandles"
    | "fatGripz"
    | "flatBench"
    | "foamRoller"
    | "freeWeights"
    | "ghd"
    | "gymnasticRing"
    | "hackSquatMachine"
    | "harnessStraps"
    | "headHarness"
    | "hexBar"
    | "hipAbductionMachine"
    | "hipAdductionMachine"
    | "hyperextensionBench"
    | "hyperextensionMachine"
    | "inclineBench"
    | "inclineChestPressMachine"
    | "indianClub"
    | "inversionTable"
    | "jumpRope"
    | "keg"
    | "kettlebell"
    | "lacrosseMassageBall"
    | "landmineAttachment"
    | "largeTire"
    | "latPulldownMachine"
    | "legCurlMachine"
    | "legExtensionMachine"
    | "legPressMachine"
    | "liftingBelt"
    | "logBar"
    | "lyingLegCurlMachine"
    | "machine"
    | "maceBell"
    | "mat"
    | "medicineBall"
    | "miniBands"
    | "parallettes"
    | "pegboard"
    | "pecDeckMachine"
    | "pilatesReformer"
    | "padding"
    | "plates"
    | "plyoBox"
    | "platform"
    | "powerRackSquatRack"
    | "preacherCurlBench"
    | "prowlerSled"
    | "pullUpBar"
    | "rack"
    | "resistanceBand"
    | "resistanceBandLoop"
    | "resistanceBandsHandles"
    | "reverseHyperextensionMachine"
    | "reversePecDeckMachine"
    | "rope"
    | "ropeAttachmentCables"
    | "rowerErg"
    | "safetySquatBar"
    | "sandbag"
    | "seatedCalfRaiseMachine"
    | "seatedRowMachine"
    | "shoulderPressMachine"
    | "skierg"
    | "slamBall"
    | "sledgehammer"
    | "slingshot"
    | "smithMachine"
    | "stabilityBall"
    | "stairClimber"
    | "stairs"
    | "stairClimbingMachine"
    | "stationaryBike"
    | "steelClub"
    | "steelMace"
    | "straightBarAttachmentCables"
    | "stretchingStrap"
    | "suspensionTrainer"
    | "swissBar"
    | "tBarRowMachine"
    | "table"
    | "theraBand"
    | "tire"
    | "towel"
    | "treadmill"
    | "vBarHandle"
    | "vibrationPlate"
    | "vipr"
    | "wall"
    | "wallBall"
    | "weightPlates"
    | "weightReleasers"
    | "weightVest"
    | "wristRoller"
    | "wristWraps"
    | "yogaBlock"
    | "yogaMat"
    | "yoke";

export enum EquipmentCategory {
    'dumbbell' = 'dumbbell',
    'kettlebell' = 'kettlebell',
    'plate' = 'plate',
    'barbell' = 'barbell',
    'functionalBodyweight' = 'functionalBodyweight',
    'band' = 'band',
    'machine' = 'machine',
    'benchesRacks' = 'benchesRacks',
    'accessory' = 'accessory',
    'freeWeights' = 'freeWeights',
    'bag' = 'bag',
    'macebell' = 'macebell',
    'club' = 'club',
    'cardio' = 'cardio',
    'custom' = 'custom',
    'other' = 'other',
    'general' = 'general'
};

export interface Equipment {
    id: EquipmentValue,
    name: string,
    categories: EquipmentCategory[]
}

export const EQUIPMENT_DATA: Equipment[] = [
    {
        "id": "table",
        "name": "Table",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "wall",
        "name": "Wall",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "bar",
        "name": "Bar",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "abdominalCrunchMachine",
        "name": "Abdominal Crunch Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "abRollerCoaster",
        "name": "Ab Roller Coaster",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "abWheel",
        "name": "Ab Wheel",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "adjustableBench",
        "name": "Adjustable Bench",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "aerobicStepper",
        "name": "Aerobic Stepper",
        "categories": [EquipmentCategory.cardio]
    },
    {
        "id": "airBike",
        "name": "Air Bike (Assault/Echo)",
        "categories": [EquipmentCategory.cardio]
    },
    {
        "id": "anchorPoint",
        "name": "Anchor Point",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "ankleWeights",
        "name": "Ankle Weights",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "armBlaster",
        "name": "Arm Blaster",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "atlasStone",
        "name": "Atlas Stone",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "axelBar",
        "name": "Axel Bar (Thick Bar)",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "backExtensionMachine",
        "name": "Back Extension Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "barbell",
        "name": "Barbell",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "battleRopes",
        "name": "Battle Ropes",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "bench",
        "name": "Bench",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "bicycle",
        "name": "Bicycle (Outdoor)",
        "categories": [EquipmentCategory.cardio]
    },
    {
        "id": "blocks",
        "name": "Blocks",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "boards",
        "name": "Boards",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "bosuBall",
        "name": "Bosu Ball",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "bumperPlates",
        "name": "Bumper Plates",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "cableMachine",
        "name": "Cable Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "calfRaiseMachine",
        "name": "Calf Raise Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "camberedBar",
        "name": "Cambered Bar",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "captainsOfCrushGrippers",
        "name": "Captains of Crush Grippers",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "chains",
        "name": "Chains",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "chalk",
        "name": "Chalk",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "chestPressMachine",
        "name": "Chest Press Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "inclineChestPressMachine",
        "name": "Incline Chest Press Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "circusDumbbell",
        "name": "Circus Dumbbell",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "climbingRope",
        "name": "Climbing Rope",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "dHandle",
        "name": "D-Handle / Stirrup Handle",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "declineBench",
        "name": "Decline Bench",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "dipBelt",
        "name": "Dip Belt",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "dipStation",
        "name": "Dip Station / Parallel Bars",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "doorway",
        "name": "Doorway",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "dumbbell",
        "name": "Dumbbell",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "ezCurlBar",
        "name": "EZ-Curl Bar",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "farmersWalkHandles",
        "name": "Farmer's Walk Handles",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "fatGripz",
        "name": "Fat Gripz",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "flatBench",
        "name": "Flat Bench",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "foamRoller",
        "name": "Foam Roller",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "ghd",
        "name": "GHD (Glute-Ham Developer)",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "gymnasticRing",
        "name": "Gymnastic Rings",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "hackSquatMachine",
        "name": "Hack Squat Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "harnessStraps",
        "name": "Harness / Straps",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "headHarness",
        "name": "Head Harness (Neck Training)",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "hexBar",
        "name": "Hex Bar (Trap Bar)",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "hipAbductionMachine",
        "name": "Hip Abduction Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "hipAdductionMachine",
        "name": "Hip Adduction Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "hyperextensionBench",
        "name": "Hyperextension Bench",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "inclineBench",
        "name": "Incline Bench",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "inversionTable",
        "name": "Inversion Table",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "jumpRope",
        "name": "Jump Rope",
        "categories": [EquipmentCategory.cardio]
    },
    {
        "id": "keg",
        "name": "Keg",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "kettlebell",
        "name": "Kettlebell",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "lacrosseMassageBall",
        "name": "Lacrosse Ball / Massage Ball",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "landmineAttachment",
        "name": "Landmine Attachment",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "largeTire",
        "name": "Large Tire",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "latPulldownMachine",
        "name": "Lat Pulldown Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "legCurlMachine",
        "name": "Leg Curl Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "lyingLegCurlMachine",
        "name": "Lying Leg Curl Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "legExtensionMachine",
        "name": "Leg Extension Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "legPressMachine",
        "name": "Leg Press Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "liftingBelt",
        "name": "Lifting Belt",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "logBar",
        "name": "Log Bar",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "medicineBall",
        "name": "Medicine Ball",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "miniBands",
        "name": "Mini Bands (Hip Circles)",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "parallettes",
        "name": "Parallettes",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "pegboard",
        "name": "Pegboard",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "pecDeckMachine",
        "name": "Pec Deck Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "pilatesReformer",
        "name": "Pilates Reformer",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "plyoBox",
        "name": "Plyo Box / Platform",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "platform",
        "name": "Platform",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "box",
        "name": "Box",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "powerRackSquatRack",
        "name": "Power Rack / Squat Rack",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "preacherCurlBench",
        "name": "Preacher Curl Bench",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "prowlerSled",
        "name": "Prowler Sled",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "pullUpBar",
        "name": "Pull-up Bar",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "resistanceBandLoop",
        "name": "Resistance Band (Loop)",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "resistanceBandsHandles",
        "name": "Resistance Bands (with Handles)",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "reverseHyperextensionMachine",
        "name": "Reverse Hyperextension Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "ropeAttachmentCables",
        "name": "Rope Attachment (for cables)",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "rowerErg",
        "name": "Rower (Erg)",
        "categories": [EquipmentCategory.cardio]
    },
    {
        "id": "safetySquatBar",
        "name": "Safety Squat Bar",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "sandbag",
        "name": "Sandbag",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "seatedCalfRaiseMachine",
        "name": "Seated Calf Raise Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "seatedRowMachine",
        "name": "Seated Row Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "shoulderPressMachine",
        "name": "Shoulder Press Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "skierg",
        "name": "SkiErg",
        "categories": [EquipmentCategory.cardio]
    },
    {
        "id": "slamBall",
        "name": "Slam Ball",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "sledgehammer",
        "name": "Sledgehammer",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "slingshot",
        "name": "Slingshot",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "smithMachine",
        "name": "Smith Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "stabilityBall",
        "name": "Stability Ball (Swiss Ball)",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "stairClimber",
        "name": "Stair Climber / StairMaster",
        "categories": [EquipmentCategory.cardio]
    },
    {
        "id": "stationaryBike",
        "name": "Stationary Bike",
        "categories": [EquipmentCategory.cardio]
    },
    {
        "id": "maceBell",
        "name": "Mace Bell",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "steelClub",
        "name": "Steel Club",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "steelMace",
        "name": "Steel Mace",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "stretchingStrap",
        "name": "Stretching Strap",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "suspensionTrainer",
        "name": "Suspension Trainer (TRX)",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "swissBar",
        "name": "Swiss Bar (Multi-Grip Bar)",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "tBarRowMachine",
        "name": "T-Bar Row Machine",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "theraBand",
        "name": "TheraBand",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "towel",
        "name": "Towel",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "treadmill",
        "name": "Treadmill",
        "categories": [EquipmentCategory.cardio]
    },
    {
        "id": "vBarHandle",
        "name": "V-Bar Handle (for cables)",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "vibrationPlate",
        "name": "Vibration Plate",
        "categories": [EquipmentCategory.machine]
    },
    {
        "id": "wallBall",
        "name": "Wall Ball",
        "categories": [EquipmentCategory.functionalBodyweight]
    },
    {
        "id": "weightPlates",
        "name": "Weight Plates",
        "categories": [EquipmentCategory.freeWeights]
    },
    {
        "id": "weightReleasers",
        "name": "Weight Releasers",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "weightVest",
        "name": "Weight Vest",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "wristRoller",
        "name": "Wrist Roller",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "wristWraps",
        "name": "Wrist Wraps",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "yogaBlock",
        "name": "Yoga Block",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "yogaMat",
        "name": "Yoga Mat",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "mat",
        "name": "Mat",
        "categories": [EquipmentCategory.accessory]
    },
    {
        "id": "yoke",
        "name": "Yoke",
        "categories": [EquipmentCategory.functionalBodyweight]
    },

    // Free Weights
    { id: 'ezCurlBar', name: 'EZ-Curl Bar', categories: [EquipmentCategory.freeWeights] },

    // Machines
    { id: 'machine', name: 'Machine', categories: [EquipmentCategory.machine] },
    { id: 'cableMachine', name: 'Cable Machine', categories: [EquipmentCategory.machine] },
    { id: 'abductorMachine', name: 'Abductor Machine', categories: [EquipmentCategory.machine] },
    { id: 'adductorMachine', name: 'Adductor Machine', categories: [EquipmentCategory.machine] },
    { id: 'pecDeckMachine', name: 'Pec Deck Machine', categories: [EquipmentCategory.machine] },
    { id: 'chestPressMachine', name: 'Chest Press Machine', categories: [EquipmentCategory.machine] },
    { id: 'inclineChestPressMachine', name: 'Incline Chest Press Machine', categories: [EquipmentCategory.machine] },
    { id: 'latPulldownMachine', name: 'Lat Pulldown Machine', categories: [EquipmentCategory.machine] },
    { id: 'seatedRowMachine', name: 'Seated Row Machine', categories: [EquipmentCategory.machine] },
    { id: 'legPressMachine', name: 'Leg Press Machine', categories: [EquipmentCategory.machine] },
    { id: 'legExtensionMachine', name: 'Leg Extension Machine', categories: [EquipmentCategory.machine] },
    { id: 'legCurlMachine', name: 'Leg Curl Machine', categories: [EquipmentCategory.machine] },
    { id: 'shoulderPressMachine', name: 'Shoulder Press Machine', categories: [EquipmentCategory.machine] },
    { id: 'reversePecDeckMachine', name: 'Reverse Pec Deck Machine', categories: [EquipmentCategory.machine] },
    { id: 'calfRaiseMachine', name: 'Calf Raise Machine', categories: [EquipmentCategory.machine] },
    { id: 'hackSquatMachine', name: 'Hack Squat Machine', categories: [EquipmentCategory.machine] },
    { id: 'seatedCalfRaiseMachine', name: 'Seated Calf Raise Machine', categories: [EquipmentCategory.machine] },
    { id: 'abdominalCrunchMachine', name: 'Abdominal Crunch Machine', categories: [EquipmentCategory.machine] },
    { id: 'hyperextensionMachine', name: 'Hyperextension Machine', categories: [EquipmentCategory.machine] },
    { id: 'treadmill', name: 'Treadmill', categories: [EquipmentCategory.machine] },
    { id: 'stationaryBike', name: 'Stationary Bike', categories: [EquipmentCategory.machine] },
    { id: 'ellipticalTrainer', name: 'Elliptical Trainer', categories: [EquipmentCategory.machine] },
    { id: 'stairClimbingMachine', name: 'Stair Climbing Machine', categories: [EquipmentCategory.machine] },

    // Bodyweight & Calisthenics
    { id: 'bodyweight', name: 'Bodyweight', categories: [EquipmentCategory.functionalBodyweight] },

    // Benches & Racks
    { id: 'bench', name: 'Bench', categories: [EquipmentCategory.benchesRacks] },
    { id: 'rack', name: 'Rack / Squat Rack', categories: [EquipmentCategory.benchesRacks] },
    // Accessories
    { id: 'medicineBall', name: 'Medicine Ball / Slam Ball', categories: [EquipmentCategory.accessory] },
    { id: 'padding', name: 'Padding', categories: [EquipmentCategory.accessory] },
    // Strongman & Other
    { id: 'bulgarianBag', name: 'Bulgarian Bag', categories: [EquipmentCategory.other] },
    { id: 'indianClub', name: 'Indian Clubs', categories: [EquipmentCategory.other] },
    { id: 'vipr', name: 'ViPR', categories: [EquipmentCategory.other] },
    // General
    { id: 'stairs', name: 'Stairs', categories: [EquipmentCategory.general] }
]