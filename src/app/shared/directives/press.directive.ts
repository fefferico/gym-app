
import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appPress]'
})
export class PressDirective implements OnDestroy, OnInit {
  @Input() pressDisabled: boolean = false;
  @Output() shortPress = new EventEmitter<Event>();
  @Output() longPress = new EventEmitter<Event>();
  @Output() pressRelease = new EventEmitter<Event>();

  private timeoutId: any;
  private isLongPress = false;

  // Store bound function references for proper cleanup
  private boundOnPressStart: (event: Event) => void;
  private boundOnPressEnd: (event: Event) => void;

  private unlistenFunctions: (() => void)[] = [];

  constructor(private el: ElementRef, private renderer: Renderer2) {
    this.boundOnPressStart = this.onPressStart.bind(this);
    this.boundOnPressEnd = this.onPressEnd.bind(this);
  }

  ngOnInit(): void {
    // Mouse events via Renderer2
    this.unlistenFunctions.push(
      this.renderer.listen(this.el.nativeElement, 'mousedown', this.boundOnPressStart)
    );

    // Touch events with passive: false to allow preventDefault()
    this.el.nativeElement.addEventListener('touchstart', this.boundOnPressStart, { passive: false });

    // End events
    const endEvents = ['mouseup', 'mouseleave', 'touchend', 'touchcancel'];
    endEvents.forEach(event => {
      this.unlistenFunctions.push(
        this.renderer.listen(this.el.nativeElement, event, this.boundOnPressEnd)
      );
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timeoutId);
    this.unlistenFunctions.forEach(unlisten => unlisten());
    this.el.nativeElement.removeEventListener('touchstart', this.boundOnPressStart);
  }


  onPressStart(event: Event): void {
    if (this.el.nativeElement.disabled) {
      event.preventDefault(); // Also prevent default behavior
      return;
    }
    if (this.pressDisabled) return;

    event.stopPropagation();
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
    if (this.pressDisabled) return;
    event.stopPropagation();
    clearTimeout(this.timeoutId);
    this.renderer.removeClass(this.el.nativeElement, 'is-pressed');

    if (!this.isLongPress && event.type !== 'mouseleave' && event.type !== 'touchcancel') {
      this.shortPress.emit(event);
    }

    this.pressRelease.emit(event);
  }
}