import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy, signal, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PressDirective } from '../../directives/press.directive';
// +++ IMPORT ANIMATION FUNCTIONS +++
import { trigger, style, animate, transition } from '@angular/animations';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-full-screen-rest-timer',
  standalone: true,
  imports: [CommonModule, PressDirective, IconComponent],
  templateUrl: './full-screen-rest-timer.html',
  styleUrls: ['./full-screen-rest-timer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  @ViewChild('progressCircleSvg') progressCircleSvg!: ElementRef<SVGSVGElement>;

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

  ngAfterViewInit(): void {}

  private startTimer(): void {
    this.stopTimer();
    this.initialDuration.set(this.durationSeconds);
    this.remainingTime.set(this.durationSeconds);
    if (this.durationSeconds <= 0) {
      this.finishAndHideTimer();
      return;
    }
    const decrementAmount = this.timerUpdateIntervalMs / 1000;
    this.timerIntervalId = setInterval(() => {
      this.remainingTime.update(rt => {
        const newTime = rt - decrementAmount;
        if (newTime <= 0) {
          this.finishAndHideTimer();
          return 0;
        }
        return newTime;
      });
    }, this.timerUpdateIntervalMs);
  }

  private stopTimer(): void {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  private finishAndHideTimer(): void {
    this.stopTimer();
    this.timerFinished.emit();
    this.hideTimer.emit();
  }

  adjustTimer(seconds: number): void {
    this.remainingTime.update(currentRemaining => {
      let newTime = currentRemaining + seconds;
      newTime = Math.max(0, newTime);
      if (newTime <= 0) {
        this.finishAndHideTimer();
      }
      return newTime;
    });
    this.initialDuration.update(currentInitial => Math.max(currentInitial, this.remainingTime()));
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