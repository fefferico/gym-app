import { Injectable } from "@angular/core";

export enum AUDIO_TYPES {
  "countdown" = 'countdown',
  "end" = 'end',
  "error" = 'error',
  "correct" = 'correct',
  "whoosh" = 'whoosh',
  "tada" = 'tada',
  "tatatada" = 'tatatada',
  "untoggle" = 'untoggle'
};

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioCtx: AudioContext | null = null;

  constructor() { }

  playSound(type: AUDIO_TYPES): void {
    this.initializeAudioContext();
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;
    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    const masterGain = this.audioCtx.createGain();
    const overtoneGain = this.audioCtx.createGain();

    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();
    const osc3 = this.audioCtx.createOscillator();
    const osc4 = this.audioCtx.createOscillator();

    switch (type) {
      case AUDIO_TYPES.countdown:
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, now);
        gainNode.gain.setValueAtTime(2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
        break;
      case AUDIO_TYPES.end:
        masterGain.gain.setValueAtTime(0.8, now);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

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
        break;
      case AUDIO_TYPES.error:
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(600, now);
        oscillator.frequency.linearRampToValueAtTime(300, now + 0.25);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.25);
        break;
      case AUDIO_TYPES.correct:
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
        break;
      case AUDIO_TYPES.untoggle:
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1); // Very short fade

        oscillator.type = 'triangle'; // Softer than a square wave
        oscillator.frequency.setValueAtTime(120, now); // Low, bassy pop

        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        oscillator.start(now);
        oscillator.stop(now + 0.1);
        break;
      case AUDIO_TYPES.whoosh:
        // --- Whoosh Sound ---
        const duration = 0.3;
        gainNode.gain.setValueAtTime(1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 15; // High Q value for a more resonant "whistling" sound
        filter.frequency.setValueAtTime(4000, now); // Start high
        filter.frequency.exponentialRampToValueAtTime(100, now + duration); // Sweep low

        // Generate white noise
        const bufferSize = this.audioCtx.sampleRate * duration;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }

        const noiseSource = this.audioCtx.createBufferSource();
        noiseSource.buffer = buffer;

        // Connect the nodes
        noiseSource.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        noiseSource.start(now);
        noiseSource.stop(now + duration);
        break;
      case AUDIO_TYPES.tada:
        // --- "Ta-daaaan!" Fanfare ---
        masterGain.gain.setValueAtTime(0.6, now);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2); // Total duration
        masterGain.connect(this.audioCtx.destination);

        // Note 1: "Ta" (C5)
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(523.25, now);
        osc1.connect(masterGain);
        osc1.start(now);
        osc1.stop(now + 0.15);

        // Note 2: "Da" (G5)
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(783.99, now + 0.15);
        osc2.connect(masterGain);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.3);

        // Note 3: "Daaan!" (C6) - The final, triumphant note
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(1046.50, now + 0.3);
        osc3.connect(masterGain);
        osc3.start(now + 0.3);
        osc3.stop(now + 5);
        break;
      case AUDIO_TYPES.tatatada:
        // --- "Ta-daaaan!" Fanfare ---
        // Set master gain for the whole sequence and fade out
        masterGain.gain.setValueAtTime(0.6, now);
        // Exponential ramp to almost silent over 3.5 seconds (adjust as needed for fanfare duration)
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
        masterGain.connect(this.audioCtx.destination);

        // Define frequencies for a classic "Ta-da" (e.g., C4 - G4 - C5 - G5)
        // You can adjust these to your liking.
        const noteC4 = 261.63; // C4
        const noteG4 = 392.00; // G4
        const noteC5 = 523.25; // C5
        const noteG5 = 783.99; // G5 (the "Daaan!" note)

        const noteDuration = 0.15; // Duration of the short 'Ta' notes
        const delayBetweenNotes = 0.10; // Pause between 'Ta' notes
        let startTime = now;

        // Helper function to create and play a single note
        const playNote = (frequency: number, duration: number, startAt: number) => {
          if (!this.audioCtx){
            return;
          }
          const osc = this.audioCtx.createOscillator();
          const gainNode = this.audioCtx.createGain(); // Use a dedicated gain for each note for more control

          osc.type = 'triangle'; // Or 'sine', 'square', 'sawtooth'
          osc.frequency.setValueAtTime(frequency, startAt);

          // Simple ADSR envelope for each note for a cleaner sound
          gainNode.gain.setValueAtTime(0, startAt);
          gainNode.gain.linearRampToValueAtTime(1, startAt + 0.01); // Attack
          gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration); // Release

          osc.connect(gainNode);
          gainNode.connect(masterGain); // Connect to master gain

          osc.start(startAt);
          osc.stop(startAt + duration); // Stop the oscillator after its duration
        };

        // Note 1: "Ta" (C4)
        playNote(noteC4, noteDuration, startTime);
        startTime += noteDuration + delayBetweenNotes;

        // Note 2: "Ta" (G4)
        playNote(noteG4, noteDuration, startTime);
        startTime += noteDuration + delayBetweenNotes;

        // Note 3: "Ta" (C5)
        playNote(noteC5, noteDuration, startTime);
        startTime += noteDuration + delayBetweenNotes;

        // Note 4: "Daaan!" (G5) - The final, triumphant note
        // This note will be longer
        const finalNoteDuration = 2.0; // Sustain for 2 seconds
        const finalOsc = this.audioCtx.createOscillator();
        const finalGain = this.audioCtx.createGain();

        finalOsc.type = 'triangle';
        finalOsc.frequency.setValueAtTime(noteG5, startTime);

        // More pronounced envelope for the final note
        finalGain.gain.setValueAtTime(0, startTime);
        finalGain.gain.linearRampToValueAtTime(1, startTime + 0.05); // Attack
        finalGain.gain.exponentialRampToValueAtTime(0.0001, startTime + finalNoteDuration + 0.5); // Decay/Release over a longer period

        finalOsc.connect(finalGain);
        finalGain.connect(masterGain);

        finalOsc.start(startTime);
        finalOsc.stop(startTime + finalNoteDuration + 0.5); // Stop slightly after gain ramps down
        break;
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
}