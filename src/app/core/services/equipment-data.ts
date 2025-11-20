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

export const EQUIPMENT_DATA = [
    {
        "id": "table",
        "name": "Table",
        "category": "Accessories"
    },
    {
        "id": "wall",
        "name": "Wall",
        "category": "Accessories"
    },
    {
        "id": "bar",
        "name": "Bar",
        "category": "Free Weights"
    },
    {
        "id": "abdominalCrunchMachine",
        "name": "Abdominal Crunch Machine",
        "category": "Machines"
    },
    {
        "id": "abRollerCoaster",
        "name": "Ab Roller Coaster",
        "category": "Machines"
    },
    {
        "id": "abWheel",
        "name": "Ab Wheel",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "adjustableBench",
        "name": "Adjustable Bench",
        "category": "Accessories"
    },
    {
        "id": "aerobicStepper",
        "name": "Aerobic Stepper",
        "category": "Cardio"
    },
    {
        "id": "airBike",
        "name": "Air Bike (Assault/Echo)",
        "category": "Cardio"
    },
    {
        "id": "anchorPoint",
        "name": "Anchor Point",
        "category": "Accessories"
    },
    {
        "id": "ankleWeights",
        "name": "Ankle Weights",
        "category": "Accessories"
    },
    {
        "id": "armBlaster",
        "name": "Arm Blaster",
        "category": "Accessories"
    },
    {
        "id": "atlasStone",
        "name": "Atlas Stone",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "axelBar",
        "name": "Axel Bar (Thick Bar)",
        "category": "Free Weights"
    },
    {
        "id": "backExtensionMachine",
        "name": "Back Extension Machine",
        "category": "Machines"
    },
    {
        "id": "barbell",
        "name": "Barbell",
        "category": "Free Weights"
    },
    {
        "id": "battleRopes",
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
        "id": "bosuBall",
        "name": "Bosu Ball",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "bumperPlates",
        "name": "Bumper Plates",
        "category": "Free Weights"
    },
    {
        "id": "cableMachine",
        "name": "Cable Machine",
        "category": "Machines"
    },
    {
        "id": "calfRaiseMachine",
        "name": "Calf Raise Machine",
        "category": "Machines"
    },
    {
        "id": "camberedBar",
        "name": "Cambered Bar",
        "category": "Free Weights"
    },
    {
        "id": "captainsOfCrushGrippers",
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
        "id": "chestPressMachine",
        "name": "Chest Press Machine",
        "category": "Machines"
    },
    {
        "id": "inclineChestPressMachine",
        "name": "Incline Chest Press Machine",
        "category": "Machines"
    },
    {
        "id": "circusDumbbell",
        "name": "Circus Dumbbell",
        "category": "Free Weights"
    },
    {
        "id": "climbingRope",
        "name": "Climbing Rope",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "dHandle",
        "name": "D-Handle / Stirrup Handle",
        "category": "Accessories"
    },
    {
        "id": "declineBench",
        "name": "Decline Bench",
        "category": "Accessories"
    },
    {
        "id": "dipBelt",
        "name": "Dip Belt",
        "category": "Accessories"
    },
    {
        "id": "dipStation",
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
        "id": "ellipticalTrainer",
        "name": "Elliptical Trainer",
        "category": "Cardio"
    },
    {
        "id": "ezCurlBar",
        "name": "EZ-Curl Bar",
        "category": "Free Weights"
    },
    {
        "id": "farmersWalkHandles",
        "name": "Farmer's Walk Handles",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "fatGripz",
        "name": "Fat Gripz",
        "category": "Accessories"
    },
    {
        "id": "flatBench",
        "name": "Flat Bench",
        "category": "Accessories"
    },
    {
        "id": "foamRoller",
        "name": "Foam Roller",
        "category": "Accessories"
    },
    {
        "id": "ghd",
        "name": "GHD (Glute-Ham Developer)",
        "category": "Machines"
    },
    {
        "id": "gymnasticRing",
        "name": "Gymnastic Rings",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "hackSquatMachine",
        "name": "Hack Squat Machine",
        "category": "Machines"
    },
    {
        "id": "harnessStraps",
        "name": "Harness / Straps",
        "category": "Accessories"
    },
    {
        "id": "headHarness",
        "name": "Head Harness (Neck Training)",
        "category": "Accessories"
    },
    {
        "id": "hexBar",
        "name": "Hex Bar (Trap Bar)",
        "category": "Free Weights"
    },
    {
        "id": "hipAbductionMachine",
        "name": "Hip Abduction Machine",
        "category": "Machines"
    },
    {
        "id": "hipAdductionMachine",
        "name": "Hip Adduction Machine",
        "category": "Machines"
    },
    {
        "id": "hyperextensionBench",
        "name": "Hyperextension Bench",
        "category": "Machines"
    },
    {
        "id": "inclineBench",
        "name": "Incline Bench",
        "category": "Benches & Racks"
    },
    {
        "id": "inversionTable",
        "name": "Inversion Table",
        "category": "Accessories"
    },
    {
        "id": "jumpRope",
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
        "id": "lacrosseMassageBall",
        "name": "Lacrosse Ball / Massage Ball",
        "category": "Accessories"
    },
    {
        "id": "landmineAttachment",
        "name": "Landmine Attachment",
        "category": "Accessories"
    },
    {
        "id": "largeTire",
        "name": "Large Tire",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "latPulldownMachine",
        "name": "Lat Pulldown Machine",
        "category": "Machines"
    },
    {
        "id": "legCurlMachine",
        "name": "Leg Curl Machine",
        "category": "Machines"
    },
    {
        "id": "lyingLegCurlMachine",
        "name": "Lying Leg Curl Machine",
        "category": "Machines"
    },
    {
        "id": "legExtensionMachine",
        "name": "Leg Extension Machine",
        "category": "Machines"
    },
    {
        "id": "legPressMachine",
        "name": "Leg Press Machine",
        "category": "Machines"
    },
    {
        "id": "liftingBelt",
        "name": "Lifting Belt",
        "category": "Accessories"
    },
    {
        "id": "logBar",
        "name": "Log Bar",
        "category": "Free Weights"
    },
    {
        "id": "medicineBall",
        "name": "Medicine Ball",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "miniBands",
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
        "id": "pecDeckMachine",
        "name": "Pec Deck Machine",
        "category": "Machines"
    },
    {
        "id": "pilatesReformer",
        "name": "Pilates Reformer",
        "category": "Machines"
    },
    {
        "id": "plyoBox",
        "name": "Plyo Box / Platform",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "box",
        "name": "Box",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "powerRackSquatRack",
        "name": "Power Rack / Squat Rack",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "preacherCurlBench",
        "name": "Preacher Curl Bench",
        "category": "Machines"
    },
    {
        "id": "prowlerSled",
        "name": "Prowler Sled",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "pullUpBar",
        "name": "Pull-up Bar",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "resistanceBandLoop",
        "name": "Resistance Band (Loop)",
        "category": "Accessories"
    },
    {
        "id": "resistanceBandsHandles",
        "name": "Resistance Bands (with Handles)",
        "category": "Accessories"
    },
    {
        "id": "reverseHyperextensionMachine",
        "name": "Reverse Hyperextension Machine",
        "category": "Machines"
    },
    {
        "id": "ropeAttachmentCables",
        "name": "Rope Attachment (for cables)",
        "category": "Accessories"
    },
    {
        "id": "rowerErg",
        "name": "Rower (Erg)",
        "category": "Cardio"
    },
    {
        "id": "safetySquatBar",
        "name": "Safety Squat Bar",
        "category": "Free Weights"
    },
    {
        "id": "sandbag",
        "name": "Sandbag",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "seatedCalfRaiseMachine",
        "name": "Seated Calf Raise Machine",
        "category": "Machines"
    },
    {
        "id": "seatedRowMachine",
        "name": "Seated Row Machine",
        "category": "Machines"
    },
    {
        "id": "shoulderPressMachine",
        "name": "Shoulder Press Machine",
        "category": "Machines"
    },
    {
        "id": "skierg",
        "name": "SkiErg",
        "category": "Cardio"
    },
    {
        "id": "slamBall",
        "name": "Slam Ball",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "sledgehammer",
        "name": "Sledgehammer",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "smithMachine",
        "name": "Smith Machine",
        "category": "Machines"
    },
    {
        "id": "stabilityBall",
        "name": "Stability Ball (Swiss Ball)",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "stairClimber",
        "name": "Stair Climber / StairMaster",
        "category": "Cardio"
    },
    {
        "id": "stationaryBike",
        "name": "Stationary Bike",
        "category": "Cardio"
    },
    {
        "id": "macebell",
        "name": "Mace Bell",
        "category": "Free Weights"
    },
    {
        "id": "steelClub",
        "name": "Steel Club",
        "category": "Free Weights"
    },
    {
        "id": "steelMace",
        "name": "Steel Mace",
        "category": "Free Weights"
    },
    {
        "id": "stretchingStrap",
        "name": "Stretching Strap",
        "category": "Accessories"
    },
    {
        "id": "suspensionTrainer",
        "name": "Suspension Trainer (TRX)",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "swissBar",
        "name": "Swiss Bar (Multi-Grip Bar)",
        "category": "Free Weights"
    },
    {
        "id": "tBarRowMachine",
        "name": "T-Bar Row Machine",
        "category": "Machines"
    },
    {
        "id": "theraBand",
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
        "id": "vBarHandle",
        "name": "V-Bar Handle (for cables)",
        "category": "Accessories"
    },
    {
        "id": "vibrationPlate",
        "name": "Vibration Plate",
        "category": "Machines"
    },
    {
        "id": "wallBall",
        "name": "Wall Ball",
        "category": "Functional & Bodyweight"
    },
    {
        "id": "weightPlates",
        "name": "Weight Plates",
        "category": "Free Weights"
    },
    {
        "id": "weightReleasers",
        "name": "Weight Releasers",
        "category": "Accessories"
    },
    {
        "id": "weightVest",
        "name": "Weight Vest",
        "category": "Accessories"
    },
    {
        "id": "wristRoller",
        "name": "Wrist Roller",
        "category": "Accessories"
    },
    {
        "id": "wristWraps",
        "name": "Wrist Wraps",
        "category": "Accessories"
    },
    {
        "id": "yogaBlock",
        "name": "Yoga Block",
        "category": "Accessories"
    },
    {
        "id": "yogaMat",
        "name": "Yoga Mat",
        "category": "Accessories"
    },
    {
        "id": "mat",
        "name": "Mat",
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