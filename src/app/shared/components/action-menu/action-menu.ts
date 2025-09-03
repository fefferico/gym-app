// src/app/shared/components/action-menu/action-menu.component.ts
import { Component, Input, Output, EventEmitter, HostListener, ElementRef, ChangeDetectionStrategy, inject, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { IconRegistryService } from '../../../core/services/icon-registry.service';
import { MenuMode } from '../../../core/models/app-settings.model';
import { IconComponent, IconLayer } from '../icon/icon.component';
// +++ 1. Import the AlertService and the AlertButton model +++
import { AlertService } from '../../../core/services/alert.service';
import { AlertButton } from '../../../core/models/alert.model';


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
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.95) translateY(-10px)' }),
    animate('100ms ease-out', style({ opacity: 1, transform: 'scale(1) translateY(0)' })),
  ]),
  transition(':leave', [
    animate('75ms ease-in', style({ opacity: 0, transform: 'scale(0.95) translateY(-10px)' })),
  ]),
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
  imports: [CommonModule, IconComponent],
  templateUrl: './action-menu.html',
  animations: [dropdownMenuAnimation, compactBarAnimation, modalOverlayAnimation, modalContentAnimation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionMenuComponent implements OnChanges, OnDestroy {
  private sanitizer = inject(DomSanitizer);
  private elRef = inject(ElementRef);
  private iconRegistry = inject(IconRegistryService);
  // +++ 2. Inject the AlertService +++
  private alertService = inject(AlertService);

  @Input() items: ActionMenuItem[] = [];
  @Input() isVisible: boolean = false;
  @Input() displayMode: MenuMode = 'dropdown';
  @Input() modalTitle: string = 'Actions';

  // --- No longer needed for modal, but kept for dropdown ---
  @Input() dropdownMenuClass: string = 'origin-top-right absolute right-0 top-full mt-2 w-56 rounded-lg shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 p-1 z-[60]';
  defaultDropdownButtonClass: string = 'flex items-center w-full rounded-md px-3 py-2 text-sm font-medium text-white';
  @Input() compactBarClass: string = 'flex gap-2 grid grid-cols-2 justify-center items-center z-20 rounded-b-lg p-2';
  defaultCompactButtonClass: string = 'flex items-center w-full rounded-md px-3 py-2 text-sm font-medium text-white';
  @Input() gridClass: string = '';
  @Input() customButtonDivCssClass: string = 'grid grid-cols-2';

  @Output() itemClick = new EventEmitter<{ actionKey: string, data?: any }>();
  @Output() closeMenu = new EventEmitter<void>();

  private _boundOnEnterKey = this.handleEnterKey.bind(this);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']) {
      const isVisible = changes['isVisible'].currentValue;

      // +++ 3. Intercept the visibility change for modal mode +++
      if (isVisible && this.displayMode === 'modal') {
        // Use a timeout to avoid any potential expression-changed-after-checked errors
        setTimeout(() => this.presentAsAlert(), 0);
      }

      // Keep existing listener logic for other modes
      if (isVisible && this.displayMode !== 'modal') {
        document.addEventListener('keydown', this._boundOnEnterKey);
      } else {
        document.removeEventListener('keydown', this._boundOnEnterKey);
      }
    }
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
        overrideCssClass: `justify-start text-xl ${item.buttonClass || ''}`, // Ensure buttons are styled nicely
        data: item.data
      }));

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