// press.directive.ts - FINAL VERSION

import { Directive, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appPress]'
})
export class PressDirective implements OnDestroy, OnInit {
  @Input() pressDisabled: boolean = false;
  @Output() shortPress = new EventEmitter<Event>();
  @Output() longPress = new EventEmitter<Event>();
  @Output() pressRelease = new EventEmitter<Event>(); // Fired on mouseup/touchend ALWAYS

  private timeoutId: any;
  private isLongPress = false;
  private unlistenFunctions: (() => void)[] = [];

  constructor(private el: ElementRef, private renderer: Renderer2) { }

  ngOnInit(): void {
    // --- THIS IS THE FIX ---

    // For mouse, Renderer2 is fine.
    this.unlistenFunctions.push(
      this.renderer.listen(this.el.nativeElement, 'mousedown', this.onPressStart.bind(this))
    );

    // For touch, we use the native method to explicitly set passive: false.
    // The redundant and problematic renderer.listen for 'touchstart' has been REMOVED.
    this.el.nativeElement.addEventListener('touchstart', this.onPressStart.bind(this), { passive: false });


    // End Events (mouseup, touchend, etc.) are non-blocking, so Renderer2 is fine.
    const endEvents = ['mouseup', 'mouseleave', 'touchend', 'touchcancel'];
    endEvents.forEach(event => {
      this.unlistenFunctions.push(
        this.renderer.listen(this.el.nativeElement, event, this.onPressEnd.bind(this))
      );
    });
  }

  ngOnDestroy(): void {
    // Clean up all the listeners when the directive is destroyed
    this.unlistenFunctions.forEach(unlisten => unlisten());
    // Also explicitly remove the manually added touchstart listener to prevent memory leaks
    this.el.nativeElement.removeEventListener('touchstart', this.onPressStart.bind(this));
  }

  onPressStart(event: Event): void {
    if (this.pressDisabled) return;

    // We still need this to prevent the context menu on a long press on mobile
    event.preventDefault();

    this.isLongPress = false;
    this.renderer.addClass(this.el.nativeElement, 'is-pressed');
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    this.timeoutId = setTimeout(() => {
      this.isLongPress = true;
      this.longPress.emit(event);
    }, 500);
  }

  onPressEnd(event: Event): void {
    clearTimeout(this.timeoutId);
    this.renderer.removeClass(this.el.nativeElement, 'is-pressed');

    // Remove the class from any element in the unlikely case it gets stuck
    document.querySelectorAll('.is-pressed').forEach(el => {
      this.renderer.removeClass(el, 'is-pressed');
    });

    if (event.type === 'mouseleave' || event.type === 'touchcancel') {
      // If the user's finger/mouse leaves the button, we cancel the press
      // but still fire the release event.
    } else {
      // Only emit shortPress if it was a valid release on the button
      // and a longPress hasn't already been fired.
      if (!this.isLongPress) {
        this.shortPress.emit(event);
      }
    }

    // ALWAYS emit that the press has been released.
    this.pressRelease.emit(event);
  }
}