export const EXERCISES_DATA = [
  {
    "id": "push-up",
    "name": "Push-up",
    "description": "A classic bodyweight exercise that works the chest, shoulders, and triceps. Keep your body straight and core engaged.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Chest", "Triceps", "Shoulders (Anterior)", "Core"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/exercises/push-up_1.jpg", "assets/images/exercises/push-up_2.jpg"],
    "videoUrl": "https://www.youtube.com/watch?v=IODxDxX7oi4",
    "notes": "Lower your body until your chest nearly touches the floor. Push back up to the starting position."
  },
  {
    "id": "pull-up",
    "name": "Pull-up",
    "description": "An advanced bodyweight exercise that targets the back and biceps using an overhand grip.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Lats",
    "muscleGroups": ["Lats", "Biceps", "Traps (Middle & Lower)", "Rhomboids", "Forearms", "Core"],
    "equipmentNeeded": ["Pull-up Bar"],
    "imageUrls": ["assets/images/exercises/pull-up_1.jpg", "assets/images/exercises/pull-up_2.jpg"]
  },
  {
    "id": "chin-up",
    "name": "Chin-up",
    "description": "A bodyweight exercise targeting the back and biceps using an underhand grip, often emphasizing biceps more than pull-ups.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Biceps",
    "muscleGroups": ["Lats", "Biceps", "Traps (Middle & Lower)", "Rhomboids", "Forearms", "Core"],
    "equipmentNeeded": ["Pull-up Bar"],
    "imageUrls": ["assets/images/exercises/chin-up_1.jpg", "assets/images/exercises/chin-up_2.jpg"]
  },
  {
    "id": "bodyweight-squat",
    "name": "Bodyweight Squat",
    "description": "A fundamental lower body exercise engaging quads, glutes, and hamstrings without external weight.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Hamstrings", "Calves", "Core"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/exercises/bodyweight-squat_1.jpg", "assets/images/exercises/bodyweight-squat_2.jpg"],
    "notes": "Keep your chest up, back straight, and descend until thighs are at least parallel to the floor."
  },
  {
    "id": "lunge",
    "name": "Lunge",
    "description": "A unilateral leg exercise that improves balance, stability, and strengthens quads, glutes, and hamstrings.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Hamstrings", "Calves"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/exercises/lunge_1.jpg", "assets/images/exercises/lunge_2.jpg"]
  },
  {
    "id": "plank",
    "name": "Plank",
    "description": "An isometric core strength exercise that involves maintaining a position similar to a push-up for the maximum possible time.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Core",
    "muscleGroups": ["Core (Abs, Obliques, Lower Back)", "Shoulders", "Glutes"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/exercises/plank_1.jpg", "assets/images/exercises/plank_2.jpg"]
  },
  {
    "id": "burpee",
    "name": "Burpee",
    "description": "A full-body, high-intensity exercise combining a squat, push-up, and jump.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Chest", "Triceps", "Shoulders", "Core", "Quadriceps", "Glutes", "Hamstrings", "Calves"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/exercises/burpee_1.jpg", "assets/images/exercises/burpee_2.jpg"]
  },
  {
    "id": "dip-bar",
    "name": "Dip (Bar)",
    "description": "A compound bodyweight exercise primarily targeting the triceps and chest, performed on parallel bars.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Triceps",
    "muscleGroups": ["Triceps", "Chest (Lower)", "Shoulders (Anterior)"],
    "equipmentNeeded": ["Dip Station / Parallel Bars"],
    "imageUrls": ["assets/images/exercises/dip-bar_1.jpg", "assets/images/exercises/dip-bar_2.jpg"]
  },
  {
    "id": "barbell-bench-press",
    "name": "Barbell Bench Press",
    "description": "A fundamental compound exercise for upper body strength, primarily targeting the chest, shoulders, and triceps.",
    "category": "barbells",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Chest", "Triceps", "Shoulders (Anterior)"],
    "equipmentNeeded": ["Barbell", "Bench", "Rack (optional but recommended)"],
    "imageUrls": ["assets/images/exercises/barbell-bench-press_1.jpg", "assets/images/exercises/barbell-bench-press_2.jpg"],
    "notes": "Maintain 5 points of contact: head, upper back, glutes on bench; both feet on floor."
  },
  {
    "id": "barbell-back-squat",
    "name": "Barbell Back Squat",
    "description": "A core strength exercise targeting the quads, glutes, hamstrings, and lower back by squatting with a barbell on the upper back.",
    "category": "barbells",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Hamstrings", "Adductors", "Core", "Lower Back"],
    "equipmentNeeded": ["Barbell", "Squat Rack"],
    "imageUrls": ["assets/images/exercises/barbell-back-squat_1.jpg", "assets/images/exercises/barbell-back-squat_2.jpg"],
    "videoUrl": "https://www.youtube.com/watch?v=ultWZbUMPL8",
    "notes": "Keep your chest up and back straight. Squat down until your thighs are at least parallel to the floor."
  },
  {
    "id": "barbell-deadlift",
    "name": "Barbell Deadlift (Conventional)",
    "description": "A full-body compound exercise lifting a barbell off the floor to a standing position, engaging legs, back, and core.",
    "category": "barbells",
    "primaryMuscleGroup": "Hamstrings",
    "muscleGroups": ["Hamstrings", "Glutes", "Lower Back", "Quadriceps", "Traps", "Lats", "Forearms", "Core"],
    "equipmentNeeded": ["Barbell", "Plates"],
    "imageUrls": ["assets/images/exercises/barbell-deadlift_1.jpg", "assets/images/exercises/barbell-deadlift_2.jpg"]
  },
  {
    "id": "overhead-press-barbell",
    "name": "Overhead Press (Barbell)",
    "description": "A compound shoulder exercise pressing a barbell overhead from a standing or seated position.",
    "category": "barbells",
    "primaryMuscleGroup": "Shoulders (Anterior & Medial)",
    "muscleGroups": ["Shoulders (Anterior, Medial)", "Triceps", "Traps (Upper)", "Core"],
    "equipmentNeeded": ["Barbell", "Rack (optional)"],
    "imageUrls": ["assets/images/exercises/overhead-press-barbell_1.jpg", "assets/images/exercises/overhead-press-barbell_2.jpg"]
  },
  {
    "id": "bent-over-row-barbell",
    "name": "Bent-Over Row (Barbell)",
    "description": "A compound back exercise where a barbell is pulled towards the torso while bent at the hips.",
    "category": "barbells",
    "primaryMuscleGroup": "Lats",
    "muscleGroups": ["Lats", "Rhomboids", "Traps (Middle & Lower)", "Biceps", "Forearms", "Lower Back (stabilizer)"],
    "equipmentNeeded": ["Barbell"],
    "imageUrls": ["assets/images/exercises/bent-over-row-barbell_1.jpg", "assets/images/exercises/bent-over-row-barbell_2.jpg"]
  },
  {
    "id": "barbell-bicep-curl",
    "name": "Barbell Bicep Curl",
    "description": "An isolation exercise for the biceps using a barbell.",
    "category": "barbells",
    "primaryMuscleGroup": "Biceps",
    "muscleGroups": ["Biceps", "Forearms (Flexors)"],
    "equipmentNeeded": ["Barbell", "EZ-Curl Bar (optional)"],
    "imageUrls": ["assets/images/exercises/barbell-bicep-curl_1.jpg", "assets/images/exercises/barbell-bicep-curl_2.jpg"]
  },
  {
    "id": "barbell-romanian-deadlift",
    "name": "Barbell Romanian Deadlift (RDL)",
    "description": "Targets hamstrings and glutes by hinging at the hips with a slight knee bend, keeping the barbell close to the legs.",
    "category": "barbells",
    "primaryMuscleGroup": "Hamstrings",
    "muscleGroups": ["Hamstrings", "Glutes", "Lower Back", "Erector Spinae"],
    "equipmentNeeded": ["Barbell"],
    "imageUrls": ["assets/images/exercises/barbell-rdl_1.jpg", "assets/images/exercises/barbell-rdl_2.jpg"]
  },
  {
    "id": "dumbbell-bench-press",
    "name": "Dumbbell Bench Press",
    "description": "A compound exercise that targets the chest, shoulders, and triceps using dumbbells on a bench, allowing for greater range of motion.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Chest", "Triceps", "Shoulders (Anterior)"],
    "equipmentNeeded": ["Dumbbells", "Bench"],
    "imageUrls": ["assets/images/exercises/db-bench-press_1.jpg", "assets/images/exercises/db-bench-press_2.jpg"],
    "notes": "Keep your feet flat on the floor and maintain a slight arch in your lower back."
  },
  {
    "id": "dumbbell-shoulder-press",
    "name": "Dumbbell Shoulder Press",
    "description": "A compound shoulder exercise pressing dumbbells overhead, allowing for independent arm movement.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Shoulders (Anterior & Medial)",
    "muscleGroups": ["Shoulders (Anterior, Medial)", "Triceps", "Traps (Upper)"],
    "equipmentNeeded": ["Dumbbells", "Bench (optional)"],
    "imageUrls": ["assets/images/exercises/db-shoulder-press_1.jpg", "assets/images/exercises/db-shoulder-press_2.jpg"]
  },
  {
    "id": "dumbbell-row",
    "name": "Dumbbell Row (Single Arm)",
    "description": "A unilateral back exercise targeting lats, rhomboids, and biceps, typically performed with one knee and hand on a bench.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Lats",
    "muscleGroups": ["Lats", "Rhomboids", "Traps (Middle)", "Biceps", "Forearms"],
    "equipmentNeeded": ["Dumbbell", "Bench"],
    "imageUrls": ["assets/images/exercises/db-row_1.jpg", "assets/images/exercises/db-row_2.jpg"]
  },
  {
    "id": "dumbbell-bicep-curl",
    "name": "Dumbbell Bicep Curl",
    "description": "An isolation exercise for biceps using dumbbells, allowing for supination (wrist rotation).",
    "category": "dumbbells",
    "primaryMuscleGroup": "Biceps",
    "muscleGroups": ["Biceps", "Brachialis", "Forearms (Flexors)"],
    "equipmentNeeded": ["Dumbbells"],
    "imageUrls": ["assets/images/exercises/db-bicep-curl_1.jpg", "assets/images/exercises/db-bicep-curl_2.jpg"]
  },
  {
    "id": "dumbbell-tricep-extension-overhead",
    "name": "Dumbbell Overhead Tricep Extension",
    "description": "An isolation exercise for triceps, performed by extending a dumbbell overhead.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Triceps",
    "muscleGroups": ["Triceps (Long Head)"],
    "equipmentNeeded": ["Dumbbell"],
    "imageUrls": ["assets/images/exercises/db-tricep-overhead_1.jpg", "assets/images/exercises/db-tricep-overhead_2.jpg"]
  },
  {
    "id": "dumbbell-lunge",
    "name": "Dumbbell Lunge",
    "description": "Lunges performed while holding dumbbells, adding resistance to the lower body.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Hamstrings", "Calves"],
    "equipmentNeeded": ["Dumbbells"],
    "imageUrls": ["assets/images/exercises/db-lunge_1.jpg", "assets/images/exercises/db-lunge_2.jpg"]
  },
  {
    "id": "dumbbell-romanian-deadlift",
    "name": "Dumbbell Romanian Deadlift (RDL)",
    "description": "Targets hamstrings and glutes using dumbbells, focusing on hip hinge movement.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Hamstrings",
    "muscleGroups": ["Hamstrings", "Glutes", "Lower Back"],
    "equipmentNeeded": ["Dumbbells"],
    "imageUrls": ["assets/images/exercises/db-rdl_1.jpg", "assets/images/exercises/db-rdl_2.jpg"]
  },
  {
    "id": "goblet-squat",
    "name": "Goblet Squat",
    "description": "A squat variation holding a single dumbbell or kettlebell at chest level, promoting an upright torso.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Adductors", "Core"],
    "equipmentNeeded": ["Dumbbell", "Kettlebell (alternative)"],
    "imageUrls": ["assets/images/exercises/goblet-squat_1.jpg", "assets/images/exercises/goblet-squat_2.jpg"]
  },
  {
    "id": "dumbbell-lateral-raise",
    "name": "Dumbbell Lateral Raise",
    "description": "An isolation exercise for the medial (side) deltoids, lifting dumbbells out to the sides.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Shoulders (Medial)",
    "muscleGroups": ["Shoulders (Medial)"],
    "equipmentNeeded": ["Dumbbells"],
    "imageUrls": ["assets/images/exercises/db-lateral-raise_1.jpg", "assets/images/exercises/db-lateral-raise_2.jpg"]
  },
  {
    "id": "dumbbell-front-raise",
    "name": "Dumbbell Front Raise",
    "description": "An isolation exercise for the anterior (front) deltoids, lifting dumbbells forward.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Shoulders (Anterior)",
    "muscleGroups": ["Shoulders (Anterior)"],
    "equipmentNeeded": ["Dumbbells"],
    "imageUrls": ["assets/images/exercises/db-front-raise_1.jpg", "assets/images/exercises/db-front-raise_2.jpg"]
  },
  {
    "id": "kettlebell-swing",
    "name": "Kettlebell Swing (Two-Handed)",
    "description": "A dynamic, explosive exercise targeting the posterior chain (glutes, hamstrings, back) and improving power.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Glutes",
    "muscleGroups": ["Glutes", "Hamstrings", "Lower Back", "Core", "Shoulders (stabilizers)"],
    "equipmentNeeded": ["Kettlebells"],
    "imageUrls": ["assets/images/exercises/kb-swing_1.jpg", "assets/images/exercises/kb-swing_2.jpg"]
  },
  {
    "id": "turkish-get-up",
    "name": "Turkish Get-Up (TGU)",
    "description": "A complex, full-body exercise involving transitioning from lying on the floor to standing, all while holding a kettlebell (or dumbbell) overhead. Enhances stability, mobility, and strength.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Core", "Shoulders (stabilizers)", "Glutes", "Legs", "Triceps"],
    "equipmentNeeded": ["Kettlebell", "Dumbbell (alternative)"],
    "imageUrls": ["assets/images/exercises/turkish-get-up_1.jpg", "assets/images/exercises/turkish-get-up_2.jpg", "assets/images/exercises/turkish-get-up_3.jpg"]
  },
  {
    "id": "farmers-walk",
    "name": "Farmer's Walk",
    "description": "A full-body exercise involving walking for a distance while holding heavy weights (dumbbells, kettlebells, or farmer's walk handles). Improves grip strength, core stability, and overall conditioning.",
    "category": "other",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Forearms (Grip)", "Traps", "Core", "Shoulders (stabilizers)", "Legs"],
    "equipmentNeeded": ["Heavy Dumbbells", "Kettlebells", "Farmer's Walk Handles"],
    "imageUrls": ["assets/images/exercises/farmers-walk_1.jpg", "assets/images/exercises/farmers-walk_2.jpg"]
  },
  {
    "id": "kettlebell-single-arm-row",
    "name": "Kettlebell Single Arm Row",
    "description": "A unilateral back exercise targeting lats, rhomboids, and biceps, performed by pulling a kettlebell towards the torso, often with one hand and knee supported on a bench.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Lats",
    "muscleGroups": ["Lats", "Rhomboids", "Traps (Middle)", "Biceps", "Forearms", "Core (stabilizer)"],
    "equipmentNeeded": ["Kettlebell", "Bench (optional for support)"],
    "imageUrls": ["assets/images/exercises/kb-single-arm-row_1.jpg", "assets/images/exercises/kb-single-arm-row_2.jpg"]
  },
  {
    "id": "kettlebell-deadlift",
    "name": "Kettlebell Deadlift",
    "description": "A foundational strength exercise using one or two kettlebells to target the posterior chain, focusing on a hip hinge movement. Can be done with Kettlebell between feet or outside (suitcase style).",
    "category": "kettlebells",
    "primaryMuscleGroup": "Hamstrings",
    "muscleGroups": ["Hamstrings", "Glutes", "Lower Back", "Core", "Traps", "Forearms (Grip)"],
    "equipmentNeeded": ["Kettlebell"],
    "imageUrls": ["assets/images/exercises/kb-deadlift_1.jpg", "assets/images/exercises/kb-deadlift_2.jpg"]
  },
  {
    "id": "kettlebell-strict-press",
    "name": "Kettlebell Strict Press (Single Arm)",
    "description": "An overhead pressing exercise for shoulder and tricep strength, performed with a single kettlebell from the rack position without using leg drive.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Shoulders (Anterior & Medial)",
    "muscleGroups": ["Shoulders (Anterior, Medial)", "Triceps", "Traps (Upper)", "Core (stabilizer)"],
    "equipmentNeeded": ["Kettlebells"],
    "imageUrls": ["assets/images/exercises/kb-strict-press_1.jpg", "assets/images/exercises/kb-strict-press_2.jpg"]
  },
  {
    "id": "kettlebell-rack-lunge",
    "name": "Kettlebell Lunge (Rack Position)",
    "description": "A unilateral leg exercise that builds strength, stability, and core engagement, performed while holding one or two kettlebells in the front rack position.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Hamstrings", "Core (stabilizer)"],
    "equipmentNeeded": ["Kettlebell"],
    "imageUrls": ["assets/images/exercises/kb-rack-lunge_1.jpg", "assets/images/exercises/kb-rack-lunge_2.jpg"]
  },
  {
    "id": "kettlebell-russian-twist",
    "name": "Kettlebell Russian Twist",
    "description": "A core exercise targeting the obliques and rectus abdominis, performed by sitting with knees bent and feet off the ground (optional), twisting the torso from side to side while holding a kettlebell.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Core (Obliques)",
    "muscleGroups": ["Core (Obliques, Rectus Abdominis)", "Hip Flexors", "Lower Back (stabilizer)"],
    "equipmentNeeded": ["Kettlebells"],
    "imageUrls": ["assets/images/exercises/kb-russian-twist_1.jpg", "assets/images/exercises/kb-russian-twist_2.jpg"]
  },
  {
    "id": "kettlebell-high-pull",
    "name": "Kettlebell High Pull",
    "description": "An explosive exercise that develops power in the hips, back, and shoulders. It involves pulling the kettlebell from a swing position (or floor) up towards chin height, keeping the elbow high.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Shoulders",
    "muscleGroups": ["Shoulders (Deltoids, Traps)", "Glutes", "Hamstrings", "Back (Upper)", "Biceps", "Core"],
    "equipmentNeeded": ["Kettlebells"],
    "imageUrls": ["assets/images/exercises/kb-high-pull_1.jpg", "assets/images/exercises/kb-high-pull_2.jpg"]
  },
  {
    "id": "kettlebell-suitcase-carry",
    "name": "Kettlebell Suitcase Carry",
    "description": "A unilateral loaded carry exercise that challenges core stability, grip strength, and posture by carrying a single heavy kettlebell in one hand, like a suitcase.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Core (Obliques)",
    "muscleGroups": ["Core (Obliques, Quadratus Lumborum)", "Forearms (Grip)", "Traps", "Shoulders (stabilizers)", "Hips (stabilizers)"],
    "equipmentNeeded": ["Kettlebells"],
    "imageUrls": ["assets/images/exercises/kb-suitcase-carry_1.jpg", "assets/images/exercises/kb-suitcase-carry_2.jpg"]
  },
  {
    "id": "kettlebell-thruster",
    "name": "Kettlebell Thruster",
    "description": "A full-body compound exercise combining a kettlebell front squat with an overhead press in one fluid movement. Can be done with one or two kettlebells.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Quadriceps", "Glutes", "Shoulders", "Triceps", "Core"],
    "equipmentNeeded": ["Kettlebell"],
    "imageUrls": ["assets/images/exercises/kb-thruster_1.jpg", "assets/images/exercises/kb-thruster_2.jpg"]
  },
  {
    "id": "lat-pulldown-machine",
    "name": "Lat Pulldown (Machine)",
    "description": "A machine-based exercise targeting the latissimus dorsi muscles by pulling a bar down towards the chest.",
    "category": "machines",
    "primaryMuscleGroup": "Lats",
    "muscleGroups": ["Lats", "Biceps", "Rhomboids", "Traps (Middle & Lower)"],
    "equipmentNeeded": ["Lat Pulldown Machine"],
    "imageUrls": ["assets/images/exercises/lat-pulldown_1.jpg", "assets/images/exercises/lat-pulldown_2.jpg"]
  },
  {
    "id": "seated-row-machine",
    "name": "Seated Row (Machine)",
    "description": "A machine exercise for back thickness, targeting the middle back muscles by pulling handles towards the torso.",
    "category": "machines",
    "primaryMuscleGroup": "Middle Back",
    "muscleGroups": ["Rhomboids", "Lats", "Traps (Middle)", "Biceps", "Posterior Deltoids"],
    "equipmentNeeded": ["Seated Row Machine"],
    "imageUrls": ["assets/images/exercises/seated-row-machine_1.jpg", "assets/images/exercises/seated-row-machine_2.jpg"]
  },
  {
    "id": "leg-press-machine",
    "name": "Leg Press (Machine)",
    "description": "A compound lower body exercise performed on a machine, pushing a weighted platform away with the legs.",
    "category": "machines",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Hamstrings", "Calves (depending on foot placement)"],
    "equipmentNeeded": ["Leg Press Machine"],
    "imageUrls": ["assets/images/exercises/leg-press_1.jpg", "assets/images/exercises/leg-press_2.jpg"]
  },
  {
    "id": "leg-extension-machine",
    "name": "Leg Extension (Machine)",
    "description": "An isolation exercise for the quadriceps, extending the lower legs against resistance.",
    "category": "machines",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps"],
    "equipmentNeeded": ["Leg Extension Machine"],
    "imageUrls": ["assets/images/exercises/leg-extension_1.jpg", "assets/images/exercises/leg-extension_2.jpg"]
  },
  {
    "id": "leg-curl-machine",
    "name": "Leg Curl (Machine - Lying or Seated)",
    "description": "An isolation exercise for the hamstrings, curling the lower legs towards the glutes against resistance.",
    "category": "machines",
    "primaryMuscleGroup": "Hamstrings",
    "muscleGroups": ["Hamstrings"],
    "equipmentNeeded": ["Leg Curl Machine"],
    "imageUrls": ["assets/images/exercises/leg-curl_1.jpg", "assets/images/exercises/leg-curl_2.jpg"]
  },
  {
    "id": "chest-press-machine",
    "name": "Chest Press (Machine)",
    "description": "A machine-based compound exercise for the chest, similar to a bench press but with a fixed movement path.",
    "category": "machines",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Chest", "Triceps", "Shoulders (Anterior)"],
    "equipmentNeeded": ["Chest Press Machine"],
    "imageUrls": ["assets/images/exercises/chest-press-machine_1.jpg", "assets/images/exercises/chest-press-machine_2.jpg"]
  },
  {
    "id": "shoulder-press-machine",
    "name": "Shoulder Press (Machine)",
    "description": "A machine exercise for the shoulders, pressing handles overhead with a guided motion.",
    "category": "machines",
    "primaryMuscleGroup": "Shoulders (Anterior & Medial)",
    "muscleGroups": ["Shoulders (Anterior, Medial)", "Triceps"],
    "equipmentNeeded": ["Shoulder Press Machine"],
    "imageUrls": ["assets/images/exercises/shoulder-press-machine_1.jpg", "assets/images/exercises/shoulder-press-machine_2.jpg"]
  },
  {
    "id": "pec-deck-fly-machine",
    "name": "Pec Deck Fly (Machine)",
    "description": "An isolation exercise for the chest, bringing arms together in a fly motion using a machine.",
    "category": "machines",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Chest (Pectoralis Major)"],
    "equipmentNeeded": ["Pec Deck Machine"],
    "imageUrls": ["assets/images/exercises/pec-deck_1.jpg", "assets/images/exercises/pec-deck_2.jpg"]
  },
  {
    "id": "reverse-pec-deck-machine",
    "name": "Reverse Pec Deck (Rear Delt Fly)",
    "description": "A machine exercise targeting the posterior deltoids (rear shoulders) and upper back muscles.",
    "category": "machines",
    "primaryMuscleGroup": "Shoulders (Posterior)",
    "muscleGroups": ["Shoulders (Posterior)", "Rhomboids", "Traps (Middle)"],
    "equipmentNeeded": ["Reverse Pec Deck Machine"],
    "imageUrls": ["assets/images/exercises/reverse-pec-deck_1.jpg", "assets/images/exercises/reverse-pec-deck_2.jpg"]
  },
  {
    "id": "calf-raise-machine",
    "name": "Calf Raise (Machine - Standing or Seated)",
    "description": "An isolation exercise for the calf muscles (gastrocnemius and soleus).",
    "category": "machines",
    "primaryMuscleGroup": "Calves",
    "muscleGroups": ["Calves (Gastrocnemius, Soleus)"],
    "equipmentNeeded": ["Calf Raise Machine"],
    "imageUrls": ["assets/images/exercises/calf-raise-machine_1.jpg", "assets/images/exercises/calf-raise-machine_2.jpg"]
  },
  {
    "id": "cable-tricep-pushdown",
    "name": "Cable Tricep Pushdown (Rope or Bar)",
    "description": "An isolation exercise for the triceps using a cable machine with a rope or bar attachment.",
    "category": "cables",
    "primaryMuscleGroup": "Triceps",
    "muscleGroups": ["Triceps"],
    "equipmentNeeded": ["Cable Machine", "Rope Attachment or Straight/V-Bar"],
    "imageUrls": ["assets/images/exercises/cable-tricep-pushdown_1.jpg", "assets/images/exercises/cable-tricep-pushdown_2.jpg"]
  },
  {
    "id": "cable-bicep-curl",
    "name": "Cable Bicep Curl (Bar or Handles)",
    "description": "An isolation exercise for biceps using a cable machine, providing constant tension.",
    "category": "cables",
    "primaryMuscleGroup": "Biceps",
    "muscleGroups": ["Biceps", "Brachialis"],
    "equipmentNeeded": ["Cable Machine", "Straight Bar or D-Handles"],
    "imageUrls": ["assets/images/exercises/cable-bicep-curl_1.jpg", "assets/images/exercises/cable-bicep-curl_2.jpg"]
  },
  {
    "id": "cable-face-pull",
    "name": "Cable Face Pull",
    "description": "An excellent exercise for rear deltoids, rotator cuff health, and upper back posture.",
    "category": "cables",
    "primaryMuscleGroup": "Shoulders (Posterior)",
    "muscleGroups": ["Shoulders (Posterior)", "Rhomboids", "Traps (Middle & Lower)", "Rotator Cuff"],
    "equipmentNeeded": ["Cable Machine", "Rope Attachment"],
    "imageUrls": ["assets/images/exercises/cable-face-pull_1.jpg", "assets/images/exercises/cable-face-pull_2.jpg"]
  },
  {
    "id": "cable-fly",
    "name": "Cable Fly (Standing - High, Mid, or Low)",
    "description": "An isolation exercise for the chest using a cable machine, allowing for various angles to target different parts of the chest.",
    "category": "cables",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Chest (Pectoralis Major - Sternal, Clavicular, Costal depending on angle)"],
    "equipmentNeeded": ["Cable Machine (Dual Pulleys)", "D-Handles"],
    "imageUrls": ["assets/images/exercises/cable-fly_1.jpg", "assets/images/exercises/cable-fly_2.jpg"]
  },
  {
    "id": "cable-lateral-raise",
    "name": "Cable Lateral Raise",
    "description": "An isolation exercise for the medial deltoids using a cable, providing constant tension throughout the movement.",
    "category": "cables",
    "primaryMuscleGroup": "Shoulders (Medial)",
    "muscleGroups": ["Shoulders (Medial)"],
    "equipmentNeeded": ["Cable Machine", "D-Handle"],
    "imageUrls": ["assets/images/exercises/cable-lateral-raise_1.jpg", "assets/images/exercises/cable-lateral-raise_2.jpg"]
  },
  {
    "id": "cable-woodchop",
    "name": "Cable Woodchop (High to Low or Low to High)",
    "description": "A core rotational exercise engaging the obliques and transverse abdominis.",
    "category": "cables",
    "primaryMuscleGroup": "Core (Obliques)",
    "muscleGroups": ["Core (Obliques, Transverse Abdominis, Rectus Abdominis)", "Shoulders", "Back"],
    "equipmentNeeded": ["Cable Machine", "D-Handle or Rope"],
    "imageUrls": ["assets/images/exercises/cable-woodchop_1.jpg", "assets/images/exercises/cable-woodchop_2.jpg"]
  },
  {
    "id": "resistance-band-bicep-curl",
    "name": "Resistance Band Bicep Curl",
    "description": "Bicep curls performed with a resistance band, providing variable resistance.",
    "category": "bands",
    "primaryMuscleGroup": "Biceps",
    "muscleGroups": ["Biceps", "Forearms"],
    "equipmentNeeded": ["Resistance Band"],
    "imageUrls": ["assets/images/exercises/band-bicep-curl_1.jpg", "assets/images/exercises/band-bicep-curl_2.jpg"]
  },
  {
    "id": "resistance-band-tricep-pushdown",
    "name": "Resistance Band Tricep Pushdown",
    "description": "Tricep pushdowns using a resistance band anchored overhead or held.",
    "category": "bands",
    "primaryMuscleGroup": "Triceps",
    "muscleGroups": ["Triceps"],
    "equipmentNeeded": ["Resistance Band", "Anchor Point (optional)"],
    "imageUrls": ["assets/images/exercises/band-tricep-pushdown_1.jpg", "assets/images/exercises/band-tricep-pushdown_2.jpg"]
  },
  {
    "id": "resistance-band-pull-apart",
    "name": "Resistance Band Pull-Apart",
    "description": "A great exercise for shoulder health, targeting the rear deltoids and upper back muscles.",
    "category": "bands",
    "primaryMuscleGroup": "Shoulders (Posterior)",
    "muscleGroups": ["Shoulders (Posterior)", "Rhomboids", "Traps (Middle)"],
    "equipmentNeeded": ["Resistance Band (Light to Medium)"],
    "imageUrls": ["assets/images/exercises/band-pull-apart_1.jpg", "assets/images/exercises/band-pull-apart_2.jpg"]
  },
  {
    "id": "resistance-band-squat",
    "name": "Resistance Band Squat",
    "description": "Squats performed with a resistance band underfoot and looped over shoulders or held, adding resistance.",
    "category": "bands",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Hamstrings"],
    "equipmentNeeded": ["Resistance Band (Loop or with Handles)"],
    "imageUrls": ["assets/images/exercises/band-squat_1.jpg", "assets/images/exercises/band-squat_2.jpg"]
  },
  {
    "id": "resistance-band-glute-bridge",
    "name": "Resistance Band Glute Bridge",
    "description": "Glute bridges with a resistance band around the thighs for added glute medius activation.",
    "category": "bands",
    "primaryMuscleGroup": "Glutes",
    "muscleGroups": ["Glutes", "Hamstrings", "Core"],
    "equipmentNeeded": ["Resistance Band (Loop)"],
    "imageUrls": ["assets/images/exercises/band-glute-bridge_1.jpg", "assets/images/exercises/band-glute-bridge_2.jpg"]
  },
  {
    "id": "farmers-walk",
    "name": "Farmer's Walk",
    "description": "A full-body exercise involving walking for a distance while holding heavy weights (dumbbells, kettlebells, or farmer's walk handles). Improves grip strength, core stability, and overall conditioning.",
    "category": "other",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Forearms (Grip)", "Traps", "Core", "Shoulders (stabilizers)", "Legs"],
    "equipmentNeeded": ["Heavy Dumbbells", "Kettlebells", "Farmer's Walk Handles"],
    "imageUrls": ["assets/images/exercises/farmers-walk_1.jpg", "assets/images/exercises/farmers-walk_2.jpg"]
  },
  {
    "id": "box-jump",
    "name": "Box Jump",
    "description": "A plyometric exercise that involves jumping onto an elevated platform, developing explosive power in the lower body.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Hamstrings", "Calves"],
    "equipmentNeeded": ["Plyo Box or Sturdy Platform"],
    "imageUrls": ["assets/images/exercises/box-jump_1.jpg", "assets/images/exercises/box-jump_2.jpg"],
    "notes": "Ensure the box is stable. Land softly on the box."
  },
  {
    "id": "medicine-ball-slam",
    "name": "Medicine Ball Slam",
    "description": "A full-body power exercise involving lifting a medicine ball overhead and slamming it forcefully onto the ground.",
    "category": "other",
    "primaryMuscleGroup": "Core",
    "muscleGroups": ["Core", "Lats", "Shoulders", "Triceps", "Legs"],
    "equipmentNeeded": ["Medicine Ball (Slam Ball)"],
    "imageUrls": ["assets/images/exercises/mb-slam_1.jpg", "assets/images/exercises/mb-slam_2.jpg"]
  },
  {
    "id": "glute-bridge",
    "name": "Glute Bridge",
    "description": "A bodyweight exercise targeting the glutes and hamstrings by lifting the hips off the floor.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Glutes",
    "muscleGroups": ["Glutes", "Hamstrings", "Core (Lower Back)"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/exercises/glute-bridge_1.jpg", "assets/images/exercises/glute-bridge_2.jpg"]
  },
  {
    "id": "superman-exercise",
    "name": "Superman",
    "description": "A bodyweight exercise that strengthens the lower back, glutes, and hamstrings by simultaneously lifting arms and legs off the floor while lying prone.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Lower Back",
    "muscleGroups": ["Lower Back (Erector Spinae)", "Glutes", "Hamstrings"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/exercises/superman_1.jpg", "assets/images/exercises/superman_2.jpg"]
  },
  {
    "id": "mountain-climbers",
    "name": "Mountain Climbers",
    "description": "A dynamic full-body exercise that builds cardio endurance, core strength, and agility, mimicking the motion of climbing a mountain.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Core",
    "muscleGroups": ["Core", "Shoulders", "Quadriceps", "Hip Flexors"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/exercises/mountain-climbers_1.jpg", "assets/images/exercises/mountain-climbers_2.jpg"]
  },
  {
    "id": "bench-dips",
    "name": "Bench Dips (Triceps)",
    "description": "A bodyweight exercise targeting the triceps, performed using a bench or chair.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Triceps",
    "muscleGroups": ["Triceps", "Shoulders (Anterior)", "Chest (Lower)"],
    "equipmentNeeded": ["Bench or sturdy chair"],
    "imageUrls": ["assets/images/exercises/bench-dips_1.jpg", "assets/images/exercises/bench-dips_2.jpg"]
  },
  {
    "id": "bodyweight-calf-raise",
    "name": "Bodyweight Calf Raise",
    "description": "A simple yet effective bodyweight exercise to strengthen the calf muscles.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Calves",
    "muscleGroups": ["Calves (Gastrocnemius, Soleus)"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/exercises/bw-calf-raise_1.jpg", "assets/images/exercises/bw-calf-raise_2.jpg"]
  },
  {
    "id": "barbell-hip-thrust",
    "name": "Barbell Hip Thrust",
    "description": "A powerful glute exercise performed by thrusting the hips upward with a barbell across the lap, typically with the upper back supported on a bench.",
    "category": "barbells",
    "primaryMuscleGroup": "Glutes",
    "muscleGroups": ["Glutes", "Hamstrings", "Core"],
    "equipmentNeeded": ["Barbell", "Bench", "Padding (optional)"],
    "imageUrls": ["assets/images/exercises/barbell-hip-thrust_1.jpg", "assets/images/exercises/barbell-hip-thrust_2.jpg"]
  },
  {
    "id": "barbell-front-squat",
    "name": "Barbell Front Squat",
    "description": "A squat variation where the barbell is held across the front of the shoulders, emphasizing quads and core stability.",
    "category": "barbells",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Core", "Upper Back"],
    "equipmentNeeded": ["Barbell", "Squat Rack"],
    "imageUrls": ["assets/images/exercises/barbell-front-squat_1.jpg", "assets/images/exercises/barbell-front-squat_2.jpg"]
  },
  {
    "id": "barbell-good-morning",
    "name": "Barbell Good Morning",
    "description": "An exercise targeting the posterior chain (hamstrings, glutes, lower back) by hinging at the hips with a barbell on the upper back.",
    "category": "barbells",
    "primaryMuscleGroup": "Hamstrings",
    "muscleGroups": ["Hamstrings", "Glutes", "Lower Back (Erector Spinae)"],
    "equipmentNeeded": ["Barbell", "Rack (optional)"],
    "imageUrls": ["assets/images/exercises/barbell-good-morning_1.jpg", "assets/images/exercises/barbell-good-morning_2.jpg"]
  },
  {
    "id": "dumbbell-incline-press",
    "name": "Dumbbell Incline Press",
    "description": "Targets the upper chest, shoulders, and triceps by pressing dumbbells on an incline bench.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Chest (Upper)",
    "muscleGroups": ["Chest (Upper)", "Shoulders (Anterior)", "Triceps"],
    "equipmentNeeded": ["Dumbbells", "Incline Bench"],
    "imageUrls": ["assets/images/exercises/db-incline-press_1.jpg", "assets/images/exercises/db-incline-press_2.jpg"]
  },
  {
    "id": "dumbbell-fly",
    "name": "Dumbbell Fly",
    "description": "An isolation exercise for the chest, performed by opening and closing the arms in an arc motion while holding dumbbells.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Chest", "Shoulders (Anterior - stabilizer)"],
    "equipmentNeeded": ["Dumbbells", "Bench"],
    "imageUrls": ["assets/images/exercises/db-fly_1.jpg", "assets/images/exercises/db-fly_2.jpg"]
  },
  {
    "id": "dumbbell-hammer-curl",
    "name": "Dumbbell Hammer Curl",
    "description": "A bicep curl variation with a neutral grip (palms facing each other), targeting the brachialis and brachioradialis in addition to the biceps.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Biceps",
    "muscleGroups": ["Biceps", "Brachialis", "Brachioradialis (Forearms)"],
    "equipmentNeeded": ["Dumbbells"],
    "imageUrls": ["assets/images/exercises/db-hammer-curl_1.jpg", "assets/images/exercises/db-hammer-curl_2.jpg"]
  },
  {
    "id": "dumbbell-tricep-kickback",
    "name": "Dumbbell Tricep Kickback",
    "description": "An isolation exercise for the triceps, performed by extending the arm backward while hinged at the hips.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Triceps",
    "muscleGroups": ["Triceps"],
    "equipmentNeeded": ["Dumbbell", "Bench (optional for support)"],
    "imageUrls": ["assets/images/exercises/db-tricep-kickback_1.jpg", "assets/images/exercises/db-tricep-kickback_2.jpg"]
  },
  {
    "id": "dumbbell-bulgarian-split-squat",
    "name": "Dumbbell Bulgarian Split Squat",
    "description": "A unilateral leg exercise with the rear foot elevated, targeting quads, glutes, and hamstrings while improving balance.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Hamstrings", "Adductors"],
    "equipmentNeeded": ["Dumbbells", "Bench or elevated surface"],
    "imageUrls": ["assets/images/exercises/db-bulgarian-split-squat_1.jpg", "assets/images/exercises/db-bulgarian-split-squat_2.jpg"]
  },
  {
    "id": "dumbbell-pullover",
    "name": "Dumbbell Pullover",
    "description": "An exercise that works the chest and lats, performed by lying on a bench and lowering a dumbbell behind the head.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Chest", "Lats", "Triceps (Long Head)", "Serratus Anterior"],
    "equipmentNeeded": ["Dumbbell", "Bench"],
    "imageUrls": ["assets/images/exercises/db-pullover_1.jpg", "assets/images/exercises/db-pullover_2.jpg"]
  },
  {
    "id": "kettlebell-halo",
    "name": "Kettlebell Halo",
    "description": "A shoulder mobility and stability exercise involving circling a kettlebell around the head.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Shoulders (stabilizers)",
    "muscleGroups": ["Shoulders (Rotator Cuff, Deltoids)", "Core", "Upper Back"],
    "equipmentNeeded": ["Kettlebells"],
    "imageUrls": ["assets/images/exercises/kb-halo_1.jpg", "assets/images/exercises/kb-halo_2.jpg"]
  },
  {
    "id": "hack-squat-machine",
    "name": "Hack Squat (Machine)",
    "description": "A machine-based squat variation that targets the quadriceps, often with a focus on the outer quads.",
    "category": "machines",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Hamstrings"],
    "equipmentNeeded": ["Hack Squat Machine"],
    "imageUrls": ["assets/images/exercises/hack-squat-machine_1.jpg", "assets/images/exercises/hack-squat-machine_2.jpg"]
  },
  {
    "id": "seated-calf-raise-machine",
    "name": "Seated Calf Raise (Machine)",
    "description": "An isolation exercise for the soleus muscle of the calf, performed on a seated machine.",
    "category": "machines",
    "primaryMuscleGroup": "Calves (Soleus)",
    "muscleGroups": ["Calves (Soleus)"],
    "equipmentNeeded": ["Seated Calf Raise Machine"],
    "imageUrls": ["assets/images/exercises/seated-calf-raise-machine_1.jpg", "assets/images/exercises/seated-calf-raise-machine_2.jpg"],
    "notes": "This specifically targets the soleus due to the knee being bent."
  },
  {
    "id": "abdominal-crunch-machine",
    "name": "Abdominal Crunch (Machine)",
    "description": "A machine-based exercise for isolating the rectus abdominis muscles.",
    "category": "machines",
    "primaryMuscleGroup": "Abs (Rectus Abdominis)",
    "muscleGroups": ["Abs (Rectus Abdominis)"],
    "equipmentNeeded": ["Abdominal Crunch Machine"],
    "imageUrls": ["assets/images/exercises/ab-crunch-machine_1.jpg", "assets/images/exercises/ab-crunch-machine_2.jpg"]
  },
  {
    "id": "back-extension-machine",
    "name": "Back Extension (Hyperextension Machine)",
    "description": "Strengthens the lower back, glutes, and hamstrings using a hyperextension bench or machine.",
    "category": "machines",
    "primaryMuscleGroup": "Lower Back (Erector Spinae)",
    "muscleGroups": ["Lower Back (Erector Spinae)", "Glutes", "Hamstrings"],
    "equipmentNeeded": ["Hyperextension Bench/Machine"],
    "imageUrls": ["assets/images/exercises/back-extension-machine_1.jpg", "assets/images/exercises/back-extension-machine_2.jpg"]
  },
  {
    "id": "cable-overhead-tricep-extension",
    "name": "Cable Overhead Tricep Extension (Rope)",
    "description": "Targets the long head of the triceps using a cable machine and rope attachment.",
    "category": "cables",
    "primaryMuscleGroup": "Triceps (Long Head)",
    "muscleGroups": ["Triceps (Long Head)"],
    "equipmentNeeded": ["Cable Machine", "Rope Attachment"],
    "imageUrls": ["assets/images/exercises/cable-overhead-tricep_1.jpg", "assets/images/exercises/cable-overhead-tricep_2.jpg"]
  },
  {
    "id": "cable-pull-through",
    "name": "Cable Pull-Through",
    "description": "A hip hinge exercise that targets the glutes and hamstrings using a cable machine.",
    "category": "cables",
    "primaryMuscleGroup": "Glutes",
    "muscleGroups": ["Glutes", "Hamstrings", "Lower Back"],
    "equipmentNeeded": ["Cable Machine (Low Pulley)", "Rope Attachment"],
    "imageUrls": ["assets/images/exercises/cable-pull-through_1.jpg", "assets/images/exercises/cable-pull-through_2.jpg"]
  },
  {
    "id": "cable-reverse-fly",
    "name": "Cable Reverse Fly",
    "description": "Targets the posterior deltoids and upper back muscles using a cable machine with dual pulleys.",
    "category": "cables",
    "primaryMuscleGroup": "Shoulders (Posterior)",
    "muscleGroups": ["Shoulders (Posterior)", "Rhomboids", "Traps (Middle)"],
    "equipmentNeeded": ["Cable Machine (Dual Pulleys)", "D-Handles"],
    "imageUrls": ["assets/images/exercises/cable-reverse-fly_1.jpg", "assets/images/exercises/cable-reverse-fly_2.jpg"]
  },
  {
    "id": "cable-torso-twist",
    "name": "Cable Torso Twist (Standing)",
    "description": "A core exercise targeting the obliques through rotational movement against cable resistance.",
    "category": "cables",
    "primaryMuscleGroup": "Core (Obliques)",
    "muscleGroups": ["Core (Obliques, Transverse Abdominis)", "Shoulders (stabilizers)"],
    "equipmentNeeded": ["Cable Machine", "D-Handle"],
    "imageUrls": ["assets/images/exercises/cable-torso-twist_1.jpg", "assets/images/exercises/cable-torso-twist_2.jpg"]
  },
  {
    "id": "resistance-band-chest-press",
    "name": "Resistance Band Chest Press",
    "description": "A chest press variation using resistance bands, can be done standing or lying down.",
    "category": "bands",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Chest", "Triceps", "Shoulders (Anterior)"],
    "equipmentNeeded": ["Resistance Band", "Anchor Point (optional)"],
    "imageUrls": ["assets/images/exercises/band-chest-press_1.jpg", "assets/images/exercises/band-chest-press_2.jpg"]
  },
  {
    "id": "resistance-band-row",
    "name": "Resistance Band Row (Seated or Standing)",
    "description": "Targets back muscles using a resistance band, can be anchored or held.",
    "category": "bands",
    "primaryMuscleGroup": "Lats",
    "muscleGroups": ["Lats", "Rhomboids", "Traps (Middle)", "Biceps"],
    "equipmentNeeded": ["Resistance Band", "Anchor Point (optional)"],
    "imageUrls": ["assets/images/exercises/band-row_1.jpg", "assets/images/exercises/band-row_2.jpg"]
  },
  {
    "id": "resistance-band-deadlift",
    "name": "Resistance Band Deadlift",
    "description": "A deadlift variation using resistance bands, good for learning form or lighter days.",
    "category": "bands",
    "primaryMuscleGroup": "Hamstrings",
    "muscleGroups": ["Hamstrings", "Glutes", "Lower Back", "Core"],
    "equipmentNeeded": ["Resistance Band (Loop or with Handles)"],
    "imageUrls": ["assets/images/exercises/band-deadlift_1.jpg", "assets/images/exercises/band-deadlift_2.jpg"]
  },
  {
    "id": "resistance-band-lateral-walk",
    "name": "Resistance Band Lateral Walk (Crab Walk)",
    "description": "Targets the glute medius and hip abductors, performed by walking sideways with a band around ankles or knees.",
    "category": "bands",
    "primaryMuscleGroup": "Glutes (Medius)",
    "muscleGroups": ["Glutes (Medius, Minimus)", "Hip Abductors"],
    "equipmentNeeded": ["Resistance Band (Loop - mini band)"],
    "imageUrls": ["assets/images/exercises/band-lateral-walk_1.jpg", "assets/images/exercises/band-lateral-walk_2.jpg"]
  },
  {
    "id": "hamstring-stretch",
    "name": "Hamstring Stretch (Standing/Seated)",
    "description": "A static stretch to improve flexibility in the hamstring muscles.",
    "category": "stretching",
    "primaryMuscleGroup": "Hamstrings",
    "muscleGroups": ["Hamstrings", "Calves (sometimes)"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/stretches/hamstring-stretch_1.jpg", "assets/images/stretches/hamstring-stretch_2.jpg"],
    "notes": "Hold for 20-30 seconds. Do not bounce."
  },
  {
    "id": "quadriceps-stretch",
    "name": "Quadriceps Stretch (Standing)",
    "description": "A static stretch for the quadriceps, typically performed by pulling the heel towards the glutes.",
    "category": "stretching",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Hip Flexors (sometimes)"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/stretches/quad-stretch_1.jpg", "assets/images/stretches/quad-stretch_2.jpg"]
  },
  {
    "id": "chest-stretch-doorway",
    "name": "Chest Stretch (Doorway)",
    "description": "A static stretch for the pectoral muscles using a doorway for leverage.",
    "category": "stretching",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Chest", "Shoulders (Anterior)"],
    "equipmentNeeded": ["Doorway"],
    "imageUrls": ["assets/images/stretches/chest-stretch-doorway_1.jpg", "assets/images/stretches/chest-stretch-doorway_2.jpg"]
  },
  {
    "id": "triceps-stretch",
    "name": "Triceps Stretch (Overhead)",
    "description": "A static stretch for the triceps, performed by reaching one arm overhead and bending the elbow.",
    "category": "stretching",
    "primaryMuscleGroup": "Triceps",
    "muscleGroups": ["Triceps", "Lats (slightly)"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/stretches/triceps-stretch_1.jpg"]
  },
  {
    "id": "cat-cow-stretch",
    "name": "Cat-Cow Stretch",
    "description": "A dynamic stretch that improves spinal mobility and relieves tension in the back and core.",
    "category": "stretching",
    "primaryMuscleGroup": "Spine",
    "muscleGroups": ["Spine", "Core", "Back"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/stretches/cat-cow_1.jpg", "assets/images/stretches/cat-cow_2.jpg"]
  },
  {
    "id": "childs-pose",
    "name": "Child's Pose",
    "description": "A gentle resting pose that calms the brain and helps relieve stress and fatigue. It gently stretches the hips, thighs, and ankles.",
    "category": "stretching",
    "primaryMuscleGroup": "Lower Back",
    "muscleGroups": ["Lower Back", "Hips", "Thighs", "Ankles"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/stretches/childs-pose_1.jpg"]
  },
  {
    "id": "jumping-jacks",
    "name": "Jumping Jacks",
    "description": "A classic full-body calisthenic exercise that serves as a good warm-up or cardio burst.",
    "category": "cardio",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Legs", "Shoulders", "Core", "Cardiovascular System"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/cardio/jumping-jacks_1.jpg", "assets/images/cardio/jumping-jacks_2.jpg"]
  },
  {
    "id": "high-knees",
    "name": "High Knees",
    "description": "A cardio-intensive exercise that involves running in place while lifting the knees as high as possible.",
    "category": "cardio",
    "primaryMuscleGroup": "Legs",
    "muscleGroups": ["Quadriceps", "Hip Flexors", "Calves", "Core", "Cardiovascular System"],
    "equipmentNeeded": [],
    "imageUrls": ["assets/images/cardio/high-knees_1.jpg", "assets/images/cardio/high-knees_2.jpg"]
  },
  {
    "id": "running-jogging",
    "name": "Running/Jogging",
    "description": "An effective cardiovascular exercise that improves endurance and burns calories.",
    "category": "cardio",
    "primaryMuscleGroup": "Legs",
    "muscleGroups": ["Legs (Quadriceps, Hamstrings, Glutes, Calves)", "Core", "Cardiovascular System"],
    "equipmentNeeded": ["Treadmill (optional)"],
    "imageUrls": ["assets/images/cardio/running_1.jpg", "assets/images/cardio/jogging_1.jpg"]
  },
  {
    "id": "cycling",
    "name": "Cycling",
    "description": "A low-impact cardiovascular exercise that primarily works the leg muscles.",
    "category": "cardio",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Hamstrings", "Glutes", "Calves", "Cardiovascular System"],
    "equipmentNeeded": ["Bicycle", "Stationary Bike"],
    "imageUrls": ["assets/images/cardio/cycling_1.jpg", "assets/images/cardio/stationary-bike_1.jpg"]
  },
  {
    "id": "jump-rope",
    "name": "Jump Rope",
    "description": "A highly effective cardiovascular exercise that improves coordination, agility, and burns a significant amount of calories.",
    "category": "cardio",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Calves", "Quadriceps", "Shoulders", "Core", "Cardiovascular System"],
    "equipmentNeeded": ["Jump Rope"],
    "imageUrls": ["assets/images/cardio/jump-rope_1.jpg", "assets/images/cardio/jump-rope_2.jpg"]
  },
  {
    "id": "elliptical-trainer",
    "name": "Elliptical Trainer",
    "description": "A low-impact cardio machine that simulates stair climbing, walking, or running without causing excessive pressure to the joints.",
    "category": "cardio",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Legs (Quadriceps, Hamstrings, Glutes, Calves)", "Arms (if handles used)", "Core", "Cardiovascular System"],
    "equipmentNeeded": ["Elliptical Trainer Machine"],
    "imageUrls": ["assets/images/cardio/elliptical_1.jpg", "assets/images/cardio/elliptical_2.jpg"]
  },
  {
    "id": "stair-climbing",
    "name": "Stair Climbing",
    "description": "A vigorous cardiovascular exercise that targets the glutes, quads, and hamstrings.",
    "category": "cardio",
    "primaryMuscleGroup": "Glutes",
    "muscleGroups": ["Glutes", "Quadriceps", "Hamstrings", "Calves", "Cardiovascular System"],
    "equipmentNeeded": ["Stairs", "Stair Climbing Machine"],
    "imageUrls": ["assets/images/cardio/stair-climbing_1.jpg", "assets/images/cardio/stair-machine_1.jpg"]
  },
  {
    "id": "sled-push",
    "name": "Sled Push",
    "description": "A full-body strength and conditioning exercise involving pushing a weighted sled.",
    "category": "other",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Quadriceps", "Glutes", "Calves", "Core", "Chest", "Shoulders", "Triceps"],
    "equipmentNeeded": ["Prowler Sled", "Weights"],
    "imageUrls": ["assets/images/exercises/sled-push_1.jpg", "assets/images/exercises/sled-push_2.jpg"]
  },
  {
    "id": "sled-pull",
    "name": "Sled Pull",
    "description": "A full-body strength and conditioning exercise involving pulling a weighted sled using straps or a harness.",
    "category": "other",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Hamstrings", "Glutes", "Back (Lats, Traps, Rhomboids)", "Biceps", "Forearms", "Core"],
    "equipmentNeeded": ["Prowler Sled", "Weights", "Harness or Straps"],
    "imageUrls": ["assets/images/exercises/sled-pull_1.jpg", "assets/images/exercises/sled-pull_2.jpg"]
  },
  {
    "id": "tire-flip",
    "name": "Tire Flip",
    "description": "A powerful full-body exercise common in strongman training, involving flipping a large tire.",
    "category": "other",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Legs (Quads, Glutes, Hamstrings)", "Back (Lower, Upper)", "Chest", "Shoulders", "Arms", "Core"],
    "equipmentNeeded": ["Large Tire"],
    "imageUrls": ["assets/images/exercises/tire-flip_1.jpg", "assets/images/exercises/tire-flip_2.jpg"]
  },
  {
    "id": "battle-ropes",
    "name": "Battle Ropes",
    "description": "A high-intensity, low-impact exercise that works the upper body, core, and provides a cardiovascular challenge.",
    "category": "other",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Shoulders", "Arms (Biceps, Triceps, Forearms)", "Core", "Back", "Cardiovascular System"],
    "equipmentNeeded": ["Battle Ropes", "Anchor Point"],
    "imageUrls": ["assets/images/exercises/battle-ropes_1.jpg", "assets/images/exercises/battle-ropes_2.jpg"]
  },
  {
    "id": "archer-push-up",
    "name": "Archer Push-up",
    "description": "An advanced push-up variation that enhances unilateral chest and shoulder strength by shifting weight side to side.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Chest", "Triceps", "Shoulders (Anterior)"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/archer-push-up_1.jpg"],
    notes: "Keep your body straight and reach one arm out to the side, then switch sides."
  },
  {
    "id": "pistol-squat",
    "name": "Pistol Squat",
    "description": "A challenging single-leg squat that improves balance, mobility, and leg strength.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Hamstrings", "Core"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/pistol-squat_1.jpg"]
  },
  // Dumbbell Exercises
  {
    "id": "dumbbell-arnold-press",
    "name": "Dumbbell Arnold Press",
    "description": "A shoulder exercise that combines rotation and pressing for full deltoid activation.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Shoulders (Anterior & Lateral)",
    "muscleGroups": ["Shoulders (All Deltoid Heads)", "Triceps"],
    "equipmentNeeded": ["Dumbbells"],
    imageUrls: ["assets/images/exercises/db-arnold-press_1.jpg"]
  },
  {
    "id": "dumbbell-concentration-curl",
    "name": "Dumbbell Concentration Curl",
    "description": "An isolation exercise focusing on the biceps peak by curling with elbow supported on the inner thigh.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Biceps",
    "muscleGroups": ["Biceps"],
    "equipmentNeeded": ["Dumbbell"],
    imageUrls: ["assets/images/exercises/db-concentration-curl_1.jpg"]
  },
  {
    "id": "dumbbell-overhead-lunge",
    "name": "Dumbbell Overhead Lunge",
    "description": "A lower body exercise combining lunges with overhead dumbbell hold to challenge stability and core engagement.",
    "category": "dumbbells",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Core"],
    "equipmentNeeded": ["Dumbbells"],
    imageUrls: ["assets/images/exercises/db-overhead-lunge_1.jpg"]
  },
  // Machine Exercises
  {
    "id": "seated-pec-fly",
    "name": "Seated Pec Deck Fly",
    "description": "An isolation exercise for the chest, focusing on pectoral contraction at various angles.",
    "category": "machines",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Chest"],
    "equipmentNeeded": ["Pec Deck Machine"],
    imageUrls: ["assets/images/exercises/seated-pec-fly_1.jpg"]
  },
  {
    "id": "machine-lateral-raise",
    "name": "Machine Lateral Raise",
    "description": "Targets the medial deltoids with controlled movement on a machine.",
    "category": "machines",
    "primaryMuscleGroup": "Shoulders (Medial)",
    "muscleGroups": ["Shoulders (Medial)"],
    "equipmentNeeded": ["Shoulder Machine"],
    imageUrls: ["assets/images/exercises/machine-lateral-raise_1.jpg"]
  },
  {
    "id": "cable-seated-row",
    "name": "Cable Seated Row",
    "description": "A back exercise focusing on middle and upper back muscles with a seated position.",
    "category": "machines",
    "primaryMuscleGroup": "Middle Back",
    "muscleGroups": ["Rhomboids", "Lats", "Traps", "Biceps"],
    "equipmentNeeded": ["Cable Machine"],
    imageUrls: ["assets/images/exercises/cable-seated-row_1.jpg"]
  },

  // Cardio & Plyometric Exercises
  {
    "id": "burpee-box-jump",
    "name": "Burpee with Box Jump",
    "description": "Combines a burpee with a box jump for increased explosiveness and cardio intensity.",
    "category": "cardio",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Chest", "Legs", "Core", "Arms"],
    "equipmentNeeded": ["Plyo Box"],
    imageUrls: ["assets/images/exercises/burpee-box-jump_1.jpg"]
  },
  {
    "id": "skater-jumps",
    "name": "Skater Jumps",
    "description": "A lateral plyometric exercise that targets legs and improves agility.",
    "category": "cardio",
    "primaryMuscleGroup": "Legs",
    "muscleGroups": ["Quadriceps", "Glutes", "Adductors"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/skater-jumps_1.jpg"]
  },
  {
    "id": "jump-squat",
    "name": "Jump Squat",
    "description": "A plyometric squat that develops explosive power in the lower body.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Hamstrings", "Calves"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/jump-squat_1.jpg"]
  },

  // Flexibility & Stretching
  {
    "id": "hip-flexor-stretch",
    "name": "Hip Flexor Stretch",
    "description": "A static stretch to improve flexibility in the hip flexors.",
    "category": "stretching",
    "primaryMuscleGroup": "Hip Flexors",
    "muscleGroups": ["Hip Flexors"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/stretches/hip-flexor_1.jpg"]
  },
  {
    "id": "calf-stretch",
    "name": "Calf Stretch",
    "description": "A static stretch to elongate the calf muscles.",
    "category": "stretching",
    "primaryMuscleGroup": "Calves",
    "muscleGroups": ["Calves"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/stretches/calf-stretch_1.jpg"]
  },

  // Additional Functional & Core Exercises
  {
    "id": "bird-dog",
    "name": "Bird Dog",
    "description": "A core and lower back stability exercise performed on hands and knees, extending opposite arm and leg.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Lower Back",
    "muscleGroups": ["Lower Back", "Glutes", "Core"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/bird-dog_1.jpg"]
  },
  {
    "id": "plank-to-push-up",
    "name": "Plank to Push-up",
    "description": "A dynamic core and upper body exercise that transitions between plank and push-up positions.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Core",
    "muscleGroups": ["Core", "Shoulders", "Arms"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/plank-to-push-up_1.jpg"]
  },
  {
    "id": "handstand-push-up",
    "name": "Handstand Push-up",
    "description": "An advanced exercise that builds shoulder, triceps, and core strength by performing a push-up while in a handstand position against a wall or free-standing.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Shoulders",
    "muscleGroups": ["Shoulders (Deltoids)", "Triceps", "Upper Chest", "Core"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/handstand-push-up_1.jpg"],
    notes: "Start against a wall for support. Progress to freestanding as strength improves."
  },
  {
    "id": "muscle-up",
    "name": "Muscle-up",
    "description": "A challenging compound movement that combines a pull-up and a dip, requiring explosive strength and technique.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Upper Body",
    "muscleGroups": ["Lats", "Biceps", "Triceps", "Chest", "Shoulders"],
    "equipmentNeeded": ["Pull-up Bar"],
    imageUrls: ["assets/images/exercises/muscle-up_1.jpg"]
  },
  {
    "id": "explosive-clap-push-up",
    "name": "Explosive Clap Push-up",
    "description": "A plyometric push-up that develops explosive power by pushing off the ground to clap in mid-air.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Chest", "Triceps", "Shoulders"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/explosive-clap_1.jpg"]
  },
  {
    "id": "pike-push-up",
    "name": "Pike Push-up",
    "description": "Targets the shoulders and upper chest with a push-up position that emphasizes overhead pressing motion.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Shoulders",
    "muscleGroups": ["Shoulders (Deltoids)", "Triceps", "Upper Chest"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/pike-push-up_1.jpg"]
  },
  {
    "id": "decline-push-up",
    "name": "Decline Push-up",
    "description": "An increased difficulty push-up variation that targets the upper chest and shoulders by elevating the feet.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Upper Chest", "Shoulders (Anterior)", "Triceps"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/decline-push-up_1.jpg"]
  },
  {
    "id": "wall-sit",
    "name": "Wall Sit",
    "description": "Isometric lower body exercise that targets the quadriceps and improves endurance by holding a seated position against a wall.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Calves"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/wall-sit_1.jpg"]
  },
  {
    "id": "plank",
    "name": "Plank",
    "description": "An isometric core strength exercise that involves maintaining a position similar to a push-up for maximum duration.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Core",
    "muscleGroups": ["Core (Abs, Obliques, Lower Back)", "Shoulders", "Glutes"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/plank_1.jpg"]
  },
  {
    id: "side-plank",
    name: "Side Plank",
    description: "Targets obliques and improves lateral core stability.",
    category: "calisthenics",
    primaryMuscleGroup: "Core",
    muscleGroups: ["Obliques", "Transverse Abdominis"],
    equipmentNeeded: [],
    imageUrls: ["assets/images/exercises/side-plank_1.jpg"]
  },
  {
    "id": "superman",
    "name": "Superman",
    "description": "A lower back and posterior chain exercise performed lying prone, lifting arms and legs simultaneously.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Lower Back",
    "muscleGroups": ["Lower Back (Erector Spinae)", "Glutes", "Hamstrings"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/superman_1.jpg"]
  },
  {
    "id": "dolphin-plank",
    "name": "Dolphin Plank",
    "description": "A core and shoulder stability exercise performed on forearms with hips raised, strengthening shoulders and core.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Shoulders",
    "muscleGroups": ["Shoulders", "Core", "Upper Back"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/dolphin-plank_1.jpg"]
  },
  {
    "id": "leg-raises",
    "name": "Leg Raises",
    "description": "An effective core exercise that targets the lower abs by lifting legs while lying on the back.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Abs",
    "muscleGroups": ["Lower Abs", "Hip Flexors"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/leg-raises_1.jpg"]
  },
  {
    "id": "crab-walk",
    "name": "Crab Walk",
    "description": "A full-body exercise that improves shoulder stability, core strength, and coordination by walking on hands and feet.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Shoulders", "Core", "Glutes", "Legs"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/crab-walk_1.jpg"]
  },
  {
    "id": "wall-handstand",
    "name": "Wall Handstand",
    "description": "A balance and shoulder stability exercise performed against a wall, building strength for free-standing handstands.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Shoulders",
    "muscleGroups": ["Shoulders", "Core", "Wrists"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/wall-handstand_1.jpg"]
  },
  {
    id: "handstand",
    name: "Handstand",
    description: "A balance and strength move targeting shoulders, arms, and core.",
    category: "calisthenics",
    primaryMuscleGroup: "Shoulders",
    muscleGroups: ["Deltoids", "Arms", "Core"],
    equipmentNeeded: ["Wall or open space"],
    imageUrls: ["assets/images/exercises/handstand_1.jpg"]
  },
  {
    "id": "clapping-push-up",
    "name": "Clapping Push-up",
    "description": "A plyometric push-up that develops explosive upper body power by clapping hands mid-air.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Chest",
    "muscleGroups": ["Chest", "Triceps", "Shoulders"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/clapping-push-up_1.jpg"]
  },
  {
    "id": "wall-sit",
    "name": "Wall Sit",
    "description": "An isometric hold that targets the quadriceps, glutes, and calves, simulating a seated position against a wall.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Calves"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/wall-sit_1.jpg"]
  },
  {
    "id": "shrimp-squat",
    "name": "Shrimp Squat",
    "description": "A challenging single-leg squat variation that emphasizes balance and unilateral strength.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Quadriceps",
    "muscleGroups": ["Quadriceps", "Glutes", "Hamstrings", "Core"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/shrimp-squat_1.jpg"]
  },
  {
    "id": "superman-extensions",
    "name": "Superman Extensions",
    "description": "Lying prone, lift arms, chest, and legs off the ground to strengthen lower back and posterior chain.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Lower Back",
    "muscleGroups": ["Lower Back", "Glutes", "Hamstrings"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/superman-extensions_1.jpg"]
  },
  {
    "id": "l-sit",
    "name": "L-Sit",
    "description": "An isometric hold that develops core, hip flexors, and shoulder strength by supporting the body in an 'L' shape with hands on the ground.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Core",
    "muscleGroups": ["Core", "Hip Flexors", "Shoulders"],
    "equipmentNeeded": ["Parallettes or Dip Bars"],
    imageUrls: ["assets/images/exercises/l-sit_1.jpg"]
  },
  {
    "id": "planche",
    "name": "Planche",
    "description": "A highly advanced balance move that requires full-body strength, especially in the core, shoulders, and arms.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Core & Upper Body",
    "muscleGroups": ["Core", "Shoulders", "Arms"],
    "equipmentNeeded": ["Parallettes or Flat Surface"],
    imageUrls: ["assets/images/exercises/planche_1.jpg"]
  },
  {
    "id": "frog-stand",
    "name": "Frog Stand",
    "description": "A beginner balance exercise that builds wrist, arm, and core strength necessary for handstands.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Core & Shoulders",
    "muscleGroups": ["Core", "Shoulders", "Wrists"],
    "equipmentNeeded": [],
    imageUrls: ["assets/images/exercises/frog-stand_1.jpg"]
  },
  {
    "id": "tuck-planche",
    "name": "Tuck Planche",
    "description": "An advanced balance move where knees are tucked in, challenging core and shoulder stability.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Core & Shoulders",
    "muscleGroups": ["Core", "Shoulders", "Arms"],
    "equipmentNeeded": ["Parallettes"],
    imageUrls: ["assets/images/exercises/tuck-planche_1.jpg"]
  },
  {
    "id": "dip",
    "name": "Straight Bar Dip",
    "description": "An exercise that targets the chest, triceps, and shoulders by lowering and pressing on a straight bar or dip station.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Triceps",
    "muscleGroups": ["Triceps", "Chest", "Shoulders (Anterior)"],
    "equipmentNeeded": ["Dip Bars or Parallel Bars"],
    imageUrls: ["assets/images/exercises/dip_1.jpg"]
  },
  {
    "id": "inverted-row",
    "name": "Inverted Row",
    "description": "A back and biceps exercise performed underneath a bar or suspension trainer, pulling the chest towards the bar.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Back",
    "muscleGroups": ["Lats", "Rhomboids", "Biceps", "Traps"],
    "equipmentNeeded": ["Bar or Suspension Trainer"],
    imageUrls: ["assets/images/exercises/inverted-row_1.jpg"]
  },
  {
    "id": "kettlebell-clean",
    "name": "Kettlebell Clean",
    "description": "A fundamental movement that lifts the kettlebell from the floor to the rack position, engaging the hips, core, and arms.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Hips", "Glutes", "Back", "Shoulders", "Arms"],
    "equipmentNeeded": ["Kettlebells"],
    imageUrls: ["assets/images/exercises/kettlebell-clean_1.jpg"]
  },
  {
    "id": "kettlebell-jerk",
    "name": "Kettlebell Jerk",
    "description": "An overhead pressing movement that involves a dip, drive, and lockout, developing explosive shoulder and arm strength.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Shoulders",
    "muscleGroups": ["Shoulders", "Triceps", "Core"],
    "equipmentNeeded": ["Kettlebells"],
    imageUrls: ["assets/images/exercises/kettlebell-jerk_1.jpg"]
  },
  {
    "id": "kettlebell-sumo-deadlift",
    "name": "Kettlebell Sumo Deadlift",
    "description": "A variation of the deadlift emphasizing the inner thighs, hips, and glutes with a wide stance.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Lower Body",
    "muscleGroups": ["Glutes", "Hamstrings", "Quadriceps", "Lower Back"],
    "equipmentNeeded": ["Kettlebells"],
    imageUrls: ["assets/images/exercises/kettlebell-sumo-deadlift_1.jpg"]
  },
  {
    "id": "kettlebell-snatch",
    "name": "Kettlebell Snatch",
    "description": "An explosive movement that lifts the kettlebell overhead in one fluid motion, engaging the entire posterior chain.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Hips", "Glutes", "Back", "Shoulders", "Arms"],
    "equipmentNeeded": ["Kettlebells"],
    imageUrls: ["assets/images/exercises/kettlebell-snatch_1.jpg"]
  },
  {
    "id": "kettlebell-goblet-squat",
    "name": "Kettlebell Goblet Squat",
    "description": "A squat variation holding the kettlebell at chest level, promoting proper form and core engagement.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Lower Body",
    "muscleGroups": ["Quadriceps", "Glutes", "Core"],
    "equipmentNeeded": ["Kettlebells"],
    imageUrls: ["assets/images/exercises/kettlebell-goblet-squat_1.jpg"]
  },
  {
    "id": "kettlebell-figure-eight",
    "name": "Kettlebell Figure Eight",
    "description": "A dynamic movement passing the kettlebell between the legs in a figure-eight pattern, improving coordination and grip.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Core", "Forearms", "Hips"],
    "equipmentNeeded": ["Kettlebells"],
    imageUrls: ["assets/images/exercises/kettlebell-figure-eight_1.jpg"]
  },
  {
    "id": "kettlebell-clean-and-press",
    "name": "Kettlebell Clean and Press",
    "description": "A compound exercise combining the clean and overhead press, building strength and power in the hips, shoulders, and arms.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Full Body",
    "muscleGroups": ["Hips", "Back", "Shoulders", "Arms"],
    "equipmentNeeded": ["Kettlebells"],
    imageUrls: ["assets/images/exercises/kettlebell-clean-and-press_1.jpg"]
  },
  {
    "id": "kettlebell-rack-walk",
    "name": "Kettlebell Rack Walk",
    "description": "Walking with kettlebells held in the rack position, enhancing grip, core stability, and overall endurance.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Core & Grip",
    "muscleGroups": ["Core", "Forearms", "Shoulders"],
    "equipmentNeeded": ["Kettlebell"],
    imageUrls: ["assets/images/exercises/kettlebell-rack-walk_1.jpg"]
  },
  {
    "id": "kettlebell-halifax",
    "name": "Kettlebell Halifax",
    "description": "A rotational movement passing the kettlebell around the body, improving core rotational strength and coordination.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Core",
    "muscleGroups": ["Obliques", "Transverse Abdominis", "Shoulders"],
    "equipmentNeeded": ["Kettlebells"],
    imageUrls: ["assets/images/exercises/kettlebell-halifax_1.jpg"]
  },
  {
    id: "double-kettlebell-front-squat",
    name: "Double Kettlebell Front Squat",
    description: "Holding two kettlebells at shoulder height, perform a squat to target the quads, glutes, and core.",
    category: "kettlebells",
    primaryMuscleGroup: "Lower Body",
    muscleGroups: ["Quadriceps", "Glutes", "Core"],
    equipmentNeeded: ["2 Kettlebells"],
    imageUrls: ["assets/images/exercises/double-kettlebell-front-squat_1.jpg"]
  },
  {
    id: "double-kettlebell-rack-deadlift",
    name: "Double Kettlebell Rack Deadlift",
    description: "Lift two kettlebells from the ground to a rack position, emphasizing posterior chain strength.",
    category: "kettlebells",
    primaryMuscleGroup: "Posterior Chain",
    muscleGroups: ["Hamstrings", "Glutes", "Lower Back"],
    equipmentNeeded: ["2 Kettlebells"],
    imageUrls: ["assets/images/exercises/double-kettlebell-rack-deadlift_1.jpg"]
  },
  {
    id: "double-kettlebell-swing",
    name: "Double Kettlebell Swing",
    description: "A powerful hip-hinge movement using two kettlebells to develop explosive strength and endurance.",
    category: "kettlebells",
    primaryMuscleGroup: "Full Body",
    muscleGroups: ["Hips", "Glutes", "Hamstrings", "Back"],
    equipmentNeeded: ["2 Kettlebells"],
    imageUrls: ["assets/images/exercises/double-kettlebell-swing_1.jpg"]
  },
  {
    id: "single-kettlebell-jerk",
    name: "Single Kettlebell Jerk",
    description: "An overhead press with a dip and drive movement, improving explosive shoulder power.",
    category: "kettlebells",
    primaryMuscleGroup: "Shoulders",
    muscleGroups: ["Shoulders", "Triceps", "Core"],
    equipmentNeeded: ["Kettlebell"],
    imageUrls: ["assets/images/exercises/single-kettlebell-jerk_1.jpg"]
  },
  {
    id: "single-kettlebell-clean-and-press",
    name: "Single Kettlebell Clean and Press",
    description: "A dynamic full-body movement to build strength, power, and coordination.",
    category: "kettlebells",
    primaryMuscleGroup: "Full Body",
    muscleGroups: ["Hips", "Back", "Shoulders", "Arms"],
    equipmentNeeded: ["Kettlebell"],
    imageUrls: ["assets/images/exercises/single-kettlebell-clean-and-press_1.jpg"]
  },
  {
    id: "double-kettlebell-arching-swing",
    name: "Double Kettlebell Arching Swing",
    description: "A variation emphasizing controlled movement and grip strength, swinging two kettlebells in an arc.",
    category: "kettlebells",
    primaryMuscleGroup: "Full Body",
    muscleGroups: ["Hips", "Glutes", "Back"],
    equipmentNeeded: ["2 Kettlebells"],
    imageUrls: ["assets/images/exercises/double-kettlebell-arching-swing_1.jpg"]
  },
  {
    id: "single-kettlebell-figure-eight",
    name: "Single Kettlebell Figure Eight",
    description: "Passing the kettlebell between the legs in a figure-eight pattern, enhancing coordination and grip.",
    category: "kettlebells",
    primaryMuscleGroup: "Full Body",
    muscleGroups: ["Core", "Forearms", "Hips"],
    equipmentNeeded: ["Kettlebell"],
    imageUrls: ["assets/images/exercises/single-kettlebell-figure-eight_1.jpg"]
  },
  {
    id: "double-kettlebell-overhead-lunge",
    name: "Double Kettlebell Overhead Lunge",
    description: "Holding two kettlebells overhead, perform lunges to challenge stability and strength.",
    category: "kettlebells",
    primaryMuscleGroup: "Lower Body",
    muscleGroups: ["Quadriceps", "Glutes", "Core", "Shoulders"],
    equipmentNeeded: ["2 Kettlebells"],
    imageUrls: ["assets/images/exercises/double-kettlebell-overhead-lunge_1.jpg"]
  },
  {
    id: "single-kettlebell-high-pull",
    name: "Single Kettlebell High Pull",
    description: "A powerful movement pulling the kettlebell to chest level, engaging the back and shoulders.",
    category: "kettlebells",
    primaryMuscleGroup: "Back & Shoulders",
    muscleGroups: ["Lats", "Traps", "Shoulders"],
    equipmentNeeded: ["Kettlebell"],
    imageUrls: ["assets/images/exercises/single-kettlebell-high-pull_1.jpg"]
  },
  {
    id: "double-kettlebell-press",
    name: "Double Kettlebell Overhead Press",
    description: "Pressing two kettlebells overhead simultaneously for balanced shoulder development.",
    category: "kettlebells",
    primaryMuscleGroup: "Shoulders",
    muscleGroups: ["Shoulders", "Triceps", "Core"],
    equipmentNeeded: ["2 Kettlebells"],
    imageUrls: ["assets/images/exercises/double-kettlebell-press_1.jpg"]
  },
  {
    id: "single-kettlebell-front-squat",
    name: "Single Kettlebell Front Squat",
    description: "Hold the kettlebell at chest level and perform a squat to target quads, glutes, and core stability.",
    category: "kettlebells",
    primaryMuscleGroup: "Lower Body",
    muscleGroups: ["Quadriceps", "Glutes", "Core"],
    equipmentNeeded: ["Kettlebell"],
    imageUrls: ["assets/images/exercises/single-kettlebell-front-squat_1.jpg"]
  },
  {
    id: "single-kettlebell-russian-twist",
    name: "Single Kettlebell Russian Twist",
    description: "Sit on the floor, lean back slightly, and twist the kettlebell side to side for oblique engagement.",
    category: "kettlebells",
    primaryMuscleGroup: "Core",
    muscleGroups: ["Obliques", "Rectus Abdominis"],
    equipmentNeeded: ["Kettlebell"],
    imageUrls: ["assets/images/exercises/single-kettlebell-russian-twist_1.jpg"]
  },
  {
    id: "single-kettlebell-overhead-press",
    name: "Single Kettlebell Overhead Press",
    description: "Press the kettlebell overhead, focusing on shoulder stability and core engagement.",
    category: "kettlebells",
    primaryMuscleGroup: "Shoulders",
    muscleGroups: ["Shoulders", "Triceps", "Core"],
    equipmentNeeded: ["Kettlebell"],
    imageUrls: ["assets/images/exercises/single-kettlebell-overhead-press_1.jpg"]
  },
  {
    id: "single-kettlebell-windmill",
    name: "Single Kettlebell Windmill",
    description: "Hold the kettlebell overhead and hinge at the hips to touch the opposite foot, improving mobility and core strength.",
    category: "kettlebells",
    primaryMuscleGroup: "Core & Shoulders",
    muscleGroups: ["Obliques", "Shoulders", "Hips"],
    equipmentNeeded: ["Kettlebell"],
    imageUrls: ["assets/images/exercises/single-kettlebell-windmill_1.jpg"]
  },
  {
    id: "single-kettlebell-swing",
    name: "Single Kettlebell Swing",
    description: "Hinge at hips and swing the kettlebell between legs to chest or eye level, building explosive hip power.",
    category: "kettlebells",
    primaryMuscleGroup: "Full Body",
    muscleGroups: ["Hips", "Glutes", "Hamstrings", "Back"],
    equipmentNeeded: ["Kettlebell"],
    imageUrls: ["assets/images/exercises/single-kettlebell-swing_1.jpg"]
  },

  // Double kettlebell exercises
  {
    id: "double-kettlebell-clean",
    name: "Double Kettlebell Clean",
    description: "Lift two kettlebells from the ground to rack position in one explosive movement, engaging full posterior chain.",
    category: "kettlebells",
    primaryMuscleGroup: "Full Body",
    muscleGroups: ["Hips", "Back", "Shoulders", "Arms"],
    equipmentNeeded: ["2 Kettlebells"],
    imageUrls: ["assets/images/exercises/double-kettlebell-clean_1.jpg"]
  },
  {
    id: "double-kettlebell-sumo-deadlift",
    name: "Double Kettlebell Sumo Deadlift",
    description: "Wide stance deadlift with two kettlebells to target inner thighs, hips, and glutes.",
    category: "kettlebells",
    primaryMuscleGroup: "Lower Body",
    muscleGroups: ["Glutes", "Hamstrings", "Quadriceps", "Lower Back"],
    equipmentNeeded: ["2 Kettlebells"],
    imageUrls: ["assets/images/exercises/double-kettlebell-sumo-deadlift_1.jpg"]
  },
  {
    id: "double-kettlebell-windmill",
    name: "Double Kettlebell Windmill",
    description: "Hold kettlebells overhead in both hands and hinge at the hips to touch the floor, improving mobility and core strength.",
    category: "kettlebells",
    primaryMuscleGroup: "Core & Shoulders",
    muscleGroups: ["Obliques", "Shoulders", "Hips"],
    equipmentNeeded: ["2 Kettlebells"],
    imageUrls: ["assets/images/exercises/double-kettlebell-windmill_1.jpg"]
  },
  // Additional versatile exercises
  {
    id: "single-kettlebell-overhead-lunge",
    name: "Single Kettlebell Overhead Lunge",
    description: "Hold one kettlebell overhead in one hand and perform lunges to challenge stability and core control.",
    category: "kettlebells",
    primaryMuscleGroup: "Lower Body & Core",
    muscleGroups: ["Quadriceps", "Glutes", "Obliques"],
    equipmentNeeded: ["Kettlebell"],
    imageUrls: ["assets/images/exercises/single-kettlebell-overhead-lunge_1.jpg"]
  },
  {
    id: "double-kettlebell-rotational-press",
    name: "Double Kettlebell Rotational Press",
    description: "Press kettlebells overhead while rotating the torso to enhance rotational strength and core stability.",
    category: "kettlebells",
    primaryMuscleGroup: "Core & Shoulders",
    muscleGroups: ["Obliques", "Shoulders", "Core"],
    equipmentNeeded: ["2 Kettlebells"],
    imageUrls: ["assets/images/exercises/double-kettlebell-rotational-press_1.jpg"]
  },
  {
    id: "front-lever",
    name: "Front Lever",
    description: "Isometric hold for core, back, and shoulder strength.",
    category: "calisthenics",
    primaryMuscleGroup: "Back & Core",
    muscleGroups: ["Lats", "Core"],
    equipmentNeeded: ["Pull-up Bar"],
    imageUrls: ["assets/images/exercises/front-lever_1.jpg"]
  },
  {
    "id": "kettlebell-clean-and-overhead-press-complex",
    "name": "Kettlebell Clean & OHP Complex",
    "description": "A complex combining a clean and overhead press with alternating variations.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Shoulders",
    "muscleGroups": ["Shoulders", "Triceps", "Core", "Back"],
    "equipmentNeeded": ["Kettlebell"],
    "imageUrls": [],
    "notes": "As described by Chandler Marchman: Clean & Overhead Press to Alternating From Top OHP to Alternating From Bottom OHP."
  },
  {
    "id": "kettlebell-rack-carry",
    "name": "Kettlebell Rack Carry",
    "description": "A loaded carry exercise where one or two kettlebells are held in the front rack position, challenging core stability and posture.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Core",
    "muscleGroups": ["Core", "Shoulders", "Forearms (Grip)"],
    "equipmentNeeded": ["Kettlebell"],
    "imageUrls": []
  },
  {
    "id": "kettlebell-double-hand-swing",
    "name": "Kettlebell Double Hand Swing",
    "description": "The standard two-handed kettlebell swing, a powerful hip-hinge movement for the posterior chain.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Glutes",
    "muscleGroups": ["Glutes", "Hamstrings", "Lower Back", "Core"],
    "equipmentNeeded": ["Kettlebell"],
    "imageUrls": []
  },
  {
    "id": "kettlebell-goblet-walk",
    "name": "Kettlebell Goblet Walk",
    "description": "A loaded carry exercise performed by walking while holding a single kettlebell at chest level in the goblet position.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Core",
    "muscleGroups": ["Core", "Quadriceps", "Glutes", "Upper Back"],
    "equipmentNeeded": ["Kettlebell"],
    "imageUrls": []
  }, {
    "id": "kettlebell-floor-skullcrusher",
    "name": "Kettlebell Floor Skullcrusher",
    "description": "A tricep isolation exercise performed lying on the floor, lowering one or two kettlebells towards the forehead.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Triceps",
    "muscleGroups": ["Triceps"],
    "equipmentNeeded": ["Kettlebell"],
    "imageUrls": []
  },
  {
    "id": "kettlebell-close-grip-floor-press",
    "name": "Kettlebell Close Grip Floor Press",
    "description": "A chest and tricep exercise performed on the floor with a close grip, emphasizing tricep activation.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Triceps",
    "muscleGroups": ["Triceps", "Chest (Inner)"],
    "equipmentNeeded": ["Kettlebell"],
    "imageUrls": []
  },
  {
    "id": "kettlebell-towel-curl",
    "name": "Kettlebell Towel Curl",
    "description": "A bicep curl variation using a towel looped through a kettlebell handle to challenge grip strength and target the biceps differently.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Biceps",
    "muscleGroups": ["Biceps", "Forearms (Grip)"],
    "equipmentNeeded": ["Kettlebell", "Towel"],
    "imageUrls": []
  },
  {
    "id": "kettlebell-slow-eccentric-pause-towel-curl",
    "name": "Slow Eccentric Pause Towel Curls",
    "description": "A bicep curl variation using a towel looped through a kettlebell handle to challenge grip strength and target the biceps differently.",
    "category": "kettlebells",
    "primaryMuscleGroup": "Biceps",
    "muscleGroups": ["Biceps", "Forearms (Grip)"],
    "equipmentNeeded": ["Kettlebell", "Towel"],
    "imageUrls": []
  },
  {
    "id": "lying-leg-curl-machine",
    "name": "Lying Leg Curl (Machine)",
    "description": "An isolation exercise for the hamstrings, performed lying face down on a machine.",
    "category": "machines",
    "primaryMuscleGroup": "Hamstrings",
    "muscleGroups": ["Hamstrings"],
    "equipmentNeeded": ["Lying Leg Curl Machine"],
    "imageUrls": []
  },
  {
    "id": "barbell-skull-crusher",
    "name": "Barbell Skull Crusher",
    "description": "A tricep isolation exercise performed lying on a bench, lowering a barbell towards the forehead. Also known as a lying tricep extension.",
    "category": "barbells",
    "primaryMuscleGroup": "Triceps",
    "muscleGroups": ["Triceps"],
    "equipmentNeeded": ["Barbell", "Bench", "EZ-Curl Bar (recommended)"],
    "imageUrls": []
  },
  {
    "id": "standing-calf-raise",
    "name": "Standing Calf Raise",
    "description": "An isolation exercise for the calf muscles (gastrocnemius and soleus), typically performed on a machine or with free weights.",
    "category": "bodyweight/calisthenics",
    "primaryMuscleGroup": "Calves",
    "muscleGroups": ["Calves (Gastrocnemius, Soleus)"],
    "equipmentNeeded": ["Calf Raise Machine", "Dumbbells (optional)"],
    "imageUrls": []
  }
];