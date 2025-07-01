import { Routine } from "../models/workout.model";

export const ROUTINES_DATA: Routine[] = [
    {
        "id": "f4f6e3c1-4b7e-4b1e-8c3b-2f1a6e9a0b1d",
        "name": "Build 3-Dimensional Shoulders",
        "description": "An intense kettlebell bodybuilding routine from a video by Chandler Marchman. Rest 2-3 minutes between rounds.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "e1a1b2c3-1",
                "exerciseId": "kettlebell-clean-and-overhead-press-complex",
                "exerciseName": "Clean & Overhead Press to Alternating From Top OHP to Alternating From Bottom OHP",
                "sets": [
                    {
                        "id": "s1a",
                        "reps": 3,
                        "weight": 71,
                        "restAfterSet": 60,
                        "type": "standard"
                    }
                ],
                "rounds": 3,
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "e1a1b2c3-2",
                "exerciseId": "kettlebell-rack-carry",
                "exerciseName": "Rack Carry",
                "sets": [
                    {
                        "id": "s1b",
                        "duration": 50,
                        "notes": "Distance: 50 ft.",
                        "weight": 71,
                        "restAfterSet": 60,
                        "type": "standard"
                    }
                ],
                "rounds": 3,
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "e1a1b2c3-3",
                "exerciseId": "push-up",
                "exerciseName": "Push Up",
                "sets": [
                    {
                        "id": "s1c",
                        "reps": 6,
                        "weight": null,
                        "restAfterSet": 60,
                        "type": "standard"
                    }
                ],
                "rounds": 3,
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "e1a1b2c3-4",
                "exerciseId": "farmers-walk",
                "exerciseName": "Farmers Walk",
                "sets": [
                    {
                        "id": "s1d",
                        "duration": 50,
                        "notes": "Distance: 50 ft.",
                        "weight": 71,
                        "restAfterSet": 60,
                        "type": "standard"
                    }
                ],
                "rounds": 3,
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "e1a1b2c3-5",
                "exerciseId": "kettlebell-double-hand-swing",
                "exerciseName": "Double Hand Swing",
                "sets": [
                    {
                        "id": "s1e",
                        "reps": 6,
                        "weight": 71,
                        "restAfterSet": 150,
                        "type": "standard"
                    }
                ],
                "rounds": 3,
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            }
        ],
        "notes": "Original workout by Chandler Marchman. Video URL: https://www.youtube.com/watch?v=9Ri9Yqc9HZ8. Weight Used In Workout: 71 lb. Kettlebells."
    },
    {
        "id": "a2b3c4d5-1",
        "name": "BRUTALLY Intense 4 Minute Kettlebell Fat Loss Routine",
        "description": "Perform as FAST as possible (no rest in between intervals). Original workout by Chandler Marchman.",
        "goal": "tabata",
        "exercises": [
            {
                "id": "e2a2b2c2-1",
                "exerciseId": "goblet-squat",
                "exerciseName": "Goblet Squat",
                "sets": [
                    { "id": "s2a1", "reps": 10, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "tabata" },
                    { "id": "s2a2", "reps": 8, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "tabata" },
                    { "id": "s2a3", "reps": 6, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "tabata" },
                    { "id": "s2a4", "reps": 4, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "tabata" },
                    { "id": "s2a5", "reps": 2, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "tabata" }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "tabata"
            },
            {
                "id": "e2a2b2c2-2",
                "exerciseId": "kettlebell-swing",
                "exerciseName": "Double Hand Swings",
                "sets": [
                    { "id": "s2b1", "reps": 10, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "tabata" },
                    { "id": "s2b2", "reps": 8, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "tabata" },
                    { "id": "s2b3", "reps": 6, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "tabata" },
                    { "id": "s2b4", "reps": 4, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "tabata" },
                    { "id": "s2b5", "reps": 2, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "tabata" }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "tabata"
            },
            {
                "id": "e2a2b2c2-3",
                "exerciseId": "kettlebell-deadlift",
                "exerciseName": "Deadlift",
                "sets": [
                    { "id": "s2c1", "reps": 10, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "standard" },
                    { "id": "s2c2", "reps": 8, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "standard" },
                    { "id": "s2c3", "reps": 6, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "standard" },
                    { "id": "s2c4", "reps": 4, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "standard" },
                    { "id": "s2c5", "reps": 2, "weight": 71, "duration": 20, "restAfterSet": 10, "type": "standard" }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "tabata"
            },
            {
                "id": "e2a2b2c2-4",
                "exerciseId": "kettlebell-goblet-walk",
                "exerciseName": "Goblet Walk",
                "sets": [
                    { "id": "s2d1", "duration": 50, "notes": "Distance: 50 ft. after each interval", "reps": 1, "weight": 71, "restAfterSet": 0, "type": "standard" }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "tabata"
            }
        ],
        "notes": "Original workout by Chandler Marchman. Video URL: https://www.youtube.com/watch?v=u78u8pIwA_Q. Weight Used During Workout: 71 lb. Kettlebell."
    },
    {
        "id": "b3c4d5e6-1",
        "name": "50 Rep Kettlebell Arm Blaster Build Muscular Biceps & Triceps",
        "description": "Rest no more than 3 minutes between rounds. <i>Original workout by Chandler Marchman.</i>",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "e3a3b3c3-1",
                "exerciseId": "kettlebell-floor-skullcrusher",
                "exerciseName": "Slow Eccentric Floor Skullcrusher",
                "notes": "Split from combo exercise 'Slow Eccentric Floor Skullcrusher to Close Grip Floor Press'.",
                "sets": [{ "id": "s3a1", "reps": 5, "weight": 71, "restAfterSet": 0, "type": "standard", "tempo": "4010" }],
                "rounds": 3, "supersetId": null, "supersetOrder": null,
                "type": "superset",
            },
            {
                "id": "e3a3b3c3-2",
                "exerciseId": "kettlebell-close-grip-floor-press",
                "exerciseName": "Close Grip Floor Press (from combo)",
                "notes": "Split from combo exercise 'Slow Eccentric Floor Skullcrusher to Close Grip Floor Press'.",
                "sets": [{ "id": "s3a2", "reps": 5, "weight": 71, "restAfterSet": 60, "type": "standard" }],
                "rounds": 3, "supersetId": null, "supersetOrder": null, "type": "superset"
            },
            {
                "id": "e3a3b3c3-3",
                "exerciseId": "kettlebell-floor-skullcrusher",
                "exerciseName": "Floor Skullcrusher",
                "sets": [{ "id": "s3b", "reps": 10, "weight": 71, "restAfterSet": 60, "type": "standard" }],
                "rounds": 3, "supersetId": null, "supersetOrder": null, "type": "superset"
            },
            {
                "id": "e3a3b3c3-4",
                "exerciseId": "kettlebell-close-grip-floor-press",
                "exerciseName": "Close Grip Floor Press",
                "sets": [{ "id": "s3c", "reps": 10, "weight": 71, "restAfterSet": 60, "type": "standard" }],
                "rounds": 3, "supersetId": null, "supersetOrder": null, "type": "superset"
            },
            {
                "id": "e3a3b3c3-5",
                "exerciseId": "push-up",
                "exerciseName": "Proprioceptive Close Grip Push Up",
                "sets": [{ "id": "s3d", "reps": 5, "weight": null, "restAfterSet": 60, "type": "standard" }],
                "rounds": 3, "supersetId": null, "supersetOrder": null, "type": "superset"
            },
            {
                "id": "e3a3b3c3-6",
                "exerciseId": "push-up",
                "exerciseName": "Push Up",
                "sets": [{ "id": "s3e", "reps": 5, "weight": null, "restAfterSet": 60, "type": "standard" }],
                "rounds": 3, "supersetId": null, "supersetOrder": null, "type": "superset"
            },
            {
                "id": "e3a3b3c3-7",
                "exerciseId": "kettlebell-slow-eccentric-pause-towel-curl",
                "exerciseName": "Slow Eccentric Pause Towel Curls",
                "sets": [{ "id": "s3f", "reps": 5, "weight": 71, "restAfterSet": 60, "type": "standard", "tempo": "4110" }],
                "rounds": 3, "supersetId": null, "supersetOrder": null, "type": "superset"
            },
            {
                "id": "e3a3b3c3-8",
                "exerciseId": "kettlebell-towel-curl",
                "exerciseName": "Towel Curls",
                "sets": [{ "id": "s3g", "reps": 5, "weight": 71, "restAfterSet": 180, "type": "standard" }],
                "rounds": 3, "supersetId": null, "supersetOrder": null, "type": "superset"
            }
        ],
        "notes": "Original workout by Chandler Marchman. Video URL: https://www.youtube.com/watch?v=NKrxQWu4iYE. Weight Used During Workout: 71 lb. Kettlebell."
    },
    {
        "id": "beginner-workout-v1-a",
        "name": "Beginner Weight Training - Workout A (V1)",
        "description": "A foundational full-body workout focusing on major compound lifts. Perform this workout on your first training day of the week.",
        "goal": "strength",
        "exercises": [
            {
                "id": "bwa-ex1",
                "exerciseId": "barbell-back-squat",
                "exerciseName": "Squats",
                "sets": [
                    {
                        "id": "bwa-ex1-s1",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex1-s2",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex1-s3",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "bwa-ex2",
                "exerciseId": "barbell-bench-press",
                "exerciseName": "Bench Press",
                "sets": [
                    {
                        "id": "bwa-ex2-s1",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex2-s2",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex2-s3",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "bwa-ex3",
                "exerciseId": "bent-over-row-barbell",
                "exerciseName": "Rows",
                "sets": [
                    {
                        "id": "bwa-ex3-s1",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex3-s2",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex3-s3",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            }
        ]
    },
    {
        "id": "beginner-workout-v1-b",
        "name": "Beginner Weight Training - Workout B (V1)",
        "description": "A complementary full-body workout to be alternated with Workout A. Focuses on pulling strength and overhead pressing.",
        "goal": "strength",
        "exercises": [
            {
                "id": "bwb-ex1",
                "exerciseId": "barbell-deadlift",
                "exerciseName": "Deadlifts",
                "sets": [
                    {
                        "id": "bwb-ex1-s1",
                        "reps": 8,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 6-8 reps."
                    },
                    {
                        "id": "bwb-ex1-s2",
                        "reps": 8,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 6-8 reps."
                    },
                    {
                        "id": "bwb-ex1-s3",
                        "reps": 8,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 6-8 reps."
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "bwb-ex2",
                "exerciseId": "pull-up",
                "exerciseName": "Pull-ups (or lat pull-downs)",
                "sets": [
                    {
                        "id": "bwb-ex2-s1",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "If you cannot do pull-ups, substitute with Lat Pulldowns. Aim for 8-10 reps."
                    },
                    {
                        "id": "bwb-ex2-s2",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwb-ex2-s3",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "bwb-ex3",
                "exerciseId": "overhead-press-barbell",
                "exerciseName": "Shoulder Press",
                "sets": [
                    {
                        "id": "bwb-ex3-s1",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwb-ex3-s2",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwb-ex3-s3",
                        "reps": 10,
                        "weight": null,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            }
        ]
    },
    {
        "id": "beginner-workout-v2-a",
        "name": "Beginner Weight Training - Workout A (V2)",
        "description": "Version 2 of the foundational full-body workout. Adds accessory work for triceps and calves.",
        "goal": "strength",
        "exercises": [
            {
                "id": "bw2a-ex1",
                "exerciseId": "barbell-back-squat",
                "exerciseName": "Squats",
                "sets": [
                    { "id": "bw2a-ex1-s1", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2a-ex1-s2", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2a-ex1-s3", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 8-10 reps." }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "bw2a-ex2",
                "exerciseId": "barbell-bench-press",
                "exerciseName": "Bench Press",
                "sets": [
                    { "id": "bw2a-ex2-s1", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2a-ex2-s2", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2a-ex2-s3", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 8-10 reps." }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "bw2a-ex3",
                "exerciseId": "bent-over-row-barbell",
                "exerciseName": "Rows",
                "sets": [
                    { "id": "bw2a-ex3-s1", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2a-ex3-s2", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2a-ex3-s3", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 8-10 reps." }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "bw2a-ex4",
                "exerciseId": "cable-tricep-pushdown",
                "exerciseName": "Triceps Pushdowns",
                "sets": [
                    { "id": "bw2a-ex4-s1", "reps": 15, "weight": null, "restAfterSet": 0, "type": "standard", "notes": "Aim for 10-15 reps." }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "bw2a-ex5",
                "exerciseId": "bodyweight-calf-raise",
                "exerciseName": "Calf Raises",
                "sets": [
                    { "id": "bw2a-ex5-s1", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 8-12 reps." },
                    { "id": "bw2a-ex5-s2", "reps": 12, "weight": null, "restAfterSet": 0, "type": "standard", "notes": "Aim for 8-12 reps." }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            }
        ]
    },
    {
        "id": "beginner-workout-v2-b",
        "name": "Beginner Weight Training - Workout B (V2)",
        "description": "Version 2 of the complementary full-body workout. Adds accessory work for biceps and abs.",
        "goal": "strength",
        "exercises": [
            {
                "id": "bw2b-ex1",
                "exerciseId": "barbell-deadlift",
                "exerciseName": "Deadlifts",
                "sets": [
                    { "id": "bw2b-ex1-s1", "reps": 8, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "bw2b-ex1-s2", "reps": 8, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "bw2b-ex1-s3", "reps": 8, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 6-8 reps." }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "bw2b-ex2",
                "exerciseId": "pull-up",
                "exerciseName": "Pull-ups (or lat pull-downs)",
                "sets": [
                    { "id": "bw2b-ex2-s1", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "If unable to perform, substitute with Lat Pulldowns. Aim for 8-10 reps." },
                    { "id": "bw2b-ex2-s2", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2b-ex2-s3", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 8-10 reps." }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "bw2b-ex3",
                "exerciseId": "overhead-press-barbell",
                "exerciseName": "Shoulder Press",
                "sets": [
                    { "id": "bw2b-ex3-s1", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2b-ex3-s2", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2b-ex3-s3", "reps": 10, "weight": null, "restAfterSet": 120, "type": "standard", "notes": "Aim for 8-10 reps." }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "bw2b-ex4",
                "exerciseId": "dumbbell-bicep-curl",
                "exerciseName": "Dumbbell Curls",
                "sets": [
                    { "id": "bw2b-ex4-s1", "reps": 15, "weight": null, "restAfterSet": 0, "type": "standard", "notes": "Aim for 10-15 reps." }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "bw2b-ex5",
                "exerciseId": "plank",
                "exerciseName": "Abs",
                "sets": [
                    { "id": "bw2b-ex5-s1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Perform any ab exercise like crunches, leg raises, or planks. Aim for 8-15 reps." },
                    { "id": "bw2b-ex5-s2", "reps": 15, "weight": null, "restAfterSet": 0, "type": "standard", "notes": "Aim for 8-15 reps." }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            }
        ]
    },
    {
        "id": "muscle-building-v1-upper-a",
        "name": "Muscle Building - Upper Body A (V1)",
        "description": "An upper body focused routine designed for hypertrophy, part of a 4-day split.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-ua-ex1", "exerciseId": "barbell-bench-press", "exerciseName": "Bench Press", "sets": [
                    { "id": "mb-ua-s1-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ua-s1-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ua-s1-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ua-ex2", "exerciseId": "bent-over-row-barbell", "exerciseName": "Rows", "sets": [
                    { "id": "mb-ua-s2-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ua-s2-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ua-s2-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ua-ex3", "exerciseId": "dumbbell-incline-press", "exerciseName": "Incline Dumbbell Press", "sets": [
                    { "id": "mb-ua-s3-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ua-s3-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ua-s3-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ua-ex4", "exerciseId": "lat-pulldown-machine", "exerciseName": "Lat Pull-Downs", "sets": [
                    { "id": "mb-ua-s4-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ua-s4-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ua-s4-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ua-ex5", "exerciseId": "dumbbell-lateral-raise", "exerciseName": "Lateral Raises", "sets": [
                    { "id": "mb-ua-s5-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-ua-s5-2", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ua-ex6", "exerciseId": "cable-tricep-pushdown", "exerciseName": "Triceps Pushdowns", "sets": [
                    { "id": "mb-ua-s6-1", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-ua-s6-2", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-ua-s6-3", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ua-ex7", "exerciseId": "dumbbell-bicep-curl", "exerciseName": "Dumbbell Curls", "sets": [
                    { "id": "mb-ua-s7-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-ua-s7-2", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 12-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ]
    },
    {
        "id": "muscle-building-v1-lower-a",
        "name": "Muscle Building - Lower Body A (V1)",
        "description": "A lower body focused routine for hypertrophy, emphasizing hamstrings and glutes.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-la-ex1", "exerciseId": "barbell-romanian-deadlift", "exerciseName": "Romanian Deadlifts", "sets": [
                    { "id": "mb-la-s1-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-la-s1-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-la-s1-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-la-ex2", "exerciseId": "leg-press-machine", "exerciseName": "Leg Press", "sets": [
                    { "id": "mb-la-s2-1", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-la-s2-2", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-la-s2-3", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-la-ex3", "exerciseId": "leg-curl-machine", "exerciseName": "Seated Leg Curls", "sets": [
                    { "id": "mb-la-s3-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-la-s3-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-la-s3-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-la-ex4", "exerciseId": "standing-calf-raise", "exerciseName": "Standing Calf Raises", "sets": [
                    { "id": "mb-la-s4-1", "reps": 8, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-la-s4-2", "reps": 8, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-la-s4-3", "reps": 8, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-la-s4-4", "reps": 8, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-la-ex5", "exerciseId": "plank", "exerciseName": "Abs", "sets": [
                    { "id": "mb-la-s5-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ]
    },
    {
        "id": "muscle-building-v1-upper-b",
        "name": "Muscle Building - Upper Body B (V1)",
        "description": "The second upper body routine in the hypertrophy program, focusing on different angles and exercises.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-ub-ex1", "exerciseId": "pull-up", "exerciseName": "Pull-Ups", "sets": [
                    { "id": "mb-ub-s1-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ub-s1-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ub-s1-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ub-ex2", "exerciseId": "overhead-press-barbell", "exerciseName": "Barbell Shoulder Press", "sets": [
                    { "id": "mb-ub-s2-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ub-s2-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ub-s2-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ub-ex3", "exerciseId": "seated-row-machine", "exerciseName": "Seated Cable Row", "sets": [
                    { "id": "mb-ub-s3-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ub-s3-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ub-s3-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ub-ex4", "exerciseId": "dumbbell-bench-press", "exerciseName": "Dumbbell Bench Press", "sets": [
                    { "id": "mb-ub-s4-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ub-s4-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ub-s4-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ub-ex5", "exerciseId": "dumbbell-fly", "exerciseName": "Dumbbell Flyes", "sets": [
                    { "id": "mb-ub-s5-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-ub-s5-2", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ub-ex6", "exerciseId": "barbell-bicep-curl", "exerciseName": "Barbell Curls", "sets": [
                    { "id": "mb-ub-s6-1", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-ub-s6-2", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-ub-s6-3", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ub-ex7", "exerciseId": "barbell-skull-crusher", "exerciseName": "Skull Crushers", "sets": [
                    { "id": "mb-ub-s7-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-ub-s7-2", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 12-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ]
    },
    {
        "id": "muscle-building-v1-lower-b",
        "name": "Muscle Building - Lower Body B (V1)",
        "description": "A second lower body routine for hypertrophy, focusing on the squat pattern and different hamstring/calf exercises.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-lb-ex1", "exerciseId": "barbell-back-squat", "exerciseName": "Squats", "sets": [
                    { "id": "mb-lb-s1-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-lb-s1-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-lb-s1-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-lb-ex2", "exerciseId": "dumbbell-bulgarian-split-squat", "exerciseName": "Split Squats", "sets": [
                    { "id": "mb-lb-s2-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." },
                    { "id": "mb-lb-s2-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." },
                    { "id": "mb-lb-s2-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-lb-ex3", "exerciseId": "lying-leg-curl-machine", "exerciseName": "Lying Leg Curls", "sets": [
                    { "id": "mb-lb-s3-1", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-lb-s3-2", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-lb-s3-3", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-lb-ex4", "exerciseId": "seated-calf-raise-machine", "exerciseName": "Seated Calf Raises", "sets": [
                    { "id": "mb-lb-s4-1", "reps": 15, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-lb-s4-2", "reps": 15, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-lb-s4-3", "reps": 15, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-lb-s4-4", "reps": 15, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-lb-ex5", "exerciseId": "plank", "exerciseName": "Abs", "sets": [
                    { "id": "mb-lb-s5-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ]
    },
    {
        "id": "muscle-building-v2-upper-a",
        "name": "Muscle Building - Upper Body A (V2)",
        "description": "Version 2 of the upper body workout, with increased volume on the main compound lifts. Part of a 4-day split for hypertrophy.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-v2-ua-ex1", "exerciseId": "barbell-bench-press", "exerciseName": "Bench Press", "sets": [
                    { "id": "mb-v2-ua-s1-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ua-s1-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ua-s1-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ua-s1-4", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ua-ex2", "exerciseId": "bent-over-row-barbell", "exerciseName": "Rows", "sets": [
                    { "id": "mb-v2-ua-s2-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ua-s2-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ua-s2-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ua-s2-4", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ua-ex3", "exerciseId": "dumbbell-incline-press", "exerciseName": "Incline Dumbbell Press", "sets": [
                    { "id": "mb-v2-ua-s3-1", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-ua-s3-2", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ua-ex4", "exerciseId": "lat-pulldown-machine", "exerciseName": "Lat Pull-Downs", "sets": [
                    { "id": "mb-v2-ua-s4-1", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-ua-s4-2", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ua-ex5", "exerciseId": "dumbbell-lateral-raise", "exerciseName": "Lateral Raises", "sets": [
                    { "id": "mb-v2-ua-s5-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v2-ua-s5-2", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ua-ex6", "exerciseId": "cable-tricep-pushdown", "exerciseName": "Triceps Pushdowns", "sets": [
                    { "id": "mb-v2-ua-s6-1", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-ua-s6-2", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-ua-s6-3", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ua-ex7", "exerciseId": "dumbbell-bicep-curl", "exerciseName": "Dumbbell Curls", "sets": [
                    { "id": "mb-v2-ua-s7-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-v2-ua-s7-2", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 12-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ]
    },
    {
        "id": "muscle-building-v2-lower-a",
        "name": "Muscle Building - Lower Body A (V2)",
        "description": "Version 2 of the hamstring-focused lower body routine for hypertrophy.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-v2-la-ex1", "exerciseId": "barbell-romanian-deadlift", "exerciseName": "Romanian Deadlifts", "sets": [
                    { "id": "mb-v2-la-s1-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-la-s1-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-la-s1-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-la-s1-4", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-la-ex2", "exerciseId": "leg-press-machine", "exerciseName": "Leg Press", "sets": [
                    { "id": "mb-v2-la-s2-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v2-la-s2-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v2-la-s2-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-la-ex3", "exerciseId": "leg-curl-machine", "exerciseName": "Seated Leg Curls", "sets": [
                    { "id": "mb-v2-la-s3-1", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-la-s3-2", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-la-ex4", "exerciseId": "standing-calf-raise", "exerciseName": "Standing Calf Raises", "sets": [
                    { "id": "mb-v2-la-s4-1", "reps": 8, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v2-la-s4-2", "reps": 8, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v2-la-s4-3", "reps": 8, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v2-la-s4-4", "reps": 8, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-la-ex5", "exerciseId": "plank", "exerciseName": "Abs", "sets": [
                    { "id": "mb-v2-la-s5-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ]
    },
    {
        "id": "muscle-building-v2-upper-b",
        "name": "Muscle Building - Upper Body B (V2)",
        "description": "Version 2 of the second upper body routine, with increased volume on the main vertical push and pull movements.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-v2-ub-ex1", "exerciseId": "pull-up", "exerciseName": "Pull-Ups", "sets": [
                    { "id": "mb-v2-ub-s1-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ub-s1-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ub-s1-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ub-s1-4", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ub-ex2", "exerciseId": "overhead-press-barbell", "exerciseName": "Barbell Shoulder Press", "sets": [
                    { "id": "mb-v2-ub-s2-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ub-s2-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ub-s2-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ub-s2-4", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ub-ex3", "exerciseId": "seated-row-machine", "exerciseName": "Seated Cable Row", "sets": [
                    { "id": "mb-v2-ub-s3-1", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-ub-s3-2", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ub-ex4", "exerciseId": "dumbbell-bench-press", "exerciseName": "Dumbbell Bench Press", "sets": [
                    { "id": "mb-v2-ub-s4-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v2-ub-s4-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v2-ub-s4-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ub-ex5", "exerciseId": "dumbbell-fly", "exerciseName": "Dumbbell Flyes", "sets": [
                    { "id": "mb-v2-ub-s5-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v2-ub-s5-2", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ub-ex6", "exerciseId": "barbell-bicep-curl", "exerciseName": "Barbell Curls", "sets": [
                    { "id": "mb-v2-ub-s6-1", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-ub-s6-2", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-ub-s6-3", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ub-ex7", "exerciseId": "barbell-skull-crusher", "exerciseName": "Skull Crushers", "sets": [
                    { "id": "mb-v2-ub-s7-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-v2-ub-s7-2", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 12-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ]
    },
    {
        "id": "muscle-building-v2-lower-b",
        "name": "Muscle Building - Lower Body B (V2)",
        "description": "Version 2 of the squat-focused lower body routine for hypertrophy.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-v2-lb-ex1", "exerciseId": "barbell-back-squat", "exerciseName": "Squats", "sets": [
                    { "id": "mb-v2-lb-s1-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-lb-s1-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-lb-s1-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-lb-s1-4", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 5-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-lb-ex2", "exerciseId": "dumbbell-bulgarian-split-squat", "exerciseName": "Split Squats", "sets": [
                    { "id": "mb-v2-lb-s2-1", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps per leg." },
                    { "id": "mb-v2-lb-s2-2", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps per leg." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-lb-ex3", "exerciseId": "lying-leg-curl-machine", "exerciseName": "Lying Leg Curls", "sets": [
                    { "id": "mb-v2-lb-s3-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v2-lb-s3-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v2-lb-s3-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-lb-ex4", "exerciseId": "seated-calf-raise-machine", "exerciseName": "Seated Calf Raises", "sets": [
                    { "id": "mb-v2-lb-s4-1", "reps": 15, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v2-lb-s4-2", "reps": 15, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v2-lb-s4-3", "reps": 15, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v2-lb-s4-4", "reps": 15, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-lb-ex5", "exerciseId": "plank", "exerciseName": "Abs", "sets": [
                    { "id": "mb-v2-lb-s5-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ]
    },
    {
        "id": "muscle-building-v3-upper-a",
        "name": "Muscle Building - Upper Body A (V3)",
        "description": "Version 3 of the upper body hypertrophy routine. Exercise order is adjusted to group push and pull movements together.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-v3-ua-ex1", "exerciseId": "barbell-bench-press", "exerciseName": "Bench Press", "sets": [
                    { "id": "mb-v3-ua-s1-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ua-s1-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ua-s1-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ua-ex2", "exerciseId": "dumbbell-incline-press", "exerciseName": "Incline Dumbbell Press", "sets": [
                    { "id": "mb-v3-ua-s2-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ua-s2-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ua-s2-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ua-ex3", "exerciseId": "bent-over-row-barbell", "exerciseName": "Rows", "sets": [
                    { "id": "mb-v3-ua-s3-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ua-s3-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ua-s3-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ua-ex4", "exerciseId": "lat-pulldown-machine", "exerciseName": "Lat Pull-Downs", "sets": [
                    { "id": "mb-v3-ua-s4-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ua-s4-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ua-s4-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ua-ex5", "exerciseId": "dumbbell-lateral-raise", "exerciseName": "Lateral Raises", "sets": [
                    { "id": "mb-v3-ua-s5-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v3-ua-s5-2", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ua-ex6", "exerciseId": "cable-tricep-pushdown", "exerciseName": "Triceps Pushdowns", "sets": [
                    { "id": "mb-v3-ua-s6-1", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-ua-s6-2", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-ua-s6-3", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ua-ex7", "exerciseId": "dumbbell-bicep-curl", "exerciseName": "Dumbbell Curls", "sets": [
                    { "id": "mb-v3-ua-s7-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-v3-ua-s7-2", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 12-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ]
    },
    {
        "id": "muscle-building-v3-lower-a",
        "name": "Muscle Building - Lower Body A (V3)",
        "description": "Version 3 of the hamstring-focused lower body routine for hypertrophy.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-v3-la-ex1", "exerciseId": "barbell-romanian-deadlift", "exerciseName": "Romanian Deadlifts", "sets": [
                    { "id": "mb-v3-la-s1-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-la-s1-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-la-s1-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-la-ex2", "exerciseId": "leg-curl-machine", "exerciseName": "Seated Leg Curls", "sets": [
                    { "id": "mb-v3-la-s2-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-la-s2-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-la-s2-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-la-ex3", "exerciseId": "leg-press-machine", "exerciseName": "Leg Press", "sets": [
                    { "id": "mb-v3-la-s3-1", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-la-s3-2", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-la-s3-3", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-la-ex4", "exerciseId": "standing-calf-raise", "exerciseName": "Standing Calf Raises", "sets": [
                    { "id": "mb-v3-la-s4-1", "reps": 8, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-la-s4-2", "reps": 8, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-la-s4-3", "reps": 8, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-la-s4-4", "reps": 8, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-la-ex5", "exerciseId": "plank", "exerciseName": "Abs", "sets": [
                    { "id": "mb-v3-la-s5-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ]
    },
    {
        "id": "muscle-building-v3-upper-b",
        "name": "Muscle Building - Upper Body B (V3)",
        "description": "Version 3 of the second upper body routine, grouping pull and push movements.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-v3-ub-ex1", "exerciseId": "pull-up", "exerciseName": "Pull-Ups", "sets": [
                    { "id": "mb-v3-ub-s1-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ub-s1-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ub-s1-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ub-ex2", "exerciseId": "seated-row-machine", "exerciseName": "Seated Cable Row", "sets": [
                    { "id": "mb-v3-ub-s2-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ub-s2-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ub-s2-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ub-ex3", "exerciseId": "overhead-press-barbell", "exerciseName": "Barbell Shoulder Press", "sets": [
                    { "id": "mb-v3-ub-s3-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ub-s3-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ub-s3-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ub-ex4", "exerciseId": "dumbbell-bench-press", "exerciseName": "Dumbbell Bench Press", "sets": [
                    { "id": "mb-v3-ub-s4-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ub-s4-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ub-s4-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ub-ex5", "exerciseId": "dumbbell-fly", "exerciseName": "Dumbbell Flyes", "sets": [
                    { "id": "mb-v3-ub-s5-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v3-ub-s5-2", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ub-ex6", "exerciseId": "barbell-bicep-curl", "exerciseName": "Barbell Curls", "sets": [
                    { "id": "mb-v3-ub-s6-1", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-ub-s6-2", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-ub-s6-3", "reps": 12, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ub-ex7", "exerciseId": "barbell-skull-crusher", "exerciseName": "Skull Crushers", "sets": [
                    { "id": "mb-v3-ub-s7-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-v3-ub-s7-2", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 12-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ]
    },
    {
        "id": "muscle-building-v3-lower-b",
        "name": "Muscle Building - Lower Body B (V3)",
        "description": "Version 3 of the squat-focused lower body routine for hypertrophy.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-v3-lb-ex1", "exerciseId": "barbell-back-squat", "exerciseName": "Squats", "sets": [
                    { "id": "mb-v3-lb-s1-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-lb-s1-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-lb-s1-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-lb-ex2", "exerciseId": "dumbbell-bulgarian-split-squat", "exerciseName": "Split Squats", "sets": [
                    { "id": "mb-v3-lb-s2-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." },
                    { "id": "mb-v3-lb-s2-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." },
                    { "id": "mb-v3-lb-s2-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-lb-ex3", "exerciseId": "lying-leg-curl-machine", "exerciseName": "Lying Leg Curls", "sets": [
                    { "id": "mb-v3-lb-s3-1", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-lb-s3-2", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-lb-s3-3", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-lb-ex4", "exerciseId": "seated-calf-raise-machine", "exerciseName": "Seated Calf Raises", "sets": [
                    { "id": "mb-v3-lb-s4-1", "reps": 15, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v3-lb-s4-2", "reps": 15, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v3-lb-s4-3", "reps": 15, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v3-lb-s4-4", "reps": 15, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-lb-ex5", "exerciseId": "plank", "exerciseName": "Abs", "sets": [
                    { "id": "mb-v3-lb-s5-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ]
    },
    {
        "id": "muscle-building-v4-upper-a",
        "name": "Muscle Building - Upper Body A (V4)",
        "description": "Version 4 of the upper body hypertrophy routine, utilizing supersets to increase workout intensity and density.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-v4-ua-ex1", "exerciseId": "barbell-bench-press", "exerciseName": "Bench Press", "supersetId": "ss-ua-1", "supersetSize": 2, "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-ua-s1-1", "reps": 8, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ua-s1-2", "reps": 8, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ua-s1-3", "reps": 8, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 6-8 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ua-ex2", "exerciseId": "bent-over-row-barbell", "exerciseName": "Rows", "supersetId": "ss-ua-1", "supersetSize": 2, "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-ua-s2-1", "reps": 8, "weight": null, "restAfterSet": 90, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ua-s2-2", "reps": 8, "weight": null, "restAfterSet": 90, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ua-s2-3", "reps": 8, "weight": null, "restAfterSet": 90, "type": "superset", "notes": "Aim for 6-8 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ua-ex3", "exerciseId": "dumbbell-incline-press", "exerciseName": "Incline Dumbbell Press", "supersetId": "ss-ua-2", "supersetSize": 2, "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-ua-s3-1", "reps": 10, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ua-s3-2", "reps": 10, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ua-s3-3", "reps": 10, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 8-10 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ua-ex4", "exerciseId": "lat-pulldown-machine", "exerciseName": "Lat Pull-Downs", "supersetId": "ss-ua-2", "supersetSize": 2, "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-ua-s4-1", "reps": 10, "weight": null, "restAfterSet": 60, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ua-s4-2", "reps": 10, "weight": null, "restAfterSet": 60, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ua-s4-3", "reps": 10, "weight": null, "restAfterSet": 60, "type": "superset", "notes": "Aim for 8-10 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ua-ex5", "exerciseId": "dumbbell-lateral-raise", "exerciseName": "Lateral Raises", "sets": [
                    { "id": "mb-v4-ua-s5-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v4-ua-s5-2", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v4-ua-ex6", "exerciseId": "cable-tricep-pushdown", "exerciseName": "Triceps Pushdowns", "supersetId": "ss-ua-3", "supersetSize": 2, "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-ua-s6-1", "reps": 12, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-ua-s6-2", "reps": 12, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-ua-s6-3", "reps": 12, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 10-12 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ua-ex7", "exerciseId": "dumbbell-bicep-curl", "exerciseName": "Dumbbell Curls", "supersetId": "ss-ua-3", "supersetSize": 2, "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-ua-s7-1", "reps": 15, "weight": null, "restAfterSet": 45, "type": "superset", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-v4-ua-s7-2", "reps": 15, "weight": null, "restAfterSet": 45, "type": "superset", "notes": "Aim for 12-15 reps." }
                ], "type": "superset"
            }
        ]
    },
    {
        "id": "muscle-building-v4-lower-a",
        "name": "Muscle Building - Lower Body A (V4)",
        "description": "Version 4 of the hamstring-focused lower body routine, utilizing supersets.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-v4-la-ex1", "exerciseId": "barbell-romanian-deadlift", "exerciseName": "Romanian Deadlifts", "sets": [
                    { "id": "mb-v4-la-s1-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-la-s1-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-la-s1-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v4-la-ex2", "exerciseId": "leg-press-machine", "exerciseName": "Leg Press", "supersetId": "ss-la-1", "supersetSize": 2, "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-la-s2-1", "reps": 12, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-la-s2-2", "reps": 12, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-la-s2-3", "reps": 12, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 10-12 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-la-ex3", "exerciseId": "leg-curl-machine", "exerciseName": "Seated Leg Curls", "supersetId": "ss-la-1", "supersetSize": 2, "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-la-s3-1", "reps": 10, "weight": null, "restAfterSet": 60, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-la-s3-2", "reps": 10, "weight": null, "restAfterSet": 60, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-la-s3-3", "reps": 10, "weight": null, "restAfterSet": 60, "type": "superset", "notes": "Aim for 8-10 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-la-ex4", "exerciseId": "standing-calf-raise", "exerciseName": "Standing Calf Raises", "supersetId": "ss-la-2", "supersetSize": 2, "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-la-s4-1", "reps": 8, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-la-s4-2", "reps": 8, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-la-s4-3", "reps": 8, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-la-s4-4", "reps": 8, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 6-8 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-la-ex5", "exerciseId": "plank", "exerciseName": "Abs", "supersetId": "ss-la-2", "supersetSize": 2, "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-la-s5-1", "reps": 15, "weight": null, "restAfterSet": 45, "type": "superset", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
                ], "type": "superset"
            }
        ]
    },
    {
        "id": "muscle-building-v4-upper-b",
        "name": "Muscle Building - Upper Body B (V4)",
        "description": "Version 4 of the second upper body routine, featuring supersets.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-v4-ub-ex1", "exerciseId": "pull-up", "exerciseName": "Pull-Ups", "supersetId": "ss-ub-1", "supersetSize": 2, "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-ub-s1-1", "reps": 8, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ub-s1-2", "reps": 8, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ub-s1-3", "reps": 8, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 6-8 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ub-ex2", "exerciseId": "overhead-press-barbell", "exerciseName": "Barbell Shoulder Press", "supersetId": "ss-ub-1", "supersetSize": 2, "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-ub-s2-1", "reps": 8, "weight": null, "restAfterSet": 90, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ub-s2-2", "reps": 8, "weight": null, "restAfterSet": 90, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ub-s2-3", "reps": 8, "weight": null, "restAfterSet": 90, "type": "superset", "notes": "Aim for 6-8 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ub-ex3", "exerciseId": "seated-row-machine", "exerciseName": "Seated Cable Row", "supersetId": "ss-ub-2", "supersetSize": 2, "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-ub-s3-1", "reps": 10, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ub-s3-2", "reps": 10, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ub-s3-3", "reps": 10, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 8-10 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ub-ex4", "exerciseId": "dumbbell-bench-press", "exerciseName": "Dumbbell Bench Press", "supersetId": "ss-ub-2", "supersetSize": 2, "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-ub-s4-1", "reps": 10, "weight": null, "restAfterSet": 60, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ub-s4-2", "reps": 10, "weight": null, "restAfterSet": 60, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ub-s4-3", "reps": 10, "weight": null, "restAfterSet": 60, "type": "superset", "notes": "Aim for 8-10 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ub-ex5", "exerciseId": "dumbbell-fly", "exerciseName": "Dumbbell Flyes", "sets": [
                    { "id": "mb-v4-ub-s5-1", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v4-ub-s5-2", "reps": 15, "weight": null, "restAfterSet": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v4-ub-ex6", "exerciseId": "barbell-bicep-curl", "exerciseName": "Barbell Curls", "supersetId": "ss-ub-3", "supersetSize": 2, "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-ub-s6-1", "reps": 12, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-ub-s6-2", "reps": 12, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-ub-s6-3", "reps": 12, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 10-12 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ub-ex7", "exerciseId": "barbell-skull-crusher", "exerciseName": "Skull Crushers", "supersetId": "ss-ub-3", "supersetSize": 2, "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-ub-s7-1", "reps": 15, "weight": null, "restAfterSet": 45, "type": "superset", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-v4-ub-s7-2", "reps": 15, "weight": null, "restAfterSet": 45, "type": "superset", "notes": "Aim for 12-15 reps." }
                ], "type": "superset"
            }
        ]
    },
    {
        "id": "muscle-building-v4-lower-b",
        "name": "Muscle Building - Lower Body B (V4)",
        "description": "Version 4 of the squat-focused lower body routine, featuring supersets.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "mb-v4-lb-ex1", "exerciseId": "barbell-back-squat", "exerciseName": "Squats", "sets": [
                    { "id": "mb-v4-lb-s1-1", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-lb-s1-2", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-lb-s1-3", "reps": 8, "weight": null, "restAfterSet": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v4-lb-ex2", "exerciseId": "dumbbell-bulgarian-split-squat", "exerciseName": "Split Squats", "sets": [
                    { "id": "mb-v4-lb-s2-1", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." },
                    { "id": "mb-v4-lb-s2-2", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." },
                    { "id": "mb-v4-lb-s2-3", "reps": 10, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v4-lb-ex3", "exerciseId": "lying-leg-curl-machine", "exerciseName": "Lying Leg Curls", "sets": [
                    { "id": "mb-v4-lb-s3-1", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-lb-s3-2", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-lb-s3-3", "reps": 12, "weight": null, "restAfterSet": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v4-lb-ex4", "exerciseId": "seated-calf-raise-machine", "exerciseName": "Seated Calf Raises", "supersetId": "ss-lb-1", "supersetSize": 2, "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-lb-s4-1", "reps": 15, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v4-lb-s4-2", "reps": 15, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v4-lb-s4-3", "reps": 15, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v4-lb-s4-4", "reps": 15, "weight": null, "restAfterSet": 0, "type": "superset", "notes": "Aim for 10-15 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-lb-ex5", "exerciseId": "plank", "exerciseName": "Abs", "supersetId": "ss-lb-1", "supersetSize": 2, "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-lb-s5-1", "reps": 15, "weight": null, "restAfterSet": 45, "type": "superset", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
                ], "type": "superset"
            }
        ]
    },
    {
        "id": "toning-3-giorno-1",
        "name": "Toning 3 - Day 1",
        "description": "First day of the level 3 toning program.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "routine-1-ex-1",
                "exerciseId": "running-jogging",
                "exerciseName": "Treadmill or Runner",
                "sets": [
                    {
                        "id": "set-1-1-1",
                        "duration": 600,
                        "restAfterSet": 60,
                        "type": "cardio"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            },
            {
                "id": "routine-1-ex-2",
                "exerciseId": "dumbbell-bench-press",
                "exerciseName": "Dumbbell Flat Bench Press",
                "sets": [
                    {
                        "id": "set-1-2-1",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-2-2",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-2-3",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-2-4",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            },
            {
                "id": "routine-1-ex-3",
                "exerciseId": "dumbbell-incline-fly",
                "exerciseName": "Dumbbell Incline Fly",
                "sets": [
                    {
                        "id": "set-1-3-1",
                        "reps": 12,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-3-2",
                        "reps": 12,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-3-3",
                        "reps": 12,
                        "restAfterSet": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            },
            {
                "id": "routine-1-ex-4",
                "exerciseId": "dumbbell-lunge",
                "exerciseName": "Dumbbell Reverse Lunge",
                "sets": [
                    {
                        "id": "set-1-4-1",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-4-2",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-4-3",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-4-4",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            },
            {
                "id": "routine-1-ex-5",
                "exerciseId": "plank",
                "exerciseName": "Straight-Arm Plank",
                "sets": [
                    {
                        "id": "set-1-5-1",
                        "duration": 45,
                        "restAfterSet": 30,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-5-2",
                        "duration": 45,
                        "restAfterSet": 30,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-5-3",
                        "duration": 45,
                        "restAfterSet": 30,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-5-4",
                        "duration": 45,
                        "restAfterSet": 30,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-5-5",
                        "duration": 45,
                        "restAfterSet": 30,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            },
            {
                "id": "routine-1-ex-6",
                "exerciseId": "running-jogging",
                "exerciseName": "Treadmill or Runner",
                "sets": [
                    {
                        "id": "set-1-6-1",
                        "duration": 300,
                        "restAfterSet": 60,
                        "type": "cardio"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            }
        ]
    },
    {
        "id": "toning-3-giorno-2",
        "name": "Toning 3 - Day 2",
        "description": "Second day of the level 3 toning program.",
        "goal": "hypertrophy",
        "exercises": [
            {
                "id": "routine-2-ex-1",
                "exerciseId": "running-jogging",
                "exerciseName": "Treadmill or Runner",
                "sets": [
                    {
                        "id": "set-2-1-1",
                        "duration": 600,
                        "restAfterSet": 60,
                        "type": "cardio"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-2",
                "exerciseId": "incline-chest-press-machine",
                "exerciseName": "Incline Chest Press",
                "sets": [
                    {
                        "id": "set-2-2-1",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-2-2",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-2-3",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-2-4",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-3",
                "exerciseId": "seated-row-machine",
                "exerciseName": "Seated Row Machine (Neutral Grip)",
                "sets": [
                    {
                        "id": "set-2-3-1",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-3-2",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-3-3",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-4",
                "exerciseId": "dumbbell-shoulder-press",
                "exerciseName": "Seated Dumbbell Shoulder Press",
                "sets": [
                    {
                        "id": "set-2-4-1",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-4-2",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-4-3",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-4-4",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-5",
                "exerciseId": "dumbbell-lateral-raise",
                "exerciseName": "Seated Dumbbell Lateral Raise",
                "sets": [
                    {
                        "id": "set-2-5-1",
                        "reps": 12,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-5-2",
                        "reps": 12,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-5-3",
                        "reps": 12,
                        "restAfterSet": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-6",
                "exerciseId": "cable-tricep-pushdown",
                "exerciseName": "Tricep Rope Pushdown",
                "sets": [
                    {
                        "id": "set-2-6-1",
                        "reps": 12,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-6-2",
                        "reps": 12,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-6-3",
                        "reps": 12,
                        "restAfterSet": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-7",
                "exerciseId": "dumbbell-bicep-curl",
                "exerciseName": "Alternating Dumbbell Curl",
                "sets": [
                    {
                        "id": "set-2-7-1",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-7-2",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-7-3",
                        "reps": 10,
                        "restAfterSet": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-8",
                "exerciseId": "twist-sit-up",
                "exerciseName": "Twisting Sit-up",
                "sets": [
                    {
                        "id": "set-2-8-1",
                        "reps": 15,
                        "restAfterSet": 30,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-8-2",
                        "reps": 15,
                        "restAfterSet": 30,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-8-3",
                        "reps": 15,
                        "restAfterSet": 30,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-9",
                "exerciseId": "running-jogging",
                "exerciseName": "Treadmill or Runner",
                "sets": [
                    {
                        "id": "set-2-9-1",
                        "duration": 300,
                        "restAfterSet": 60,
                        "type": "cardio"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "rounds": 1,
                "type": "standard"
            }
        ]
    }
]