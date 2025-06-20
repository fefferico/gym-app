// src/app/shared/components/action-menu/action-menu.component.ts
import { Component, Input, Output, EventEmitter, HostListener, ElementRef, ChangeDetectionStrategy, SecurityContext, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { ActionMenuItem } from '../../../core/models/action-menu.model';

// Animation for dropdown mode
export const dropdownMenuAnimation = trigger('dropdownMenu', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.95) translateY(-10px)' }),
    animate('100ms ease-out', style({ opacity: 1, transform: 'scale(1) translateY(0)' })),
  ]),
  transition(':leave', [
    animate('75ms ease-in', style({ opacity: 0, transform: 'scale(0.95) translateY(-10px)' })),
  ]),
]);

// Animation for compact bar (e.g., slide in from bottom)
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
  animations: [dropdownMenuAnimation, compactBarAnimation], // Add both animations
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionMenuComponent {
  private sanitizer = inject(DomSanitizer);
  private elRef = inject(ElementRef);

  @Input() items: ActionMenuItem[] = [];
  @Input() isVisible: boolean = false;
  @Input() displayMode: 'dropdown' | 'compact-bar' = 'dropdown';
  
  // Default classes for dropdown mode
  @Input() dropdownMenuClass: string = 'origin-top-right absolute right-0 top-full mt-1 sm:mt-2 w-40 sm:w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black dark:ring-gray-600 ring-opacity-5 focus:outline-none py-1 z-[60]';
  
  // Default classes for compact-bar mode
@Input() compactBarClass: string = 'flex flex-wrap gap-1.5 justify-center z-20 rounded-b-lg grid-cols-3';


  @Output() itemClick = new EventEmitter<{ actionKey: string, data?: any }>();
  @Output() closeMenu = new EventEmitter<void>();

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isVisible && !this.elRef.nativeElement.contains(event.target)) {
      this.closeMenu.emit();
    }
  }

  onItemClicked(event: MouseEvent, item: ActionMenuItem): void {
    event.stopPropagation();
    if (!item.isDivider) {
      this.itemClick.emit({ actionKey: item.actionKey ?? '', data: item.data });
      // For compact bar, we might not want to auto-close after every click,
      // depending on UX. Parent can decide by calling closeMenu.
      // For dropdown, it usually closes.
      if (this.displayMode === 'dropdown') {
        this.closeMenu.emit();
      }
    }
  }

  sanitizeSvg(svgString?: string): SafeHtml | null {
    if (!svgString) return null;
    return this.sanitizer.bypassSecurityTrustHtml(svgString);
  }

  // Helper for compact mode to decide if icon and label or just icon
  showLabelInCompact(item: ActionMenuItem): boolean {
    // Example logic: show label if icon is not present, or if a specific flag is set.
    // For now, let's assume compact buttons always show labels if provided.
    // You can make this more sophisticated.
    return !!item.label;
  }
}