import { Directive, ElementRef, EventEmitter, HostListener, Output, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appPress]'
})
export class PressDirective {
  @Output() shortPress = new EventEmitter<Event>();
  @Output() longPress = new EventEmitter<Event>();
  @Output() pressRelease = new EventEmitter<Event>();

  private timeoutId: any;
  private isLongPress = false;
  private isScrolling = false;
  private startY = 0;
  private startX = 0;

  constructor(private el: ElementRef, private renderer: Renderer2) { }

  @HostListener('mousedown', ['$event'])
  @HostListener('touchstart', ['$event'])
  onPressStart(event: MouseEvent | TouchEvent): void {
    // Prevent context menu on mobile
    if (event instanceof TouchEvent) {
      this.startY = event.touches[0].clientY;
      this.startX = event.touches[0].clientX;
    }

    this.isLongPress = false;
    this.isScrolling = false;

    this.renderer.addClass(this.el.nativeElement, 'is-pressed');
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    this.timeoutId = setTimeout(() => {
      this.isLongPress = true;
      if (!this.isScrolling) {
        this.longPress.emit(event);
      }
    }, 500);
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (this.isScrolling) {
      return;
    }

    const y = event.touches[0].clientY;
    const x = event.touches[0].clientX;
    const yDiff = Math.abs(y - this.startY);
    const xDiff = Math.abs(x - this.startX);

    // If movement is more than a few pixels, treat it as a scroll
    if (yDiff > 10 || xDiff > 10) {
      this.isScrolling = true;
      clearTimeout(this.timeoutId);
      this.renderer.removeClass(this.el.nativeElement, 'is-pressed');
    }
  }

  @HostListener('mouseup', ['$event'])
  @HostListener('touchend', ['$event'])
  @HostListener('touchcancel', ['$event'])
  onPressEnd(event: Event): void {
    clearTimeout(this.timeoutId);
    this.renderer.removeClass(this.el.nativeElement, 'is-pressed');

    document.querySelectorAll('.is-pressed').forEach(el => {
      el.classList.remove('is-pressed');
    });

    if (event.type === 'mouseleave' || this.isScrolling) {
      this.isScrolling = false; // Reset for next touch
      return;
    }

    if (!this.isLongPress) {
      this.shortPress.emit(event);
    }

    this.pressRelease.emit(event);
  }
}