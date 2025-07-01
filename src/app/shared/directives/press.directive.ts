import { Directive, EventEmitter, HostListener, Output } from '@angular/core';

@Directive({
  selector: '[appPress]'
})
export class PressDirective {
  @Output() shortPress = new EventEmitter<Event>();
  @Output() longPress = new EventEmitter<Event>();

  private pressTimeout: any;
  private longPressFired = false;

  @HostListener('mousedown', ['$event'])
  @HostListener('touchstart', ['$event'])
  onPressStart(event: Event): void {
    this.longPressFired = false;
    this.pressTimeout = setTimeout(() => {
      this.longPressFired = true;
      this.longPress.emit(event);
    }, 500);
  }

  @HostListener('mouseup', ['$event'])
  // @HostListener('mouseleave', ['$event'])
  @HostListener('touchend', ['$event'])
  @HostListener('touchcancel', ['$event'])
  onPressEnd(event: Event): void {
    clearTimeout(this.pressTimeout);
    if (!this.longPressFired) {
      this.shortPress.emit(event);
    }
  }
}
