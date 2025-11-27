import { Injectable } from "@angular/core";

export enum AUDIO_TYPES {
  "countdown" = 'countdown',
  "tick" = 'tick',
  "end" = 'end',
  "error" = 'error',
  "correct" = 'correct',
  "whoosh" = 'whoosh',
  "tada" = 'tada',
  "tatatada" = 'tatatada',
  "untoggle" = 'untoggle',
  "magic" = "magic",
  "pop" = "pop",
  "whistle" = "whistle",
  "referee" = "referee"
};

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private _lastTickTime: number = 0;
  private audioCtx: AudioContext | null = null;
  private _userInteracted = false;

  constructor() {
    // Listen for first user interaction to unlock audio context
    window.addEventListener('pointerdown', this._unlockAudioContext, { once: true });
    window.addEventListener('keydown', this._unlockAudioContext, { once: true });
  }

  private _unlockAudioContext = () => {
    this.initializeAudioContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    this._userInteracted = true;
  };

  async playSound(type: AUDIO_TYPES): Promise<void> {
  this.initializeAudioContext();
  if (!this.audioCtx) return;

  if (!this._userInteracted) {
    this._userInteracted = true;
  }

  if (this.audioCtx.state === 'suspended') {
    try {
      await this.audioCtx.resume();
    } catch (e) {
      return;
    }
  }

    switch (type) {
      case AUDIO_TYPES.countdown:
        this.playCountdownSound();
        break;
      case AUDIO_TYPES.end:
        this.playEndSound();
        break;
      case AUDIO_TYPES.error:
        this.playErrorSound();
        break;
      case AUDIO_TYPES.correct:
        this.playCorrectSound();
        break;
      case AUDIO_TYPES.untoggle:
        this.playUntoggleSound();
        break;
      case AUDIO_TYPES.whoosh:
        this.playWhooshSound();
        break;
      case AUDIO_TYPES.tada:
        this.playTadaSound();
        break;
      case AUDIO_TYPES.tatatada:
        this.playTaTaTaDaSound();
        break;
      case AUDIO_TYPES.magic: {
        this.playMagicRestoreSound();
        break;
      }
      case AUDIO_TYPES.pop: {
        this.playPopSound();
        break;
      }
      case AUDIO_TYPES.referee:
        this.playRefereeSound();
        break;
      case AUDIO_TYPES.tick: {
        this.playTickSound();
        break;
      }
    }
  }

  private initializeAudioContext(): void {
    if (!this.audioCtx) {
      try {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.error("Web Audio API is not supported in this browser");
      }
    }
  }

  /**
 * Plays a dynamically generated "magical restore" sound.
 */
  playMagicRestoreSound() {
    this.initializeAudioContext();
    if (!this.audioCtx) {
      return;
    }
    const now = this.audioCtx.currentTime;

    // This sound is composed of three ascending notes (an arpeggio)
    // that quickly play and fade out, creating a "sparkle" effect.
    const notes = [622.25, 783.99, 932.33]; // F#5, G5, A#5

    // Master gain to control the overall volume and prevent clipping
    const masterGain = this.audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.3, now); // Set overall volume to 30%
    masterGain.connect(this.audioCtx.destination);

    notes.forEach((frequency, index) => {
      if (!this.audioCtx) {
        return;
      }
      const oscillator = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      // Configure the oscillator
      oscillator.type = 'sine'; // A sine wave is clean and pure, good for magic sounds
      oscillator.frequency.setValueAtTime(frequency, now);

      // Connect nodes: Oscillator -> GainNode -> MasterGain -> Speakers
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);

      // Schedule the sound envelope (ADSR - Attack, Decay, Sustain, Release)
      const startTime = now + index * 0.08; // Stagger the start time of each note

      // 1. Attack: Quickly fade in to avoid a "click"
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.05); // Quick rise to 80% volume

      // 2. Decay & Release: Fade out over a longer period
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.5);

      // Start and stop the oscillator
      oscillator.start(startTime);
      oscillator.stop(startTime + 1.5);
    });
  }

  /**
   * Plays a "pop" or "bloop" sound that matches the provided audio sample.
   * This sound is characterized by a single, pure tone with a very rapid
   * drop in pitch and a quick decay.
   */
  playPopSound(): void {
    this.initializeAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;

    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    // A sine wave produces a pure, clean tone perfect for this "bloop" sound.
    oscillator.type = 'sine';

    // --- Pitch (Frequency) Envelope ---
    // This is the most critical part for matching the sound.
    // Start at a high-mid frequency and drop it very quickly.
    const startFrequency = 880; // A5 note
    const endFrequency = 150;
    const rampDownTime = 0.1; // The pitch drops over 100ms

    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + rampDownTime);

    // --- Volume (Gain) Envelope ---
    // A fast attack and a slightly longer decay to let the sound ring out a little.
    gainNode.gain.setValueAtTime(0.8, now); // Start at a decent volume
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.2); // Fade out over 200ms

    // --- Connect Audio Graph and Play ---
    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.25); // Stop the oscillator after the sound has faded
  }

  /**
 * Plays a mechanical clock tick: sharp, short, high-pitched.
 */
  playTickSound(): void {
    this.initializeAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;

    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    oscillator.type = 'square'; // Sharper than sine
    const tickDuration = 0.018; // 18ms, very short

    // Start at 3500Hz, drop to 800Hz very quickly
    oscillator.frequency.setValueAtTime(3500, now);
    oscillator.frequency.exponentialRampToValueAtTime(800, now + tickDuration);

    // Always reset gain to 0 before ramping up
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + 0.001); // Fast attack
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + tickDuration); // Decay

    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    oscillator.start(now);
    oscillator.stop(now + tickDuration);
  }

  /**
 * Plays a short, high-pitched countdown beep.
 */
  playCountdownSound(): void {
    this.initializeAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.15);
  }

  /**
   * Plays a multi-tone "end" sound.
   */
  playEndSound(): void {
    this.initializeAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const masterGain = this.audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.8, now);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();
    const osc3 = this.audioCtx.createOscillator();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(110, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(220, now);

    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(330, now);

    osc1.connect(masterGain);
    osc2.connect(masterGain);
    osc3.connect(masterGain);
    masterGain.connect(this.audioCtx.destination);

    osc1.start(now);
    osc1.stop(now + 2.0);
    osc2.start(now);
    osc2.stop(now + 2.0);
    osc3.start(now);
    osc3.stop(now + 2.0);
  }

  /**
   * Plays a short error sound.
   */
  playErrorSound(): void {
    this.initializeAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(600, now);
    oscillator.frequency.linearRampToValueAtTime(300, now + 0.25);

    gainNode.gain.setValueAtTime(0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.25);
  }

  /**
   * Plays a short correct/confirmation sound.
   */
  playCorrectSound(): void {
    this.initializeAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    const overtoneGain = this.audioCtx.createGain();

    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(784, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1568, now);

    overtoneGain.gain.setValueAtTime(0.5, now);

    osc1.connect(gainNode);
    osc2.connect(overtoneGain);
    overtoneGain.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    osc1.start(now);
    osc1.stop(now + 0.7);
    osc2.start(now);
    osc2.stop(now + 0.7);
  }

  /**
   * Plays a short "whoosh" sound using white noise and a sweeping bandpass filter.
   */
  playWhooshSound(): void {
    this.initializeAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const duration = 0.3;

    // Create gain node for volume envelope
    const gainNode = this.audioCtx.createGain();
    gainNode.gain.setValueAtTime(1, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // Create a bandpass filter for the sweeping effect
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 15;
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + duration);

    // Generate white noise buffer
    const bufferSize = this.audioCtx.sampleRate * duration;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.audioCtx.createBufferSource();
    noiseSource.buffer = buffer;

    // Connect nodes: noise -> filter -> gain -> destination
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + duration);
  }

  /**
 * Plays a "Ta-daaaan!" fanfare sound using three triangle wave notes.
 */
  playTadaSound(): void {
    this.initializeAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const masterGain = this.audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.6, now);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2); // Total duration
    masterGain.connect(this.audioCtx.destination);

    // Note 1: "Ta" (C5)
    const osc1 = this.audioCtx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, now);
    osc1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Note 2: "Da" (G5)
    const osc2 = this.audioCtx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(783.99, now + 0.15);
    osc2.connect(masterGain);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.3);

    // Note 3: "Daaan!" (C6) - The final, triumphant note
    const osc3 = this.audioCtx.createOscillator();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(1046.50, now + 0.3);
    osc3.connect(masterGain);
    osc3.start(now + 0.3);
    osc3.stop(now + 1.2);
  }

  /**
 * Plays a "Ta-Ta-Ta-Daaan!" fanfare: three short notes and a long final note.
 */
  playTaTaTaDaSound(): void {
    this.initializeAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const masterGain = this.audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.6, now);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
    masterGain.connect(this.audioCtx.destination);

    // Note frequencies
    const noteC4 = 261.63;
    const noteG4 = 392.00;
    const noteC5 = 523.25;
    const noteG5 = 783.99;

    const noteDuration = 0.15;
    const delayBetweenNotes = 0.10;
    let startTime = now;

    // Helper to play a short note
    const playNote = (frequency: number, duration: number, startAt: number) => {
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, startAt);

      gainNode.gain.setValueAtTime(0, startAt);
      gainNode.gain.linearRampToValueAtTime(1, startAt + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      osc.connect(gainNode);
      gainNode.connect(masterGain);

      osc.start(startAt);
      osc.stop(startAt + duration);
    };

    // Play the three "Ta" notes
    playNote(noteC4, noteDuration, startTime);
    startTime += noteDuration + delayBetweenNotes;

    playNote(noteG4, noteDuration, startTime);
    startTime += noteDuration + delayBetweenNotes;

    playNote(noteC5, noteDuration, startTime);
    startTime += noteDuration + delayBetweenNotes;

    // Final "Daaan!" note (longer)
    const finalNoteDuration = 2.0;
    const finalOsc = this.audioCtx.createOscillator();
    const finalGain = this.audioCtx.createGain();

    finalOsc.type = 'triangle';
    finalOsc.frequency.setValueAtTime(noteG5, startTime);

    finalGain.gain.setValueAtTime(0, startTime);
    finalGain.gain.linearRampToValueAtTime(1, startTime + 0.05);
    finalGain.gain.exponentialRampToValueAtTime(0.0001, startTime + finalNoteDuration + 0.5);

    finalOsc.connect(finalGain);
    finalGain.connect(masterGain);

    finalOsc.start(startTime);
    finalOsc.stop(startTime + finalNoteDuration + 0.5);
  }

  /**
 * Plays a short referee whistle sound (fixed pitch, sharp stop).
 */
  playRefereeSound(): void {
    this.initializeAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const whistleDur = 0.4;

    // Master gain for this sound
    const whistleGain = this.audioCtx.createGain();

    // Volume Envelope
    whistleGain.gain.setValueAtTime(0, now);
    whistleGain.gain.linearRampToValueAtTime(0.8, now + 0.05); // Fast attack
    whistleGain.gain.setValueAtTime(0.8, now + whistleDur - 0.05); // Sustain
    whistleGain.gain.linearRampToValueAtTime(0.0001, now + whistleDur); // Sharp release

    whistleGain.connect(this.audioCtx.destination);

    // Oscillator 1: Base Tone (constant frequency)
    const osc1 = this.audioCtx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(3000, now);
    osc1.connect(whistleGain);

    // Oscillator 2: Interference Tone ("pea" rattle, constant frequency)
    const osc2 = this.audioCtx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(3080, now); // 80Hz difference = fast rattle
    osc2.connect(whistleGain);

    osc1.start(now);
    osc1.stop(now + whistleDur);
    osc2.start(now);
    osc2.stop(now + whistleDur);
  }

  /**
   * Plays a short, soft "untoggle" sound (low, quick pop).
   */
  playUntoggleSound(): void {
    this.initializeAudioContext();
    if (!this.audioCtx) return;

    const now = this.audioCtx.currentTime;
    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();


    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.1); // Quick fade

        oscillator.type = 'triangle'; // Softer than square
    oscillator.frequency.setValueAtTime(120, now); // Low, bassy pop

    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }
}