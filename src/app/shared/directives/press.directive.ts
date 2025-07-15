// press.directive.ts - FINAL VERSION

import { Directive, ElementRef, EventEmitter, HostListener, Output, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appPress]'
})
export class PressDirective {
  @Output() shortPress = new EventEmitter<Event>();
  @Output() longPress = new EventEmitter<Event>();
  @Output() pressRelease = new EventEmitter<Event>(); // Fired on mouseup/touchend ALWAYS

  private timeoutId: any;
  private isLongPress = false;

  constructor(private el: ElementRef, private renderer: Renderer2) { }

  @HostListener('mousedown')
  @HostListener('touchstart', ['$event'])
  onPressStart(event?: Event): void {
    // Prevent context menu on mobile
    event?.preventDefault();

    this.isLongPress = false;

    this.renderer.addClass(this.el.nativeElement, 'is-pressed');
    if (navigator.vibrate) {
      navigator.vibrate(50); // Vibrate for 50 milliseconds
    }

    this.timeoutId = setTimeout(() => {
      this.isLongPress = true;
      this.longPress.emit();
    }, 500);
  }

    @HostListener('mouseup', ['$event'])
    @HostListener('mouseleave', ['$event'])
    @HostListener('touchend', ['$event'])
    @HostListener('touchcancel', ['$event'])
    onPressEnd(event?: Event): void { 
    clearTimeout(this.timeoutId);
    this.renderer.removeClass(this.el.nativeElement, 'is-pressed');
    // Check if the event is a mouseleave event
    // Angular HostListener does not pass event by default for mouseup/mouseleave
    // So, to detect mouseleave, you need to add ['$event'] to HostListener and accept event param

    document.querySelectorAll('.is-pressed').forEach(el => {
      el.classList.remove('is-pressed');
    });
    if (event?.type === 'mouseleave') {
      return;
    }

    // Only emit shortPress if a longPress hasn't already been fired.
    if (!this.isLongPress) {
      this.shortPress.emit(event);
    }
    
    // ALWAYS emit that the press has been released.
    this.pressRelease.emit(event);
  }
}