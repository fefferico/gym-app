// src/app/shared/alert/alert.component.ts
import { Component, Input, Output, EventEmitter, HostListener, ChangeDetectionStrategy, OnInit, QueryList, ElementRef, ViewChildren } from '@angular/core';
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
  @Output() dismissed = new EventEmitter<{ role: string, data?: any, values?: { [key: string]: string | number | boolean } } | undefined>();
  @ViewChildren('alertInput') inputElements!: QueryList<ElementRef<HTMLInputElement | HTMLTextAreaElement>>;

  inputValues: { [key: string]: string | number | boolean } = {};

  ngOnInit(): void {
    if (this.options?.inputs) {
      this.options.inputs.forEach(input => {
        if (input.type === 'checkbox') {
          this.inputValues[input.name] = input.value !== undefined ? !!input.value : false;
        } else {
          this.inputValues[input.name] = input.value !== undefined ? input.value : (input.type === 'number' ? 0 : '');
        }
      });
    }
  }

  // This lifecycle hook runs after the view is initialized and the *ngFor is rendered
  ngAfterViewInit(): void {
    if (!this.options?.inputs || !this.inputElements) {
      return;
    }

    // Find the index of the input that has autofocus: true
    const focusIndex = this.options.inputs.findIndex(input => input.autofocus);

    if (focusIndex > -1) {
      // Use setTimeout to make sure the focus happens after the current change detection cycle.
      // This is a robust way to avoid timing issues with rendering or animations.
      setTimeout(() => {
        const inputToFocus = this.inputElements.get(focusIndex);
        if (inputToFocus) {
          inputToFocus.nativeElement.focus();
          // Bonus: Also select the text in the input for easy replacement.
          inputToFocus.nativeElement.select();
        }
      }, 0);
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

  /**
   * Handles the Enter key press on the alert.
   * Finds the primary confirmation button and triggers its click.
   * @param event The keyboard event.
   */
  handleEnterPress(event?: Event): void {
    // Prevent the default Enter key action (like form submission)
    event?.preventDefault();

    // Find the primary confirmation button. It's either the one with role 'confirm'
    // or the first button if no specific 'confirm' role is present.
    const confirmButton = this.options?.buttons?.find(b => b.role === 'confirm') || this.options?.buttons?.[0];

    if (confirmButton) {
      // Simulate a click on that button to reuse the validation and dismissal logic
      this.onButtonClick(confirmButton);
    }
  }

  onButtonClick(button: AlertButton): void {
    if (button.role === 'confirm' || button.role !== 'cancel') {
      if (this.options?.inputs) {
        for (const input of this.options.inputs) {
          if (input.type !== 'checkbox' && input.required && (this.inputValues[input.name] === undefined || String(this.inputValues[input.name]).trim() === '')) {
            alert(`Please fill in the '${input.label || input.name}' field.`);
            return;
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

  private dismissWith(result: { role: string, data?: any, values?: { [key: string]: string | number | boolean } } | undefined): void {
    this.dismissed.emit(result);
  }

  getButtonClass(button: AlertButton): string {
    let classes = 'w-full text-white px-4 py-2 rounded text-m font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ';
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
        if (button.cssClass) {
          classes += button.cssClass + ' ';
        } else {
          classes += 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400 dark:bg-blue-600 dark:hover:bg-blue-500 dark:focus:ring-blue-500';
        }
        break;
    }

    return classes;
  }
}