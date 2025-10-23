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
}

export type MenuMode = 'dropdown' | 'compact' | 'modal';
export type PlayerMode = 'focus' | 'compact';
