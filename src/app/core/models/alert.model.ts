// src/app/core/models/alert.model.ts
export interface AlertButton {
  text: string;
  role: 'confirm' | 'cancel' | 'custom' | string; // Allow custom roles
  cssClass?: string;
  handler?: () => boolean | void | Promise<boolean | void>; // Handler can return boolean to prevent dismiss
  data?: any; // Optional data to pass back when button is clicked
}

export interface AlertInput {
  type?: 'text' | 'number' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'date' | 'textarea' | 'checkbox'; // Add more as needed
  name: string; // Will be the key in the returned data object
  placeholder?: string;
  value?: string | number | boolean;
  label?: string; // Optional label for the input
  id?: string; // Optional id for the input element
  min?: number | string; // For number/date types
  max?: number | string; // For number/date types
  required?: boolean; // Basic required validation indicator
  // Add more attributes as needed: pattern, step, rows (for textarea), etc.
  attributes?: any;
  autofocus?: boolean;
}

export interface AlertOptions {
  header?: string;
  message?: string;
  listItems?: string[]; // <-- ADD THIS LINE
  buttons: AlertButton[];
  inputs?: AlertInput[]; // <-- ADDED THIS
  backdropDismiss?: boolean; // Default true (dismiss on backdrop click)
  customCssClass?: string; // Optional custom class for the alert box itself
  // Add other options like subHeader, custom component, etc. if needed later
}