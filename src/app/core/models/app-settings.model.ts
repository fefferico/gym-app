export interface AppSettings {
  enableTimerCountdownSound: boolean;
  countdownSoundSeconds: number;
  enablePresetTimer: boolean;
  presetTimerDurationSeconds: number;
  weightStep: number; // <<< NEW PROPERTY
  // Add other settings as needed
}