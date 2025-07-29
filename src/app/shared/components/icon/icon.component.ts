// src/app/shared/components/icon/icon.component.ts

import { Component, Input, OnChanges, SimpleChanges, ElementRef, Renderer2, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconRegistryService } from '../../../core/services/icon-registry.service';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: '', // The template is empty; we add content programmatically.
  styleUrls: ['./icon.component.scss']
})
export class IconComponent implements OnChanges {
  private registry = inject(IconRegistryService);
  private el: HTMLElement = inject(ElementRef).nativeElement;
  private renderer = inject(Renderer2);

  @Input() name?: string;
  @Input() strokeWidth?: number | string;
  @Input() class?: string;

  ngOnChanges(changes: SimpleChanges): void {
    this.updateIcon();
  }

  private updateIcon(): void {
    // 1. Clear any existing SVG
    this.el.innerHTML = '';

    if (!this.name) {
      return;
    }

    // 2. Get the raw SVG string
    const svgString = this.registry.getIconString(this.name);
    if (!svgString) {
      return;
    }

    // 3. Create the SVG element from the string
    const tempDiv = this.renderer.createElement('div');
    this.renderer.setProperty(tempDiv, 'innerHTML', svgString);
    const svgElement = tempDiv.querySelector('svg');

    if (svgElement) {
      // 4. Apply attributes and styles
      if (this.class) {
        this.renderer.setAttribute(svgElement, 'class', this.class);
      }
      
      // --- THIS IS THE FIX ---
      // Use setStyle to apply stroke-width as an inline CSS style.
      if (this.strokeWidth !== undefined && this.strokeWidth !== null && svgElement.children) {
        this.renderer.setStyle(svgElement.children[0], 'stroke-width', this.strokeWidth.toString());
      }
      // --- END OF FIX ---
      
      this.renderer.setAttribute(svgElement, 'aria-hidden', 'true');

      // 5. Append the fully configured SVG to the component's host
      this.renderer.appendChild(this.el, svgElement);
    }
  }
}