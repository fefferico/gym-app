// buttons-data.ts

import { IconLayer } from "../../shared/components/icon/icon.component";
import { ActionMenuItem } from "../models/action-menu.model";

export const pauseSessionBtn = {
    label: 'actionButtons.pause',
    actionKey: 'pause',
    iconName: `pause`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-yellow-500 ',
} as ActionMenuItem;

export const addExerciseBtn = {
    label: 'actionButtons.addExercise',
    actionKey: 'addExercise',
    iconName: `plus-circle`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-blue-700 ',
} as ActionMenuItem;

export const jumpToExerciseBtn = {
    label: 'actionButtons.jumpToExercise',
    actionKey: 'jumpToExercise',
    iconName: `dumbbell`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-fuchsia-600 ',
} as ActionMenuItem;

export const switchExerciseBtn = {
    label: 'actionButtons.switch',
    actionKey: 'switchExercise',
    iconName: [
        // Layer 1: Base icon (fills the container)
        { name: 'dumbbell' },

        // Layer 2: Padded white background circle, centered
        {
            name: 'none',
            display: 'filled-padded', // Makes it 125% of the container size
            position: 'bottom-right',       // Ensures it's centered
            class: 'bg-white dark:bg-gray-800'
            ,
        },

        // Layer 3: The 'change' icon, centered on top of the circle
        {
            name: 'change',
            position: 'bottom-right',       // Ensures it's centered
            size: 'w-4 h-4',      // Now this will work! Size is relative to the host.
            class: 'text-primary',
            strokeWidth: 2.5
        }
    ],
    iconClass: 'w-8 h-8 mr-2', // This class is applied to the <app-icon> host
    buttonClass: ' hover:bg-cyan-600 ',
} as ActionMenuItem;

export const openSessionPerformanceInsightsBtn = {
    label: 'actionButtons.sessionInsight',
    actionKey: 'insights',
    iconName: `chart`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-green-600 ',
} as ActionMenuItem;

export const openExercisePerformanceInsightsBtn = {
    label: 'actionButtons.exerciseInsights',
    actionKey: 'exerciseInsights',
    iconName: `schedule`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-green-600 ',
} as ActionMenuItem;

export const quitWorkoutBtn = {
    label: 'actionButtons.exit',
    actionKey: 'exit',
    iconName: `exit-door`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-red-800 ',
} as ActionMenuItem;

export const addWarmupSetBtn = {
    label: 'actionButtons.warmupSet',
    actionKey: 'add_warmup_set',
    iconName: [
        { name: 'flame' },
        {
            name: 'none',
            display: 'filled-padded',
            class: 'bg-white dark:bg-gray-800'

        },
        {
            name: 'plus-circle',
            class: 'text-primary',
            strokeWidth: 3
        }
    ],
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-sky-600 ',
} as ActionMenuItem;

export const skipCurrentSetBtn = {
    label: 'actionButtons.skipSet',
    actionKey: 'skipSet',
    iconName: `skip`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-blue-600 ',
} as ActionMenuItem;

export const skipCurrentExerciseBtn = {
    label: 'actionButtons.skipExercise',
    actionKey: 'skipExercise',
    iconName: `skip`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-indigo-600 ',
} as ActionMenuItem;

export const markAsDoLaterBtn = {
    label: 'actionButtons.doLater',
    actionKey: 'later',
    iconName: `clock`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-orange-600 ',
} as ActionMenuItem;

export const finishEarlyBtn = {
    label: 'actionButtons.finishEarly',
    actionKey: 'finish',
    iconName: `done`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-teal-600 ',
} as ActionMenuItem;

export const createSuperSetBtn = {
    label: 'actionButtons.createSuperset',
    actionKey: 'create_superset',
    iconName: [
        { name: 'link' },
        {
            name: 'none',
            display: 'filled-padded',
            class: 'bg-white dark:bg-gray-800'
        },
        {
            name: 'plus-circle',
            class: 'text-primary',
            strokeWidth: 3,
        }
    ],
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-primary ',
} as ActionMenuItem

export const addToSuperSetBtn = {
    label: 'actionButtons.addToSuperset',
    actionKey: 'add_to_superset', // Assumes this might trigger a different UI flow
    iconName: 'link',
    buttonClass: ' hover:bg-primary ',
    iconClass: 'w-8 h-8 mr-2'
}

export const removeFromSuperSetBtn = {
    label: 'actionButtons.removeFromSuperset',
    actionKey: 'remove_from_superset',
    iconName: [
        { name: 'unlink' },
        {
            name: 'none',
            display: 'filled-padded',
            class: 'bg-white dark:bg-gray-800'

        },
        {
            name: 'minus-circle',
            class: 'text-primary',
            strokeWidth: 3,
        }
    ],
    buttonClass: ' hover:bg-red-800 ',
    iconClass: 'w-8 h-8 mr-2'
}

export const removeExerciseBtn = {
    label: 'actionButtons.removeExercise',
    actionKey: 'remove',
    iconName: 'trash',
    buttonClass: ' hover:bg-red-800 ',
    iconClass: 'w-8 h-8 mr-2'
}

export const addSetToExerciseBtn = {
    label: 'actionButtons.addSet', actionKey: 'add_set',
    iconName: [
        { name: 'dumbbell' },
        {
            name: 'none',
            display: 'filled-padded',
            class: 'bg-white dark:bg-gray-800'

        },
        {
            name: 'plus-circle',
            class: 'text-primary',
            strokeWidth: 3,
        }
    ],
    buttonClass: ' hover:bg-teal-800 ',
    iconClass: 'w-8 h-8 mr-2'
}

