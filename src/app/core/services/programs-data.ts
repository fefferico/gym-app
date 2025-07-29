export const PROGRAMS_DATA = [
    {
        "id": "7fefb7b9-040f-4043-a1ad-9e9540cb744a",
        "name": "Tonificazione 3",
        "goals": [
            "skill acquisition",
            "power / explosiveness",
            "tabata",
            "muscular endurance",
            "fat loss / body composition"
        ],
        "description": "",
        "programNotes": undefined,
        "startDate": "2025-07-01",
        "cycleLength": undefined,
        "schedule": [
            {
                "id": "444d2b71-464d-4bbc-8870-761746a90b8d",
                "dayOfWeek": 2,
                "routineId": "toning-3-giorno-1",
                "routineName": "Toning 3 - Day 1",
                "notes": "",
                "timeOfDay": "", "programId": "7fefb7b9-040f-4043-a1ad-9e9540cb744a",
            },
            {
                "id": "15374416-5f25-4f1f-ada7-ebf9aa263df7",
                "dayOfWeek": 4,
                "routineId": "toning-3-giorno-2",
                "routineName": "Toning 3 - Day 2",
                "notes": "",
                "timeOfDay": "", "programId": "7fefb7b9-040f-4043-a1ad-9e9540cb744a",
            }
        ],
        "isActive": true
    },
    {
        "id": "prog-beginner-3day-v1",
        "name": "Beginner Full-Body Foundation",
        "goals": [
            "strength",
            "hypertrophy",
            "beginner",
            "muscle building"
        ],
        "description": "A 3-day per week program perfect for those new to weight training. You will alternate between two full-body workouts (A and B) to build a solid foundation of strength and muscle across your entire body.",
        "programNotes": "Focus on proper form before increasing weight. The goal is consistency. In week 2, you will perform B-A-B.",
        "startDate": undefined,
        "cycleLength": 14,
        "schedule": [
            {
                "id": "sch-beg-1",
                "dayOfWeek": 1,
                "routineId": "beginner-workout-v1-a",
                "routineName": "Beginner Weight Training - Workout A (V1)",
                "notes": "Workout A",
                "timeOfDay": "", "programId": "prog-beginner-3day-v1",
            },
            {
                "id": "sch-beg-2",
                "dayOfWeek": 3,
                "routineId": "beginner-workout-v1-b",
                "routineName": "Beginner Weight Training - Workout B (V1)",
                "notes": "Workout B",
                "timeOfDay": "", "programId": "prog-beginner-3day-v1",
            },
            {
                "id": "sch-beg-3",
                "dayOfWeek": 5,
                "routineId": "beginner-workout-v1-a",
                "routineName": "Beginner Weight Training - Workout A (V1)",
                "notes": "Workout A",
                "timeOfDay": "", "programId": "prog-beginner-3day-v1",
            }
        ],
        "isActive": false
    },
    {
        "id": "prog-hypertrophy-4day-v1",
        "name": "Classic Upper/Lower Hypertrophy",
        "goals": [
            "hypertrophy",
            "strength",
            "muscle building"
        ],
        "description": "A classic 4-day upper/lower split designed to maximize muscle growth (hypertrophy). Each major muscle group is trained twice a week with a focus on volume and intensity to stimulate growth.",
        "programNotes": "Ensure you are eating in a caloric surplus to support muscle growth. Rest days on Wednesday, Saturday, and Sunday are crucial for recovery.",
        "startDate": undefined,
        "cycleLength": 7,
        "schedule": [
            {
                "id": "sch-hyper-1",
                "dayOfWeek": 1,
                "routineId": "muscle-building-v1-upper-a",
                "routineName": "Muscle Building - Upper Body A (V1)",
                "notes": "Upper Body - Chest & Back focus",
                "timeOfDay": "", "programId": "prog-hypertrophy-4day-v1",
            },
            {
                "id": "sch-hyper-2",
                "dayOfWeek": 2,
                "routineId": "muscle-building-v1-lower-a",
                "routineName": "Muscle Building - Lower Body A (V1)",
                "notes": "Lower Body - Hamstring & Glute focus",
                "timeOfDay": "", "programId": "prog-hypertrophy-4day-v1",
            },
            {
                "id": "sch-hyper-3",
                "dayOfWeek": 4,
                "routineId": "muscle-building-v1-upper-b",
                "routineName": "Muscle Building - Upper Body B (V1)",
                "notes": "Upper Body - Shoulders & Arms focus",
                "timeOfDay": "", "programId": "prog-hypertrophy-4day-v1",
            },
            {
                "id": "sch-hyper-4",
                "dayOfWeek": 5,
                "routineId": "muscle-building-v1-lower-b",
                "routineName": "Muscle Building - Lower Body B (V1)",
                "notes": "Lower Body - Squat pattern focus",
                "timeOfDay": "", "programId": "prog-hypertrophy-4day-v1",
            }
        ],
        "isActive": false
    },
    {
        "id": "prog-gpp-kettlebell-3day",
        "name": "Functional Kettlebell GPP",
        "goals": [
            "GPP",
            "functional strength",
            "muscular endurance",
            "power / explosiveness"
        ],
        "description": "A 3-day program focused on building General Physical Preparedness (GPP). It combines intense, kettlebell-centric workouts for the upper body with a heavy leg day to forge well-rounded functional strength and conditioning.",
        "programNotes": "These workouts are intense. Do not be afraid to use a lighter kettlebell to maintain form, especially on the arm and shoulder days.",
        "startDate": undefined,
        "cycleLength": 7,
        "schedule": [
            {
                "id": "sch-gpp-1",
                "dayOfWeek": 1,
                "routineId": "f4f6e3c1-4b7e-4b1e-8c3b-2f1a6e9a0b1d",
                "routineName": "Build 3-Dimensional Shoulders",
                "notes": "Focus on shoulder stability and endurance.",
                "timeOfDay": "", "programId": "prog-gpp-kettlebell-3day",
            },
            {
                "id": "sch-gpp-2",
                "dayOfWeek": 3,
                "routineId": "muscle-building-v1-lower-b",
                "routineName": "Muscle Building - Lower Body B (V1)",
                "notes": "Strength and power for the lower body.",
                "timeOfDay": "", "programId": "prog-gpp-kettlebell-3day",
            },
            {
                "id": "sch-gpp-3",
                "dayOfWeek": 5,
                "routineId": "b3c4d5e6-1",
                "routineName": "50 Rep Kettlebell Arm Blaster",
                "notes": "High-volume arm workout for muscular endurance.",
                "timeOfDay": "", "programId": "prog-gpp-kettlebell-3day",
            }
        ],
        "isActive": false
    },
    {
        "id": "prog-fatloss-5day-hiit",
        "name": "High-Intensity Fat Loss Circuit",
        "goals": [
            "fat loss / body composition",
            "muscular endurance",
            "cardio",
            "tabata"
        ],
        "description": "A 5-day high-frequency program designed for maximum fat loss and metabolic conditioning. It alternates total-body toning days with brutally intense Tabata circuits to keep your metabolism elevated all week.",
        "programNotes": "Recovery is key. Ensure adequate sleep and nutrition to handle the high frequency of this program. The Tabata days are meant to be performed with maximum intensity.",
        "startDate": undefined,
        "cycleLength": 7,
        "schedule": [
            {
                "id": "sch-fatloss-1",
                "dayOfWeek": 1,
                "routineId": "toning-3-giorno-1",
                "routineName": "Toning 3 - Day 1",
                "timeOfDay": "", "programId": "prog-fatloss-5day-hiit",
            },
            {
                "id": "sch-fatloss-2",
                "dayOfWeek": 2,
                "routineId": "a2b3c4d5-1",
                "routineName": "BRUTALLY Intense 4 Minute Kettlebell Fat Loss Routine",
                "timeOfDay": "", "programId": "prog-fatloss-5day-hiit",
            },
            {
                "id": "sch-fatloss-3",
                "dayOfWeek": 3,
                "routineId": "toning-3-giorno-2",
                "routineName": "Toning 3 - Day 2",
                "timeOfDay": "", "programId": "prog-fatloss-5day-hiit",
            },
            {
                "id": "sch-fatloss-4",
                "dayOfWeek": 4,
                "routineId": "a2b3c4d5-1",
                "routineName": "BRUTALLY Intense 4 Minute Kettlebell Fat Loss Routine",
                "timeOfDay": "", "programId": "prog-fatloss-5day-hiit",
            },
            {
                "id": "sch-fatloss-5",
                "dayOfWeek": 5,
                "routineId": "toning-3-giorno-1",
                "routineName": "Toning 3 - Day 1",
                "timeOfDay": "", "programId": "prog-fatloss-5day-hiit",
            }
        ],
        "isActive": false
    },
    {
        "id": "prog-advanced-hypertrophy-4day",
        "name": "Advanced Hypertrophy (Superset Focus)",
        "goals": [
            "hypertrophy",
            "advanced",
            "muscular endurance"
        ],
        "description": "An advanced 4-day upper/lower split for experienced lifters. This program utilizes supersets to increase workout density, intensity, and metabolic stress, helping to push past plateaus and stimulate new muscle growth.",
        "programNotes": "This is a high-volume, high-intensity program. It is not recommended for beginners. Ensure your recovery and nutrition are dialed in.",
        "startDate": undefined,
        "cycleLength": 7,
        "schedule": [
            {
                "id": "sch-advhyper-1",
                "dayOfWeek": 2,
                "routineId": "muscle-building-v4-upper-a",
                "routineName": "Muscle Building - Upper Body A (V4)",
                "timeOfDay": "", "programId": "prog-advanced-hypertrophy-4day",
            },
            {
                "id": "sch-advhyper-2",
                "dayOfWeek": 3,
                "routineId": "muscle-building-v4-lower-a",
                "routineName": "Muscle Building - Lower Body A (V4)",
                "timeOfDay": "", "programId": "prog-advanced-hypertrophy-4day",
            },
            {
                "id": "sch-advhyper-3",
                "dayOfWeek": 5,
                "routineId": "muscle-building-v4-upper-b",
                "routineName": "Muscle Building - Upper Body B (V4)",
                "timeOfDay": "", "programId": "prog-advanced-hypertrophy-4day",
            },
            {
                "id": "sch-advhyper-4",
                "dayOfWeek": 6,
                "routineId": "muscle-building-v4-lower-b",
                "routineName": "Muscle Building - Lower Body B (V4)",
                "timeOfDay": "", "programId": "prog-advanced-hypertrophy-4day",
            }
        ],
        "isActive": false
    },
    {
        "id": "prog-strength-5x5-inspired-3day",
        "name": "Starting Strength Inspired (3-Day)",
        "goals": [
            "strength",
            "beginner",
            "muscle building"
        ],
        "description": "Inspired by classic 3-day full-body programs like 5x5, this schedule uses two alternating workouts to drive progress on core compound lifts. While it uses a 3x10 rep scheme from the base routines, the focus is on linear progression: consistently adding a small amount of weight to the bar each week.",
        "programNotes": "Alternate Workout A and B every time you train. Week 1 is A-B-A. Week 2 will be B-A-B. Your number one goal is to add a little weight to your main lifts each session.",
        "startDate": undefined,
        "cycleLength": 14,
        "schedule": [
            {
                "id": "sch-5x5-1",
                "dayOfWeek": 1,
                "routineId": "beginner-workout-v1-a",
                "routineName": "Beginner Weight Training - Workout A (V1)",
                "timeOfDay": "", "programId": "prog-strength-5x5-inspired-3day",
            },
            {
                "id": "sch-5x5-2",
                "dayOfWeek": 3,
                "routineId": "beginner-workout-v1-b",
                "routineName": "Beginner Weight Training - Workout B (V1)",
                "timeOfDay": "", "programId": "prog-strength-5x5-inspired-3day",
            },
            {
                "id": "sch-5x5-3",
                "dayOfWeek": 5,
                "routineId": "beginner-workout-v1-a",
                "routineName": "Beginner Weight Training - Workout A (V1)",
                "timeOfDay": "", "programId": "prog-strength-5x5-inspired-3day",
            }
        ],
        "isActive": false
    },
    {
        "id": "prog-strength-531-inspired-4day",
        "name": "5/3/1 Structure Inspired (4-Day)",
        "goals": [
            "strength",
            "hypertrophy",
            "intermediate"
        ],
        "description": "This program is structured like Jim Wendler's 5/3/1, dedicating each day to one main compound lift followed by accessory work. While it doesn't use the specific 5/3/1 percentage and rep schemes, it follows the proven principle of focusing your energy on one heavy lift per session for consistent strength gains.",
        "programNotes": "The main lift is the first exercise of each routine. Focus on progressive overload on this lift over a 4-6 week cycle.",
        "startDate": undefined,
        "cycleLength": 7,
        "schedule": [
            {
                "id": "sch-531-1",
                "dayOfWeek": 1,
                "routineId": "wendler-531-day1-ohp",
                "routineName": "5/3/1 - Overhead Press Day",
                "notes": "Main Lift: Overhead Press",
                "timeOfDay": "", "programId": "prog-strength-531-inspired-4day",
            },
            {
                "id": "sch-531-2",
                "dayOfWeek": 2,
                "routineId": "wendler-531-day2-deadlift",
                "routineName": "5/3/1 - Deadlift Day",
                "notes": "Main Lift: Deadlift",
                "timeOfDay": "", "programId": "prog-strength-531-inspired-4day",
            },
            {
                "id": "sch-531-3",
                "dayOfWeek": 4,
                "routineId": "wendler-531-day3-bench",
                "routineName": "5/3/1 - Bench Press Day",
                "notes": "Main Lift: Bench Press",
                "timeOfDay": "", "programId": "prog-strength-531-inspired-4day",
            },
            {
                "id": "sch-531-4",
                "dayOfWeek": 5,
                "routineId": "wendler-531-day4-squat",
                "routineName": "5/3/1 - Squat Day",
                "notes": "Main Lift: Squat",
                "timeOfDay": "", "programId": "prog-strength-531-inspired-4day",
            }
        ],
        "isActive": false
    },
    {
        "id": "prog-athletic-performance-4day",
        "name": "Athletic Performance (4-Day)",
        "goals": [
            "power / explosiveness",
            "GPP",
            "functional strength",
            "strength"
        ],
        "description": "A 4-day program for athletes looking to improve overall performance. It balances two heavy strength days with two days focused on explosive power, conditioning, and functional movement patterns using kettlebells and high-intensity circuits.",
        "programNotes": "The goal on strength days is moving heavy weight with good form. The goal on conditioning days is high work-rate and intensity.",
        "startDate": undefined,
        "cycleLength": 7,
        "schedule": [
            {
                "id": "sch-ath-1",
                "dayOfWeek": 1,
                "routineId": "muscle-building-v2-lower-b",
                "routineName": "Muscle Building - Lower Body B (V2)",
                "notes": "Maximal Strength & Power",
                "timeOfDay": "", "programId": "prog-athletic-performance-4day"
            },
            {
                "id": "sch-ath-2",
                "dayOfWeek": 2,
                "routineId": "muscle-building-v2-upper-a",
                "routineName": "Muscle Building - Upper Body A (V2)",
                "notes": "Upper Body Strength",
                "timeOfDay": "", "programId": "prog-athletic-performance-4day"
            },
            {
                "id": "sch-ath-3",
                "dayOfWeek": 4,
                "routineId": "f4f6e3c1-4b7e-4b1e-8c3b-2f1a6e9a0b1d",
                "routineName": "Build 3-Dimensional Shoulders",
                "notes": "Kettlebell Power & Conditioning",
                "timeOfDay": "", "programId": "prog-athletic-performance-4day"
            },
            {
                "id": "sch-ath-4",
                "dayOfWeek": 5,
                "routineId": "toning-3-giorno-2",
                "routineName": "Toning 3 - Day 2",
                "notes": "General Physical Preparedness (GPP)",
                "timeOfDay": "", "programId": "prog-athletic-performance-4day"
            }
        ],
        "isActive": false
    },
    {
        "id": "prog-time-crunched-3day",
        "name": "Time-Crunched Pro (3-Day)",
        "goals": [
            "GPP",
            "muscular endurance",
            "hypertrophy"
        ],
        "description": "A 3-day program for busy individuals who want maximum results in minimum time. It uses a full-body approach with a mix of heavy lifting and higher-rep toning work to cover all bases efficiently.",
        "programNotes": "Focus on keeping rest periods strict to get the workout done in a timely manner.",
        "startDate": undefined,
        "cycleLength": 7,
        "schedule": [
            {
                "id": "sch-tc-1",
                "dayOfWeek": 1,
                "routineId": "beginner-workout-v2-a",
                "routineName": "Beginner Weight Training - Workout A (V2)",
                "timeOfDay": "", "programId": "prog-time-crunched-3day",
            },
            {
                "id": "sch-tc-2",
                "dayOfWeek": 3,
                "routineId": "beginner-workout-v2-b",
                "routineName": "Beginner Weight Training - Workout B (V2)",
                "timeOfDay": "", "programId": "prog-time-crunched-3day",
            },
            {
                "id": "sch-tc-3",
                "dayOfWeek": 5,
                "routineId": "toning-3-giorno-1",
                "routineName": "Toning 3 - Day 1",
                "timeOfDay": "", "programId": "prog-time-crunched-3day",
            }
        ],
        "isActive": false
    },
    {
        "id": "prog-bodybuilding-5day-split",
        "name": "Advanced Bodybuilding Split (5-Day)",
        "goals": [
            "hypertrophy",
            "muscle building",
            "advanced"
        ],
        "description": "A high-volume, 5-day split for the serious bodybuilder. This program follows an Upper/Lower split for four days and adds a fifth day dedicated to blasting the arms for maximum growth.",
        "programNotes": "This is an advanced program. Ensure your nutrition, sleep, and recovery are optimal to handle the volume.",
        "startDate": undefined,
        "cycleLength": 7,
        "schedule": [
            {
                "id": "sch-bb-1",
                "dayOfWeek": 1,
                "routineId": "muscle-building-v3-upper-a",
                "routineName": "Muscle Building - Upper Body A (V3)",
                "notes": "Upper Body Volume",
                "timeOfDay": "", "programId": "prog-bodybuilding-5day-split",
            },
            {
                "id": "sch-bb-2",
                "dayOfWeek": 2,
                "routineId": "muscle-building-v3-lower-a",
                "routineName": "Muscle Building - Lower Body A (V3)",
                "notes": "Lower Body Volume",
                "timeOfDay": "", "programId": "prog-bodybuilding-5day-split",
            },
            {
                "id": "sch-bb-3",
                "dayOfWeek": 4,
                "routineId": "muscle-building-v3-upper-b",
                "routineName": "Muscle Building - Upper Body B (V3)",
                "notes": "Upper Body Strength",
                "timeOfDay": "", "programId": "prog-bodybuilding-5day-split",
            },
            {
                "id": "sch-bb-4",
                "dayOfWeek": 5,
                "routineId": "muscle-building-v3-lower-b",
                "routineName": "Muscle Building - Lower Body B (V3)",
                "notes": "Lower Body Strength",
                "timeOfDay": "", "programId": "prog-bodybuilding-5day-split",
            },
            {
                "id": "sch-bb-5",
                "dayOfWeek": 6,
                "routineId": "b3c4d5e6-1",
                "routineName": "50 Rep Kettlebell Arm Blaster",
                "notes": "Arm Specialization Day",
                "timeOfDay": "", "programId": "prog-bodybuilding-5day-split",
            }
        ],
        "isActive": false
    },
    {
        "id": "prog-strength-5x5-classic-3day",
        "name": "Classic 5x5 Strength Program",
        "goals": [
            "strength",
            "muscle building",
            "beginner",
            "powerlifting"
        ],
        "description": "A classic and highly effective 3-day strength program for beginners. This program is built on the principle of linear progression, focusing on getting stronger in the most important compound lifts by alternating two full-body workouts (A and B).",
        "programNotes": "The schedule is 3 non-consecutive days a week (e.g., Mon/Wed/Fri). You alternate workouts each session. Week 1: A, B, A. Week 2: B, A, B. Your primary goal is to add a small amount of weight to each exercise in every workout.",
        "startDate": undefined,
        "cycleLength": 14,
        "schedule": [
            {
                "id": "sch-5x5-classic-1",
                "dayOfWeek": 1,
                "routineId": "5x5-workout-a",
                "routineName": "5x5 Strength - Workout A",
                "timeOfDay": "", "programId": "prog-strength-5x5-classic-3day",
            },
            {
                "id": "sch-5x5-classic-2",
                "dayOfWeek": 3,
                "routineId": "5x5-workout-b",
                "routineName": "5x5 Strength - Workout B",
                "timeOfDay": "", "programId": "prog-strength-5x5-classic-3day",
            },
            {
                "id": "sch-5x5-classic-3",
                "dayOfWeek": 5,
                "routineId": "5x5-workout-a",
                "routineName": "5x5 Strength - Workout A",
                "timeOfDay": "", "programId": "prog-strength-5x5-classic-3day",
            }
        ],
        "isActive": false
    }
]