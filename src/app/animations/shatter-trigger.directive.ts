import { Directive, HostListener } from '@angular/core';
import { ShatterableDirective } from './shatterable.directive';

@Directive({
  selector: '[appShatterTrigger]',
  standalone: true // For modern Angular apps
})
export class ShatterTriggerDirective {

  // Angular injects the ShatterableDirective from the parent element
  constructor(private shatterable: ShatterableDirective) {}

  @HostListener('click')
  onClick(): void {
    // Call the public shatter() method on the parent directive
    this.shatterable.shatter();
  }
}