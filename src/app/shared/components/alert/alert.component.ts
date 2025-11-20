// src/app/shared/alert/alert.component.ts
import { Component, Input, Output, EventEmitter, HostListener, ChangeDetectionStrategy, OnInit, QueryList, ElementRef, ViewChildren, ViewChild, SimpleChanges, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms'; // <-- Import FormsModule
import { AlertButton, AlertOptions, AlertInput } from '../../../core/models/alert.model';
import { PressDirective } from '../../directives/press.directive';
import { IconComponent } from '../icon/icon.component';
import { ToastService } from '../../../core/services/toast.service';
import { trigger, style, animate, transition } from '@angular/animations';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule, FormsModule, PressDirective, IconComponent], // <-- Add FormsModule
  templateUrl: './alert.component.html',
  styleUrls: ['./alert.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('modalOverlay', [
      transition(':enter', [
        style({ opacity: 0 }),
        // A slightly longer, smoother fade-in for the backdrop
        animate('300ms ease-in-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [
        animate('200ms ease-in-out', style({ opacity: 0 })),
      ]),
    ]),
    trigger('modalContent', [
      transition(':enter', [
        // Start from further down and fully transparent
        style({ transform: 'translateY(100%)', opacity: 0 }),
        // Use a custom cubic-bezier for a natural ease-in-out effect
        animate('300ms cubic-bezier(0.35, 0, 0.25, 1)', style({ transform: 'translateY(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('200ms cubic-bezier(0.35, 0, 0.25, 1)', style({ transform: 'translateY(100%)', opacity: 0 })),
      ]),
    ]),
  ]
})
export class AlertComponent implements OnInit {
  Array = Array;
  @Input() options: AlertOptions | null = null;
  @Output() dismissed = new EventEmitter<{ role: string, data?: any, values?: { [key: string]: string | number | boolean | number[] } } | undefined>();
  @ViewChildren('alertInput') inputElements!: QueryList<ElementRef<HTMLInputElement | HTMLTextAreaElement>>;
  @ViewChild('singleButton') singleButton?: ElementRef<HTMLButtonElement>;
  @ViewChildren('alertButton') allButtons!: QueryList<ElementRef<HTMLButtonElement>>;

  standardCssButtonClass: string = " w-full flex justify-center items-center text-white text-left px-4 py-2 rounded-md text-xl font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ";

  inputValues: { [key: string]: string | number | boolean | number[] } = {};

  private toastService = inject(ToastService);
  private platformId = inject(PLATFORM_ID); // Inject PLATFORM_ID
  protected translate = inject(TranslateService);

  // =================== START OF CORRECTION ===================
  /**
   * Determines the vertical alignment of the modal.
   * On mobile devices with input fields, it aligns the modal to the top
   * to prevent the on-screen keyboard from hiding it.
   */
  get alignmentClass(): string {
    if (isPlatformBrowser(this.platformId)) {
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const hasInputs = this.options?.inputs && this.options.inputs.length > 0;

      if (isMobile && hasInputs) {
        // On mobile with inputs, align to the top and add padding.
        return 'items-start pt-12';
      }
    }
    // By default, or on desktop, center the modal vertically.
    return 'items-center';
  }
  // =================== END OF CORRECTION ===================

  ngOnInit(): void {
    if (this.options?.inputs) {
    this.options.inputs.forEach(input => {
      if (input.type === 'checkbox') {
        // If the value is an array, use it directly (for checkbox groups)
        if (Array.isArray(input.value)) {
          this.inputValues[input.name] = input.value;
        } else {
          // Otherwise, treat as a single boolean checkbox
          this.inputValues[input.name] = input.value !== undefined ? !!input.value : false;
        }
      } else if (input.type === 'radio' && input.options && input.options.length > 0) {
        this.inputValues[input.name] = input.value !== undefined
          ? input.value
          : input.options[0].value;
      } else {
        this.inputValues[input.name] = input.value !== undefined ? input.value : (input.type === 'number' ? 0 : '');
      }
    });
  }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // If the 'options' input changes and we now have a single button
    if (changes['options']) {
      // We need a timeout to allow Angular to render the button first
      setTimeout(() => this.focusButton(), 0);
    }
  }

  private focusButton(): void {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobile) {
      return;
    }

    if (!this.options?.buttons || this.allButtons.length === 0) {
      return;
    }

    // Attempt to find a "confirm" button and focus it
    const confirmButtonIndex = this.options.buttons.findIndex(b => b.role === 'confirm');
    if (confirmButtonIndex > -1) {
      const confirmButtonElement = this.allButtons.get(confirmButtonIndex);
      if (confirmButtonElement) {
        confirmButtonElement.nativeElement.focus();
        return;
      }
    }

