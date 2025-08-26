export interface AppSettings {
  enableTimerCountdownSound: boolean;
  countdownSoundSeconds: number;
  enablePresetTimer: boolean;
  presetTimerDurationSeconds: number;
  weightStep: number;
  playerMode: boolean;
  menuMode: MenuMode;
  // Add other settings as needed
}

export type MenuMode = 'dropdown' | 'compact' | 'modal';
