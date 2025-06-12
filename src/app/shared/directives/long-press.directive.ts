// long-press.directive.ts
import {
  Directive,
  EventEmitter,
  HostListener,
  Output,
} from '@angular/core';

@Directive({
  selector: '[appLongPress]',
})
export class LongPressDirective {
  @Output() longPress = new EventEmitter<MouseEvent | TouchEvent>();

  private pressTimer: any;
  private readonly longPressDuration = 500; // milliseconds

  @HostListener('mousedown', ['$event'])
  @HostListener('touchstart', ['$event'])
  onPressStart(event: MouseEvent | TouchEvent) {
    this.clearTimeout(); // Just in case

    this.pressTimer = setTimeout(() => {
      this.longPress.emit(event);
    }, this.longPressDuration);
  }

  @HostListener('mouseup')
  @HostListener('mouseleave')
  @HostListener('touchend')
  @HostListener('touchcancel')
  onPressEnd() {
    this.clearTimeout();
  }

  private clearTimeout() {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }
}
