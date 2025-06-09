// src/app/shared/components/toast/toast.component.ts
import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service'; // Adjust path
import { ToastMessage, ToastType } from '../../../core/models/toast.model'; // Adjust path
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
  animations: [
    trigger('toastAnimation', [
      state('void', style({
        transform: 'translateY(100%) translateX(50%) scale(0.5)',
        opacity: 0,
        height: 0,
        margin: 0,
        padding:0,
      })),
      state('*', style({
        transform: 'translateY(0) translateX(0) scale(1)',
        opacity: 1,
      })),
      transition('void => *', [
        animate('0.3s ease-out')
      ]),
      transition('* => void', [
        animate('0.2s ease-in', style({
          opacity: 0,
          transform: 'translateX(100%)',
          height:0,
          margin:0,
          padding:0
        }))
      ])
    ])
  ]
})
export class ToastContainerComponent {
  toastService = inject(ToastService);
  toasts = computed(() => this.toastService.toasts());

  constructor() {}

  removeToast(toastId: string): void {
    this.toastService.remove(toastId);
  }

  // Explicit trackBy function
  trackByToastId(index: number, toast: ToastMessage): string | undefined {
    return toast.id;
  }

  getToastClasses(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'bg-green-500 border-green-600';
      case 'error':
        return 'bg-red-500 border-red-600';
      case 'warning':
        return 'bg-yellow-500 border-yellow-600';
      case 'info':
      default:
        return 'bg-blue-500 border-blue-600';
    }
  }

  getIconPath(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'error':
        return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'warning':
        return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
      case 'info':
      default:
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }
}