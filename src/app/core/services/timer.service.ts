import { Injectable, signal, computed } from '@angular/core';

export type TimerMode = 'timer' | 'stopwatch';

export interface TimerState {
    mode: TimerMode;
    duration: number; // seconds (for timer)
    remaining: number; // seconds
    running: boolean;
    startTimestamp?: number;
    preferredCountdowns: number[]; // user-saved durations in seconds
}

@Injectable({ providedIn: 'root' })
export class TimerService {
    private _state = signal<TimerState>({
        mode: 'timer',
        duration: 60,
        remaining: 60,
        running: false,
        preferredCountdowns: [30, 60, 90, 120],
    });

    readonly state = computed(() => this._state());

    setMode(mode: TimerMode) {
        this._state.update(s => ({ ...s, mode }));
    }

    setDuration(seconds: number) {
        this._state.update(s => ({ ...s, duration: seconds, remaining: seconds }));
    }

    start() {
        if (this._state().running) return;
        this._state.update(s => ({
            ...s,
            running: true,
            startTimestamp: Date.now(),
            remaining: s.duration,
        }));
        this.tick();
    }

    private tick() {
        if (!this._state().running) return;
        if (this._state().mode === 'timer') {
            const elapsed = (Date.now() - (this._state().startTimestamp || 0)) / 1000;
            const remaining = Math.max(0, this._state().duration - elapsed);
            this._state.update(s => ({ ...s, remaining }));
            if (remaining > 0) {
                setTimeout(() => this.tick(), 100);
            } else {
                this.stop();
            }
        } else {
            // Stopwatch mode
            const elapsed = (Date.now() - (this._state().startTimestamp || 0)) / 1000;
            this._state.update(s => ({ ...s, remaining: elapsed }));
            setTimeout(() => this.tick(), 100);
        }
    }

    stop() {
        this._state.update(s => ({ ...s, running: false }));
    }

    reset() {
        this._state.update(s => ({
            ...s,
            running: false,
            remaining: s.duration,
            startTimestamp: undefined,
        }));
    }

    savePreferredCountdown(seconds: number) {
        const prefs = this._state().preferredCountdowns;
        if (!prefs.includes(seconds)) {
            this._state.update(s => ({
                ...s,
                preferredCountdowns: [...prefs, seconds].sort((a, b) => a - b),
            }));
        }
    }

    updateState(partial: Partial<TimerState>) {
        this._state.update(s => ({ ...s, ...partial }));
    }
}