import { Directive, ElementRef, Output, EventEmitter, HostListener, inject } from '@angular/core';

@Directive({
  selector: '[appClickOutside]',
  standalone: true
})
export class ClickOutsideDirective {
  private elementRef = inject(ElementRef);

  @Output() clickOutside = new EventEmitter<Event>();

  // Listen for the full event object now
  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: MouseEvent): void {
    // 1. Get the target from the event
    const target = event.target;

    // 2. THIS IS THE TYPE GUARD:
    //    Check if the target is a valid Node and if the directive's element contains it.
    //    `instanceof Node` is a safe way to ensure we have a DOM node.
    if (target instanceof Node && !this.elementRef.nativeElement.contains(target)) {
      // If the click was outside, emit the event
      this.clickOutside.emit(event);
    }
  }
}