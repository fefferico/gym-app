// src/app/core/models/app-settings.model.ts
export interface AppSettings {
  enableTimerCountdownSound: boolean;
  countdownSoundSeconds: number;
  enablePresetTimer: boolean;         // NEW
  enablePresetTimerAfterRest: boolean;         // NEW
  presetTimerDurationSeconds: number; // NEW
}