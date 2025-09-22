// src/app/shared/components/fab-menu/fab-menu.component.ts

import { Component, EventEmitter, HostListener, inject, Input, OnDestroy, OnInit, Output, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { trigger, style, animate, transition } from '@angular/animations';
import { Subscription } from 'rxjs';

import { WorkoutService } from '../../../core/services/workout.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { IconComponent } from '../icon/icon.component';
import { PressDirective } from '../../directives/press.directive';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

export interface FabAction {
  actionKey: string;  // A unique key for the action, e.g., 'create_routine'
  label: string;      // The text for the tooltip, e.g., 'CREATE ROUTINE'
  iconName: string;   // The name of the icon to display
  cssClass: string;   // Tailwind CSS classes for button styling (e.g., 'bg-blue-500')
  isPremium?: boolean;// Optional flag for features requiring a subscription
}

@Component({
  selector: 'app-fab-menu',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    PressDirective,
    ClickOutsideDirective
  ],
  templateUrl: './fab-menu.component.html',
  styleUrls: ['./fab-menu.component.scss'],
  animations: [
    trigger('fabSlideUp', [
      transition(':enter', [
        style({ transform: 'translateY(20%)', opacity: 0 }),
        animate('200ms ease-out', style({ transform: 'translateY(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translateY(20%)', opacity: 0 }))
      ])
    ])
  ]
})
export class FabMenuComponent implements OnInit, OnDestroy {
  // --- Injected Services ---
  protected workoutService = inject(WorkoutService);
  protected subscriptionService = inject(SubscriptionService);
  private platformId = inject(PLATFORM_ID);
  private pausedSub: Subscription | undefined;

  // --- Inputs & Outputs ---
  @Input() actions: FabAction[] = []; // <-- NEW: Actions are now an input
  @Output() actionClicked = new EventEmitter<string>(); // <-- NEW: Generic event emitter

  // --- Component State (Unchanged) ---
  isFabActionsOpen = signal(false);
  showBackToTopButton = signal(false);
  isPausedSession = signal(false);

  // --- Lifecycle Hooks (Unchanged) ---
  ngOnInit(): void {
    this.isPausedSession.set(this.workoutService.isPausedSession());
    this.pausedSub = this.workoutService.pausedWorkoutDiscarded$.subscribe(() => {
        this.isPausedSession.set(false);
    });
  }

  ngOnDestroy(): void {
    this.pausedSub?.unsubscribe();
  }

  // --- Event Handlers (Unchanged) ---
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.showBackToTopButton.set(window.pageYOffset > 400);
    }
  }
  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  handleFabClick(): void {
    this.isFabActionsOpen.update(v => !v);
  }
  handleFabMouseEnter(): void {}
  handleFabMouseLeave(): void {}

  // --- Action Methods ---
  
  // NEW: Generic handler that emits the action key
  handleAction(actionKey: string): void {
    this.actionClicked.emit(actionKey);
    this.isFabActionsOpen.set(false); // Close menu after an action
  }

  handleClose(): void {
    if (this.isFabActionsOpen()) {
        this.isFabActionsOpen.set(false);
    }
  }
}