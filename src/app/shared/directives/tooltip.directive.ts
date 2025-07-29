import { Directive, Input, ElementRef, HostListener, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective {
  @Input('appTooltip') tooltipText: string = '';
  @Input() tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';
  @Input() tooltipDelay: number = 200;

  private tooltipElement: HTMLElement | null = null;
  private delayTimeout: any;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2
  ) {}

  @HostListener('mouseenter')
  onMouseEnter(): void {
    // Clear any lingering timeout from rapid mouse movements
    clearTimeout(this.delayTimeout);
    
    this.delayTimeout = setTimeout(() => {
      this.createTooltip();
    }, this.tooltipDelay);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    clearTimeout(this.delayTimeout);
    this.removeTooltip();
  }

  private createTooltip(): void {
    if (this.tooltipElement || !this.tooltipText) {
      return;
    }

    // 1. Create element and add content
    this.tooltipElement = this.renderer.createElement('span');
    this.renderer.appendChild(
      this.tooltipElement,
      this.renderer.createText(this.tooltipText)
    );

    // 2. Append to body so it can be measured
    this.renderer.appendChild(document.body, this.tooltipElement);
    
    // --- THE FIX IS HERE ---
    // 3. Add a special 'preparing' class that sets visibility: hidden.
    // This makes the browser calculate its full size without showing it.
    this.renderer.addClass(this.tooltipElement, 'tooltip-container');
    this.renderer.addClass(this.tooltipElement, 'tooltip-preparing');

    // 4. NOW we can measure it and position it correctly.
    // Because it's fully rendered (just invisible), getBoundingClientRect() will be accurate.
    this.positionTooltip();

    // 5. Finally, swap the classes to trigger the fade-in animation.
    // We use a tiny delay to ensure the browser registers the position change before the transition starts.
    setTimeout(() => {
      if(this.tooltipElement) {
        this.renderer.removeClass(this.tooltipElement, 'tooltip-preparing');
        this.renderer.addClass(this.tooltipElement, 'tooltip-active');
      }
    }, 20);
  }

  private removeTooltip(): void {
    if (!this.tooltipElement) {
      return;
    }
    
    this.renderer.removeClass(this.tooltipElement, 'tooltip-active');

    setTimeout(() => {
      if (this.tooltipElement) {
        this.renderer.removeChild(document.body, this.tooltipElement);
        this.tooltipElement = null;
      }
    }, 200); // Should match CSS transition duration
  }

  private positionTooltip(): void {
    if (!this.tooltipElement) return;

    const hostPos = this.el.nativeElement.getBoundingClientRect();
    const tooltipPos = this.tooltipElement.getBoundingClientRect(); // This is now ACCURATE
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    let top, left;

    // The positioning math remains the same, but now it has the correct tooltipPos.height
    switch (this.tooltipPosition) {
      case 'bottom':
        top = hostPos.bottom + scrollY + 8;
        left = hostPos.left + scrollX + (hostPos.width - tooltipPos.width) / 2;
        break;
      case 'left':
        top = hostPos.top + scrollY + (hostPos.height - tooltipPos.height) / 2;
        left = hostPos.left + scrollX - tooltipPos.width - 8;
        break;
      case 'right':
        top = hostPos.top + scrollY + (hostPos.height - tooltipPos.height) / 2;
        left = hostPos.right + scrollX + 8;
        break;
      case 'top':
      default:
        top = hostPos.top + scrollY - tooltipPos.height - 8;
        left = hostPos.left + scrollX + (hostPos.width - tooltipPos.width) / 2;
        break;
    }

    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
  }
}