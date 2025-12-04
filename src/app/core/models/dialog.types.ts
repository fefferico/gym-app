export type DialogInputType = 'text' | 'number' | 'textarea' | 'select' | 'radio' | 'checkbox';

export interface DialogOption {
  label: string;
  value: any;
}

export interface DialogField {
  key: string;            // The property name in the result object (e.g., 'reps')
  type: DialogInputType;
  label: string;
  value?: any;            // Initial value
  placeholder?: string;
  options?: DialogOption[]; // Only for select/radio
  required?: boolean;
  cssClass?: string;
  attributes?: {
    [key: string]: string | number | boolean;
  };
}

export interface DialogConfig {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  fields?: DialogField[]; // If empty, it's just a simple alert
  listItems?: string[];
  listClass?: string;
  icon?: string;
  renderAsHtml?: boolean; // NEW: Allow HTML in both message and listItems
}

export interface DialogOutput {
  action: 'CONFIRM' | 'CANCEL';
  data?: any; // The form values
}