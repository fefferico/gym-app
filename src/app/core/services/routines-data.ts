import { Routine } from "../models/workout.model";

export const ROUTINES_DATA: Routine[] = [
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
                        "weight": 10,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex1-s2",
                        "reps": 10,
                        "weight": 10,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex1-s3",
                        "reps": 10,
                        "weight": 10,
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
                        "weight": 10,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex2-s2",
                        "reps": 10,
                        "weight": 10,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex2-s3",
                        "reps": 10,
                        "weight": 10,
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
                        "weight": 10,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex3-s2",
                        "reps": 10,
                        "weight": 10,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwa-ex3-s3",
                        "reps": 10,
                        "weight": 10,
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
                        "weight": 10,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 6-8 reps."
                    },
                    {
                        "id": "bwb-ex1-s2",
                        "reps": 8,
                        "weight": 10,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 6-8 reps."
                    },
                    {
                        "id": "bwb-ex1-s3",
                        "reps": 8,
                        "weight": 10,
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
                        "weight": 10,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwb-ex3-s2",
                        "reps": 10,
                        "weight": 10,
                        "restAfterSet": 120,
                        "type": "standard",
                        "notes": "Aim for 8-10 reps."
                    },
                    {
                        "id": "bwb-ex3-s3",
                        "reps": 10,
                        "weight": 10,
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
    }
]