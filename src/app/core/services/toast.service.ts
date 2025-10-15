// src/app/core/services/toast.service.ts
import { Injectable, signal, WritableSignal } from '@angular/core';
import { ToastMessage, ToastType } from '../models/toast.model';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts: WritableSignal<ToastMessage[]> = signal([]);
  private defaultDuration = 5000; // 5 seconds

  constructor() { }

show(message: string, type: ToastType = 'info', duration?: number, title?: string, action?: ToastMessage['action']): void {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const toast: ToastMessage = { id, message, type, duration: duration ?? this.defaultDuration, title, action };
    
    this.toasts.update(currentToasts => [...currentToasts, toast]);

    // Do not auto-dismiss toasts that have a user action
    // if (action) {
    //   toast.duration = 0; // Override duration if there's an action
    // }

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => this.remove(id), toast.duration);
    }
  }

  // --- NEW Convenience Method ---
  /**
   * Shows a toast with a clickable action button.
   * This type of toast will not auto-dismiss.
   */
  showWithAction(message: string, actionLabel: string, actionCallback: () => void, type: ToastType = 'info', title?: string): void {
    const action = {
      label: actionLabel,
      action: () => {
        actionCallback();
        // Automatically remove the toast after the action is performed.
        // We find the toast in the current signal state to get its ID.
        const toastId = this.toasts().find(t => t.message === message && t.action?.label === actionLabel)?.id;
        if (toastId) {
          this.remove(toastId);
        }
      }
    };
    // Call the main `show` method with a duration of 0 to prevent auto-dismissal.
    this.show(message, type, 5000, title, action);
  }

  success(message: string, duration?: number, title?: string, hideOtherMessages: boolean = true): void {
    if (hideOtherMessages) {
      this.clearAll(); // Clear existing toasts if specified
    }
    this.show(message, 'success', duration ? duration : 3000, title);
  }

  error(message: string, duration?: number, title?: string): void {
    this.show(message, 'error', duration ? duration : 3000, title);
  }

  warning(message: string, duration?: number, title?: string): void {
    this.show(message, 'warning', duration ? duration : 3000, title);
  }

  info(message: string, duration?: number, title?: string, hideOtherMessages: boolean = true): void {
    if (hideOtherMessages) {
      this.clearAll(); // Clear existing toasts if specified
    }
    this.show(message, 'info', duration ? duration : 3000, title);
  }

  veryImportant(message: string, duration?: number, title?: string, hideOtherMessages: boolean = true): void {
    if (hideOtherMessages) {
      this.clearAll(); // Clear existing toasts if specified
    }
    this.show(message, 'very-important', duration ? duration : 10000, title);
  }

  remove(toastId: string): void {
    this.toasts.update(currentToasts => currentToasts.filter(t => t.id !== toastId));
  }

  clearAll(): void {
    // avoid removing toast which are very-important
    this.toasts.update(currentToasts => currentToasts.filter(t => t.type === 'very-important'));
  }
}