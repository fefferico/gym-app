export interface AppSettings {
  enableTimerCountdownSound: boolean;
  countdownSoundSeconds: number;
  enablePresetTimer: boolean;
  enableProgressiveOverload: boolean;
  presetTimerDurationSeconds: number;
  weightStep: number;
  playerMode: PlayerMode;
  menuMode: MenuMode;
  enableTrueGymMode: boolean;
  showMetricTarget: boolean;
  durationStep: number;
  distanceStep: number;
  restStep: number;
  restTimerMode?: RestTimerMode;
  summaryDisplayMode?: SummaryDisplayMode;
}

export type MenuMode = 'dropdown' | 'compact' | 'modal';
export type PlayerMode = 'focus' | 'compact';
export enum RestTimerMode { Fullscreen = 'fullscreen', Compact = 'compact' };
export enum SummaryDisplayMode { Text = 'text', Icons = 'icons' };