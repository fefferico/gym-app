import { Directive, Input, ElementRef, HostListener, Renderer2, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
  @Input('appTooltip') tooltipText: string = '';
  @Input() tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';
  @Input() tooltipDelay: number = 200;

  private tooltipElement: HTMLElement | null = null;
  private delayTimeout: any;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2
  ) { }

  @HostListener('mouseenter')
  onMouseEnter(): void {
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

  ngOnDestroy(): void {
    clearTimeout(this.delayTimeout);
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  private createTooltip(): void {
    if (this.tooltipElement || !this.tooltipText) {
      return;
    }
    
    this.tooltipElement = this.renderer.createElement('span');
    
    // Support for multiline tooltips by splitting the text by '\n'
    const textLines = this.tooltipText.split('\n');
    textLines.forEach((line, index) => {
      this.renderer.appendChild(this.tooltipElement, this.renderer.createText(line));
      if (index < textLines.length - 1) {
        this.renderer.appendChild(this.tooltipElement, this.renderer.createElement('br'));
      }
    });

    this.renderer.appendChild(document.body, this.tooltipElement);
    this.renderer.addClass(this.tooltipElement, 'tooltip-container');
    
    // Add the 'preparing' class. The CSS you provided uses this to keep the
    // element in the layout but invisible, so we can measure it.
    this.renderer.addClass(this.tooltipElement, 'tooltip-preparing');

    // Position it *after* it's been added to the DOM and can be measured.
    this.positionTooltip();

    // After positioning, start the transition to make it visible.
    setTimeout(() => {
      if (this.tooltipElement) {
        this.renderer.removeClass(this.tooltipElement, 'tooltip-preparing');
        this.renderer.addClass(this.tooltipElement, 'tooltip-active');
      }
    }, 20); // Small delay to ensure the browser registers the initial state
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
    }, 200); // Match the transition duration in your CSS
  }

  /**
   * --- REWRITTEN FOR VIEWPORT AWARENESS ---
   * This method now calculates the ideal tooltip position and then adjusts it
   * to ensure it never renders outside the visible screen area.
   */
  private positionTooltip(): void {
    if (!this.tooltipElement) return;

    const hostPos = this.el.nativeElement.getBoundingClientRect();
    // Because the tooltip is in the 'preparing' state (visibility: hidden),
    // its dimensions are calculated correctly by the browser.
    const tooltipPos = this.tooltipElement.getBoundingClientRect();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 8; // A small margin from the screen edges

    let top, left;

    // 1. Calculate the ideal position based on the input preference
    switch (this.tooltipPosition) {
      case 'bottom':
        top = hostPos.bottom + margin;
        left = hostPos.left + (hostPos.width - tooltipPos.width) / 2;
        break;
      case 'left':
        top = hostPos.top + (hostPos.height - tooltipPos.height) / 2;
        left = hostPos.left - tooltipPos.width - margin;
        break;
      case 'right':
        top = hostPos.top + (hostPos.height - tooltipPos.height) / 2;
        left = hostPos.right + margin;
        break;
      case 'top':
      default:
        top = hostPos.top - tooltipPos.height - margin;
        left = hostPos.left + (hostPos.width - tooltipPos.width) / 2;
        break;
    }

    // 2. Adjust the calculated position to keep it within the viewport boundaries.

    // Adjust horizontal position
    if (left < margin) {
      left = margin;
    }
    if (left + tooltipPos.width > viewportWidth - margin) {
      left = viewportWidth - tooltipPos.width - margin;
    }

    // Adjust vertical position
    if (top < margin) {
      top = margin;
    }
    if (top + tooltipPos.height > viewportHeight - margin) {
      top = viewportHeight - tooltipPos.height - margin;
    }

    // 3. Apply the final, safe styles to the tooltip element.
    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
  }
}