// press-scroll.directive.ts - FINAL CORRECTED VERSION

import { Directive, ElementRef, EventEmitter, HostListener, Input, Output, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appPressScroll]'
})
export class PressScrollDirective {
  @Input() pressDisabled: boolean = false;
  @Output() shortPress = new EventEmitter<Event>();
  @Output() longPress = new EventEmitter<Event>();
  @Output() pressRelease = new EventEmitter<Event>();

  private timeoutId: any;
  private isLongPress = false;
  private isScrolling = false;
  private startX = 0;
  private startY = 0;
  private readonly scrollThreshold = 10;

  constructor(private el: ElementRef, private renderer: Renderer2) { }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: Event): void {
    event.preventDefault();
  }

  @HostListener('mousedown', ['$event'])
  @HostListener('touchstart', ['$event'])
  onPressStart(event: MouseEvent | TouchEvent): void {
    if (this.pressDisabled) {
      return; // Do nothing if the directive is disabled
    }
    if (event instanceof TouchEvent) {
      this.startX = event.touches[0].clientX;
      this.startY = event.touches[0].clientY;
    }

    this.isLongPress = false;
    this.isScrolling = false;

    this.renderer.addClass(this.el.nativeElement, 'is-pressed');
    
    // VIBRATION LOGIC MOVED FROM HERE...

    this.timeoutId = setTimeout(() => {
      this.isLongPress = true;

      // ...TO HERE (for long press)
      // Vibrate when the long press is officially detected.
      if (navigator.vibrate) {
        navigator.vibrate(50); // Use a distinct vibration for long press if desired, e.g., [100, 50, 100]
      }
      
      this.longPress.emit(event);
    }, 500);
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (this.isLongPress || this.isScrolling) {
      return;
    }

    const currentX = event.touches[0].clientX;
    const currentY = event.touches[0].clientY;
    const deltaX = Math.abs(this.startX - currentX);
    const deltaY = Math.abs(this.startY - currentY);

    if (deltaX > this.scrollThreshold || deltaY > this.scrollThreshold) {
      this.isScrolling = true;
      clearTimeout(this.timeoutId);
      this.renderer.removeClass(this.el.nativeElement, 'is-pressed');
    }
  }

  @HostListener('mouseup', ['$event'])
  @HostListener('mouseleave', ['$event'])
  @HostListener('touchend', ['$event'])
  @HostListener('touchcancel', ['$event'])
  onPressEnd(event: Event): void {
    clearTimeout(this.timeoutId);
    this.renderer.removeClass(this.el.nativeElement, 'is-pressed');

    document.querySelectorAll('.is-pressed').forEach(el => {
      el.classList.remove('is-pressed');
    });

    if (event.type === 'mouseleave' || event.type === 'touchcancel' || this.isScrolling) {
      this.isScrolling = false;
      return;
    }

    if (!this.isLongPress) {
      // AND HERE (for short press)
      // Vibrate right before emitting the short press event.
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      this.shortPress.emit(event);
    }

    this.pressRelease.emit(event);
  }
}