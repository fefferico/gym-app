import { Component, Inject, OnInit } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogConfig, DialogOutput } from '../../../core/models/dialog.types';

@Component({
  selector: 'app-dynamic-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <!-- 
      Main Container: 
      - Adapts to dark mode (gray-800)
      - adds borders for separation in dark mode
    -->
    <div class="w-full max-w-lg p-6 bg-white border border-gray-200 shadow-2xl rounded-2xl dark:bg-gray-800 dark:border-gray-700">
      
      <!-- Header -->
      <h2 class="mb-2 text-xl font-bold text-gray-900 dark:text-white">
        {{ config.title }}
      </h2>
      
      @if (config.message) { 
        <p class="mb-6 text-sm text-gray-500 dark:text-gray-400">
          {{ config.message }}
        </p> 
      }

      <form [formGroup]="form" (ngSubmit)="onConfirm()">
        
        <!-- GRID CONTAINER: Tailwind Grid -->
        <div class="grid grid-cols-12 gap-4 mb-8">
          
          @for (field of config.fields; track field.key) {
            
            <!-- 
               Wrapper:
               Dynamic class determines span (col-12, col-6).
               Default is 'col-12' (full width).
            -->
            <div class="flex flex-col" [ngClass]="field.cssClass || 'col-12'">
              
              <!-- Label -->
              @if (field.type !== 'checkbox') {
                <label [for]="field.key" class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {{ field.label }}
                </label>
              }

              <!-- SWITCH INPUT TYPES -->
              @switch (field.type) {
                
                @case ('text') {
                  <input type="text" [id]="field.key" [formControlName]="field.key" 
                         class="input-base" [placeholder]="field.placeholder || ''">
                }
                
                @case ('number') {
                  <input type="number" [id]="field.key" [formControlName]="field.key" 
                         class="input-base">
                }
                
                @case ('select') {
                  <select [id]="field.key" [formControlName]="field.key" class="input-base">
                    @for (opt of field.options; track opt.value) {
                      <option [value]="opt.value">{{ opt.label }}</option>
                    }
                  </select>
                }
                
                @case ('textarea') {
                  <textarea [id]="field.key" [formControlName]="field.key" rows="3" 
                            class="input-base resize-y"></textarea>
                }
                
                @case ('checkbox') {
                  <div class="flex items-center h-full pt-1 space-x-3">
                    <input type="checkbox" [id]="field.key" [formControlName]="field.key" 
                           class="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:bg-gray-700 dark:border-gray-600">
                    <label [for]="field.key" class="text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer select-none">
                      {{ field.placeholder || field.label }}
                    </label>
                  </div>
                }
              }
            </div>
          }
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <button type="button" (click)="onCancel()" 
            class="px-4 py-2 text-sm font-medium text-gray-700 transition-colors bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 dark:hover:text-white">
            {{ config.cancelText || 'Cancel' }}
          </button>
          
          <button type="submit" [disabled]="form.invalid"
            class="px-4 py-2 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-500">
            {{ config.confirmText || 'Confirm' }}
          </button>
        </div>

      </form>
    </div>
  `,
  styles: [`
  :host {
    display: block;
    /* The Pop Animation */
    animation: scaleIn 0.2s ease-out forwards;
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
    /* 
      SHARED INPUT STYLES (Tailwind @apply equivalent) 
      We keep this class to avoid repeating these long strings in the HTML 5 times.
    */
    .input-base {
      @apply w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg 
             focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors
             dark:bg-gray-900 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500;
    }

    /* 
      GRID HELPERS 
      These map the dynamic config strings to CSS Grid spans.
    */
    .col-12 { grid-column: span 12 / span 12; }
    .col-6  { grid-column: span 6 / span 6; }
    .col-4  { grid-column: span 4 / span 4; }
    .col-3  { grid-column: span 3 / span 3; }
    
    /* Legacy mapping if you used 'col-full' previously */
    .col-full { grid-column: span 12 / span 12; }
    .col-half { grid-column: span 6 / span 6; }
  `]
})
export class DynamicDialogComponent implements OnInit {
  form: FormGroup = new FormGroup({});

  constructor(
    @Inject(DIALOG_DATA) public config: DialogConfig,
    public dialogRef: DialogRef<DialogOutput>,
    private fb: FormBuilder
  ) { }

  ngOnInit() {
    const group: any = {};
    this.config.fields?.forEach(field => {
      const validators = field.required ? [Validators.required] : [];
      group[field.key] = [field.value || null, validators];
    });
    this.form = this.fb.group(group);
  }

  onConfirm() {
    if (this.form.valid) {
      this.dialogRef.close({ action: 'CONFIRM', data: this.form.value });
    }
  }

  onCancel() {
    this.dialogRef.close({ action: 'CANCEL' });
  }
}