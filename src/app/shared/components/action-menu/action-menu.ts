// src/app/shared/components/action-menu/action-menu.component.ts
import { Component, Input, Output, EventEmitter, HostListener, ElementRef, ChangeDetectionStrategy, inject, OnChanges, SimpleChanges, OnDestroy, signal, PLATFORM_ID, ViewChildren, QueryList, ChangeDetectorRef, runInInjectionContext, afterNextRender, Injector } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { IconRegistryService } from '../../../core/services/icon-registry.service';
import { MenuMode } from '../../../core/models/app-settings.model';
import { IconComponent, IconLayer } from '../icon/icon.component';
// +++ 1. Import the AlertService and the AlertButton model +++
import { AlertService } from '../../../core/services/alert.service';
import { AlertButton } from '../../../core/models/alert.model';
import { TranslateModule } from '@ngx-translate/core';


// ... (animations can remain unchanged) ...
export const modalOverlayAnimation = trigger('modalOverlay', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('200ms ease-out', style({ opacity: 1 })),
  ]),
  transition(':leave', [
    animate('150ms ease-in', style({ opacity: 0 })),
  ]),
]);
export const modalContentAnimation = trigger('modalContent', [
  transition(':enter', [
    style({ transform: 'translateY(100%)' }),
    animate('200ms ease-out', style({ transform: 'translateY(0)' })),
  ]),
  transition(':leave', [
    animate('150ms ease-in', style({ transform: 'translateY(100%)' })),
  ]),
]);
export const dropdownMenuAnimation = trigger('dropdownMenu', [
  // State for 'preparing' and 'closed' is invisible
  state('closed, preparing', style({
    opacity: 0,
    transform: 'scale(0.95) translateY(-10px)'
  })),
  // State for 'open' is visible
  state('open', style({
    opacity: 1,
    transform: 'scale(1) translateY(0)'
  })),
  // Transition from preparing to open for a smooth fade-in
  transition('preparing => open', [
    animate('100ms ease-out')
  ]),
  // Transition back to closed
  transition('* => closed', [
    animate('75ms ease-in')
  ])
]);
export const compactBarAnimation = trigger('compactBar', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('200ms ease-out', style({ opacity: 1 })),
  ]),
  transition(':leave', [
    animate('150ms ease-in', style({ opacity: 0 })),
  ]),
]);

