// --- START OF FILE long-press.directive.ts ---

import { Directive, ElementRef, Input, OnInit, OnDestroy, Renderer2, Output, EventEmitter } from '@angular/core';

@Directive({
  selector: '[appLongPressDrag]', // The selector for your directive
  standalone: true,
})
export class LongPressDragDirective implements OnInit, OnDestroy {
  @Input() longPressEnabled = true;
  @Input() longPressDelay = 300;
  @Input() longPressClass = 'is-long-pressing';
  @Input() dragHandleSelector?: string;
  @Input() classTargetSelector?: string;

  @Output() longPress = new EventEmitter<void>();

  private timer: any;
  private isPressing = false;

  // We need stable references to our event handlers for proper cleanup.
  private readonly mouseDownHandler: (event: MouseEvent) => void;
  private readonly touchStartHandler: (event: TouchEvent) => void;
  private readonly pressEndHandler: () => void;

  constructor(private renderer: Renderer2, private el: ElementRef) {
    // We bind the handlers once in the constructor to maintain the 'this' context.
    this.mouseDownHandler = this.onMouseDown.bind(this);
    this.touchStartHandler = this.onTouchStart.bind(this);
    this.pressEndHandler = this.onPressEnd.bind(this);
  }

  ngOnInit(): void {
    // Add event listeners manually to control their options and prevent conflicts.
    const element = this.el.nativeElement;

    // Add MOUSE listeners
    element.addEventListener('mousedown', this.mouseDownHandler);
    element.addEventListener('mouseup', this.pressEndHandler);
    element.addEventListener('mouseleave', this.pressEndHandler);

    // Add TOUCH listeners with the crucial 'passive: false' option
    element.addEventListener('touchstart', this.touchStartHandler, { passive: false });
    element.addEventListener('touchend', this.pressEndHandler);
    element.addEventListener('touchcancel', this.pressEndHandler);
  }

  onMouseDown(event: MouseEvent): void {
    if (!this.longPressEnabled || event.button !== 0) return;

    // --- ALIGNMENT LOGIC ---
    // If a handle selector is defined, check if the press started on the handle.
    if (this.dragHandleSelector) {
      if (!(event.target as HTMLElement).closest(this.dragHandleSelector)) {
        // If the press did NOT start on the handle, ignore it and do nothing.
        return;
      }
    }
    // --- END ALIGNMENT ---
    
    // If the check passes (or no handle is defined), start the timer.
    this.startTimer();
  }

  onTouchStart(event: TouchEvent): void {
    if (!this.longPressEnabled) return;
    
    // --- ALIGNMENT LOGIC ---
    // Same check for touch events.
    if (this.dragHandleSelector) {
      if (!(event.target as HTMLElement).closest(this.dragHandleSelector)) {
        return;
      }
    }
    // --- END ALIGNMENT ---
    
    this.startTimer();
  }

private startTimer(): void {
    this.isPressing = true;
    this.timer = setTimeout(() => {
      if (this.isPressing) {
        // SIMPLIFIED: Always add class to the host element
        this.renderer.addClass(this.el.nativeElement, this.longPressClass);
        this.longPress.emit();
      }
    }, this.longPressDelay);
  }

  private onPressEnd(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isPressing = false;
    this.renderer.removeClass(this.el.nativeElement, this.longPressClass);
  }

  ngOnDestroy(): void {
    // Manually remove all event listeners we added to prevent memory leaks.
    const element = this.el.nativeElement;

    element.removeEventListener('mousedown', this.mouseDownHandler);
    element.removeEventListener('mouseup', this.pressEndHandler);
    element.removeEventListener('mouseleave', this.pressEndHandler);
    
    element.removeEventListener('touchstart', this.touchStartHandler);
    element.removeEventListener('touchend', this.pressEndHandler);
    element.removeEventListener('touchcancel', this.pressEndHandler);

    // Also clear any running timer
    this.onPressEnd();
  }
}