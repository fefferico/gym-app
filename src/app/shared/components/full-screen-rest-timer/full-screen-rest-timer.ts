// full-screen-rest-timer.ts

import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy, signal, computed, Signal, Injectable, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PressDirective } from '../../directives/press.directive';
import { trigger, style, animate, transition } from '@angular/animations';
import { IconComponent } from '../icon/icon.component';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AUDIO_TYPES, AudioService } from '../../../core/services/audio.service';

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
export class FullScreenRestTimerComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() isVisible: boolean = false;
  @Input() mainTimer = signal('00:00:00');
  @Input() durationSeconds: number = 60;
  @Input() mainText: string = 'RESTING';
  @Input() nextUpText: string | null = null;
  
  // --- START: NEW INPUT AND OUTPUT ---
  @Input() mode: 'timer' | 'stopwatch' = 'timer';
  @Output() stopwatchStopped = new EventEmitter<number>(); // Emits elapsed seconds
  // --- END: NEW INPUT AND OUTPUT ---

  @Output() timerFinished = new EventEmitter<void>();
  @Output() timerSkipped = new EventEmitter<number>();
  @Output() hideTimer = new EventEmitter<void>();

  private appSettingsService = inject(AppSettingsService);
  private audioService = inject(AudioService);
  private lastBeepSecond: number | null = null;
  private translate = inject(TranslateService);

  @ViewChild('progressCircleSvg') progressCircleSvg!: ElementRef<SVGSVGElement>;

  private timerStartTime = 0;
  private targetEndTime = 0;
  private timerIntervalId: any;
  private readonly circleRadius = 90;
  private readonly circumference = 2 * Math.PI * this.circleRadius;
  private readonly timerUpdateIntervalMs = 100;

  readonly remainingTime = signal(0);
  readonly initialDuration = signal(0);
  // --- START: NEW SIGNAL FOR STOPWATCH ---
  readonly elapsedTime = signal(0);
  // --- END: NEW SIGNAL FOR STOPWATCH ---

  readonly strokeDashoffset = computed(() => {
    const initial = this.initialDuration();
    if (initial <= 0) return this.circumference;
    const currentProgress = Math.max(0, this.remainingTime()) / initial;
    return this.circumference * (1 - currentProgress);
  });

  readonly displayTime = computed(() => {
    // --- START: MODIFIED LOGIC ---
    // Display is now based on the current mode
    const timeSource = this.mode === 'timer' ? this.remainingTime() : this.elapsedTime();
    const totalSecondsValue = Math.max(0, timeSource);
    // --- END: MODIFIED LOGIC ---
    
    const minutes = Math.floor(totalSecondsValue / 60);
    const seconds = Math.floor(totalSecondsValue % 60);
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${seconds}`;
    }
  });

  readonly displayTentsTime = computed(() => {
    const timeSource = this.mode === 'timer' ? this.remainingTime() : this.elapsedTime();
    const tenths = Math.floor(Math.max(0, timeSource) * 10) % 10;
    return `.${tenths}`;
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']) {
      if (this.isVisible) {
        this.runTimerBasedOnMode();
      } else {
        this.stopAllTimers();
      }
    }
    // If duration changes while timer is active, restart it
    if (changes['durationSeconds'] && this.isVisible) {
      this.runTimerBasedOnMode();
    }
  }

  ngAfterViewInit(): void { }

  private runTimerBasedOnMode(): void {
    if (this.mode === 'timer') {
      this.startTimer();
    } else {
      this.startStopwatch();
    }
  }

  private startTimer(): void {
    this.stopAllTimers();
    this.lastBeepSecond = null;
    this.initialDuration.set(this.durationSeconds);
    this.remainingTime.set(this.durationSeconds);

    if (this.durationSeconds <= 0) {
      this.finishAndHideTimer();
      return;
    }
    this.timerStartTime = Date.now();
    this.targetEndTime = this.timerStartTime + this.durationSeconds * 1000;

    this.timerIntervalId = setInterval(() => {
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
        this.audioService.playSound(AUDIO_TYPES.countdown);
        this.lastBeepSecond = remainingSecondsFloored;
      }
      if (newTimeInSeconds <= 0) {
        this.finishAndHideTimer();
      }
    }, this.timerUpdateIntervalMs);
  }

  // --- START: NEW METHOD ---
  private startStopwatch(): void {
    this.stopAllTimers();
    this.elapsedTime.set(0);
    this.timerStartTime = Date.now();

    this.timerIntervalId = setInterval(() => {
      const now = Date.now();
      const elapsedMilliseconds = now - this.timerStartTime;
      this.elapsedTime.set(elapsedMilliseconds / 1000);
    }, this.timerUpdateIntervalMs);
  }
  // --- END: NEW METHOD ---

  private stopAllTimers(): void {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
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
    if (this.mode !== 'timer') return;

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
    if (this.mode === 'timer') {
      this.skipTimer();
    } else {
      this.stopStopwatch();
    }
  }
  
  /** Switches the component's mode between timer and stopwatch. */
  switchMode(): void {
    this.mode = this.mode === 'timer' ? 'stopwatch' : 'timer';
    this.runTimerBasedOnMode();
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

  ngOnDestroy(): void {
    this.stopAllTimers();
  }

  getCircleCircumference(): number { return this.circumference; }
  getCircleRadius(): number { return this.circleRadius; }
}