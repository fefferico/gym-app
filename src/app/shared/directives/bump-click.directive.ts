import { Directive, ElementRef, HostListener, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appBumpClick]',
  standalone: true,
})
export class BumpClickDirective {
  constructor(private el: ElementRef, private renderer: Renderer2) {}

  @HostListener('click') onClick() {
    // Add the animation class to the button that was clicked
    this.renderer.addClass(this.el.nativeElement, 'animate-bump-in');

    // Set a timeout to remove the class after the animation completes.
    // This is crucial so the animation can be triggered again on the next click.
    setTimeout(() => {
      this.renderer.removeClass(this.el.nativeElement, 'animate-bump-in');
    }, 300); // This duration MUST match the animation duration in your SCSS
  }
}