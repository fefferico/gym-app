import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy, signal, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PressDirective } from '../../directives/press.directive';

@Component({
  selector: 'app-full-screen-rest-timer',
  standalone: true,
  imports: [CommonModule, PressDirective],
  templateUrl: './full-screen-rest-timer.html',
  styleUrls: ['./full-screen-rest-timer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FullScreenRestTimerComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() isVisible: boolean = false;
  @Input() mainTimer = signal('00:00:00');
  @Input() durationSeconds: number = 60;
  @Input() mainText: string = 'RESTING';
  @Input() nextUpText: string | null = null;

  @Output() timerFinished = new EventEmitter<void>();
  @Output() timerSkipped = new EventEmitter<number>();

  @ViewChild('progressCircleSvg') progressCircleSvg!: ElementRef<SVGSVGElement>;

  private timerIntervalId: any;
  private readonly circleRadius = 90;
  private readonly circumference = 2 * Math.PI * this.circleRadius;
  private readonly timerUpdateIntervalMs = 100; // Update every 100ms for tenths of a second

  readonly remainingTime = signal(0); // Will store time in seconds, can be float
  readonly initialDuration = signal(0); // Will store time in seconds, can be float

  readonly strokeDashoffset = computed(() => {
    const initial = this.initialDuration();
    if (initial <= 0) return this.circumference;
    // Ensure progress doesn't go below 0 for calculation
    const currentProgress = Math.max(0, this.remainingTime()) / initial;
    return this.circumference * (1 - currentProgress);
  });

  readonly displayTime = computed(() => {
    // Use Math.max to prevent displaying negative time if an interval fires slightly after time hits 0
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
      // If duration changes while timer is visible and running, restart it
      this.startTimer();
    } else if (changes['durationSeconds'] && !this.isVisible) {
      // If duration changes while not visible, just update initial values for next show
      this.initialDuration.set(this.durationSeconds);
      this.remainingTime.set(this.durationSeconds);
    }
  }

  ngAfterViewInit(): void {
    // Not strictly necessary for this change
  }

  private startTimer(): void {
    this.stopTimer();
    this.initialDuration.set(this.durationSeconds);
    this.remainingTime.set(this.durationSeconds);

    if (this.durationSeconds <= 0) {
      this.timerFinished.emit();
      return;
    }

    const decrementAmount = this.timerUpdateIntervalMs / 1000; // e.g., 0.1 seconds

    this.timerIntervalId = setInterval(() => {
      this.remainingTime.update(rt => {
        const newTime = rt - decrementAmount;
        if (newTime <= 0) {
          this.stopTimer();
          this.timerFinished.emit();
          return 0; // Ensure remainingTime is exactly 0 on finish
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

  skipTimer(): void {
    this.stopTimer();
    this.timerSkipped.emit(this.remainingTime());
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