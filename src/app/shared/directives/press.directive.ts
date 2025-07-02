// press.directive.ts - FINAL VERSION

import { Directive, EventEmitter, HostListener, Output } from '@angular/core';

@Directive({
  selector: '[appPress]'
})
export class PressDirective {
  @Output() shortPress = new EventEmitter<Event>();
  @Output() longPress = new EventEmitter<Event>();
  @Output() pressRelease = new EventEmitter<Event>(); // Fired on mouseup/touchend ALWAYS

  private timeoutId: any;
  private isLongPress = false;

  @HostListener('mousedown')
  @HostListener('touchstart', ['$event'])
  onPressStart(event?: Event): void {
    // Prevent context menu on mobile
    event?.preventDefault();

    this.isLongPress = false;
    
    this.timeoutId = setTimeout(() => {
      this.isLongPress = true;
      this.longPress.emit();
    }, 500);
  }

  @HostListener('mouseup')
  // @HostListener('mouseleave')
  @HostListener('touchend')
  @HostListener('touchcancel')
  onPressEnd(): void {
    clearTimeout(this.timeoutId);

    // Only emit shortPress if a longPress hasn't already been fired.
    if (!this.isLongPress) {
      this.shortPress.emit();
    }
    
    // ALWAYS emit that the press has been released.
    this.pressRelease.emit();
  }
}