import { METRIC, Routine } from "../../models/workout.model";

const metricENUM = METRIC;
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
                        "targetReps": 3,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.reps,
                            metricENUM.rest
                        ],
                        "targetWeight": 71,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "s2a",
                        "targetReps": 3,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.reps,
                            metricENUM.rest
                        ],
                        "targetWeight": 71,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "s3a",
                        "targetReps": 3,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.reps,
                            metricENUM.rest
                        ],
                        "targetWeight": 71,
                        "targetRest": 60,
                        "type": "standard"
                    }
                ],
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
                        "targetDuration": 50,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.duration,
                            metricENUM.rest
                        ],
                        "notes": "Distance: 50 ft.",
                        "targetWeight": 71,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "s2b",
                        "targetDuration": 50,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.duration,
                            metricENUM.rest
                        ],
                        "notes": "Distance: 50 ft.",
                        "targetWeight": 71,
                        "targetRest": 60,
                        "type": "standard"
                    },{
                        "id": "s3b",
                        "targetDuration": 50,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.duration,
                            metricENUM.rest
                        ],
                        "notes": "Distance: 50 ft.",
                        "targetWeight": 71,
                        "targetRest": 60,
                        "type": "standard"
                    }
                ],
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
                        "targetReps": 6,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.reps,
                            metricENUM.rest
                        ],
                        "targetWeight": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "s2c",
                        "targetReps": 6,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.reps,
                            metricENUM.rest
                        ],
                        "targetWeight": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "s3c",
                        "targetReps": 6,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.reps,
                            metricENUM.rest
                        ],
                        "targetWeight": 10,
                        "targetRest": 60,
                        "type": "standard"
                    }
                ],
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
                        "targetDuration": 50,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.duration,
                            metricENUM.rest
                        ],
                        "notes": "Distance: 50 ft.",
                        "targetWeight": 71,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "s2d",
                        "targetDuration": 50,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.duration,
                            metricENUM.rest
                        ],
                        "notes": "Distance: 50 ft.",
                        "targetWeight": 71,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "s3d",
                        "targetDuration": 50,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.duration,
                            metricENUM.rest
                        ],
                        "notes": "Distance: 50 ft.",
                        "targetWeight": 71,
                        "targetRest": 60,
                        "type": "standard"
                    }
                ],
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
                        "targetReps": 6,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.reps,
                            metricENUM.rest
                        ],
                        "targetWeight": 71,
                        "targetRest": 150,
                        "type": "standard"
                    },
                    {
                        "id": "s2e",
                        "targetReps": 6,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.reps,
                            metricENUM.rest
                        ],
                        "targetWeight": 71,
                        "targetRest": 150,
                        "type": "standard"
                    },
                    {
                        "id": "s3e",
                        "targetReps": 6,
                        "fieldOrder":[
                            metricENUM.weight,
                            metricENUM.reps,
                            metricENUM.rest
                        ],
                        "targetWeight": 71,
                        "targetRest": 150,
                        "type": "standard"
                    }
                ],
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
                    { "id": "s2a1", "targetReps": 10, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "tabata" },
                    { "id": "s2a2", "targetReps": 8, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "tabata" },
                    { "id": "s2a3", "targetReps": 6, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "tabata" },
                    { "id": "s2a4", "targetReps": 4, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "tabata" },
                    { "id": "s2a5", "targetReps": 2, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "tabata" }
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
                    { "id": "s2b1", "targetReps": 10, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "tabata" },
                    { "id": "s2b2", "targetReps": 8, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "tabata" },
                    { "id": "s2b3", "targetReps": 6, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "tabata" },
                    { "id": "s2b4", "targetReps": 4, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "tabata" },
                    { "id": "s2b5", "targetReps": 2, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "tabata" }
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
                    { "id": "s2c1", "targetReps": 10, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "standard" },
                    { "id": "s2c2", "targetReps": 8, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "standard" },
                    { "id": "s2c3", "targetReps": 6, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "standard" },
                    { "id": "s2c4", "targetReps": 4, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "standard" },
                    { "id": "s2c5", "targetReps": 2, "targetWeight": 71, "targetDuration": 20, "targetRest": 10, "type": "standard" }
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
                    { "id": "s2d1", "targetDuration": 50, "notes": "Distance: 50 ft. after each interval", "targetReps": 1, "targetWeight": 71, "targetRest": 0, "type": "standard" }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "tabata"
            }
        ],
        "notes": "Original workout by Chandler Marchman. Video URL: https://www.youtube.com/watch?v=u78u8pIwA_Q. Weight Used During Workout: 71 lb. Kettlebell."
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
                        "targetReps": 10,
                        "targetWeight": 10,
                        "targetRest": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex1-s2",
                        "targetReps": 10,
                        "targetWeight": 10,
                        "targetRest": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex1-s3",
                        "targetReps": 10,
                        "targetWeight": 10,
                        "targetRest": 120,
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
                        "targetReps": 10,
                        "targetWeight": 10,
                        "targetRest": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex2-s2",
                        "targetReps": 10,
                        "targetWeight": 10,
                        "targetRest": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex2-s3",
                        "targetReps": 10,
                        "targetWeight": 10,
                        "targetRest": 120,
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
                        "targetReps": 10,
                        "targetWeight": 10,
                        "targetRest": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex3-s2",
                        "targetReps": 10,
                        "targetWeight": 10,
                        "targetRest": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex3-s3",
                        "targetReps": 10,
                        "targetWeight": 10,
                        "targetRest": 120,
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
                        "targetReps": 8,
                        "targetWeight": 10,
                        "targetRest": 120,
                        "type": "standard",
                        "notes": "Aim for 6-8 reps."
                    },
                    {
                        "id": "bwb-ex1-s2",
                        "targetReps": 8,
                        "targetWeight": 10,
                        "targetRest": 120,
                        "type": "standard",
                        "notes": "Aim for 6-8 reps."
                    },
                    {
                        "id": "bwb-ex1-s3",
                        "targetReps": 8,
                        "targetWeight": 10,
                        "targetRest": 120,
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
                        "targetReps": 10,
                        "targetWeight": null,
                        "targetRest": 120,
                        "type": "standard",
                        "notes": "If you cannot do pull-ups, substitute with Lat Pulldowns. Aim for 8-10 reps."
                    },
                    {
                        "id": "bwb-ex2-s2",
                        "targetReps": 10,
                        "targetWeight": null,
                        "targetRest": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwb-ex2-s3",
                        "targetReps": 10,
                        "targetWeight": null,
                        "targetRest": 120,
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
                        "targetReps": 10,
                        "targetWeight": 10,
                        "targetRest": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwb-ex3-s2",
                        "targetReps": 10,
                        "targetWeight": 10,
                        "targetRest": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwb-ex3-s3",
                        "targetReps": 10,
                        "targetWeight": 10,
                        "targetRest": 120,
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
                    { "id": "bw2a-ex1-s1", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2a-ex1-s2", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2a-ex1-s3", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 8-10 reps." }
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
                    { "id": "bw2a-ex2-s1", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2a-ex2-s2", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2a-ex2-s3", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 8-10 reps." }
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
                    { "id": "bw2a-ex3-s1", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2a-ex3-s2", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2a-ex3-s3", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 8-10 reps." }
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
                    { "id": "bw2a-ex4-s1", "targetReps": 15, "targetWeight": 10, "targetRest": 0, "type": "standard", "notes": "Aim for 10-15 reps." }
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
                    { "id": "bw2a-ex5-s1", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 8-12 reps." },
                    { "id": "bw2a-ex5-s2", "targetReps": 12, "targetWeight": 10, "targetRest": 0, "type": "standard", "notes": "Aim for 8-12 reps." }
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
                    { "id": "bw2b-ex1-s1", "targetReps": 8, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "bw2b-ex1-s2", "targetReps": 8, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "bw2b-ex1-s3", "targetReps": 8, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 6-8 reps." }
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
                    { "id": "bw2b-ex2-s1", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "If unable to perform, substitute with Lat Pulldowns. Aim for 8-10 reps." },
                    { "id": "bw2b-ex2-s2", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2b-ex2-s3", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 8-10 reps." }
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
                    { "id": "bw2b-ex3-s1", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2b-ex3-s2", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "bw2b-ex3-s3", "targetReps": 10, "targetWeight": 10, "targetRest": 120, "type": "standard", "notes": "Aim for 8-10 reps." }
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
                    { "id": "bw2b-ex4-s1", "targetReps": 15, "targetWeight": 10, "targetRest": 0, "type": "standard", "notes": "Aim for 10-15 reps." }
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
                    { "id": "bw2b-ex5-s1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Perform any ab exercise like crunches, leg raises, or planks. Aim for 8-15 reps." },
                    { "id": "bw2b-ex5-s2", "targetReps": 15, "targetWeight": 10, "targetRest": 0, "type": "standard", "notes": "Aim for 8-15 reps." }
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
                    { "id": "mb-ua-s1-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ua-s1-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ua-s1-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ua-ex2", "exerciseId": "bent-over-row-barbell", "exerciseName": "Rows", "sets": [
                    { "id": "mb-ua-s2-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ua-s2-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ua-s2-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ua-ex3", "exerciseId": "dumbbell-incline-press", "exerciseName": "Incline Dumbbell Press", "sets": [
                    { "id": "mb-ua-s3-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ua-s3-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ua-s3-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ua-ex4", "exerciseId": "lat-pulldown-machine", "exerciseName": "Lat Pull-Downs", "sets": [
                    { "id": "mb-ua-s4-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ua-s4-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ua-s4-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ua-ex5", "exerciseId": "dumbbell-lateral-raise", "exerciseName": "Lateral Raises", "sets": [
                    { "id": "mb-ua-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-ua-s5-2", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ua-ex6", "exerciseId": "cable-tricep-pushdown", "exerciseName": "Triceps Pushdowns", "sets": [
                    { "id": "mb-ua-s6-1", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-ua-s6-2", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-ua-s6-3", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ua-ex7", "exerciseId": "dumbbell-bicep-curl", "exerciseName": "Dumbbell Curls", "sets": [
                    { "id": "mb-ua-s7-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-ua-s7-2", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 12-15 reps." }
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
                    { "id": "mb-la-s1-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-la-s1-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-la-s1-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-la-ex2", "exerciseId": "leg-press-machine", "exerciseName": "Leg Press", "sets": [
                    { "id": "mb-la-s2-1", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-la-s2-2", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-la-s2-3", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-la-ex3", "exerciseId": "leg-curl-machine", "exerciseName": "Seated Leg Curls", "sets": [
                    { "id": "mb-la-s3-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-la-s3-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-la-s3-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-la-ex4", "exerciseId": "standing-calf-raise", "exerciseName": "Standing Calf Raises", "sets": [
                    { "id": "mb-la-s4-1", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-la-s4-2", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-la-s4-3", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-la-s4-4", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-la-ex5", "exerciseId": "plank", "exerciseName": "Abs", "sets": [
                    { "id": "mb-la-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
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
                    { "id": "mb-ub-s1-1", "targetReps": 8, "targetWeight": null, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ub-s1-2", "targetReps": 8, "targetWeight": null, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ub-s1-3", "targetReps": 8, "targetWeight": null, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ub-ex2", "exerciseId": "overhead-press-barbell", "exerciseName": "Barbell Shoulder Press", "sets": [
                    { "id": "mb-ub-s2-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ub-s2-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-ub-s2-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ub-ex3", "exerciseId": "seated-row-machine", "exerciseName": "Seated Cable Row", "sets": [
                    { "id": "mb-ub-s3-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ub-s3-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ub-s3-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ub-ex4", "exerciseId": "dumbbell-bench-press", "exerciseName": "Dumbbell Bench Press", "sets": [
                    { "id": "mb-ub-s4-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ub-s4-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-ub-s4-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ub-ex5", "exerciseId": "dumbbell-fly", "exerciseName": "Dumbbell Flyes", "sets": [
                    { "id": "mb-ub-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-ub-s5-2", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ub-ex6", "exerciseId": "barbell-bicep-curl", "exerciseName": "Barbell Curls", "sets": [
                    { "id": "mb-ub-s6-1", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-ub-s6-2", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-ub-s6-3", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-ub-ex7", "exerciseId": "barbell-skull-crusher", "exerciseName": "Skull Crushers", "sets": [
                    { "id": "mb-ub-s7-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-ub-s7-2", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 12-15 reps." }
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
                    { "id": "mb-lb-s1-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-lb-s1-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-lb-s1-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-lb-ex2", "exerciseId": "dumbbell-bulgarian-split-squat", "exerciseName": "Split Squats", "sets": [
                    { "id": "mb-lb-s2-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." },
                    { "id": "mb-lb-s2-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." },
                    { "id": "mb-lb-s2-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-lb-ex3", "exerciseId": "lying-leg-curl-machine", "exerciseName": "Lying Leg Curls", "sets": [
                    { "id": "mb-lb-s3-1", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-lb-s3-2", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-lb-s3-3", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-lb-ex4", "exerciseId": "seated-calf-raise-machine", "exerciseName": "Seated Calf Raises", "sets": [
                    { "id": "mb-lb-s4-1", "targetReps": 15, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-lb-s4-2", "targetReps": 15, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-lb-s4-3", "targetReps": 15, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-lb-s4-4", "targetReps": 15, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-lb-ex5", "exerciseId": "plank", "exerciseName": "Abs", "sets": [
                    { "id": "mb-lb-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
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
                    { "id": "mb-v2-ua-s1-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ua-s1-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ua-s1-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ua-s1-4", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ua-ex2", "exerciseId": "bent-over-row-barbell", "exerciseName": "Rows", "sets": [
                    { "id": "mb-v2-ua-s2-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ua-s2-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ua-s2-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ua-s2-4", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ua-ex3", "exerciseId": "dumbbell-incline-press", "exerciseName": "Incline Dumbbell Press", "sets": [
                    { "id": "mb-v2-ua-s3-1", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-ua-s3-2", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ua-ex4", "exerciseId": "lat-pulldown-machine", "exerciseName": "Lat Pull-Downs", "sets": [
                    { "id": "mb-v2-ua-s4-1", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-ua-s4-2", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ua-ex5", "exerciseId": "dumbbell-lateral-raise", "exerciseName": "Lateral Raises", "sets": [
                    { "id": "mb-v2-ua-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v2-ua-s5-2", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ua-ex6", "exerciseId": "cable-tricep-pushdown", "exerciseName": "Triceps Pushdowns", "sets": [
                    { "id": "mb-v2-ua-s6-1", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-ua-s6-2", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-ua-s6-3", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ua-ex7", "exerciseId": "dumbbell-bicep-curl", "exerciseName": "Dumbbell Curls", "sets": [
                    { "id": "mb-v2-ua-s7-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-v2-ua-s7-2", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 12-15 reps." }
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
                    { "id": "mb-v2-la-s1-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-la-s1-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-la-s1-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-la-s1-4", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-la-ex2", "exerciseId": "leg-press-machine", "exerciseName": "Leg Press", "sets": [
                    { "id": "mb-v2-la-s2-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v2-la-s2-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v2-la-s2-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-la-ex3", "exerciseId": "leg-curl-machine", "exerciseName": "Seated Leg Curls", "sets": [
                    { "id": "mb-v2-la-s3-1", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-la-s3-2", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-la-ex4", "exerciseId": "standing-calf-raise", "exerciseName": "Standing Calf Raises", "sets": [
                    { "id": "mb-v2-la-s4-1", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v2-la-s4-2", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v2-la-s4-3", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v2-la-s4-4", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-la-ex5", "exerciseId": "plank", "exerciseName": "Abs", "sets": [
                    { "id": "mb-v2-la-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
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
                    { "id": "mb-v2-ub-s1-1", "targetReps": 8, "targetWeight": null, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ub-s1-2", "targetReps": 8, "targetWeight": null, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ub-s1-3", "targetReps": 8, "targetWeight": null, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ub-s1-4", "targetReps": 8, "targetWeight": null, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ub-ex2", "exerciseId": "overhead-press-barbell", "exerciseName": "Barbell Shoulder Press", "sets": [
                    { "id": "mb-v2-ub-s2-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ub-s2-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ub-s2-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-ub-s2-4", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ub-ex3", "exerciseId": "seated-row-machine", "exerciseName": "Seated Cable Row", "sets": [
                    { "id": "mb-v2-ub-s3-1", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-ub-s3-2", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ub-ex4", "exerciseId": "dumbbell-bench-press", "exerciseName": "Dumbbell Bench Press", "sets": [
                    { "id": "mb-v2-ub-s4-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v2-ub-s4-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v2-ub-s4-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ub-ex5", "exerciseId": "dumbbell-fly", "exerciseName": "Dumbbell Flyes", "sets": [
                    { "id": "mb-v2-ub-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v2-ub-s5-2", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ub-ex6", "exerciseId": "barbell-bicep-curl", "exerciseName": "Barbell Curls", "sets": [
                    { "id": "mb-v2-ub-s6-1", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-ub-s6-2", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v2-ub-s6-3", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-ub-ex7", "exerciseId": "barbell-skull-crusher", "exerciseName": "Skull Crushers", "sets": [
                    { "id": "mb-v2-ub-s7-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-v2-ub-s7-2", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 12-15 reps." }
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
                    { "id": "mb-v2-lb-s1-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-lb-s1-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-lb-s1-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." },
                    { "id": "mb-v2-lb-s1-4", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 5-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-lb-ex2", "exerciseId": "dumbbell-bulgarian-split-squat", "exerciseName": "Split Squats", "sets": [
                    { "id": "mb-v2-lb-s2-1", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps per leg." },
                    { "id": "mb-v2-lb-s2-2", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps per leg." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-lb-ex3", "exerciseId": "lying-leg-curl-machine", "exerciseName": "Lying Leg Curls", "sets": [
                    { "id": "mb-v2-lb-s3-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v2-lb-s3-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v2-lb-s3-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-lb-ex4", "exerciseId": "seated-calf-raise-machine", "exerciseName": "Seated Calf Raises", "sets": [
                    { "id": "mb-v2-lb-s4-1", "targetReps": 15, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v2-lb-s4-2", "targetReps": 15, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v2-lb-s4-3", "targetReps": 15, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v2-lb-s4-4", "targetReps": 15, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v2-lb-ex5", "exerciseId": "plank", "exerciseName": "Abs", "sets": [
                    { "id": "mb-v2-lb-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
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
                    { "id": "mb-v3-ua-s1-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ua-s1-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ua-s1-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ua-ex2", "exerciseId": "dumbbell-incline-press", "exerciseName": "Incline Dumbbell Press", "sets": [
                    { "id": "mb-v3-ua-s2-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ua-s2-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ua-s2-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ua-ex3", "exerciseId": "bent-over-row-barbell", "exerciseName": "Rows", "sets": [
                    { "id": "mb-v3-ua-s3-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ua-s3-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ua-s3-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ua-ex4", "exerciseId": "lat-pulldown-machine", "exerciseName": "Lat Pull-Downs", "sets": [
                    { "id": "mb-v3-ua-s4-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ua-s4-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ua-s4-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ua-ex5", "exerciseId": "dumbbell-lateral-raise", "exerciseName": "Lateral Raises", "sets": [
                    { "id": "mb-v3-ua-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v3-ua-s5-2", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ua-ex6", "exerciseId": "cable-tricep-pushdown", "exerciseName": "Triceps Pushdowns", "sets": [
                    { "id": "mb-v3-ua-s6-1", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-ua-s6-2", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-ua-s6-3", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ua-ex7", "exerciseId": "dumbbell-bicep-curl", "exerciseName": "Dumbbell Curls", "sets": [
                    { "id": "mb-v3-ua-s7-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-v3-ua-s7-2", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 12-15 reps." }
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
                    { "id": "mb-v3-la-s1-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-la-s1-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-la-s1-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-la-ex2", "exerciseId": "leg-curl-machine", "exerciseName": "Seated Leg Curls", "sets": [
                    { "id": "mb-v3-la-s2-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-la-s2-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-la-s2-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-la-ex3", "exerciseId": "leg-press-machine", "exerciseName": "Leg Press", "sets": [
                    { "id": "mb-v3-la-s3-1", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-la-s3-2", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-la-s3-3", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-la-ex4", "exerciseId": "standing-calf-raise", "exerciseName": "Standing Calf Raises", "sets": [
                    { "id": "mb-v3-la-s4-1", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-la-s4-2", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-la-s4-3", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-la-s4-4", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-la-ex5", "exerciseId": "plank", "exerciseName": "Abs", "sets": [
                    { "id": "mb-v3-la-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
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
                    { "id": "mb-v3-ub-s1-1", "targetReps": 8, "targetWeight": null, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ub-s1-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ub-s1-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ub-ex2", "exerciseId": "seated-row-machine", "exerciseName": "Seated Cable Row", "sets": [
                    { "id": "mb-v3-ub-s2-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ub-s2-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ub-s2-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ub-ex3", "exerciseId": "overhead-press-barbell", "exerciseName": "Barbell Shoulder Press", "sets": [
                    { "id": "mb-v3-ub-s3-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ub-s3-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-ub-s3-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ub-ex4", "exerciseId": "dumbbell-bench-press", "exerciseName": "Dumbbell Bench Press", "sets": [
                    { "id": "mb-v3-ub-s4-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ub-s4-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v3-ub-s4-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ub-ex5", "exerciseId": "dumbbell-fly", "exerciseName": "Dumbbell Flyes", "sets": [
                    { "id": "mb-v3-ub-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v3-ub-s5-2", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ub-ex6", "exerciseId": "barbell-bicep-curl", "exerciseName": "Barbell Curls", "sets": [
                    { "id": "mb-v3-ub-s6-1", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-ub-s6-2", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-ub-s6-3", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-ub-ex7", "exerciseId": "barbell-skull-crusher", "exerciseName": "Skull Crushers", "sets": [
                    { "id": "mb-v3-ub-s7-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-v3-ub-s7-2", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 12-15 reps." }
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
                    { "id": "mb-v3-lb-s1-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-lb-s1-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v3-lb-s1-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-lb-ex2", "exerciseId": "dumbbell-bulgarian-split-squat", "exerciseName": "Split Squats", "sets": [
                    { "id": "mb-v3-lb-s2-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." },
                    { "id": "mb-v3-lb-s2-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." },
                    { "id": "mb-v3-lb-s2-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-lb-ex3", "exerciseId": "lying-leg-curl-machine", "exerciseName": "Lying Leg Curls", "sets": [
                    { "id": "mb-v3-lb-s3-1", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-lb-s3-2", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v3-lb-s3-3", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-lb-ex4", "exerciseId": "seated-calf-raise-machine", "exerciseName": "Seated Calf Raises", "sets": [
                    { "id": "mb-v3-lb-s4-1", "targetReps": 15, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v3-lb-s4-2", "targetReps": 15, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v3-lb-s4-3", "targetReps": 15, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v3-lb-s4-4", "targetReps": 15, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v3-lb-ex5", "exerciseId": "plank", "exerciseName": "Abs", "sets": [
                    { "id": "mb-v3-lb-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
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
                "id": "mb-v4-ua-ex1", "exerciseId": "barbell-bench-press", "exerciseName": "Bench Press", "supersetId": "ss-ua-1",  "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-ua-s1-1", "targetReps": 8, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ua-s1-2", "targetReps": 8, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ua-s1-3", "targetReps": 8, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 6-8 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ua-ex2", "exerciseId": "bent-over-row-barbell", "exerciseName": "Rows", "supersetId": "ss-ua-1",  "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-ua-s2-1", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ua-s2-2", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ua-s2-3", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "superset", "notes": "Aim for 6-8 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ua-ex3", "exerciseId": "dumbbell-incline-press", "exerciseName": "Incline Dumbbell Press", "supersetId": "ss-ua-2",  "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-ua-s3-1", "targetReps": 10, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ua-s3-2", "targetReps": 10, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ua-s3-3", "targetReps": 10, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 8-10 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ua-ex4", "exerciseId": "lat-pulldown-machine", "exerciseName": "Lat Pull-Downs", "supersetId": "ss-ua-2",  "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-ua-s4-1", "targetReps": 10, "targetWeight": 10, "targetRest": 60, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ua-s4-2", "targetReps": 10, "targetWeight": 10, "targetRest": 60, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ua-s4-3", "targetReps": 10, "targetWeight": 10, "targetRest": 60, "type": "superset", "notes": "Aim for 8-10 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ua-ex5", "exerciseId": "dumbbell-lateral-raise", "exerciseName": "Lateral Raises", "sets": [
                    { "id": "mb-v4-ua-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v4-ua-s5-2", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v4-ua-ex6", "exerciseId": "cable-tricep-pushdown", "exerciseName": "Triceps Pushdowns", "supersetId": "ss-ua-3",  "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-ua-s6-1", "targetReps": 12, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-ua-s6-2", "targetReps": 12, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-ua-s6-3", "targetReps": 12, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 10-12 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ua-ex7", "exerciseId": "dumbbell-bicep-curl", "exerciseName": "Dumbbell Curls", "supersetId": "ss-ua-3",  "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-ua-s7-1", "targetReps": 15, "targetWeight": 10, "targetRest": 45, "type": "superset", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-v4-ua-s7-2", "targetReps": 15, "targetWeight": 10, "targetRest": 45, "type": "superset", "notes": "Aim for 12-15 reps." }
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
                    { "id": "mb-v4-la-s1-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-la-s1-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-la-s1-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v4-la-ex2", "exerciseId": "leg-press-machine", "exerciseName": "Leg Press", "supersetId": "ss-la-1",  "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-la-s2-1", "targetReps": 12, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-la-s2-2", "targetReps": 12, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-la-s2-3", "targetReps": 12, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 10-12 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-la-ex3", "exerciseId": "leg-curl-machine", "exerciseName": "Seated Leg Curls", "supersetId": "ss-la-1",  "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-la-s3-1", "targetReps": 10, "targetWeight": 10, "targetRest": 60, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-la-s3-2", "targetReps": 10, "targetWeight": 10, "targetRest": 60, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-la-s3-3", "targetReps": 10, "targetWeight": 10, "targetRest": 60, "type": "superset", "notes": "Aim for 8-10 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-la-ex4", "exerciseId": "standing-calf-raise", "exerciseName": "Standing Calf Raises", "supersetId": "ss-la-2",  "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-la-s4-1", "targetReps": 8, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-la-s4-2", "targetReps": 8, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-la-s4-3", "targetReps": 8, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-la-s4-4", "targetReps": 8, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 6-8 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-la-ex5", "exerciseId": "plank", "exerciseName": "Abs", "supersetId": "ss-la-2",  "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-la-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 45, "type": "superset", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
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
                "id": "mb-v4-ub-ex1", "exerciseId": "pull-up", "exerciseName": "Pull-Ups", "supersetId": "ss-ub-1",  "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-ub-s1-1", "targetReps": 8, "targetWeight": null, "targetRest": 0, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ub-s1-2", "targetReps": 8, "targetWeight": null, "targetRest": 0, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ub-s1-3", "targetReps": 8, "targetWeight": null, "targetRest": 0, "type": "superset", "notes": "Aim for 6-8 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ub-ex2", "exerciseId": "overhead-press-barbell", "exerciseName": "Barbell Shoulder Press", "supersetId": "ss-ub-1",  "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-ub-s2-1", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ub-s2-2", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "superset", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-ub-s2-3", "targetReps": 8, "targetWeight": 10, "targetRest": 90, "type": "superset", "notes": "Aim for 6-8 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ub-ex3", "exerciseId": "seated-row-machine", "exerciseName": "Seated Cable Row", "supersetId": "ss-ub-2",  "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-ub-s3-1", "targetReps": 10, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ub-s3-2", "targetReps": 10, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ub-s3-3", "targetReps": 10, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 8-10 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ub-ex4", "exerciseId": "dumbbell-bench-press", "exerciseName": "Dumbbell Bench Press", "supersetId": "ss-ub-2",  "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-ub-s4-1", "targetReps": 10, "targetWeight": 10, "targetRest": 60, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ub-s4-2", "targetReps": 10, "targetWeight": 10, "targetRest": 60, "type": "superset", "notes": "Aim for 8-10 reps." },
                    { "id": "mb-v4-ub-s4-3", "targetReps": 10, "targetWeight": 10, "targetRest": 60, "type": "superset", "notes": "Aim for 8-10 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ub-ex5", "exerciseId": "dumbbell-fly", "exerciseName": "Dumbbell Flyes", "sets": [
                    { "id": "mb-v4-ub-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v4-ub-s5-2", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Aim for 10-15 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v4-ub-ex6", "exerciseId": "barbell-bicep-curl", "exerciseName": "Barbell Curls", "supersetId": "ss-ub-3",  "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-ub-s6-1", "targetReps": 12, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-ub-s6-2", "targetReps": 12, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-ub-s6-3", "targetReps": 12, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 10-12 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-ub-ex7", "exerciseId": "barbell-skull-crusher", "exerciseName": "Skull Crushers", "supersetId": "ss-ub-3",  "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-ub-s7-1", "targetReps": 15, "targetWeight": 10, "targetRest": 45, "type": "superset", "notes": "Aim for 12-15 reps." },
                    { "id": "mb-v4-ub-s7-2", "targetReps": 15, "targetWeight": 10, "targetRest": 45, "type": "superset", "notes": "Aim for 12-15 reps." }
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
                    { "id": "mb-v4-lb-s1-1", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-lb-s1-2", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." },
                    { "id": "mb-v4-lb-s1-3", "targetReps": 8, "targetWeight": 10, "targetRest": 150, "type": "standard", "notes": "Aim for 6-8 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v4-lb-ex2", "exerciseId": "dumbbell-bulgarian-split-squat", "exerciseName": "Split Squats", "sets": [
                    { "id": "mb-v4-lb-s2-1", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." },
                    { "id": "mb-v4-lb-s2-2", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." },
                    { "id": "mb-v4-lb-s2-3", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 8-10 reps per leg." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v4-lb-ex3", "exerciseId": "lying-leg-curl-machine", "exerciseName": "Lying Leg Curls", "sets": [
                    { "id": "mb-v4-lb-s3-1", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-lb-s3-2", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." },
                    { "id": "mb-v4-lb-s3-3", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Aim for 10-12 reps." }
                ], "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "mb-v4-lb-ex4", "exerciseId": "seated-calf-raise-machine", "exerciseName": "Seated Calf Raises", "supersetId": "ss-lb-1",  "supersetOrder": 0, "sets": [
                    { "id": "mb-v4-lb-s4-1", "targetReps": 15, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v4-lb-s4-2", "targetReps": 15, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v4-lb-s4-3", "targetReps": 15, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 10-15 reps." },
                    { "id": "mb-v4-lb-s4-4", "targetReps": 15, "targetWeight": 10, "targetRest": 0, "type": "superset", "notes": "Aim for 10-15 reps." }
                ], "type": "superset"
            },
            {
                "id": "mb-v4-lb-ex5", "exerciseId": "plank", "exerciseName": "Abs", "supersetId": "ss-lb-1",  "supersetOrder": 1, "sets": [
                    { "id": "mb-v4-lb-s5-1", "targetReps": 15, "targetWeight": 10, "targetRest": 45, "type": "superset", "notes": "Perform any ab exercise. Aim for 8-15 reps." }
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
                        "targetDuration": 600,
                        "targetRest": 60,
                        "type": "cardio"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "routine-1-ex-2",
                "exerciseId": "dumbbell-bench-press",
                "exerciseName": "Dumbbell Flat Bench Press",
                "sets": [
                    {
                        "id": "set-1-2-1",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-2-2",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-2-3",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-2-4",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "routine-1-ex-3",
                "exerciseId": "dumbbell-incline-fly",
                "exerciseName": "Dumbbell Incline Fly",
                "sets": [
                    {
                        "id": "set-1-3-1",
                        "targetReps": 12,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-3-2",
                        "targetReps": 12,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-3-3",
                        "targetReps": 12,
                        "targetRest": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "routine-1-ex-4",
                "exerciseId": "dumbbell-lunge",
                "exerciseName": "Dumbbell Reverse Lunge",
                "sets": [
                    {
                        "id": "set-1-4-1",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-4-2",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-4-3",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-4-4",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "routine-1-ex-5",
                "exerciseId": "plank",
                "exerciseName": "Straight-Arm Plank",
                "sets": [
                    {
                        "id": "set-1-5-1",
                        "targetDuration": 45,
                        "targetRest": 30,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-5-2",
                        "targetDuration": 45,
                        "targetRest": 30,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-5-3",
                        "targetDuration": 45,
                        "targetRest": 30,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-5-4",
                        "targetDuration": 45,
                        "targetRest": 30,
                        "type": "standard"
                    },
                    {
                        "id": "set-1-5-5",
                        "targetDuration": 45,
                        "targetRest": 30,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "routine-1-ex-6",
                "exerciseId": "running-jogging",
                "exerciseName": "Treadmill or Runner",
                "sets": [
                    {
                        "id": "set-1-6-1",
                        "targetDuration": 300,
                        "targetRest": 60,
                        "type": "cardio"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
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
                        "targetDuration": 600,
                        "targetRest": 60,
                        "type": "cardio"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-2",
                "exerciseId": "incline-chest-press-machine",
                "exerciseName": "Incline Chest Press",
                "sets": [
                    {
                        "id": "set-2-2-1",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-2-2",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-2-3",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-2-4",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-3",
                "exerciseId": "seated-row-machine",
                "exerciseName": "Seated Row Machine (Neutral Grip)",
                "sets": [
                    {
                        "id": "set-2-3-1",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-3-2",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-3-3",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-4",
                "exerciseId": "dumbbell-shoulder-press",
                "exerciseName": "Seated Dumbbell Shoulder Press",
                "sets": [
                    {
                        "id": "set-2-4-1",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-4-2",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-4-3",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-4-4",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-5",
                "exerciseId": "dumbbell-lateral-raise",
                "exerciseName": "Seated Dumbbell Lateral Raise",
                "sets": [
                    {
                        "id": "set-2-5-1",
                        "targetReps": 12,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-5-2",
                        "targetReps": 12,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-5-3",
                        "targetReps": 12,
                        "targetRest": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-6",
                "exerciseId": "cable-tricep-pushdown",
                "exerciseName": "Tricep Rope Pushdown",
                "sets": [
                    {
                        "id": "set-2-6-1",
                        "targetReps": 12,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-6-2",
                        "targetReps": 12,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-6-3",
                        "targetReps": 12,
                        "targetRest": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-7",
                "exerciseId": "dumbbell-bicep-curl",
                "exerciseName": "Alternating Dumbbell Curl",
                "sets": [
                    {
                        "id": "set-2-7-1",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-7-2",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-7-3",
                        "targetReps": 10,
                        "targetRest": 60,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-8",
                "exerciseId": "twist-sit-up",
                "exerciseName": "Twisting Sit-up",
                "sets": [
                    {
                        "id": "set-2-8-1",
                        "targetReps": 15,
                        "targetRest": 30,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-8-2",
                        "targetReps": 15,
                        "targetRest": 30,
                        "type": "standard"
                    },
                    {
                        "id": "set-2-8-3",
                        "targetReps": 15,
                        "targetRest": 30,
                        "type": "standard"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            },
            {
                "id": "routine-2-ex-9",
                "exerciseId": "running-jogging",
                "exerciseName": "Treadmill or Runner",
                "sets": [
                    {
                        "id": "set-2-9-1",
                        "targetDuration": 300,
                        "targetRest": 60,
                        "type": "cardio"
                    }
                ],
                "supersetId": null,
                "supersetOrder": null,
                "type": "standard"
            }
        ]
    },
    {
        "id": "wendler-531-day1-ohp",
        "name": "5/3/1 - Overhead Press Day",
        "description": "This routine focuses on the Barbell Overhead Press as the main strength lift. Accessory work is designed to build the shoulders and the supporting muscles of the upper back and arms.",
        "goal": "strength",
        "exercises": [
            {
                "id": "w1-ex1",
                "exerciseId": "overhead-press-barbell",
                "exerciseName": "Overhead Press (Barbell)",
                "sets": [
                    { "id": "w1-s1", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Main lift: Focus on progressive overload week to week." },
                    { "id": "w1-s2", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard" },
                    { "id": "w1-s3", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "On the final set, aim for as many reps as possible (AMRAP) with good form." }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "w1-ex2",
                "exerciseId": "lat-pulldown-machine",
                "exerciseName": "Lat Pulldown",
                "sets": [
                    { "id": "w1-s4", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard" },
                    { "id": "w1-s5", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard" },
                    { "id": "w1-s6", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard" }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "w1-ex3",
                "exerciseId": "dumbbell-lateral-raise",
                "exerciseName": "Dumbbell Lateral Raise",
                "sets": [
                    { "id": "w1-s7", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard" },
                    { "id": "w1-s8", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard" },
                    { "id": "w1-s9", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard" }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "w1-ex4",
                "exerciseId": "cable-face-pull",
                "exerciseName": "Face Pulls",
                "sets": [
                    { "id": "w1-s10", "targetReps": 20, "targetWeight": 10, "targetRest": 60, "type": "standard" },
                    { "id": "w1-s11", "targetReps": 20, "targetWeight": 10, "targetRest": 60, "type": "standard" }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ],
        "notes": "A strong back and healthy shoulders are key to a big press. Don't neglect the accessory work."
    },
    {
        "id": "wendler-531-day2-deadlift",
        "name": "5/3/1 - Deadlift Day",
        "description": "This routine is built around the Barbell Deadlift. Accessory exercises focus on strengthening the posterior chain, quads, and core to support a heavy pull.",
        "goal": "strength",
        "exercises": [
            {
                "id": "w2-ex1",
                "exerciseId": "barbell-deadlift",
                "exerciseName": "Barbell Deadlift (Conventional)",
                "sets": [
                    { "id": "w2-s1", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Main lift: Focus on a flat back and powerful hip drive." },
                    { "id": "w2-s2", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard" },
                    { "id": "w2-s3", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "On the final set, aim for as many reps as possible (AMRAP) without form breakdown." }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "w2-ex2",
                "exerciseId": "leg-press-machine",
                "exerciseName": "Leg Press",
                "sets": [
                    { "id": "w2-s4", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard" },
                    { "id": "w2-s5", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard" },
                    { "id": "w2-s6", "targetReps": 12, "targetWeight": 10, "targetRest": 90, "type": "standard" }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "w2-ex3",
                "exerciseId": "lying-leg-curl-machine",
                "exerciseName": "Lying Leg Curls",
                "sets": [
                    { "id": "w2-s7", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard" },
                    { "id": "w2-s8", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard" },
                    { "id": "w2-s9", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard" }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "w2-ex4",
                "exerciseId": "plank",
                "exerciseName": "Plank",
                "sets": [
                    { "id": "w2-s10", "targetDuration": 60, "targetWeight": null, "targetRest": 60, "type": "standard", "notes": "Hold for max time." },
                    { "id": "w2-s11", "targetDuration": 60, "targetWeight": null, "targetRest": 60, "type": "standard", "notes": "Hold for max time." },
                    { "id": "w2-s12", "targetDuration": 60, "targetWeight": null, "targetRest": 60, "type": "standard", "notes": "Hold for max time." }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ],
        "notes": "Deadlifts are taxing. Ensure proper warm-up and focus on maintaining a neutral spine throughout the main lift."
    },
    {
        "id": "wendler-531-day3-bench",
        "name": "5/3/1 - Bench Press Day",
        "description": "This routine is centered around the Barbell Bench Press. Accessory work targets the chest from different angles, builds the back for stability, and strengthens the triceps.",
        "goal": "strength",
        "exercises": [
            {
                "id": "w3-ex1",
                "exerciseId": "barbell-bench-press",
                "exerciseName": "Barbell Bench Press",
                "sets": [
                    { "id": "w3-s1", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Main lift: Keep your shoulders pinned back and down." },
                    { "id": "w3-s2", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard" },
                    { "id": "w3-s3", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "On the final set, aim for as many reps as possible (AMRAP) with good form." }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "w3-ex2",
                "exerciseId": "dumbbell-incline-press",
                "exerciseName": "Dumbbell Incline Press",
                "sets": [
                    { "id": "w3-s4", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard" },
                    { "id": "w3-s5", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard" },
                    { "id": "w3-s6", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard" }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "w3-ex3",
                "exerciseId": "dumbbell-row",
                "exerciseName": "Dumbbell Row (Single Arm)",
                "sets": [
                    { "id": "w3-s7", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Perform 12 reps per arm." },
                    { "id": "w3-s8", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Perform 12 reps per arm." },
                    { "id": "w3-s9", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard", "notes": "Perform 12 reps per arm." }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "w3-ex4",
                "exerciseId": "barbell-skull-crusher",
                "exerciseName": "Skull Crushers",
                "sets": [
                    { "id": "w3-s10", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard" },
                    { "id": "w3-s11", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard" }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ],
        "notes": "A strong bench press requires a strong back. The dumbbell rows are just as important as the pressing movements."
    },
    {
        "id": "wendler-531-day4-squat",
        "name": "5/3/1 - Squat Day",
        "description": "This routine is built around the Barbell Back Squat. Accessory work is included to strengthen the quads, hamstrings, and core, all of which are critical for a strong squat.",
        "goal": "strength",
        "exercises": [
            {
                "id": "w4-ex1",
                "exerciseId": "barbell-back-squat",
                "exerciseName": "Barbell Back Squat",
                "sets": [
                    { "id": "w4-s1", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Main lift: Focus on hitting depth (hip crease below knee)." },
                    { "id": "w4-s2", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard" },
                    { "id": "w4-s3", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "On the final set, aim for as many reps as possible (AMRAP) with good form." }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "w4-ex2",
                "exerciseId": "dumbbell-bulgarian-split-squat",
                "exerciseName": "Bulgarian Split Squat",
                "sets": [
                    { "id": "w4-s4", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Perform 10 reps per leg." },
                    { "id": "w4-s5", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Perform 10 reps per leg." },
                    { "id": "w4-s6", "targetReps": 10, "targetWeight": 10, "targetRest": 90, "type": "standard", "notes": "Perform 10 reps per leg." }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "w4-ex3",
                "exerciseId": "barbell-good-morning",
                "exerciseName": "Good Mornings",
                "sets": [
                    { "id": "w4-s7", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard" },
                    { "id": "w4-s8", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard" },
                    { "id": "w4-s9", "targetReps": 12, "targetWeight": 10, "targetRest": 60, "type": "standard" }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "w4-ex4",
                "exerciseId": "leg-raises",
                "exerciseName": "Hanging Leg Raises",
                "sets": [
                    { "id": "w4-s10", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard" },
                    { "id": "w4-s11", "targetReps": 15, "targetWeight": 10, "targetRest": 60, "type": "standard" }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ],
        "notes": "Control the descent on your squats. The unilateral work (split squats) will help improve stability and balance."
    },
    {
        "id": "5x5-workout-a",
        "name": "5x5 Strength - Workout A",
        "description": "A full-body routine based on the 5x5 strength training methodology. This workout focuses on the Squat, Bench Press, and Barbell Row. The primary goal is linear progression by adding weight each session.",
        "goal": "strength",
        "exercises": [
            {
                "id": "5x5-a-ex1",
                "exerciseId": "barbell-back-squat",
                "exerciseName": "Barbell Back Squat",
                "sets": [
                    { "id": "5x5-a-s1", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 1 of 5." },
                    { "id": "5x5-a-s2", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 2 of 5." },
                    { "id": "5x5-a-s3", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 3 of 5." },
                    { "id": "5x5-a-s4", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 4 of 5." },
                    { "id": "5x5-a-s5", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 5 of 5." }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "5x5-a-ex2",
                "exerciseId": "barbell-bench-press",
                "exerciseName": "Barbell Bench Press",
                "sets": [
                    { "id": "5x5-a-s6", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 1 of 5." },
                    { "id": "5x5-a-s7", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 2 of 5." },
                    { "id": "5x5-a-s8", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 3 of 5." },
                    { "id": "5x5-a-s9", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 4 of 5." },
                    { "id": "5x5-a-s10", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 5 of 5." }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "5x5-a-ex3",
                "exerciseId": "bent-over-row-barbell",
                "exerciseName": "Barbell Bent-Over Row",
                "sets": [
                    { "id": "5x5-a-s11", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 1 of 5." },
                    { "id": "5x5-a-s12", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 2 of 5." },
                    { "id": "5x5-a-s13", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 3 of 5." },
                    { "id": "5x5-a-s14", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 4 of 5." },
                    { "id": "5x5-a-s15", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 5 of 5." }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ],
        "notes": "Perform 2-3 warm-up sets with lighter weight before starting your 5x5 work sets for each exercise."
    },
    {
        "id": "5x5-workout-b",
        "name": "5x5 Strength - Workout B",
        "description": "The second full-body routine in the 5x5 system. This workout features the Squat, Overhead Press, and one heavy set of Deadlifts.",
        "goal": "strength",
        "exercises": [
            {
                "id": "5x5-b-ex1",
                "exerciseId": "barbell-back-squat",
                "exerciseName": "Barbell Back Squat",
                "sets": [
                    { "id": "5x5-b-s1", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 1 of 5." },
                    { "id": "5x5-b-s2", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 2 of 5." },
                    { "id": "5x5-b-s3", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 3 of 5." },
                    { "id": "5x5-b-s4", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 4 of 5." },
                    { "id": "5x5-b-s5", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 5 of 5." }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "5x5-b-ex2",
                "exerciseId": "overhead-press-barbell",
                "exerciseName": "Overhead Press (Barbell)",
                "sets": [
                    { "id": "5x5-b-s6", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 1 of 5." },
                    { "id": "5x5-b-s7", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 2 of 5." },
                    { "id": "5x5-b-s8", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 3 of 5." },
                    { "id": "5x5-b-s9", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 4 of 5." },
                    { "id": "5x5-b-s10", "targetReps": 5, "targetWeight": 10, "targetRest": 180, "type": "standard", "notes": "Work set 5 of 5." }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            },
            {
                "id": "5x5-b-ex3",
                "exerciseId": "barbell-deadlift",
                "exerciseName": "Barbell Deadlift (Conventional)",
                "sets": [
                    { "id": "5x5-b-s11", "targetReps": 5, "targetWeight": 10, "targetRest": 240, "type": "standard", "notes": "One heavy work set of 5 reps after warming up." }
                ],
                "supersetId": null, "supersetOrder": null, "type": "standard"
            }
        ],
        "notes": "Perform warm-up sets for Squat and OHP. For the Deadlift, warm up thoroughly before attempting your single heavy set of 5."
    },

    // Routine 1: Build 3-Dimensional Shoulders
    {
        id: 'build-3-dimensional-shoulders-intense-kettlebell-bodybuilding-routine',
        name: 'Build 3-Dimensional Shoulders [Intense Kettlebell Bodybuilding Routine]',
        description: 'An intense kettlebell circuit designed to build 3-dimensional shoulders, incorporating strength, carries, and bodyweight movements.',
        exercises: [
            {
                id: 'we-1-1',
                exerciseId: 'single-kettlebell-clean-and-press',
                exerciseName: 'Clean & Overhead Press to Alternating From Top OHP to Alternating From Bottom OHP',
                sets: [{ id: 'set-1-1-1', targetReps: 3, targetRest: 0, type: 'superset' },
                    { id: 'set-1-1-2', targetReps: 3, targetRest: 0, type: 'superset' },
                    { id: 'set-1-1-3', targetReps: 3, targetRest: 0, type: 'superset' }
                ],
                supersetId: 'shoulder-circuit-1',
                supersetOrder: 0,
                type: 'superset'
            },
            {
                id: 'we-1-2',
                exerciseId: 'kettlebell-rack-carry',
                exerciseName: 'Rack Carry',
                sets: [{ id: 'set-1-2-1', targetDuration: 50, notes: 'Duration in feet.', targetRest: 0, type: 'superset' }],
                supersetId: 'shoulder-circuit-1',
                supersetOrder: 1,
                type: 'superset'
            },
            {
                id: 'we-1-3',
                exerciseId: 'push-up',
                exerciseName: 'Push Up',
                sets: [{ id: 'set-1-3-1', targetReps: 6, targetRest: 0, type: 'superset' }],
                supersetId: 'shoulder-circuit-1',
                supersetOrder: 2,
                type: 'superset'
            },
            {
                id: 'we-1-4',
                exerciseId: 'farmers-walk',
                exerciseName: 'Farmers Walk',
                sets: [{ id: 'set-1-4-1', targetDuration: 50, notes: 'Duration in feet.', targetRest: 0, type: 'superset' }],
                supersetId: 'shoulder-circuit-1',
                supersetOrder: 3,
                type: 'superset'
            },
            {
                id: 'we-1-5',
                exerciseId: 'kettlebell-double-hand-swing',
                exerciseName: 'Double Hand Swing',
                sets: [{ id: 'set-1-5-1', targetReps: 6, targetRest: 150, notes: 'Rest 2-3 minutes after this exercise.', type: 'superset' }],
                supersetId: 'shoulder-circuit-1',
                supersetOrder: 4,
                type: 'superset'
            }
        ],
        goal: 'hypertrophy',
        targetMuscleGroups: ['Shoulders', 'Core', 'Chest', 'Triceps', 'Full Body'],
        notes: 'Workout by Chandler Marchman. **Weight Used In Workout: 71 lb. Kettlebells**. Rest 2-3 minutes between rounds - Do 3 Rounds Total. Video: https://www.youtube.com/watch?v=9Ri9Yqc9HZ8'
    },

    // Routine 2: Kettlebell Core Routine
    {
        id: 'kettlebell-core-routine-4-minute-anti-side-bend-oblique-finisher',
        name: 'Kettlebell Core Routine [4 Minute "Anti-Side Bend" Oblique Finisher]',
        description: 'A kettlebell circuit focused on anti-rotation and anti-lateral flexion to build a strong, functional core and obliques.',
        exercises: [
            {
                id: 'we-2-1',
                exerciseId: 'single-kettlebell-clean-press-to-pause-windmill',
                exerciseName: 'Single Kettlebell Clean & Press To Pause Windmill',
                sets: [{ id: 'set-2-1-1', targetReps: 3, notes: 'Perform 3 reps per side.', targetRest: 0, type: 'superset' },
                    { id: 'set-2-1-2', targetReps: 3, notes: 'Perform 3 reps per side.', targetRest: 0, type: 'superset' },
                    { id: 'set-2-1-3', targetReps: 3, notes: 'Perform 3 reps per side.', targetRest: 0, type: 'superset' }
                ],
                supersetId: 'core-circuit-2',
                supersetOrder: 0,
                type: 'superset'
            },
            {
                id: 'we-2-2',
                exerciseId: 'kettlebell-waiters-walk',
                exerciseName: 'Single Arm Waiters Walk',
                sets: [{ id: 'set-2-2-1', targetDuration: 50, notes: 'Duration in feet per arm.', targetRest: 0, type: 'superset' }],
                supersetId: 'core-circuit-2',
                supersetOrder: 1,
                type: 'superset'
            },
            {
                id: 'kettlebell-single-arm-clean-and-thruster',
                exerciseId: 'kettlebell-single-arm-clean-and-thruster',
                exerciseName: 'Single Arm Clean & Thruster',
                sets: [{ id: 'set-2-3-1', targetReps: 3, notes: 'Perform 3 reps per side.', targetRest: 0, type: 'superset' }],
                supersetId: 'core-circuit-2',
                supersetOrder: 2,
                type: 'superset'
            },
            {
                id: 'we-2-4',
                exerciseId: 'kettlebell-rack-carry',
                exerciseName: 'Offset Rack Walk',
                sets: [{ id: 'set-2-4-1', targetDuration: 50, notes: 'Duration in feet per side. This is a single-arm rack carry.', targetRest: 0, type: 'superset' }],
                supersetId: 'core-circuit-2',
                supersetOrder: 3,
                type: 'superset'
            },
            {
                id: 'we-2-5',
                exerciseId: 'kettlebell-suitcase-deadlift-to-anti-rotation-row',
                exerciseName: 'Suitcase Deadlift to Anti-Rotation Row',
                sets: [{ id: 'set-2-5-1', targetReps: 3, notes: 'Perform 3 reps per side.', targetRest: 0, type: 'superset' }],
                supersetId: 'core-circuit-2',
                supersetOrder: 4,
                type: 'superset'
            },
            {
                id: 'we-2-6',
                exerciseId: 'kettlebell-farmer-carry',
                exerciseName: 'Single Arm Farmers Walk',
                sets: [{ id: 'set-2-6-1', targetDuration: 50, notes: 'Duration in feet per arm. Rest 2-3 minutes after this exercise.', targetRest: 150, type: 'superset' }],
                supersetId: 'core-circuit-2',
                supersetOrder: 5,
                type: 'superset'
            }
        ],
        goal: 'strength',
        targetMuscleGroups: ['Core', 'Obliques', 'Shoulders', 'Full Body'],
        notes: 'Workout by Chandler Marchman. **Weight Used In Workout: 71 lb. Kettlebell**. Rest 2-3 minutes between rounds - Do 3 Rounds Total. Video: https://www.youtube.com/watch?v=B5HLwfebDeA'
    },

    // Routine 3: 50 Rep Kettlebell Arm Blaster
    {
        id: '50-rep-kettlebell-arm-blaster-build-muscular-biceps-and-triceps',
        name: '50 Rep Kettlebell Arm Blaster Build Muscular Biceps & Triceps',
        description: 'A high-repetition workout focused on building muscular biceps and triceps using a kettlebell and bodyweight exercises.',
        exercises: [
            {
                id: 'we-3-1',
                exerciseId: 'kettlebell-slow-eccentric-floor-skullcrusher-to-press',
                exerciseName: 'Slow Eccentric Floor Skullcrusher to Close Grip Floor Press',
                sets: [{ id: 'set-3-1-1', targetReps: 5, targetRest: 0, type: 'superset' },
                    { id: 'set-3-1-2', targetReps: 5, targetRest: 0, type: 'superset' },
                    { id: 'set-3-1-3', targetReps: 5, targetRest: 0, type: 'superset' }
                ],
                supersetId: 'arm-blaster-3',
                supersetOrder: 0,
                type: 'superset',
                
            },
            {
                id: 'we-3-2',
                exerciseId: 'kettlebell-floor-skullcrusher',
                exerciseName: 'Floor Skullcrusher',
                sets: [{ id: 'set-3-2-1', targetReps: 10, targetRest: 0, type: 'superset' }],
                supersetId: 'arm-blaster-3',
                supersetOrder: 1,
                type: 'superset',
                
            },
            {
                id: 'we-3-3',
                exerciseId: 'kettlebell-close-grip-floor-press',
                exerciseName: 'Close Grip Floor Press',
                sets: [{ id: 'set-3-3-1', targetReps: 10, targetRest: 0, type: 'superset' }],
                supersetId: 'arm-blaster-3',
                supersetOrder: 2,
                type: 'superset',
                
            },
            {
                id: 'we-3-4',
                exerciseId: 'proprioceptive-close-grip-push-up',
                exerciseName: 'Proprioceptive Close Grip Push Up',
                sets: [{ id: 'set-3-4-1', targetReps: 5, targetRest: 0, type: 'superset' }],
                supersetId: 'arm-blaster-3',
                supersetOrder: 3,
                type: 'superset',
                
            },
            {
                id: 'we-3-5',
                exerciseId: 'push-up',
                exerciseName: 'Push Up',
                sets: [{ id: 'set-3-5-1', targetReps: 5, targetRest: 0, type: 'superset' }],
                supersetId: 'arm-blaster-3',
                supersetOrder: 4,
                type: 'superset',
                
            },
            {
                id: 'we-3-6',
                exerciseId: 'kettlebell-slow-eccentric-pause-towel-curl',
                exerciseName: 'Slow Eccentric Pause Towel Curls',
                sets: [{ id: 'set-3-6-1', targetReps: 5, targetRest: 0, type: 'superset' }],
                supersetId: 'arm-blaster-3',
                supersetOrder: 5,
                type: 'superset',
                
            },
            {
                id: 'we-3-7',
                exerciseId: 'kettlebell-towel-curl',
                exerciseName: 'Towel Curls',
                sets: [{ id: 'set-3-7-1', targetReps: 5, targetRest: 180, notes: 'Rest no more than 3 minutes after this exercise.', type: 'superset' }],
                supersetId: 'arm-blaster-3',
                supersetOrder: 6,
                type: 'superset',
                
            }
        ],
        goal: 'hypertrophy',
        targetMuscleGroups: ['Triceps', 'Biceps', 'Chest', 'Forearms'],
        notes: 'Workout by Chandler Marchman. **Weight Used During Workout: 71 lb. Kettlebell**. Rest No More Than 3 Minutes Between Rounds - Do 3 Total Rounds. Video: https://www.youtube.com/watch?v=NKrxQWu4iYE'
    },

    // Routine 4: Kettlebell Back Attack!
    {
        id: 'kettlebell-back-attack-builds-monster-lats-and-traps',
        name: 'Kettlebell Back Attack! [Builds MONSTER Lats & Traps]',
        description: 'A circuit designed to build a strong and muscular back, focusing on lats and traps with heavy kettlebell movements.',
        exercises: [
            {
                id: 'we-4-1',
                exerciseId: 'kettlebell-clean-and-press',
                exerciseName: 'Clean & Press',
                sets: [{ id: 'set-4-1-1', targetReps: 5, targetRest: 0, type: 'superset' },
                    { id: 'set-4-1-2', targetReps: 5, targetRest: 0, type: 'superset' },
                    { id: 'set-4-1-3', targetReps: 5, targetRest: 0, type: 'superset' }
                ],
                supersetId: 'back-attack-4',
                supersetOrder: 0,
                type: 'superset'
            },
            {
                id: 'we-4-2',
                exerciseId: 'kettlebell-waiters-walk',
                exerciseName: 'Waiters Walk',
                sets: [{ id: 'set-4-2-1', targetDuration: 50, notes: 'Duration in feet.', targetRest: 0, type: 'superset' }],
                supersetId: 'back-attack-4',
                supersetOrder: 1,
                type: 'superset'
            },
            {
                id: 'we-4-3',
                exerciseId: 'kettlebell-cheat-row',
                exerciseName: 'Cheat Rows',
                sets: [{ id: 'set-4-3-1', targetReps: 5, targetRest: 0, type: 'superset' }],
                supersetId: 'back-attack-4',
                supersetOrder: 2,
                type: 'superset'
            },
            {
                id: 'we-4-4',
                exerciseId: 'kettlebell-rack-carry',
                exerciseName: 'Rack Carry',
                sets: [{ id: 'set-4-4-1', targetDuration: 50, notes: 'Duration in feet.', targetRest: 0, type: 'superset' }],
                supersetId: 'back-attack-4',
                supersetOrder: 3,
                type: 'superset'
            },
            {
                id: 'we-4-5',
                exerciseId: 'barbell-deadlift',
                exerciseName: 'Deadlift',
                sets: [{ id: 'set-4-5-1', targetReps: 5, targetRest: 0, type: 'superset' }],
                supersetId: 'back-attack-4',
                supersetOrder: 4,
                type: 'superset'
            },
            {
                id: 'we-4-6',
                exerciseId: 'farmers-walk',
                exerciseName: 'Farmers Walk',
                sets: [{ id: 'set-4-6-1', targetDuration: 50, notes: 'Duration in feet. Rest no more than 3 minutes after this.', targetRest: 180, type: 'superset' }],
                supersetId: 'back-attack-4',
                supersetOrder: 5,
                type: 'superset'
            }
        ],
        goal: 'strength',
        targetMuscleGroups: ['Lats', 'Traps', 'Back', 'Core', 'Shoulders'],
        notes: 'Workout by Chandler Marchman. **Kettlebell Weight Used: 71 lb. Kettlebell Kings KB\'s**. Rest No More Than 3 Minutes Between Rounds - Do 3 Rounds Total. Video: https://www.youtube.com/watch?v=PdzeItxrws8'
    },

    // Routine 5: SHOCK Your Legs!
    {
        id: 'shock-your-legs-lower-body-kettlebell-strength-circuit',
        name: 'SHOCK Your Legs! [Lower Body Kettlebell Strength Circuit]',
        description: 'A lower body circuit that combines weighted kettlebell exercises with bodyweight movements to build strength and endurance in the legs.',
        exercises: [
            {
                id: 'we-5-1',
                exerciseId: 'proprioceptive-pause-goblet-squat',
                exerciseName: 'Proprioceptive Pause Goblet Squat',
                sets: [{ id: 'set-5-1-1', targetReps: 5, targetRest: 0, type: 'superset' },
                    { id: 'set-5-1-2', targetReps: 5, targetRest: 0, type: 'superset' },
                    { id: 'set-5-1-3', targetReps: 5, targetRest: 0, type: 'superset' }
                ],
                supersetId: 'leg-shock-5',
                supersetOrder: 0,
                type: 'superset'
            },
            {
                id: 'we-5-2',
                exerciseId: 'alternating-proprioceptive-reverse-lunge',
                exerciseName: 'Alternating Proprioceptive Reverse Lunge',
                sets: [{ id: 'set-5-2-1', targetReps: 5, notes: 'Perform 5 reps per leg.', targetRest: 0, type: 'superset' }],
                supersetId: 'leg-shock-5',
                supersetOrder: 1,
                type: 'superset'
            },
            {
                id: 'we-5-3',
                exerciseId: 'kettlebell-double-hand-swing',
                exerciseName: 'Double Hand Swing',
                sets: [{ id: 'set-5-3-1', targetReps: 5, targetRest: 0, type: 'superset' }],
                supersetId: 'leg-shock-5',
                supersetOrder: 2,
                type: 'superset'
            },
            {
                id: 'we-5-4',
                exerciseId: 'barbell-deadlift',
                exerciseName: 'Deadlift',
                sets: [{ id: 'set-5-4-1', targetReps: 5, targetRest: 0, type: 'superset' }],
                supersetId: 'leg-shock-5',
                supersetOrder: 3,
                type: 'superset'
            },
            {
                id: 'we-5-5',
                exerciseId: 'bodyweight-squat',
                exerciseName: 'Pause Bodyweight Squat',
                sets: [{ id: 'set-5-5-1', targetReps: 5, notes: 'With a pause at the bottom.', targetRest: 0, type: 'superset' }],
                supersetId: 'leg-shock-5',
                supersetOrder: 4,
                type: 'superset'
            },
            {
                id: 'we-5-6',
                exerciseId: 'bodyweight-squat',
                exerciseName: 'Bodyweight Squat',
                sets: [{ id: 'set-5-6-1', targetReps: 5, targetRest: 150, notes: 'Rest 2-3 minutes after this exercise.', type: 'superset' }],
                supersetId: 'leg-shock-5',
                supersetOrder: 5,
                type: 'superset'
            }
        ],
        goal: 'strength',
        targetMuscleGroups: ['Quadriceps', 'Glutes', 'Hamstrings', 'Core'],
        notes: 'Workout by Chandler Marchman. **Weight Used During Workout: 71 lb. Kettlebell**. Perform 3 Rounds - Rest 2-3 Minutes Between Rounds. Video: https://www.youtube.com/watch?v=aizRvVEz-m8'
    },
    // Routine 6: Home Kettlebell Bodybuilding [Chest & Triceps Routine]
    {
        id: 'home-kettlebell-bodybuilding-chest-and-triceps-routine',
        name: 'Home Kettlebell Bodybuilding [Chest & Triceps Routine]',
        description: 'A home-based kettlebell routine focused on building the chest and triceps using bands for added resistance.',
        exercises: [
            {
                id: 'we-6-1',
                exerciseId: 'double-kettlebell-floor-press',
                exerciseName: 'Banded Slow Eccentric Floor Press',
                sets: [{ id: 'set-6-1-1', targetReps: 5, notes: 'Perform with a slow eccentric. Original exercise uses bands.', targetRest: 0, type: 'superset' },
                    { id: 'set-6-1-2', targetReps: 5, notes: 'Perform with a slow eccentric. Original exercise uses bands.', targetRest: 0, type: 'superset' },
                    { id: 'set-6-1-3', targetReps: 5, notes: 'Perform with a slow eccentric. Original exercise uses bands.', targetRest: 0, type: 'superset' }
                ],
                supersetId: 'chest-triceps-circuit-6',
                supersetOrder: 0,
                type: 'superset'
            },
            {
                id: 'we-6-2',
                exerciseId: 'double-kettlebell-alternating-floor-press',
                exerciseName: 'Banded Alternating From Bottom Floor Press',
                sets: [{ id: 'set-6-2-1', targetReps: 5, notes: 'Perform 5 reps per arm. Original exercise uses bands and starts from the bottom.', targetRest: 0, type: 'superset' }],
                supersetId: 'chest-triceps-circuit-6',
                supersetOrder: 1,
                type: 'superset'
            },
            {
                id: 'we-6-3',
                exerciseId: 'kettlebell-close-grip-floor-press',
                exerciseName: 'Banded Close Grip Floor Press',
                sets: [{ id: 'set-6-3-1', targetReps: 10, notes: 'Original exercise uses bands.', targetRest: 0, type: 'superset' }],
                supersetId: 'chest-triceps-circuit-6',
                supersetOrder: 2,
                type: 'superset'
            },
            {
                id: 'we-6-4',
                exerciseId: 'push-up',
                exerciseName: 'Banded Push Up',
                sets: [{ id: 'set-6-4-1', targetReps: 5, notes: 'Original exercise uses bands.', targetRest: 0, type: 'superset' }],
                supersetId: 'chest-triceps-circuit-6',
                supersetOrder: 3,
                type: 'superset'
            },
            {
                id: 'we-6-5',
                exerciseId: 'push-up',
                exerciseName: 'Push Up',
                sets: [{ id: 'set-6-5-1', targetReps: 5, targetRest: 0, type: 'superset' }],
                supersetId: 'chest-triceps-circuit-6',
                supersetOrder: 4,
                type: 'superset'
            },
            {
                id: 'we-6-6',
                exerciseId: 'farmers-walk',
                exerciseName: 'Farmers Walk',
                sets: [{ id: 'set-6-6-1', targetDuration: 50, notes: 'Duration in feet. Rest no more than 3 minutes after this.', targetRest: 180, type: 'superset' }],
                supersetId: 'chest-triceps-circuit-6',
                supersetOrder: 5,
                type: 'superset'
            }
        ],
        goal: 'hypertrophy',
        targetMuscleGroups: ['Chest', 'Triceps', 'Core'],
        notes: 'Workout by Chandler Marchman. **Weight Used During Workout: 71 Lb. Kettlebells**. Rest No More Than 3 Minutes Between Rounds - Perform 3 Rounds Total. Video: https://www.youtube.com/watch?v=QBjT913kc_o'
    },

    // Routine 7: 50 Rep Kettlebell "DEATH SET"
    {
        id: '50-rep-kettlebell-death-set-total-body-strength-cardio',
        name: '50 Rep Kettlebell "DEATH SET" [Total Body Strength Cardio]',
        description: 'A high-repetition, total-body strength and conditioning circuit designed to push your limits.',
        exercises: [
            {
                id: 'we-7-1',
                exerciseId: 'kettlebell-snatch-to-overhead-reverse-lunge',
                exerciseName: 'Single Arm Snatch to Overhead Reverse Lunge',
                sets: [{ id: 'set-7-1-1', targetReps: 5, notes: 'Perform 5 reps per side. This is a complex with Overhead Reverse Lunge.', targetRest: 0, type: 'superset', targetWeight: 21 },
                    { id: 'set-7-1-2', targetReps: 5, notes: 'Perform 5 reps per side. This is a complex with Overhead Reverse Lunge.', targetRest: 0, type: 'superset', targetWeight: 21 },
                    { id: 'set-7-1-3', targetReps: 5, notes: 'Perform 5 reps per side. This is a complex with Overhead Reverse Lunge.', targetRest: 0, type: 'superset', targetWeight: 21 }
                ],
                supersetId: 'death-set-7',
                supersetOrder: 0,
                type: 'superset',
                
            },
            {
                id: 'we-7-2',
                exerciseId: 'kettlebell-overhead-lunge',
                exerciseName: 'Single Overhead Reverse Lunge',
                sets: [{ id: 'set-7-2-1', targetReps: 5, notes: 'Perform 5 reps per side as part of the complex.', targetRest: 0, type: 'superset', targetWeight: 21 }],
                supersetId: 'death-set-7',
                supersetOrder: 1,
                type: 'superset',
                
            },
            {
                id: 'we-7-3',
                exerciseId: 'kettlebell-deadlift-to-row',
                exerciseName: 'Deadlift to Row',
                sets: [{ id: 'set-7-3-1', targetReps: 5, notes: 'This is a complex with a Row.', targetRest: 0, type: 'superset', targetWeight: 21 }],
                supersetId: 'death-set-7',
                supersetOrder: 2,
                type: 'superset',
                
            },
            {
                id: 'we-7-4',
                exerciseId: 'kettlebell-single-arm-row',
                exerciseName: 'Deadlift to Row',
                sets: [{ id: 'set-7-4-1', targetReps: 5, notes: 'Performed as part of the complex.', targetRest: 0, type: 'superset', targetWeight: 21 }],
                supersetId: 'death-set-7',
                supersetOrder: 3,
                type: 'superset',
                
            },
            {
                id: 'we-7-5',
                exerciseId: 'kettlebell-deadlift',
                exerciseName: 'Deadlift',
                sets: [{ id: 'set-7-5-1', targetReps: 5, targetRest: 0, type: 'superset', targetWeight: 21 }],
                supersetId: 'death-set-7',
                supersetOrder: 4,
                type: 'superset',
                
            },
            {
                id: 'we-7-6',
                exerciseId: 'kettlebell-single-arm-row',
                exerciseName: 'Row',
                sets: [{ id: 'set-7-6-1', targetReps: 5, targetRest: 0, type: 'superset', targetWeight: 21 }],
                supersetId: 'death-set-7',
                supersetOrder: 5,
                type: 'superset',
                
            },
            {
                id: 'we-7-7',
                exerciseId: 'kettlebell-double-hand-swing',
                exerciseName: 'Double Hand Swing',
                sets: [{ id: 'set-7-7-1', targetReps: 5, targetRest: 0, type: 'superset', targetWeight: 21 }],
                supersetId: 'death-set-7',
                supersetOrder: 6,
                type: 'superset',
                
            },
            {
                id: 'we-7-8',
                exerciseId: 'kettlebell-double-hand-deadlift',
                exerciseName: 'Deadlift',
                sets: [{ id: 'set-7-8-1', targetReps: 5, targetRest: 150, notes: 'Rest 2-3 Minutes after this exercise.', type: 'superset', targetWeight: 21 }],
                supersetId: 'death-set-7',
                supersetOrder: 7,
                type: 'superset',
                
            }
        ],
        goal: 'fat loss / body composition',
        targetMuscleGroups: ['Full Body', 'Core', 'Glutes', 'Hamstrings', 'Back', 'Shoulders'],
        notes: 'Workout by Chandler Marchman. **Weight Used= 71 lb. Kettlebell Kings powder coated kettlebell**. Rest 2-3 Minutes Between Each Round. Video: https://www.youtube.com/watch?v=Oo5mfamYm58'
    },

    // Routine 8: Fight Ready! [KILLER MMA Kettlebell Conditioning Routine]
    {
        id: 'fight-ready-killer-mma-kettlebell-conditioning-routine',
        name: 'Fight Ready! [KILLER MMA Kettlebell Conditioning Routine]',
        description: 'A high-intensity conditioning circuit for fighters, combining kettlebell work with other functional movements.',
        exercises: [
            {
                id: 'we-8-1',
                exerciseId: 'kettlebell-single-arm-thruster',
                exerciseName: 'Single Kettlebell Thruster',
                sets: [
                    { id: 'set-8-1-1', targetReps: 5, targetRest: 0, type: 'superset' },
                    { id: 'set-8-1-2', targetReps: 3, targetRest: 0, type: 'superset' },
                    { id: 'set-8-1-3', targetReps: 1, targetRest: 0, type: 'superset' }
                ],
                supersetId: 'mma-conditioning-8',
                supersetOrder: 0,
                type: 'superset'
            },
            {
                id: 'we-8-2',
                exerciseId: 'kettlebell-goblet-squat',
                exerciseName: 'Sandbag Zercher Squat',
                sets: [{ id: 'set-8-2-1', targetReps: 5, notes: 'Original exercise is Sandbag Zercher Squat. Substituted with Goblet Squat.', targetRest: 0, type: 'superset' }],
                supersetId: 'mma-conditioning-8',
                supersetOrder: 1,
                type: 'superset'
            },
            {
                id: 'we-8-3',
                exerciseId: 'kettlebell-goblet-walk',
                exerciseName: 'Sandbag Zercher Carry',
                sets: [{ id: 'set-8-3-1', targetDuration: 50, notes: 'Duration in feet. Original is Sandbag Zercher Carry. Substituted with Goblet Walk.', targetRest: 0, type: 'superset' }],
                supersetId: 'mma-conditioning-8',
                supersetOrder: 2,
                type: 'superset'
            },
            {
                id: 'we-8-4',
                exerciseId: 'farmers-walk',
                exerciseName: 'Tire Drag',
                sets: [{ id: 'set-8-4-1', targetDuration: 50, notes: 'Duration in feet. Original exercise is Tire Drag. Substituted with Farmer\'s Walk.', targetRest: 0, type: 'superset' }],
                supersetId: 'mma-conditioning-8',
                supersetOrder: 3,
                type: 'superset'
            },
            {
                id: 'we-8-5',
                exerciseId: 'medicine-ball-slam',
                exerciseName: 'Sledgehammer Slams',
                sets: [{ id: 'set-8-5-1', targetReps: 10, notes: 'Perform 10 reps per side. Original is Sledgehammer Slams. Substituted with Medicine Ball Slam. Rest 2-3 minutes after this.', targetRest: 150, type: 'superset' }],
                supersetId: 'mma-conditioning-8',
                supersetOrder: 4,
                type: 'superset'
            }
        ],
        goal: 'sport-specific performance',
        targetMuscleGroups: ['Full Body', 'Core', 'Power / explosiveness'],
        notes: 'Workout by Chandler Marchman. **Weights used in workout: 71 lb. Powder Coated KB from "Kettlebell Kings"**. Perform as fast as possible - Rest 2-3 Minutes Between Each Round. Video: https://www.youtube.com/watch?v=y7Safm7wLqk'
    },

    // Routine 9: 10 Minute Total Body Kettlebell Workout
    {
        id: '10-minute-total-body-kettlebell-workout',
        name: '10 Minute Total Body Kettlebell Workout',
        description: 'A quick and effective total body workout using double kettlebells and loaded carries.',
        exercises: [
            {
                id: 'we-9-1',
                exerciseId: 'kettlebell-strict-press',
                exerciseName: 'Iso-Rack Overhead Press to Get-Up',
                sets: [{ id: 'set-9-1-1', targetReps: 5, notes: 'Perform 5 reps per side. Original is a complex with a Get-Up and an iso-hold.', targetRest: 0, type: 'superset' }],
                supersetId: 'total-body-10min-9',
                supersetOrder: 0,
                type: 'superset'
            },
            {
                id: 'we-9-2',
                exerciseId: 'turkish-get-up',
                exerciseName: 'Iso-Rack Overhead Press to Get-Up',
                sets: [{ id: 'set-9-2-1', targetReps: 5, notes: 'Perform 5 reps per side as part of the complex.', targetRest: 0, type: 'superset' }],
                supersetId: 'total-body-10min-9',
                supersetOrder: 1,
                
                type: 'superset'
            },
            {
                id: 'we-9-3',
                exerciseId: 'kettlebell-waiters-walk',
                exerciseName: 'Iso-Rack Waiters Walk',
                sets: [{ id: 'set-9-3-1', targetDuration: 50, notes: 'Duration in feet per side. Original has an iso-hold component.', targetRest: 0, type: 'superset' }],
                supersetId: 'total-body-10min-9',
                supersetOrder: 2,
                
                type: 'superset'
            },
            {
                id: 'we-9-4',
                exerciseId: 'double-kettlebell-front-squat',
                exerciseName: 'Front Squat',
                sets: [{ id: 'set-9-4-1', targetReps: 5, targetRest: 0, type: 'superset' }],
                supersetId: 'total-body-10min-9',
                supersetOrder: 3,
                
                type: 'superset'
            },
            {
                id: 'we-9-5',
                exerciseId: 'kettlebell-rack-carry',
                exerciseName: 'Double Kettlebell Rack Carry',
                sets: [{ id: 'set-9-5-1', targetDuration: 50, notes: 'Duration in feet.', targetRest: 0, type: 'superset' }],
                supersetId: 'total-body-10min-9',
                supersetOrder: 4,
                
                type: 'superset'
            },
            {
                id: 'we-9-6',
                exerciseId: 'kettlebell-deadlift',
                exerciseName: 'Deadlift',
                sets: [{ id: 'set-9-6-1', targetReps: 5, targetRest: 0, type: 'superset' }],
                supersetId: 'total-body-10min-9',
                supersetOrder: 5,
                
                type: 'superset'
            },
            {
                id: 'we-9-7',
                exerciseId: 'kettlebell-double-farmers-walk',
                exerciseName: 'Double Kettlebell Farmers Walk',
                sets: [{ id: 'set-9-7-1', targetDuration: 50, notes: 'Duration in feet. Rest no more than 3 minutes after this.', targetRest: 180, type: 'superset' }],
                supersetId: 'total-body-10min-9',
                supersetOrder: 6,
                
                type: 'superset'
            }
        ],
        goal: 'general health & longevity',
        targetMuscleGroups: ['Full Body', 'Core'],
        notes: 'Workout by Chandler Marchman. **Weight Used During Workout: 53 lb. Kettlebells**. {Rest no more than 3 minutes between rounds}. Video: https://www.youtube.com/watch?v=IwqIawUrma4'
    },

    // Routine 10: "MONSTER MAKING" Kettlebell Strongman Routine
    {
        id: 'monster-making-kettlebell-strongman-routine',
        name: '"MONSTER MAKING" Kettlebell Strongman Routine',
        description: 'A strongman-style routine using heavy kettlebells to build raw strength and power.',
        exercises: [
            {
                id: 'we-10-1',
                exerciseId: 'kettlebell-sumo-deadlift',
                exerciseName: 'Kettlebell Sumo Deadlift',
                sets: [{ id: 'set-10-1-1', targetReps: 5, notes: '', targetRest: 0, type: 'superset' },
                    { id: 'set-10-1-2', targetReps: 5, notes: '', targetRest: 0, type: 'superset' },
                    { id: 'set-10-1-3', targetReps: 5, notes: '', targetRest: 0, type: 'superset' }
                ],
                supersetId: 'monster-maker-10',
                
                supersetOrder: 0,
                type: 'superset'
            },
            {
                id: 'we-10-2',
                exerciseId: 'single-kettlebell-clean-and-press',
                exerciseName: 'Single Arm Clean & Push Press',
                sets: [{ id: 'set-10-2-1', targetReps: 5, notes: 'Perform 5 reps per arm. This is a complex with a Push Press.', targetRest: 0, type: 'superset' }],
                supersetId: 'monster-maker-10',
                supersetOrder: 1,
                
                type: 'superset'
            },
            {
                id: 'we-10-3',
                exerciseId: 'kettlebell-strict-press',
                exerciseName: 'Kettlebell Strict Press (Single Arm)',
                sets: [{ id: 'set-10-3-1', targetReps: 5, notes: 'Perform 5 reps per arm. Original is a Push Press, substitute with Strict Press.', targetRest: 0, type: 'superset' }],
                supersetId: 'monster-maker-10',
                supersetOrder: 2,
                
                type: 'superset'
            },
            {
                id: 'we-10-4',
                exerciseId: 'kettlebell-goblet-squat',
                exerciseName: 'Pause Goblet Squat',
                sets: [{ id: 'set-10-4-1', targetReps: 5, notes: 'Perform with a pause at the bottom.', targetRest: 0, type: 'superset' }],
                supersetId: 'monster-maker-10',
                supersetOrder: 3,
                
                type: 'superset'
            },
            {
                id: 'we-10-5',
                exerciseId: 'kettlebell-goblet-squat',
                exerciseName: 'Goblet Squat',
                sets: [{ id: 'set-10-5-1', targetReps: 5, targetRest: 0, type: 'superset' }],
                supersetId: 'monster-maker-10',
                supersetOrder: 4,
                
                type: 'superset'
            },
            {
                id: 'we-10-6',
                exerciseId: 'two-handed-kettlebell-swing',
                exerciseName: 'Swing',
                sets: [{ id: 'set-10-6-1', targetReps: 5, targetRest: 0, type: 'superset' }],
                supersetId: 'monster-maker-10',
                supersetOrder: 5,
                
                type: 'superset'
            },
            {
                id: 'we-10-7',
                exerciseId: 'kettlebell-deadlift',
                exerciseName: 'Deadlift',
                sets: [{ id: 'set-10-7-1', targetReps: 5, targetRest: 180, notes: 'Rest No More Than 3 Minutes after this.', type: 'superset' }],
                supersetId: 'monster-maker-10',
                supersetOrder: 6,
                
                type: 'superset'
            }
        ],
        goal: 'strength',
        targetMuscleGroups: ['Full Body', 'Glutes', 'Hamstrings', 'Shoulders', 'Core'],
        notes: 'Workout by Chandler Marchman. **Kettlebells used during this workout: 97 lb. (44 kg) kettlebells**. Rest No More Than 3 Minutes Between Rounds - Do 3 Rounds Total. Video: https://www.youtube.com/watch?v=faqGuUgGEio'
    }
]