    // If no "confirm" button or it wasn't found in the DOM, focus the first available button
    if (this.allButtons.first) {
      if (this.options && this.options.buttons && this.options.buttons[0] && this.options.buttons[0].autofocus === false) {
        //
      } else {
        this.allButtons.first.nativeElement.focus();
      }
    }
  }

  ngAfterViewInit(): void {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    // If there are no inputs at all, fall back to focusing a button.
    if (!this.options?.inputs || this.inputElements.length === 0) {
      this.focusButton();
      return; // Exit early
    }

    // A small delay helps ensure mobile keyboards have time to animate in.
    const focusDelay = 100;

    // --- PRIORITY 1: Explicit Autofocus ---
    // Always honor an input that is explicitly marked with `autofocus: true`.
    const focusIndex = this.options.inputs.findIndex(input => input.autofocus);
    if (focusIndex > -1) {
      setTimeout(() => {
        const inputToFocus = this.inputElements.get(focusIndex);
        if (inputToFocus) {
          inputToFocus.nativeElement.focus();
          inputToFocus.nativeElement.select(); // Select the text
        }
      }, focusDelay);
      return; // High-priority task is done, so we exit.
    }

    // =================== START OF MODIFICATION ===================
    // --- PRIORITY 2: Mobile-specific Number Input ---
    // If no explicit autofocus is set, check for the mobile-number-input case.
    if (isPlatformBrowser(this.platformId)) {
      if (isMobile) {
        const firstNumberInputIndex = this.options.inputs.findIndex(input => input.type === 'number');

        if (firstNumberInputIndex > -1) {
          setTimeout(() => {
            const numberInput = this.inputElements.get(firstNumberInputIndex);
            if (numberInput) {
              // numberInput.nativeElement.focus();
              // numberInput.nativeElement.select(); // The key action for this request
            }
          }, focusDelay);
          return; // Mobile-specific task is done, exit.
        }
      }
    }
    // =================== END OF MODIFICATION ===================

    // --- PRIORITY 3: Fallback ---
    // If none of the above conditions were met, just focus the first input without selecting it.
    if (this.inputElements.first && !isMobile) {
      setTimeout(() => {
        this.inputElements.first.nativeElement.focus();
      }, focusDelay);
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
          // --- Start of Validation Logic ---

          // 1. Check for required fields (existing logic)
          if (input.type !== 'checkbox' && input.required && (this.inputValues[input.name] === undefined || String(this.inputValues[input.name]).trim() === '')) {
            this.toastService.info(this.translate.instant('alertComponent.fillField', { field: input.label || input.name }));
            return; // Stop dismissal
          }

          // 2. NEW: Add validation for number inputs
          if (input.type === 'number') {
            const numericValue = parseFloat(String(this.inputValues[input.name]));

            // Check if the input is a valid number (especially if required)
            if (isNaN(numericValue) && String(this.inputValues[input.name]).trim() !== '') {
              this.toastService.info(this.translate.instant('alertComponent.invalidNumber', { field: input.label || input.name }));
              return; // Stop dismissal
            }

            // Check against the minimum value, if defined
            if (input.attributes !== undefined && input.attributes.min !== undefined && numericValue < parseFloat(String(input.attributes.min))) {
                this.toastService.info(this.translate.instant('alertComponent.minNumber', { field: input.label || input.name, min: input.attributes.min }));
              return; // Stop dismissal
            }

            // Check against the maximum value, if defined
            if (input.attributes !== undefined && input.attributes.max !== undefined && numericValue > parseFloat(String(input.attributes.max))) {
                this.toastService.info(this.translate.instant('alertComponent.maxNumber', { field: input.label || input.name, max: input.attributes.max }));
              return; // Stop dismissal
            }
          }
          // --- End of Validation Logic ---
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

  private dismissWith(result: { role: string, data?: any, values?: { [key: string]: string | number | boolean | number[] } } | undefined): void {
    this.dismissed.emit(result);
  }

  getButtonClass(button: AlertButton): string {
    const isDesktop = isPlatformBrowser(this.platformId) && !('ontouchstart' in window || navigator.maxTouchPoints > 0);

    let classes = this.standardCssButtonClass;
    switch (button.role) {
      case 'confirm':
        if (button.cssClass) {
          classes += button.cssClass + ' ';
        } else {
          classes += 'bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-400' + (isDesktop ? ' focus:ring-indigo-500 dark:focus:ring-indigo-600' : '');
        }
        break;
      case 'cancel': if (button.cssClass) {
        classes += button.cssClass + ' ';
      } else {
        // remove text-white from classes string
        // classes = classes.replace('text-white', '');
        classes += 'bg-gray-400 hover:bg-gray-500 text-gray-700 focus:ring-gray-400 dark:bg-gray-500 dark:hover:bg-gray-500 dark:text-gray-200 dark:focus:ring-gray-500';
      }
        break;
      default:
        if (button.overrideCssClass) {
          // `overrideCssClass` completely replaces any existing or default classes.
          classes = button.overrideCssClass;
        } else if (button.cssClass) {
          // `cssClass` is appended to any existing base classes.
          classes += button.cssClass + ' ';
        } else {
          // If neither is provided, append the default button styling.
          classes = this.standardCssButtonClass;
          classes += 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400 dark:bg-blue-600 dark:hover:bg-blue-500 dark:focus:ring-blue-500';
        }
        break;
    }

    return classes;
  }

  /**
   * Handles the click event for the optional close button in the corner.
   * Stops the event from propagating to the backdrop and dismisses the alert
   * with a 'cancel' role.
   * @param event The mouse event from the button click.
   */
  onCloseButtonClick(event: Event): void {
    event.stopPropagation(); // Prevent the backdrop click from also firing.
    this.dismissWith({ role: 'cancel' });
  }

  onNumberInput(event: Event, inputName: string) {
    const input = event.target as HTMLInputElement;
    // Only allow numbers and dot
    input.value = input.value.replace(/[^0-9.]/g, '');
    this.inputValues[inputName] = input.value;
  }
}