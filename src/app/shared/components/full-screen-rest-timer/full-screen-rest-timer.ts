import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges, ElementRef, ViewChild, AfterViewInit, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-full-screen-rest-timer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './full-screen-rest-timer.html',
  styleUrls: ['./full-screen-rest-timer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush, // Good for performance
})
export class FullScreenRestTimerComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() isVisible: boolean = false;
  @Input() durationSeconds: number = 60; // Default duration
  @Input() mainText: string = 'RESTING';
  @Input() nextUpText: string | null = null;

  @Output() timerFinished = new EventEmitter<void>();
  @Output() timerSkipped = new EventEmitter<void>();

  @ViewChild('progressCircleSvg') progressCircleSvg!: ElementRef<SVGSVGElement>;

  private timerIntervalId: any;
  private circleRadius = 90; // Radius of the progress circle
  private circumference = 2 * Math.PI * this.circleRadius;

  // Signals for reactive state
  readonly remainingTime = signal(0);
  readonly initialDuration = signal(0);

  // Computed signal for SVG stroke-dashoffset
  readonly strokeDashoffset = computed(() => {
    if (this.initialDuration() <= 0) return this.circumference;
    const progress = this.remainingTime() / this.initialDuration();
    return this.circumference * (1 - progress);
  });

  // Computed signal for displayable time
  readonly displayTime = computed(() => {
    const totalSeconds = this.remainingTime();
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
      this.startTimer(); // Restart timer if duration changes while visible
    }
  }

  ngAfterViewInit(): void {
    // If you need to manipulate the SVG element directly after view init
    // For this example, direct manipulation isn't strictly necessary as attributes are bound
  }

  private startTimer(): void {
    this.stopTimer(); // Clear any existing timer
    this.initialDuration.set(this.durationSeconds);
    this.remainingTime.set(this.durationSeconds);

    if (this.durationSeconds <= 0) {
      this.timerFinished.emit();
      return;
    }

    this.timerIntervalId = setInterval(() => {
      this.remainingTime.update(rt => {
        const newTime = rt - 1;
        if (newTime <= 0) {
          this.stopTimer();
          this.timerFinished.emit();
          return 0;
        }
        return newTime;
      });
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  skipTimer(): void {
    this.stopTimer();
    this.timerSkipped.emit();
    // The parent component will typically set isVisible to false
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  // Expose for template binding
  getCircleCircumference(): number {
    return this.circumference;
  }

  getCircleRadius(): number {
    return this.circleRadius;
  }
}