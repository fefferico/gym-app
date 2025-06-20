export interface ActionMenuItem {
  label?: string;
  actionKey?: string; // A unique key to identify the action when an event is emitted
  iconSvg?: string; // Optional: Raw SVG string for the icon
  iconClass?: string; // Optional: CSS classes for the SVG icon (e.g., 'w-5 h-5 mr-2')
  buttonClass?: string; // Optional: Custom classes for the button itself
  isDivider?: boolean; // To render a divider
  data?: any; // Optional data to associate with the action
}