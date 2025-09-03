// src/app/shared/components/icon/icon.component.ts

import { Component, Input, OnChanges, SimpleChanges, ElementRef, Renderer2, inject, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconRegistryService } from '../../../core/services/icon-registry.service';

export type IconPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';

// +++ 1. UPDATE THE INTERFACE with `display` property +++
export interface IconLayer {
  name: string; // Use 'none' for a layer with no icon (e.g., a notification dot)
  class?: string; // For custom colors, overrides, etc. (e.g., 'bg-red-500 text-white')
  position?: IconPosition;
  size?: string; // e.g., 'w-2/3 h-2/3'
  strokeWidth?: number | string;
  offset?: boolean; // If the overlay should be offset from the corner
  display?: 'filled' | 'inverted' | 'badge' | 'filled-padded'; 
}

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: '',
  styleUrls: ['./icon.component.scss']
})
export class IconComponent implements OnChanges {
  private registry = inject(IconRegistryService);
  private el: HTMLElement = inject(ElementRef).nativeElement;
  private renderer = inject(Renderer2);

  @Input() name?: string | IconLayer | (string | IconLayer)[];
  @Input() strokeWidth?: number | string;

  // This will hold the final classes applied to the host
  @HostBinding('class') hostClasses?: string;
  
  // The raw class input from the user
  @Input() class?: string;

  ngOnChanges(changes: SimpleChanges): void {
    // We now check for changes to 'class' as well
    if (changes['name'] || changes['strokeWidth'] || changes['class']) {
      this.applyHostClasses(); // Apply host classes first
      this.updateIcon();     // Then render the SVG content
    }
  }
  
  /**
   * NEW: This method prepares the host classes.
   * It adds a default size if no 'w-' or 'h-' class is provided by the user.
   */
  private applyHostClasses(): void {
    let classes = this.class || '';

    // Check if a width OR height class is missing
    const hasWidth = /w-\[?[\w\/-]+\]?/.test(classes); // Matches w-6, w-full, w-1/2, etc.
    const hasHeight = /h-\[?[\w\/-]+\]?/.test(classes); // Matches h-6, h-full, h-1/2, etc.

    if (!hasWidth && !hasHeight) {
      // Add a default size if none is specified
      classes = 'w-6 h-6 ' + classes;
    }
    
    this.hostClasses = classes.trim();
  }

  private updateIcon(): void {
    this.el.innerHTML = '';
    if (!this.name) return;
    const layers: IconLayer[] = this.normalizeLayers();
    layers.forEach((layer, index) => this.renderLayer(layer, index === 0));
  }

  private normalizeLayers(): IconLayer[] {
    if (!this.name) return [];
    const inputAsArray = Array.isArray(this.name) ? this.name : [this.name];
    return inputAsArray.map(item => (typeof item === 'string' ? { name: item } : item));
  }

  /**
   * +++ 2. UPDATE renderLayer to handle presets and icon-less layers +++
   */
  private renderLayer(layer: IconLayer, isBase: boolean): void {
    let elementToRender: HTMLElement;

    // If the name is 'none', create a simple <div> for badges/backgrounds.
    if (layer.name === 'none') {
      elementToRender = this.renderer.createElement('div');
    } else {
      // Otherwise, create an SVG element like before.
      const svgString = this.registry.getIconString(layer.name);
      if (!svgString) return;
      const tempDiv = this.renderer.createElement('div');
      tempDiv.innerHTML = svgString;
      const svgElement = tempDiv.querySelector('svg');
      if (!svgElement) return;
      elementToRender = svgElement;

      this.renderer.removeAttribute(svgElement, 'width');
      this.renderer.removeAttribute(svgElement, 'height');

      const strokeTarget = layer.strokeWidth ?? this.strokeWidth;
      if (strokeTarget !== undefined && svgElement.children) {
        for (const child of Array.from(svgElement.children)) {
          this.renderer.setStyle(child, 'stroke-width', strokeTarget.toString());
        }
      }
    }

    const combinedClasses = this.buildLayerClasses(layer, isBase);
    this.renderer.setAttribute(elementToRender, 'class', combinedClasses);
    this.renderer.setAttribute(elementToRender, 'aria-hidden', 'true');
    this.renderer.appendChild(this.el, elementToRender);
  }

