// src/app/shared/components/action-menu/action-menu.component.ts
import { Component, Input, Output, EventEmitter, HostListener, ElementRef, ChangeDetectionStrategy, inject, OnChanges, SimpleChanges, OnDestroy, signal, PLATFORM_ID, ViewChildren, QueryList, ChangeDetectorRef, runInInjectionContext, afterNextRender, Injector } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { animate, query, stagger, state, style, transition, trigger } from '@angular/animations';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { IconRegistryService } from '../../../core/services/icon-registry.service';
import { MenuMode } from '../../../core/models/app-settings.model';
import { IconComponent, IconLayer } from '../icon/icon.component';
import { AlertService } from '../../../core/services/alert.service';
import { AlertButton } from '../../../core/models/alert.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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

export const dropdownMenuAnimation = trigger('listAnimation', [
  // Opening downwards (default)
  transition('void => open', [
    query('.action-item, .menu-divider', [
      style({ opacity: 0, transform: 'translateY(-15px)' })
    ], { optional: true }),
    query('.action-item, .menu-divider', stagger('30ms', [
      animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
    ]), { optional: true })
  ]),

  // Opening upwards
  transition('void => from-bottom', [
    query('.action-item, .menu-divider', [
      style({ opacity: 0, transform: 'translateY(15px)' })
    ], { optional: true }),
    query('.action-item, .menu-divider', stagger('30ms', [
      animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
    ]), { optional: true })
  ]),

  // Closing downwards (reverse of opening downwards)
  transition('open => void', [
    query('.action-item, .menu-divider', stagger('-30ms', [
      animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-15px)' }))
    ]), { optional: true })
  ]),

  // Closing upwards (reverse of opening upwards)
  transition('from-bottom => void', [
    query('.action-item, .menu-divider', stagger('-30ms', [
      animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(15px)' }))
    ]), { optional: true })
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
  animations: [compactBarAnimation, modalOverlayAnimation, modalContentAnimation, dropdownMenuAnimation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionMenuComponent implements OnChanges, OnDestroy {
  private sanitizer = inject(DomSanitizer);
  private elRef = inject(ElementRef);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  private injector = inject(Injector);
  private iconRegistry = inject(IconRegistryService);
  private alertService = inject(AlertService);
  private translateService = inject(TranslateService);

  protected menuState = signal<'closed' | 'preparing' | 'open'>('closed');
  animationState = signal<'open' | 'from-bottom' | 'void'>('void');
  private isClosing = false;

  @Input() items: ActionMenuItem[] = [];
  @Input() displayMode: MenuMode = 'dropdown';
  @Input() modalTitle: string = 'Actions';
  @Input() borderColor: string = '';
  defaultBorderColor: string = 'border-gray-300 dark:border-gray-600';
  customBorderWidth: string = 'border-4';
  defaultBorderWidth: string = 'border-3';

  private _isVisible = false;

  @Input()
  set isVisible(value: boolean) {
    if (value === this._isVisible) {
      return;
    }
    this._isVisible = value;

    if (value) {
      this.isClosing = false;
      if (this.displayMode === 'modal') {
        setTimeout(() => this.presentAsAlert(), 0);
      } else if (this.displayMode === 'dropdown') {
        runInInjectionContext(this.injector, () => {
          afterNextRender(() => {
            this.calculateDropdownPosition();
            this.cdr.detectChanges();
          });
        });
      }
      document.addEventListener('keydown', this._boundOnEnterKey);
    } else {
      // When closing, trigger animation and wait before cleanup
      if (this.displayMode === 'dropdown' && !this.isClosing) {
        this.startClosingAnimation();
      } else {
        document.removeEventListener('keydown', this._boundOnEnterKey);
      }
    }
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  // Track if menu should be visible in DOM (even during closing animation)
  get shouldRenderInDom(): boolean {
    return this._isVisible || this.isClosing;
  }

  alignmentClass = signal('origin-top-right right-0');

  defaultDropdownButtonClass: string = 'flex items-center w-full rounded-md px-3 py-2 text-sm font-medium text-black dark:text-white hover:text-white';
  @Input() compactBarClass: string = 'flex gap-2 grid grid-cols-2 justify-center items-center z-20 rounded-b-lg p-2';
  defaultCompactButtonClass: string = 'flex items-center w-full rounded-md px-3 py-2 text-sm font-medium text-black dark:text-white hover:text-white';
  @Input() gridClass: string = '';
  @Input() customButtonDivCssClass: string = 'grid grid-cols-2';

  @Output() itemClick = new EventEmitter<{ actionKey: string, data?: any }>();
  @Output() closeMenu = new EventEmitter<void>();

  private _boundOnEnterKey = this.handleEnterKey.bind(this);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']) {
      const isVisible = changes['isVisible'].currentValue;

      if (isVisible) {
        if (this.displayMode === 'modal') {
          setTimeout(() => this.presentAsAlert(), 0);
        }
      }

      if (isVisible && this.displayMode !== 'modal') {
        document.addEventListener('keydown', this._boundOnEnterKey);
      } else {
        document.removeEventListener('keydown', this._boundOnEnterKey);
      }
    }
  }

  private startClosingAnimation(): void {
    this.isClosing = true;
    // Set animation state to void to trigger leave animation
    this.animationState.set('void');
    this.cdr.detectChanges();

    // Wait for animation to complete before cleanup
    setTimeout(() => {
      this.isClosing = false;
      document.removeEventListener('keydown', this._boundOnEnterKey);
      this.cdr.detectChanges();
    }, 200); // Match the longest animation duration
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
    let verticalClass = 'top-full mt-2';
    this.animationState.set('open'); // Default: top-to-bottom animation

    const offset = 8;
    const spaceBelowConsideringNav = window.innerHeight - anchorRect.bottom - mainNavHeight;
    const hasSpaceBelow = (dropdownHeight + offset) <= spaceBelowConsideringNav;
    const hasSpaceAbove = (anchorRect.top - dropdownHeight - offset) >= 0;

    if (!hasSpaceBelow && hasSpaceAbove) {
      verticalClass = 'bottom-full mb-2';
      this.animationState.set('from-bottom'); // Bottom-to-top animation
    } else if (!hasSpaceBelow && !hasSpaceAbove) {
      const spaceBelow = window.innerHeight - anchorRect.bottom - mainNavHeight;
      const spaceAbove = anchorRect.top;

      if (spaceAbove > spaceBelow) {
        verticalClass = 'bottom-full mb-2';
        this.animationState.set('from-bottom');
      }
    }

    if (this.borderColor) {
      this.alignmentClass.set(`${horizontalClass} ${verticalClass} ${this.customBorderWidth} ${this.borderColor}`);
    } else {
      this.alignmentClass.set(`${horizontalClass} ${verticalClass} ${this.defaultBorderWidth} ${this.defaultBorderColor}`);
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this._boundOnEnterKey);
  }

  private defaultActionModalCssClass = 'justify-start'
  private async presentAsAlert(): Promise<void> {
    const isDesktop = isPlatformBrowser(this.platformId) && !('ontouchstart' in window || navigator.maxTouchPoints > 0);

    const alertButtons: AlertButton[] = this.items
      .filter(item => !item.isDivider)
      .map(item => ({
        text: item.label ? this.translateService.instant(item.label) : '',
        role: item.actionKey || '',
        icon: item.iconName,
        iconClass: item.iconClass,
        cssClass: `${item.buttonClass || ''}`,
        overrideCssClass: item.overrideCssButtonClass ? item.overrideCssButtonClass.replace('justify-center', this.defaultActionModalCssClass) : ``,
        data: item.data,
        autofocus: isDesktop ? true : false
      } as AlertButton));

    const result = await this.alertService.present({
      header: this.modalTitle,
      buttons: alertButtons,
      backdropDismiss: true,
      customButtonDivCssClass: this.customButtonDivCssClass ? this.customButtonDivCssClass : 'grid grid-cols-2',
    });

    if (result && result.role !== 'backdrop' && result.role !== 'cancel') {
      this.itemClick.emit({
        actionKey: result.role,
        data: result.data
      });
    }

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

  getIconHtml(button: ActionMenuItem): SafeHtml | null {
    let svgString: string | null = null;
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

  isComplexIcon(item: ActionMenuItem): boolean {
    return typeof item.iconName === 'object' && item.iconName !== null;
  }

  getIconNameForComponent(item: ActionMenuItem): IconLayer | (string | IconLayer)[] {
    return item.iconName as IconLayer | (string | IconLayer)[];
  }

  caretClass(): string {
    const align = this.alignmentClass();

    if (align.includes('bottom-full')) {
      // Menu opens upward
      return align.includes('right-0')
        ? 'bottom-[-6px] right-2'
        : 'bottom-[-6px] left-2';
    } else {
      // Menu opens downward
      return align.includes('right-0')
        ? 'top-[-6px] right-2'
        : 'top-[-6px] left-2';
    }
  }
}