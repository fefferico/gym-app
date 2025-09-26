import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy, signal, computed, Signal, Injectable, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PressDirective } from '../../directives/press.directive';
// +++ IMPORT ANIMATION FUNCTIONS +++
import { trigger, style, animate, transition } from '@angular/animations';
import { IconComponent } from '../icon/icon.component';
import { AppSettingsService } from '../../../core/services/app-settings.service';


@Injectable()
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

@Component({
  selector: 'app-full-screen-rest-timer',
  standalone: true,
  imports: [CommonModule, PressDirective, IconComponent],
  templateUrl: './full-screen-rest-timer.html',
  styleUrls: ['./full-screen-rest-timer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AudioService],
  // +++ DEFINE THE ANIMATION TRIGGER +++
  animations: [
    trigger('fade', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('200ms ease-in-out', style({ opacity: 1, transform: 'scale(1)' })),
      ]),
      transition(':leave', [
        animate('200ms ease-in-out', style({ opacity: 0, transform: 'scale(0.95)' }))
      ])
    ])
  ]
})
export class FullScreenRestTimerComponent implements OnChanges, OnDestroy, AfterViewInit {
  // ... rest of your component code remains the same
  @Input() isVisible: boolean = false;
  @Input() mainTimer = signal('00:00:00');
  @Input() durationSeconds: number = 60;
  @Input() mainText: string = 'RESTING';
  @Input() nextUpText: string | null = null;

  @Output() timerFinished = new EventEmitter<void>();
  @Output() timerSkipped = new EventEmitter<number>();
  @Output() hideTimer = new EventEmitter<void>();

  private appSettingsService = inject(AppSettingsService);
  private audioService = inject(AudioService);
  private lastBeepSecond: number | null = null;

  @ViewChild('progressCircleSvg') progressCircleSvg!: ElementRef<SVGSVGElement>;

  private timerStartTime = 0;
  private targetEndTime = 0;

  private timerIntervalId: any;
  private readonly circleRadius = 90;
  private readonly circumference = 2 * Math.PI * this.circleRadius;
  private readonly timerUpdateIntervalMs = 100;

  readonly remainingTime = signal(0);
  readonly initialDuration = signal(0);

  readonly strokeDashoffset = computed(() => {
    const initial = this.initialDuration();
    if (initial <= 0) return this.circumference;
    const currentProgress = Math.max(0, this.remainingTime()) / initial;
    return this.circumference * (1 - currentProgress);
  });

  readonly displayTime = computed(() => {
    const totalSecondsValue = Math.max(0, this.remainingTime());
    const minutes = Math.floor(totalSecondsValue / 60);
    const seconds = Math.floor(totalSecondsValue % 60);
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${seconds}`;
    }
  });

  readonly displayTentsTime = computed(() => {
    const tenths = Math.floor(Math.max(0, this.remainingTime()) * 10) % 10;
    return `.${tenths}`;
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']) {
      if (this.isVisible) {
        this.startTimer();
      } else {
        this.stopTimer();
      }
    }
    if (changes['durationSeconds'] && this.isVisible) {
      this.startTimer();
    } else if (changes['durationSeconds'] && !this.isVisible) {
      this.initialDuration.set(this.durationSeconds);
      this.remainingTime.set(this.durationSeconds);
    }
  }

  ngAfterViewInit(): void { }

  private startTimer(): void {
    this.stopTimer();
    this.lastBeepSecond = null;
    this.initialDuration.set(this.durationSeconds);
    this.remainingTime.set(this.durationSeconds);

    if (this.durationSeconds <= 0) {
      this.finishAndHideTimer();
      return;
    }

    // --- MODIFIED: Set start and target end times ---
    this.timerStartTime = Date.now();
    this.targetEndTime = this.timerStartTime + this.durationSeconds * 1000;

    this.timerIntervalId = setInterval(() => {
      // --- MODIFIED: Calculate remaining time from target end time ---
      const now = Date.now();
      const remainingMilliseconds = Math.max(0, this.targetEndTime - now);
      const newTimeInSeconds = remainingMilliseconds / 1000;

      this.remainingTime.set(newTimeInSeconds);

      const remainingSecondsFloored = Math.floor(newTimeInSeconds);
      if (
        this.appSettingsService.enableTimerCountdownSound() &&
        remainingSecondsFloored <= this.appSettingsService.countdownSoundSeconds() &&
        remainingSecondsFloored !== this.lastBeepSecond
      ) {
        this.audioService.playSound('countdown');
        this.lastBeepSecond = remainingSecondsFloored;
      }
      if (newTimeInSeconds <= 0) {
        this.finishAndHideTimer();
      }
    }, this.timerUpdateIntervalMs);
  }

  private stopTimer(): void {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  private finishAndHideTimer(): void {
    if (this.appSettingsService.enableTimerCountdownSound()) {
      this.audioService.playSound('end');
    }
    this.stopTimer();
    this.timerFinished.emit();
    this.hideTimer.emit();
  }

  adjustTimer(seconds: number): void {
    // --- MODIFIED: Adjust the target end time directly ---
    this.targetEndTime += seconds * 1000;

    // --- MODIFIED: Recalculate remaining time based on the new target ---
    const now = Date.now();
    const newRemainingMs = Math.max(0, this.targetEndTime - now);
    const newRemainingSeconds = newRemainingMs / 1000;

    this.remainingTime.set(newRemainingSeconds);

    if (newRemainingSeconds <= 0) {
      this.finishAndHideTimer();
    }

    // Adjust initial duration if we added time beyond the original, to keep the circle progress correct
    this.initialDuration.update(currentInitial => Math.max(currentInitial, newRemainingSeconds));
  }

  skipTimer(): void {
    this.stopTimer();
    this.timerSkipped.emit(this.remainingTime());
    this.hideTimer.emit();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  getCircleCircumference(): number {
    return this.circumference;
  }

  getCircleRadius(): number {
    return this.circleRadius;
  }
}