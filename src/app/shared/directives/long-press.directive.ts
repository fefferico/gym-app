// src/app/shared/directives/long-press.directive.ts
import { Directive, Output, EventEmitter, HostListener, Input, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { Subject } from 'rxjs';

@Directive({
  selector: '[appLongPress]',
  standalone: true,
})
export class LongPressDirective implements OnDestroy {
  @Input() longPressDuration: number = 500; // ms
  @Input() preventDefaultTouch: boolean = true; // New input to control preventDefault

  @Output() longPressStart = new EventEmitter<TouchEvent | MouseEvent>();
  @Output() longPressEnd = new EventEmitter<void>();
  @Output() shortTap = new EventEmitter<TouchEvent | MouseEvent>();
  @Output() longPress = new EventEmitter<TouchEvent | MouseEvent>();

  private pressTimeoutId: any;
  private isPressing: boolean = false;
  private hasLongPressed: boolean = false;
  private initialTouchY: number | null = null; // For scroll prevention logic
  private initialTouchX: number | null = null; // For scroll prevention logic
  private wasScrolled: boolean = false; // Flag to check if scroll occurred during press

  private destroy$ = new Subject<void>();

  constructor(private elRef: ElementRef, private renderer: Renderer2) {}

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    this.commonPressStart(event);
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    this.initialTouchY = event.touches[0].clientY;
    this.initialTouchX = event.touches[0].clientX;
    this.wasScrolled = false;

    // Conditionally prevent default to allow drag initiation but stop scroll
    // This is the critical part for preventing scroll *during* the hold
    if (this.preventDefaultTouch) {
        // We don't call preventDefault() immediately here.
        // Instead, we might call it within the timeout if a long press is detected,
        // or if cdkDrag needs it to start.
        // However, for cdkDrag with a handle, often you don't need to preventDefault in the directive.
        // The cdkDragHandle itself should manage this.
        // Let's remove immediate preventDefault here and rely on cdkDrag's behavior.
    }
    this.commonPressStart(event);
  }

  // Added touchmove listener to detect scroll
  @HostListener('touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (!this.isPressing || this.initialTouchY === null || this.initialTouchX === null) {
      return;
    }
    const deltaY = Math.abs(event.touches[0].clientY - this.initialTouchY);
    const deltaX = Math.abs(event.touches[0].clientX - this.initialTouchX);

    // If significant movement (potential scroll), cancel the long press.
    // Threshold can be adjusted.
    if (deltaY > 10 || deltaX > 10) {
      this.wasScrolled = true;
      this.clearPressTimeout(); // Cancel long press if scrolling starts
      // Note: We are not calling onPressEnd here yet, as the touch might continue for scrolling.
      // cdkDrag itself might also cancel if it detects scroll before its delay.
    }
  }


  private commonPressStart(event: TouchEvent | MouseEvent): void {
    this.isPressing = true;
    this.hasLongPressed = false;

    this.clearPressTimeout(); // Clear any existing timeout

    this.pressTimeoutId = setTimeout(() => {
      if (this.isPressing && !this.wasScrolled) { // Only fire if still pressing AND no scroll detected
        this.hasLongPressed = true;
        this.longPressStart.emit(event);
        // Example: Add a class for visual feedback
        // this.renderer.addClass(this.elRef.nativeElement, 'long-pressing');
      }
    }, this.longPressDuration);
  }

  @HostListener('mouseup')
  @HostListener('mouseleave')
  @HostListener('touchend')
  @HostListener('touchcancel')
  onPointerUpOrLeave(event?: MouseEvent | TouchEvent): void { // Make event optional for mouseleave
    this.clearPressTimeout();

    if (this.isPressing) {
      // Only emit shortTap if it wasn't a long press AND no significant scroll occurred
      if (!this.hasLongPressed && !this.wasScrolled && event) {
        this.shortTap.emit(event);
      }
      this.longPressEnd.emit(); // Always emit longPressEnd to signify the interaction attempt is over
    }

    this.isPressing = false;
    this.hasLongPressed = false;
    this.initialTouchY = null;
    this.initialTouchX = null;
    this.wasScrolled = false;
    // this.renderer.removeClass(this.elRef.nativeElement, 'long-pressing');
  }
  
  private clearPressTimeout(): void {
    if (this.pressTimeoutId) {
      clearTimeout(this.pressTimeoutId);
      this.pressTimeoutId = null;
    }
  }

  ngOnDestroy(): void {
    this.clearPressTimeout();
    this.destroy$.next();
    this.destroy$.complete();
  }
}