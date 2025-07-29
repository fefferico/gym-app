import { Directive, Input, ElementRef, HostListener, Renderer2, OnDestroy } from '@angular/core'; // 1. Import OnDestroy

@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy { // 2. Implement OnDestroy
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
  
  // +++ 3. ADD THE ngOnDestroy METHOD +++
  /**
   * This lifecycle hook is called by Angular right before the directive is destroyed.
   * It's the perfect place to clean up our tooltip element to prevent memory leaks
   * or orphaned elements on the page, especially during route navigation.
   */
  ngOnDestroy(): void {
    // Cancel any pending tooltip creation
    clearTimeout(this.delayTimeout);

    // Immediately remove the tooltip if it exists
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
    this.renderer.appendChild(
      this.tooltipElement,
      this.renderer.createText(this.tooltipText)
    );
    this.renderer.appendChild(document.body, this.tooltipElement);
    this.renderer.addClass(this.tooltipElement, 'tooltip-container');
    this.renderer.addClass(this.tooltipElement, 'tooltip-preparing');

    this.positionTooltip();

    setTimeout(() => {
      if (this.tooltipElement) {
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
    }, 200);
  }

  private positionTooltip(): void {
    if (!this.tooltipElement) return;

    const hostPos = this.el.nativeElement.getBoundingClientRect();
    const tooltipPos = this.tooltipElement.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    let top, left;

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