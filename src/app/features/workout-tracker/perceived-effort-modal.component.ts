import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // <-- Import FormsModule
import { IconComponent } from '../../shared/components/icon/icon.component';
import { TranslateModule } from '@ngx-translate/core';


export interface PerceivedWorkoutInfo {
  perceivedEffort?: number,
  perceivedFeeling?: number,
}

@Component({
  selector: 'app-perceived-effort-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TranslateModule], // <-- Add FormsModule here
  template: `
    <div class="fixed inset-0 bg-black bg-opacity-60 z-40 flex justify-center items-center" (click)="dismiss()">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 md:p-8 max-w-md w-full mx-4" (click)="$event.stopPropagation()">
        <section>
          <h2 class="text-2xl font-bold text-center text-gray-800 dark:text-gray-100 mb-2">{{ 'perceivedEffortModal.title' | translate }}</h2>
          <p class="text-center text-gray-600 dark:text-gray-400 mb-4">{{ 'perceivedEffortModal.effortQuestion' | translate }}</p>

          <div class="px-2">
            <input type="range" min="1" max="10" [(ngModel)]="effortValue" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700">
            <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
              <span>{{ 'perceivedEffortModal.effortMin' | translate }}</span>
              <span>{{ 'perceivedEffortModal.effortMax' | translate }}</span>
            </div>
          </div>

          <div class="text-center text-4xl font-bold text-primary dark:text-primary-light my-6">
            {{ effortValue }} / 10
          </div>
        </section>
        <section class="pt-4">
          <p class="text-center text-gray-600 dark:text-gray-400 mb-4">{{ 'perceivedEffortModal.feelingQuestion' | translate }}</p>

          <div class="px-2">
            <input type="range" min="1" max="10" [(ngModel)]="feelingValue" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700">
            <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
              <span>{{ 'perceivedEffortModal.feelingMin' | translate }}</span>
              <span>{{ 'perceivedEffortModal.feelingMax' | translate }}</span>
            </div>
          </div>

          <div class="text-center text-4xl font-bold text-primary dark:text-primary-light my-6">
            {{ feelingValue }} / 10
          </div>
        </section>

        <div class="flex md:flex-row gap-3">
          <button (click)="dismiss()" class="w-full md:w-1/2 px-6 py-3 border rounded-md text-base font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-around">
            <app-icon name='cancel' class="h-6 w-6 mr-1"></app-icon>
            {{ 'perceivedEffortModal.skip' | translate }}
          </button>
          <button (click)="save()" class="w-full md:w-1/2 px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary hover:bg-primary-dark flex items-center justify-around">
            <app-icon name='save' class="h-6 w-6 mr-1"></app-icon>
            {{ 'perceivedEffortModal.save' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PerceivedEffortModalComponent {
  @Output() close = new EventEmitter<PerceivedWorkoutInfo | null>();
  effortValue: number = 5; // Default value
  feelingValue: number = 5; // Default value

  save(): void {
    this.close.emit({
      perceivedEffort: this.effortValue,
      perceivedFeeling: this.feelingValue,
    });
  }

  dismiss(): void {
    this.close.emit(null);
  }
}