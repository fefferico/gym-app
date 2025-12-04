import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-masked-icon',
  standalone: true,
  imports: [CommonModule],
  template: '', // No template needed, the host element IS the icon
  styles: [`
    :host {
      display: block;
      background-color: currentColor; /* The magic that takes the text color */
      
      /* Standard Mask Properties */
      mask-size: contain;
      mask-repeat: no-repeat;
      mask-position: center;
      
      /* Webkit Prefixes for Safari/Chrome compatibility */
      -webkit-mask-size: contain;
      -webkit-mask-repeat: no-repeat;
      -webkit-mask-position: center;
    }
  `],
  host: {
    // Bind the input src to the CSS mask property dynamically
    '[style.mask-image]': '"url(" + src + ")"',
    '[style.-webkit-mask-image]': '"url(" + src + ")"'
  }
})
export class MaskedIconComponent {
  /**
   * The URL of the SVG icon.
   */
  @Input({ required: true }) src!: string | null; // Allow null for async pipe compatibility
}