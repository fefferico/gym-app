// src/app/core/services/activity.service.ts
import { Injectable, inject } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class ColorsService {
    private cardColors = [
        '#7f1d1d', '#86198f', '#4a044e', '#1e1b4b', '#1e3a8a', '#064e3b', '#14532d',
        '#b91c1c', '#c026d3', '#701a75', '#312e81', '#2563eb', '#047857', '#15803d',
        '#f97316', '#ca8a04', '#4d7c0f', '#0f766e', '#0369a1', '#1d4ed8', '#5b21b6'
    ];

    getCardColors(): string[] {
        return this.cardColors;
    }

    getTailwindColorClass(hexColor: string | undefined): string {
        if (!hexColor) {
            return ''; // Default or fallback color if no hex is provided
        }

        // A map to store the hex to Tailwind class relationship
        const colorMap: { [key: string]: string } = {
            '#7f1d1d': 'border-routine-red-800',
            '#86198f': 'border-routine-purple-800',
            '#4a044e': 'border-routine-purple-900',
            '#1e1b4b': 'border-routine-indigo-900',
            '#1e3a8a': 'border-routine-blue-800',
            '#064e3b': 'border-routine-green-900',
            '#14532d': 'border-routine-green-800',
            '#b91c1c': 'border-routine-red-700',
            '#c026d3': 'border-routine-purple-700',
            '#701a75': 'border-routine-purple-850',
            '#312e81': 'border-routine-indigo-800',
            '#2563eb': 'border-routine-blue-700',
            '#047857': 'border-routine-green-700',
            '#15803d': 'border-routine-green-600',
            '#f97316': 'border-routine-orange-500',
            '#ca8a04': 'border-routine-yellow-600',
            '#4d7c0f': 'border-routine-lime-700',
            '#0f766e': 'border-routine-teal-700',
            '#0369a1': 'border-routine-teal-600',
            '#1d4ed8': 'border-routine-blue-900',
            '#5b21b6': 'border-routine-violet-700',
        };

        return colorMap[hexColor] || 'bg-gray-200'; // Return the mapped class or a fallback
    }

}