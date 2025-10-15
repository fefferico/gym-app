import { Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  // private countdownSound: HTMLAudioElement;
  // private endSound: HTMLAudioElement;
  private audioCtx: AudioContext | null = null;

  constructor() {
    // this.countdownSound = new Audio('assets/sounds/countdown.mp3');
    // this.endSound = new Audio('assets/sounds/end.mp3');
    // this.countdownSound.load();
    // this.endSound.load();

  }

  playSound(type: 'countdown' | 'end'): void {
    // const soundToPlay = type === 'countdown' ? this.countdownSound : this.endSound;
    // soundToPlay.play().catch(error => console.error(`Error playing ${type} sound:`, error));
    this.initializeAudioContext();
    if (!this.audioCtx) return;

    // If context is suspended, resume it. This is often needed after the page has been idle.
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;

    if (type === 'countdown') {
      // --- Simple Beep Sound ---
      const oscillator = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now); // A high-pitched, clear beep
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15); // Quick fade out

      oscillator.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.15);
    } else {
      // --- Simple Gong Sound (using two oscillators for a richer tone) ---
      const gainNode = this.audioCtx.createGain();
      gainNode.gain.setValueAtTime(0.4, now); // Start at a higher volume
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.5); // Long fade out

      // Low frequency fundamental tone
      const osc1 = this.audioCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(155, now); // D#3

      osc1.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 1.5);
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