@Component({
  selector: 'app-action-menu',
  standalone: true,
  imports: [CommonModule, IconComponent, TranslateModule],
  templateUrl: './action-menu.html',
  animations: [dropdownMenuAnimation, compactBarAnimation, modalOverlayAnimation, modalContentAnimation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionMenuComponent implements OnChanges, OnDestroy {
  private sanitizer = inject(DomSanitizer);
  private elRef = inject(ElementRef);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  private injector = inject(Injector);

  private iconRegistry = inject(IconRegistryService);
  // +++ 2. Inject the AlertService +++
  private alertService = inject(AlertService);
  protected menuState = signal<'closed' | 'preparing' | 'open'>('closed');

  @Input() items: ActionMenuItem[] = [];
  @Input() displayMode: MenuMode = 'dropdown';
  @Input() modalTitle: string = 'Actions';

  @Input()
  set isVisible(value: boolean) {
    if (value) {
      // 1. When parent wants to show, move to 'preparing' state.
      // This adds the menu to the DOM but keeps it invisible.
      this.menuState.set('preparing');

      // 2. Defer the calculation. This gives the DOM time to render the invisible menu.
      setTimeout(() => {
        this.calculateDropdownPosition();
        // 3. After calculation, move to 'open' state to trigger the fade-in animation.
        this.menuState.set('open');
      }, 0);
    } else {
      // When parent wants to hide, just go to 'closed'.
      this.menuState.set('closed');
    }
  }


  // --- No longer needed for modal, but kept for dropdown ---
  alignmentClass = signal('origin-top-right right-0');

  defaultDropdownButtonClass: string = 'flex items-center w-full rounded-md px-3 py-2 text-sm font-medium text-black dark:text-white hover:text-white'; @Input() compactBarClass: string = 'flex gap-2 grid grid-cols-2 justify-center items-center z-20 rounded-b-lg p-2';
  defaultCompactButtonClass: string = 'flex items-center w-full rounded-md px-3 py-2 text-sm font-medium text-black dark:text-white hover:text-white';
  @Input() gridClass: string = '';
  @Input() customButtonDivCssClass: string = 'grid grid-cols-2';

  @Output() itemClick = new EventEmitter<{ actionKey: string, data?: any }>();
  @Output() closeMenu = new EventEmitter<void>();

  private _boundOnEnterKey = this.handleEnterKey.bind(this);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']) {
      const isVisible = changes['isVisible'].currentValue;

      // +++ 3. Intercept the visibility change for modal mode +++
      if (isVisible) {
        if (this.displayMode === 'modal') {
          // Use a timeout to avoid any potential expression-changed-after-checked errors
          setTimeout(() => this.presentAsAlert(), 0);

        }
        if (this.displayMode === 'dropdown') {
          setTimeout(() => this.calculateDropdownPosition(), 0);
        }
      }

      // Keep existing listener logic for other modes
      if (isVisible && this.displayMode !== 'modal') {
        document.addEventListener('keydown', this._boundOnEnterKey);
      } else {
        document.removeEventListener('keydown', this._boundOnEnterKey);
      }
    }
  }

  private calculateDropdownPosition(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const dropdownElement = this.elRef.nativeElement.querySelector('.dropdown-panel');
    const anchorElement = this.elRef.nativeElement.parentElement;

    if (!dropdownElement || !anchorElement) return;

    const anchorRect = anchorElement.getBoundingClientRect();
    const dropdownWidth = dropdownElement.offsetWidth;
    const dropdownHeight = dropdownElement.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Get --main-nav-height from CSS
    const rootStyles = getComputedStyle(document.documentElement);
    const mainNavHeight = parseInt(rootStyles.getPropertyValue('--main-nav-height'), 10) || 0;

    // Horizontal alignment
    const hasSpaceOnRight = (anchorRect.left + dropdownWidth) <= viewportWidth;
    const hasSpaceOnLeft = (anchorRect.right - dropdownWidth) >= 0;

    let horizontalClass = '';
    if (hasSpaceOnLeft) {
      horizontalClass = 'right-0 origin-top-right';
    } else if (hasSpaceOnRight) {
      horizontalClass = 'left-0 origin-top-left';
    } else {
      const spaceOnRight = viewportWidth - anchorRect.left;
      const spaceOnLeft = anchorRect.right;
      horizontalClass = spaceOnRight >= spaceOnLeft ? 'left-0 origin-top-left' : 'right-0 origin-top-right';
    }

    // Vertical alignment
    let verticalClass = 'top-full mt-2'; // Default: below anchor
    const offset = 8; // Corresponding to 'mt-2' or 'mb-2'

    // Calculate available space below, considering the main nav height
    const spaceBelowConsideringNav = viewportHeight - anchorRect.bottom - mainNavHeight;
    const hasSpaceBelow = (dropdownHeight + offset) <= spaceBelowConsideringNav;

    // Calculate available space above
    const hasSpaceAbove = (anchorRect.top - dropdownHeight - offset) >= 0;

    if (!hasSpaceBelow && hasSpaceAbove) {
      verticalClass = 'bottom-full mb-2'; // If no space below (even with nav), but space above
    } else if (!hasSpaceBelow && !hasSpaceAbove) {
      // If no space above or below, choose the direction with more space
      // Comparing actual space, not just boolean flags
      const spaceBelow = viewportHeight - anchorRect.bottom - mainNavHeight; // Adjusted space below
      const spaceAbove = anchorRect.top;

      verticalClass = spaceBelow >= spaceAbove ? 'top-full mt-2' : 'bottom-full mb-2';
    }

    this.alignmentClass.set(`${horizontalClass} ${verticalClass}`);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this._boundOnEnterKey);
  }

  // +++ 4. Add the new method to present the alert +++
  private async presentAsAlert(): Promise<void> {
    // Transform ActionMenuItem[] to AlertButton[]
    const alertButtons: AlertButton[] = this.items
      .filter(item => !item.isDivider)
      .map(item => ({
        text: item.label || '',
        role: item.actionKey || '', // Use the actionKey as the unique identifier
        icon: item.iconName,
        iconClass: item.iconClass,
        cssClass: `${item.buttonClass || ''}`,
        overrideCssClass: item.overrideCssButtonClass ? item.overrideCssButtonClass : ``, // Ensure buttons are styled nicely
        data: item.data
      } as AlertButton));

    // Use the AlertService to present the options
    const result = await this.alertService.present({
      header: this.modalTitle,
      buttons: alertButtons,
      backdropDismiss: true,
      customButtonDivCssClass: this.customButtonDivCssClass ? this.customButtonDivCssClass : 'grid grid-cols-2',
      // The AlertComponent itself is responsible for the full-screen/bottom-sheet styling
    });

    // Process the result from the alert
    if (result && result.role !== 'backdrop' && result.role !== 'cancel') {
      this.itemClick.emit({
        actionKey: result.role,
        data: result.data
      });
    }

    // CRITICAL: Always emit closeMenu to reset the parent component's state
    this.closeMenu.emit();
  }


  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.displayMode === 'dropdown' && this.isVisible && !this.elRef.nativeElement.contains(event.target)) {
      this.closeMenu.emit();
    }
  }

  handleEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const primaryAction = this.items.find(item => !item.isDivider);
      if (primaryAction) {
        this.onItemClicked({ stopPropagation: () => { } } as MouseEvent, primaryAction);
      }
    }
  }

  onItemClicked(event: MouseEvent, item: ActionMenuItem): void {
    event.stopPropagation();
    if (!item.isDivider) {
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      this.itemClick.emit({ actionKey: item.actionKey ?? '', data: item.data });
      if (this.displayMode === 'dropdown') {
        this.closeMenu.emit();
      }
    }
  }

  /**
     * Renders a simple icon from a string name or a raw SVG.
     * This method is kept for backward compatibility.
     */
  getIconHtml(button: ActionMenuItem): SafeHtml | null {
    let svgString: string | null = null;
    // Only process if iconName is a simple string
    if (typeof button.iconName === 'string') {
      svgString = this.iconRegistry.getIconString(button.iconName);
    } else if (button.iconSvg) {
      svgString = button.iconSvg;
    }
    return svgString ? this.sanitizer.bypassSecurityTrustHtml(svgString) : null;
  }

  showLabelInCompact(item: ActionMenuItem): boolean {
    return !!item.label;
  }
  /**
   * +++ 3. NEW HELPER: Determines if an icon should be rendered using the <app-icon> component.
   * This is true if iconName is an object or an array (which are both of type 'object').
   */
  isComplexIcon(item: ActionMenuItem): boolean {
    return typeof item.iconName === 'object' && item.iconName !== null;
  }

  /**
   * Helper to cast the iconName for the <app-icon> component's [name] binding.
   */
  getIconNameForComponent(item: ActionMenuItem): IconLayer | (string | IconLayer)[] {
    return item.iconName as IconLayer | (string | IconLayer)[];
  }
}