export const removeSetFromExerciseBtn = {
    label: 'actionButtons.removeSet', actionKey: 'remove_set',
    iconName: [
        { name: 'dumbbell' },
        {
            name: 'none',
            display: 'filled-padded',
            class: 'bg-white dark:bg-gray-800'

        },
        {
            name: 'minus-circle',
            class: 'text-primary',
            strokeWidth: 3,
        }
    ],
    buttonClass: ' hover:bg-teal-800 ',
    iconClass: 'w-8 h-8 mr-2'
}

export const addRoundToExerciseBtn = {
    label: 'actionButtons.addRound', actionKey: 'add_round',
    iconName: [
        { name: 'dumbbell' },
        {
            name: 'none',
            display: 'filled-padded',
            class: 'bg-white dark:bg-gray-800'

        },
        {
            name: 'plus-circle',
            class: 'text-primary',
            strokeWidth: 3,
        }
    ],
    buttonClass: ' hover:bg-teal-800 ',
    iconClass: 'w-8 h-8 mr-2'
}

export const removeRoundFromExerciseBtn = {
    label: 'actionButtons.removeRound', actionKey: 'remove_round',
    iconName: [
        { name: 'dumbbell' },
        {
            name: 'none',
            display: 'filled-padded',
            class: 'bg-white dark:bg-gray-800'

        },
        {
            name: 'minus-circle',
            class: 'text-primary',
            strokeWidth: 3,
        }
    ],
    buttonClass: ' hover:bg-teal-800 ',
    iconClass: 'w-8 h-8 mr-2'
}

export const resumeSessionBtn = {
    label: 'actionButtons.resume',
    actionKey: 'play',
    iconName: 'play',
    buttonClass: ' bg-yellow-800 ',
    iconClass: 'w-8 h-8 mr-2'
}

export const sessionNotesBtn = {
    label: 'actionButtons.sessionNotes',
    actionKey: 'session_notes',
    iconName: 'clipboard-list',
    buttonClass: ' hover:bg-green-600 ',
    iconClass: 'w-8 h-8 mr-2'
}

export const hideBtn = {
    label: 'actionButtons.hide',
    actionKey: 'hide',
    iconName: `eye-off`,
    iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
    buttonClass: ' hover:bg-primary ',
}

export const unhideBtn = {
    label: 'actionButtons.unhide',
    actionKey: 'unhide',
    iconName: `eye`,
    iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
    buttonClass: ' hover:bg-primary ',
}


export const favouriteBtn = {
    label: 'actionButtons.markFavourite',
    actionKey: 'markAsFavourite',
    iconName: `favourite`,
    iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
    buttonClass: ' hover:bg-primary ',
}

export const unmarkFavouriteBtn = {
    label: 'actionButtons.unmarkFavourite',
    actionKey: 'unmarkAsFavourite',
    iconName: `unmark`,
    iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
    buttonClass: ' hover:bg-primary truncate',
}

export const historyBtn = {
    label: 'actionButtons.logs',
    actionKey: 'history',
    iconName: `clock`,
    iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
    buttonClass: ' hover:bg-primary ',
}

export const viewBtn = {
    label: 'actionButtons.view',
    actionKey: 'view',
    iconName: `eye`,
    iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
    buttonClass: ' hover:bg-primary ',
}

export const startBtn = {
    label: 'actionButtons.start',
    actionKey: 'start',
    iconName: `play`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-primary ',
}

export const editBtn = {
    label: 'actionButtons.edit',
    actionKey: 'edit',
    iconName: `edit`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-primary ',
}

export const cloneBtn = {
    label: 'actionButtons.copy',
    actionKey: 'clone',
    iconName: `copy`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-primary ',
}


export const deleteBtn = {
    label: 'actionButtons.delete',
    actionKey: 'delete',
    iconName: `trash`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-red-600 hover:animate-pulse',
}


export const createFromBtn =
{
    label: 'actionButtons.createRoutine',
    actionKey: 'create_routine',
    iconName: `create-folder`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-primary ',
}


export const routineBtn = {
    label: 'actionButtons.routine',
    actionKey: 'routine',
    iconName: `routines`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-primary ',
}

export const calculatorBtn = {
    label: 'actionButtons.weightToolkit',
    actionKey: 'weight_toolkit',
    iconName: `calc`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-primary ',
}

export const trainingProgramPremiumBtn = {
    label: '',
    actionKey: '',
    iconName: [
        // Layer 1: Base icon (fills the container)
        { name: 'calendar' },

        // Layer 2: Padded white background circle, centered
        {
            name: 'none',
            display: 'filled-padded', // Makes it 125% of the container size
            position: 'bottom-right',       // Ensures it's centered
            class: 'bg-white dark:bg-gray-800'
            ,
        },

        // Layer 3: The 'change' icon, centered on top of the circle
        {
            name: 'crown',
            position: 'bottom-right',       // Ensures it's centered
            size: 'w-4 h-4',      // Now this will work! Size is relative to the host.
            class: 'text-primary',
            strokeWidth: 2.5
        }
    ],
    iconClass: 'w-8 h-8 mr-2', // This class is applied to the <app-icon> host
    buttonClass: ' hover:bg-cyan-600 ',
} as ActionMenuItem;

export const colorBtn = {
    label: 'actionButtons.color',
    actionKey: 'color',
    iconName: `color`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-primary ',
}