export interface AppSettings {
  enableTimerCountdownSound: boolean;
  countdownSoundSeconds: number;
  enablePresetTimer: boolean;
  enableProgressiveOverload: boolean;
  presetTimerDurationSeconds: number;
  weightStep: number;
  playerMode: PlayerMode;
  menuMode: MenuMode;
  // Add other settings as needed
}

export type MenuMode = 'dropdown' | 'compact' | 'modal';
export type PlayerMode = 'focus' | 'compact';
