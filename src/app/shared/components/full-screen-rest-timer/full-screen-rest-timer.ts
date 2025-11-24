// full-screen-rest-timer.ts

import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy, signal, computed, Signal, Injectable, inject, NgZone, effect, Inject, DOCUMENT, ChangeDetectorRef, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PressDirective } from '../../directives/press.directive';
import { trigger, style, animate, transition } from '@angular/animations';
import { IconComponent } from '../icon/icon.component';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AUDIO_TYPES, AudioService } from '../../../core/services/audio.service';
import { Subscription, timer } from 'rxjs';

export enum TIMER_MODES {
  timer = "timer",
  stopwatch = "stopwatch"
}
@Component({
  selector: 'app-full-screen-rest-timer',
  standalone: true,
  imports: [CommonModule, PressDirective, IconComponent, TranslateModule],
  templateUrl: './full-screen-rest-timer.html',
  styleUrls: ['./full-screen-rest-timer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AudioService],
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
export class FullScreenRestTimerComponent implements OnDestroy, AfterViewInit {
  isVisible = input<boolean>(false);
  mainTimer = input('00:00:00');
  durationSeconds = input<number>(60);
  mainText = input<string>('RESTING');
  nextUpText = input<string | null>(null);
  mode = input<TIMER_MODES>(TIMER_MODES.timer);
  protected timerModes = TIMER_MODES;

  // --- START: NEW INPUT AND OUTPUT ---
  // --- END: NEW INPUT AND OUTPUT ---

  @Output() modeChanged = new EventEmitter<TIMER_MODES.timer | TIMER_MODES.stopwatch>();
  @Output() timerFinished = new EventEmitter<void>();
  @Output() timerSkipped = new EventEmitter<number>();
  @Output() stopwatchStopped = new EventEmitter<number>();

  private appSettingsService = inject(AppSettingsService);
  private audioService = inject(AudioService);
  private lastBeepSecond: number | null = null;
  private translate = inject(TranslateService);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('progressCircleSvg') progressCircleSvg!: ElementRef<SVGSVGElement>;

  private timerStartTime = 0;
  private targetEndTime = 0;
  private timerIntervalId: any;

  private timerSub?: Subscription;


  private readonly circleRadius = 90;
  private readonly circumference = 2 * Math.PI * this.circleRadius;
  private readonly timerUpdateIntervalMs = 100;

  readonly remainingTime = signal(0);
  readonly initialDuration = signal(0);
  readonly elapsedTime = signal(0);

  readonly strokeDashoffset = computed(() => {
    const initial = this.initialDuration();
    if (initial <= 0) return this.circumference;
    const currentProgress = Math.max(0, this.remainingTime()) / initial;
    return this.circumference * (1 - currentProgress);
  });

  readonly displayTime = computed(() => {
    const timeSource = this.mode() === TIMER_MODES.timer ? this.remainingTime() : this.elapsedTime();
    // First, get the total number of WHOLE seconds. This is the key change.
    const totalWholeSeconds = Math.floor(Math.max(0, timeSource));

    const minutes = Math.floor(totalWholeSeconds / 60);
    const seconds = totalWholeSeconds % 60;

    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else {
      // For the first minute, just show the seconds part.
      return `${seconds}`;
    }
  });

  readonly displayTentsTime = computed(() => {
    const timeSource = this.mode() === TIMER_MODES.timer ? this.remainingTime() : this.elapsedTime();
    // The tenths digit is the first number after the decimal point.
    const tenths = Math.floor((Math.max(0, timeSource) * 10) % 10);
    return `.${tenths}`;
  });

  constructor(@Inject(DOCUMENT) private document: Document) {
    // This single, clean effect manages everything.
    effect((onCleanup) => {
      // It correctly reads isVisible() and mode() as dependencies.
      const isVisible = this.isVisible();
      const currentMode = this.mode();

      if (isVisible) {
        // When shown, lock scroll and start the correct timer.
        this.document.body.classList.add('overflow-hidden');
        this.runTimerBasedOnMode();

        onCleanup(() => {
          // When hidden OR when the effect re-runs, unlock scroll and stop timers.
          this.document.body.classList.remove('overflow-hidden');
          this.stopAllTimers();
        });
      }
    });
  }

  ngAfterViewInit(): void { }

  private runTimerBasedOnMode(): void {
    // Always stop any existing timer before starting a new one.
    this.stopAllTimers();

    if (this.mode() === TIMER_MODES.timer) {
      this.startTimer();
    } else {
      this.startStopwatch();
    }
  }

  private startTimer(): void {
    this.initialDuration.set(this.durationSeconds());
    this.remainingTime.set(this.durationSeconds());

    if (this.durationSeconds() <= 0) {
      this.finishAndHideTimer();
      return;
    }

    this.timerStartTime = Date.now();
    this.targetEndTime = this.timerStartTime + this.durationSeconds() * 1000;

    this.timerSub = timer(0, this.timerUpdateIntervalMs).subscribe(() => {
      const now = Date.now();
      const remainingMilliseconds = Math.max(0, this.targetEndTime - now);
      this.remainingTime.set(remainingMilliseconds / 1000);

      // Manually trigger change detection. This is the safest way with OnPush and external timers.
      this.cdr.detectChanges();

      if (this.remainingTime() <= 0) {
        this.finishAndHideTimer();
      } else {
        this.playCountdownSound(this.remainingTime());
      }
    });
  }

  private startStopwatch(): void {
    this.elapsedTime.set(0);
    this.timerStartTime = Date.now();

    this.timerSub = timer(0, this.timerUpdateIntervalMs).subscribe(() => {
      const now = Date.now();
      const elapsedMilliseconds = now - this.timerStartTime;
      this.elapsedTime.set(elapsedMilliseconds / 1000);

      // Manually trigger change detection.
      this.cdr.detectChanges();
    });
  }

  private stopAllTimers(): void {
    // Unsubscribing is the correct way to stop the timer
    this.timerSub?.unsubscribe();
  }

  private finishAndHideTimer(): void {
    if (this.appSettingsService.enableTimerCountdownSound()) {
      this.audioService.playSound(AUDIO_TYPES.end);
    }
    this.stopAllTimers();
    this.timerFinished.emit();
  }

  adjustTimer(seconds: number): void {
    // This action only makes sense in timer mode
    if (this.mode() !== TIMER_MODES.timer) return;

    this.targetEndTime += seconds * 1000;
    const now = Date.now();
    const newRemainingMs = Math.max(0, this.targetEndTime - now);
    const newRemainingSeconds = newRemainingMs / 1000;
    this.remainingTime.set(newRemainingSeconds);

    if (newRemainingSeconds <= 0) {
      this.finishAndHideTimer();
    }
    this.initialDuration.update(currentInitial => Math.max(currentInitial, newRemainingSeconds));
  }

  // --- START: NEW METHOD ---
  /** Handles the main action button click, routing to the correct function based on mode. */
  handleMainAction(): void {
    if (this.mode() === TIMER_MODES.timer) {
      this.skipTimer();
    } else {
      this.stopStopwatch();
    }
  }

  private stopStopwatch(): void {
    this.stopAllTimers();
    this.stopwatchStopped.emit(this.elapsedTime());
  }
  // --- END: NEW METHOD ---

  private skipTimer(): void {
    this.stopAllTimers();
    this.timerSkipped.emit(this.remainingTime());
  }

  private playCountdownSound(currentRemaining: number): void {
    if (
      this.appSettingsService.enableTimerCountdownSound()
    ) {
      const wholeSeconds = Math.ceil(currentRemaining);
      if (
        this.lastBeepSecond !== wholeSeconds &&
        wholeSeconds > 0 &&
        wholeSeconds <= this.appSettingsService.countdownSoundSeconds()
      ) {
        this.audioService.playSound(AUDIO_TYPES.countdown);
        this.lastBeepSecond = wholeSeconds;
      }
    }
  }

  ngOnDestroy(): void {
    this.stopAllTimers();
  }

  getCircleCircumference(): number { return this.circumference; }
  getCircleRadius(): number { return this.circleRadius; }
}