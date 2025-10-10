import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class SpinnerService {
  private loadingCount = 0;
  private isLoading = new BehaviorSubject<boolean>(false);
  private loadingMessage = new BehaviorSubject<string | null>(null);
  private activeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private translate = inject(TranslateService);

  public readonly loading$: Observable<boolean> = this.isLoading.asObservable();
  public readonly message$: Observable<string | null> = this.loadingMessage.asObservable();

  constructor() { }

  show(message: string | null = null, timeout: number = 6000, timeoutMessageKey: string = 'spinnerService.timeoutMessage'): void {
    this.loadingCount++;
    if (this.loadingCount === 1) {
      this.isLoading.next(true);
    }

    this.loadingMessage.next(message);

    if (this.activeTimeoutId) {
      clearTimeout(this.activeTimeoutId);
      this.activeTimeoutId = null;
    }

    const timeoutMessage = this.translate.instant(timeoutMessageKey);

    if (typeof timeout === 'number' && timeout > 0 && typeof timeoutMessage === 'string') {
      this.activeTimeoutId = setTimeout(() => {
        if (this.isLoading.value) {
          const currentMessage = message ? `${message} (${timeoutMessage})` : timeoutMessage;
          this.loadingMessage.next(currentMessage);
        }
        this.activeTimeoutId = null;
      }, timeout);
    }
  }

  hide(): void {
    if (this.loadingCount > 0) {
      this.loadingCount--;
    }
    if (this.loadingCount === 0) {
      this.isLoading.next(false);
      this.loadingMessage.next(null);
      if (this.activeTimeoutId) {
        clearTimeout(this.activeTimeoutId);
        this.activeTimeoutId = null;
      }
    }
  }

  reset(): void {
    this.loadingCount = 0;
    this.isLoading.next(false);
    this.loadingMessage.next(null);
    if (this.activeTimeoutId) {
      clearTimeout(this.activeTimeoutId);
      this.activeTimeoutId = null;
    }
  }
}