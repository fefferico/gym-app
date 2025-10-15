// src/app/core/models/toast.model.ts
export interface ToastMessage {
  id?: string; // Optional: for removing specific toasts if needed
  message: string;
  type: ToastType;
  duration?: number; // Milliseconds
  title?: string; // Optional title
  // icon?: string; // Optional: for custom icons
  action?: {
    label: string;      // The text on the button, e.g., "Undo"
    action: () => void; // The function to execute when clicked
  };
}

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'very-important';