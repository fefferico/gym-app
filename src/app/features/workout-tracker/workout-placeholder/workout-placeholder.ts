import { Component } from '@angular/core';

@Component({
  selector: 'app-workout-placeholder',
  standalone: true,
  imports: [],
  template: `
    <div class="p-6 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded-lg shadow">
      <h2 class="text-2xl font-semibold text-blue-700 dark:text-blue-300 mb-2">Workout Section</h2>
      <p class="text-blue-600 dark:text-blue-400">This is a placeholder for the workout feature. Content coming soon!</p>
    </div>
  `,
  styles: `` // Add any specific styles here or keep empty if using only Tailwind from HTML
})
export class WorkoutPlaceholderComponent { }