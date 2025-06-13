// src/app/shared/alert/alert.component.ts
import { Component, Input, Output, EventEmitter, HostListener, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // <-- Import FormsModule
import { AlertButton, AlertOptions, AlertInput } from '../../../core/models/alert.model';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule, FormsModule], // <-- Add FormsModule
  templateUrl: './alert.component.html',
  styleUrls: ['./alert.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AlertComponent implements OnInit {
  @Input() options: AlertOptions | null = null;
  @Output() dismissed = new EventEmitter<{ role: string, data?: any, values?: { [key: string]: string | number } } | undefined>();

  inputValues: { [key: string]: string | number } = {};

  ngOnInit(): void {
    // Initialize inputValues from options
    if (this.options?.inputs) {
      this.options.inputs.forEach(input => {
        this.inputValues[input.name] = input.value !== undefined ? input.value : (input.type === 'number' ? 0 : '');
      });
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event) {
    if (event instanceof KeyboardEvent) {
      if (this.options?.backdropDismiss !== false) {
        this.dismissWith(undefined);
      }
    }
  }

  onButtonClick(button: AlertButton): void {
    // Basic validation for required inputs
    if (button.role === 'confirm' || button.role !== 'cancel') { // Or check for specific roles that need validation
      if (this.options?.inputs) {
        for (const input of this.options.inputs) {
          if (input.required && (this.inputValues[input.name] === undefined || String(this.inputValues[input.name]).trim() === '')) {
            alert(`Please fill in the '${input.label || input.name}' field.`); // Simple browser alert for now
            // Or use a more sophisticated inline error display within the alert
            return; // Prevent dismiss
          }
        }
      }
    }
    this.dismissWith({ role: button.role, data: button.data, values: this.inputValues });
  }

  onBackdropClick(): void {
    if (this.options?.backdropDismiss !== false) {
      this.dismissWith(undefined);
    }
  }

  private dismissWith(result: { role: string, data?: any, values?: { [key: string]: string | number } } | undefined): void {
    this.dismissed.emit(result);
  }

  getButtonClass(button: AlertButton): string {
    let classes = 'text-white px-4 py-2 rounded text-m font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ';
    switch (button.role) {
      case 'confirm':
        if (button.cssClass) {
          classes += button.cssClass + ' ';
        } else {
          classes += 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus:ring-indigo-600';
        }
        break;
      case 'cancel': if (button.cssClass) {
        classes += button.cssClass + ' ';
      } else {
        classes += 'bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-400 dark:bg-gray-500 dark:hover:bg-gray-500 dark:text-gray-200 dark:focus:ring-gray-500';
      }
        break;
      default:
        classes += 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400 dark:bg-blue-600 dark:hover:bg-blue-500 dark:focus:ring-blue-500';
        break;
    }

    return classes;
  }
}