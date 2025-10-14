import { Component, model, output, ElementRef, HostListener, ViewEncapsulation, inject, input, effect, Inject, DOCUMENT } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations'; // Import Angular Animations

@Component({
    selector: 'app-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './modal.component.html',
    styleUrls: ['./modal.component.scss'],
    animations: [
        trigger('modalAnimation', [
            state('closed', style({
                opacity: 0,
                visibility: 'hidden' // Ensure it's not interactive when closed
            })),
            state('open', style({
                opacity: 1,
                visibility: 'visible'
            })),
            transition('closed <=> open', [
                animate('300ms ease-in-out')
            ]),
        ]),
        trigger('dialogAnimation', [
            state('closed', style({
                opacity: 0,
                transform: 'scale(0.95) translateY(20px)', // Slightly more engaging animation
                visibility: 'hidden'
            })),
            state('open', style({
                opacity: 1,
                transform: 'scale(1) translateY(0)',
                visibility: 'visible'
            })),
            transition('closed <=> open', [
                animate('300ms ease-in-out')
            ]),
        ])
    ]
})
export class ModalComponent {
    private elementRef = inject(ElementRef);

    isOpen = model<boolean>(false);
    modalTitle = input<string | undefined>();
    closed = output<void>();

    /**
     * Determines the size of the modal.
     * Can be 'sm', 'md', 'lg', 'xl', or 'fullscreen'.
     */
    size = input<'sm' | 'md' | 'lg' | 'xl' | 'fullscreen'>('lg');
    forceFullScreen = input<boolean>(false);

    constructor(@Inject(DOCUMENT) private document: Document) {
        // --- START: NEW LOGIC TO PREVENT BACKGROUND SCROLL ---
        effect(() => {
            if (this.isOpen()) {
                // When the modal is open, add the class to the body to hide scrollbars.
                this.document.body.classList.add('overflow-hidden');
            } else {
                // When the modal is closed, remove the class.
                this.document.body.classList.remove('overflow-hidden');
            }

            // The onCleanup function ensures that if the component is ever destroyed
            // while the modal is open, the class is removed, preventing a stuck page.

        });
        effect((onCleanup) => {
            onCleanup(() => {
                this.document.body.classList.remove('overflow-hidden');
            });
        });
        // --- END: NEW LOGIC ---
    }

    get animationState() {
        return this.isOpen() ? 'open' : 'closed';
    }

    closeModal(): void {
        this.isOpen.set(false);
        this.closed.emit();
    }

    onDialogClick(event: MouseEvent): void {
        event.stopPropagation();
    }

    @HostListener('document:mousedown', ['$event'])
    onDocumentMouseDown(event: MouseEvent): void {
        if (this.isOpen() && this.elementRef.nativeElement.contains(event.target as Node)) {
            const targetElement = event.target as HTMLElement;
            // Close only if the mousedown was directly on the modal-container (backdrop)
            if (targetElement.classList.contains('modal-container')) {
                this.closeModal();
            }
        }
    }

    // Optional: Close on Escape key press
    @HostListener('document:keydown.escape')
    onEscapeKey(): void {
        if (this.isOpen()) {
            this.closeModal();
        }
    }
}