  private buildLayerClasses(layer: IconLayer, isBase: boolean): string {
    const classes = ['absolute'];
    if (isBase) {
      classes.push('w-full', 'h-full');
    } else {
      classes.push(this.getPositionClass(layer));
      classes.push(layer.size || 'w-1/2 h-1/2');
    }

    // +++ 3. ADD PRESET CLASSES +++
    classes.push(this.getDisplayPresetClasses(layer.display));

    if (layer.class) classes.push(layer.class);
    
    return classes.join(' ');
  }

  /**
   * +++ 4. NEW METHOD to map presets to CSS classes +++
   */
  private getDisplayPresetClasses(display?: 'filled' | 'inverted' | 'badge' | 'filled-padded'): string {
    switch (display) {
      case 'filled':
        return 'flex items-center justify-center rounded-full';
      case 'inverted':
        return 'flex items-center justify-center rounded-full bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100';
      case 'badge':
        return 'block rounded-full';
      
      // +++ NEW CASE HERE +++
      case 'filled-padded':
        // It's the same as 'filled', but with a scale transform to make it larger.
        return 'flex items-center justify-center rounded-full scale-125';
      
      default:
        return '';
    }
  }

  private getPositionClass(layer: IconLayer): string {
    // This logic remains the same from the previous step
    let positionClasses = '';
    switch (layer.position) {
      case 'top-right': 
        positionClasses = 'top-0 right-0';
        if (layer.offset) positionClasses += ' translate-x-1/4 -translate-y-1/4';
        break;
      case 'top-left': 
        positionClasses = 'top-0 left-0';
        if (layer.offset) positionClasses += ' -translate-x-1/4 -translate-y-1/4';
        break;
      case 'bottom-left': 
        positionClasses = 'bottom-0 left-0';
        if (layer.offset) positionClasses += ' -translate-x-1/4 translate-y-1/4';
        break;
      case 'center': 
        positionClasses = 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
        break;
      case 'bottom-right':
      default:
        positionClasses = 'bottom-0 right-0';
        if (layer.offset) positionClasses += ' translate-x-1/4 translate-y-1/4';
        break;
    }
    return positionClasses;
  }
}

// The display: 'inverted' preset provides a default white background. You can override the icon color using class.

// <app-icon 
//   [name]="[
//     { name: 'link' }, 
//     { 
//       name: 'plus-circle', 
//       position: 'bottom-right',
//       size: 'w-2/3 h-2/3',
//       offset: true,
//       display: 'inverted',
//       class: 'text-blue-600 dark:text-blue-500' 
//     }
//   ]"
//   class="w-8 h-8 text-gray-200">
// </app-icon>

// Use name: 'none' to create a layer that is just a shape. The badge preset makes it a circle, and you provide the color.
// code
// Html
// <app-icon 
//   [name]="[
//     { name: 'bell' }, 
//     { 
//       name: 'none', 
//       position: 'top-right',
//       size: 'w-1/3 h-1/3',
//       display: 'badge',
//       class: 'bg-red-500 border-2 border-gray-800'
//     }
//   ]"
//   class="w-8 h-8 text-gray-200">
// </app-icon>

// Use the filled preset to create a solid background circle and apply colors with the class property.
// code
// Html
// <app-icon 
//   [name]="[
//     { 
//       name: 'none', 
//       display: 'filled', 
//       class: 'bg-green-500' 
//     },
//     { 
//       name: 'check', 
//       class: 'text-white', 
//       strokeWidth: 3 
//     }
//   ]"
//   class="w-8 h-8">
// </app-icon>