import { IconLayer } from "../../shared/components/icon/icon.component";
import { ActionMenuItem } from "../models/action-menu.model";

export const pauseSessionBtn = {
    label: 'Pause',
    actionKey: 'pause',
    iconName: `pause`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-yellow-500',
} as ActionMenuItem;

export const addExerciseBtn = {
    label: 'Exercise',
    actionKey: 'addExercise',
    iconName: `plus-circle`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: 'hover:bg-blue-700',
} as ActionMenuItem;

export const jumpToExerciseBtn = {
    label: 'Jump to exercise',
    actionKey: 'jumpToExercise',
    iconName: `dumbbell`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-fuchsia-600 ',
} as ActionMenuItem;

export const switchExerciseBtn = {
    label: 'Switch',
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
    buttonClass: 'hover:bg-cyan-600',
} as ActionMenuItem;

export const openPerformanceInsightsBtn = {
    label: 'Session insight',
    actionKey: 'insight',
    iconName: `schedule`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-green-600 ',
} as ActionMenuItem;

export const quitWorkoutBtn = {
    label: 'Exit',
    actionKey: 'exit',
    iconName: `exit-door`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-red-800 ',
} as ActionMenuItem;

export const addWarmupSetBtn = {
    label: 'Warmup set',
    actionKey: 'warmup',
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
    label: 'Skip set',
    actionKey: 'skipSet',
    iconName: `skip`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-blue-600 ',
} as ActionMenuItem;

export const skipCurrentExerciseBtn = {
    label: 'Skip exercise',
    actionKey: 'skipExercise',
    iconName: `skip`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-indigo-600 ',
} as ActionMenuItem;

export const markAsDoLaterBtn = {
    label: 'Do later',
    actionKey: 'later',
    iconName: `clock`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-orange-600 ',
} as ActionMenuItem;

export const finishEarlyBtn = {
    label: 'Finish early',
    actionKey: 'finish',
    iconName: `done`,
    iconClass: 'w-8 h-8 mr-2',
    buttonClass: ' hover:bg-teal-600 ',
} as ActionMenuItem;

export const createSuperSetBtn = {
    label: 'Create Superset',
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
    label: 'Add to Superset',
    actionKey: 'add_to_superset', // Assumes this might trigger a different UI flow
    iconName: 'link',
    buttonClass: ' hover:bg-primary ',
    iconClass: 'w-8 h-8 mr-2'
}

export const removeFromSuperSetBtn = {
    label: 'Remove from Superset',
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
    label: 'Remove Exercise',
    actionKey: 'remove',
    iconName: 'trash',
    buttonClass: ' hover:bg-red-800 ',
    iconClass: 'w-8 h-8 mr-2'
}

export const addSetToExerciseBtn = {
    label: 'Add Set', actionKey: 'add_set',
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