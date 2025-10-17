import { Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioCtx: AudioContext | null = null;

  constructor() { }

  playSound(type: 'countdown' | 'end' | 'error' | 'correct' | 'untoggle'): void {
    this.initializeAudioContext();
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;

    if (type === 'countdown') {
      const oscillator = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now);
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      oscillator.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.15);
    } else if (type === 'end') {
      const masterGain = this.audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.8, now);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

      const osc1 = this.audioCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(110, now);

      const osc2 = this.audioCtx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(220, now);

      const osc3 = this.audioCtx.createOscillator();
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

    } else if (type === 'error') {
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
    } else if (type === 'correct') {
      const gainNode = this.audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.5, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

      const osc1 = this.audioCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(784, now);

      const osc2 = this.audioCtx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1568, now);
      
      const overtoneGain = this.audioCtx.createGain();
      overtoneGain.gain.setValueAtTime(0.5, now);

      osc1.connect(gainNode);
      osc2.connect(overtoneGain);
      overtoneGain.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      osc1.start(now);
      osc1.stop(now + 0.7);
      osc2.start(now);
      osc2.stop(now + 0.7);
    } else if (type === 'untoggle') {
      // --- Subtle "Pop" or "Click" Sound ---
      const gainNode = this.audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.5, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1); // Very short fade

      const oscillator = this.audioCtx.createOscillator();
      oscillator.type = 'triangle'; // Softer than a square wave
      oscillator.frequency.setValueAtTime(120, now); // Low, bassy pop

      oscillator.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      
      oscillator.start(now);
      oscillator.stop(now + 0.1);
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