import { Component, ChangeDetectionStrategy, Input, effect, Inject, DOCUMENT, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerService } from '../../../core/services/timer.service';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
import { TranslateModule } from '@ngx-translate/core';
import { AUDIO_TYPES, AudioService } from '../../../core/services/audio.service';
import { AppSettingsService } from '../../../core/services/app-settings.service';

@Component({
    selector: 'app-timer-center',
    standalone: true,
    imports: [CommonModule, FormsModule, IconComponent, TranslateModule,],
    templateUrl: './timer-center.component.html',
    styleUrls: ['./timer-center.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimerCenterComponent {
    @Input() fullscreen = false;
    @Input() isOpen = false;
    @Output() close = new EventEmitter<void>();
    customTimerValue: number | null = null;

    private appSettingsService = inject(AppSettingsService);

    constructor(
        public timer: TimerService,
        private audioService: AudioService,
        @Inject(DOCUMENT) private document: Document
    ) {
        effect((onCleanup) => {
            this.document.body.classList.add('overflow-hidden');
            onCleanup(() => {
                this.document.body.classList.remove('overflow-hidden');
            });
        });
    }
    open() {
        this.isOpen = true;
    }


    setMode(mode: 'timer' | 'stopwatch') {
        this.timer.setMode(mode);
        this.timer.reset();
    }

    setDuration(seconds: number) {
        this.timer.setDuration(seconds);
        this.timer.reset();
    }

    saveCurrentAsPreferred() {
        this.timer.savePreferredCountdown(this.timer.state().duration);
    }

    addCustomTimer() {
        if (
            this.customTimerValue &&
            !this.timer.state().preferredCountdowns.includes(this.customTimerValue)
        ) {
            this.timer.savePreferredCountdown(this.customTimerValue);
            this.customTimerValue = null;
        }
    }

    private lastTickSecond: number | null = null;


    private timerInterval: any = null;
    private tick(first = false) {
        if (!this.timer.state().running) {
            this.clearInterval();
            return;
        }
        if (this.timer.state().mode === 'timer') {
            const now = Date.now();
            const elapsed = (now - (this.timer.state().startTimestamp || 0)) / 1000;
            const remaining = Math.max(0, this.timer.state().duration - elapsed);
            this.timer.updateState({ remaining });

            const currentSecond = Math.ceil(remaining); // Use ceil for more intuitive countdown
            if (remaining > 0) {
                if (this.lastTickSecond !== currentSecond) {
                    const countdownSettings = this.appSettingsService.getSettings().countdownSoundSeconds;
                    if (
                        countdownSettings &&
                        currentSecond >= 1 &&
                        currentSecond <= countdownSettings
                    ) {
                        this.audioService.playSound(AUDIO_TYPES.countdown);
                    } else if (currentSecond > 0) {
                        this.audioService.playSound(AUDIO_TYPES.pop);
                    }
                    this.lastTickSecond = currentSecond;
                }
                // Calculate ms until next full second
                const msToNextSecond = first
                    ? (1000 - (now % 1000))
                    : 1000;
                this.timerInterval = setTimeout(() => this.tick(), msToNextSecond);
            } else {
                this.pause();
                this.audioService.playSound(AUDIO_TYPES.end);
                this.lastTickSecond = null;
            }
        } else {
            // Stopwatch mode: increment remaining
            const elapsed = (Date.now() - (this.timer.state().startTimestamp || 0)) / 1000;
            this.timer.updateState({ remaining: elapsed });
            this.timerInterval = setTimeout(() => this.tick(), 100);
        }
    }

    private clearInterval() {
        if (this.timerInterval) {
            clearTimeout(this.timerInterval);
            this.timerInterval = null;
        }
    }

    pause() {
        this.timer.stop();
        this.clearInterval();
    }

    onClose() {
        this.isOpen = false;
        this.close.emit();
        this.clearInterval();
    }

    start() {
        if (this.timer.state().running) return;
        const now = Date.now();
        let duration = this.timer.state().duration;
        let remaining = this.timer.state().remaining;

        if (remaining > 0 && remaining < duration) {
            this.timer.updateState({
                running: true,
                startTimestamp: now - ((duration - remaining) * 1000)
            });
        } else {
            this.timer.updateState({
                running: true,
                startTimestamp: now,
                remaining: duration
            });
        }
        this.startInterval();
    }

    private startInterval() {
        this.clearInterval();
        this.tick(true); // Run immediately, align to next second
    }

    readonly circleRadius = 90;
    readonly circleCircumference = 2 * Math.PI * this.circleRadius;

    get strokeDashoffset(): number {
        const state = this.timer.state();
        return this.circleCircumference * (1 - state.remaining / state.duration);
    }
}