// src/app/shared/components/action-menu/action-menu.component.ts
import { Component, Input, Output, EventEmitter, HostListener, ElementRef, ChangeDetectionStrategy, SecurityContext, inject, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { ActionMenuItem } from '../../../core/models/action-menu.model';

// ... (animations remain the same)
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
  state('void', style({
    height: '0px', opacity: 0, overflow: 'hidden',
    paddingTop: '0', paddingBottom: '0', marginTop: '0', marginBottom: '0'
  })),
  state('*', style({
    height: '*', opacity: 1, overflow: 'hidden',
    paddingTop: '0.5rem', paddingBottom: '0.5rem'
  })),
  transition('void <=> *', animate('200ms ease-in-out'))
]);


@Component({
  selector: 'app-action-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './action-menu.html',
  animations: [dropdownMenuAnimation, compactBarAnimation],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionMenuComponent implements OnChanges, OnDestroy {
  private sanitizer = inject(DomSanitizer);
  private elRef = inject(ElementRef);

  @Input() items: ActionMenuItem[] = [];
  @Input() isVisible: boolean = false;
  @Input() displayMode: 'dropdown' | 'compact-bar' = 'dropdown';

  @Input() dropdownMenuClass: string = 'origin-top-right absolute right-0 top-full mt-1 sm:mt-2 w-40 sm:w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black dark:ring-gray-600 ring-opacity-5 focus:outline-none py-1 z-[60]';

  @Input() compactBarClass: string = 'flex flex-wrap gap-1.5 justify-center z-20 rounded-b-lg grid-cols-3';

  @Output() itemClick = new EventEmitter<{ actionKey: string, data?: any }>();
  @Output() closeMenu = new EventEmitter<void>();

  // A bound reference to the event handler function.
  // This is crucial for addEventListener and removeEventListener to work correctly.
  private _boundOnEnterKey = this.handleEnterKey.bind(this);

  ngOnChanges(changes: SimpleChanges): void {
    // We watch for changes to the `isVisible` input property.
    if (changes['isVisible']) {
      if (changes['isVisible'].currentValue === true) {
        // When the menu becomes visible, add the global keydown listener.
        document.addEventListener('keydown', this._boundOnEnterKey);
      } else {
        // When the menu becomes hidden, remove the listener to prevent it from firing unnecessarily.
        document.removeEventListener('keydown', this._boundOnEnterKey);
      }
    }
  }

  ngOnDestroy(): void {
    // Always clean up the listener when the component is destroyed to prevent memory leaks.
    document.removeEventListener('keydown', this._boundOnEnterKey);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isVisible && !this.elRef.nativeElement.contains(event.target)) {
      this.closeMenu.emit();
    }
  }

  // This method is now called by our manually-managed event listener.
  handleEnterKey(event: KeyboardEvent): void {
    // We only care about the "Enter" key.
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    // Find the first clickable action in the menu.
    const primaryAction = this.items.find(item => !item.isDivider);

    if (primaryAction) {
      // Simulate a click on that item to reuse all existing logic.
      this.onItemClicked({ stopPropagation: () => { } } as MouseEvent, primaryAction);
    }
  }

  onItemClicked(event: MouseEvent, item: ActionMenuItem): void {
    event.stopPropagation();
    if (!item.isDivider) {
      this.itemClick.emit({ actionKey: item.actionKey ?? '', data: item.data });
      if (this.displayMode === 'dropdown') {
        this.closeMenu.emit();
      }
    }
  }

  sanitizeSvg(svgString?: string): SafeHtml | null {
    if (!svgString) return null;
    return this.sanitizer.bypassSecurityTrustHtml(svgString);
  }

  showLabelInCompact(item: ActionMenuItem): boolean {
    return !!item.label;
  }
}