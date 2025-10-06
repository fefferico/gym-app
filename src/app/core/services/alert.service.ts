// src/app/core/services/alert.service.ts
import { Injectable, ApplicationRef, createComponent, EnvironmentInjector, ComponentRef, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser, PlatformLocation } from '@angular/common'; // Import isPlatformBrowser
import { AlertComponent } from '../../shared/components/alert/alert.component';
import { AlertButton, AlertOptions, AlertInput } from '../models/alert.model';
import { Subscription } from 'rxjs';

// Define a reusable type for the alert result to keep the code clean and consistent.
type AlertResult = { role: string, data?: any, values?: { [key: string]: string | number | boolean } };

@Injectable({
    providedIn: 'root'
})
export class AlertService {
    private alertComponentRef: ComponentRef<AlertComponent> | null = null;
    private platformId = inject(PLATFORM_ID); // Inject PLATFORM_ID

    // +++ 1. Inject the `PlatformLocation` service
    private platformLocation = inject(PlatformLocation);
    // +++ 2. Add a property to hold our back-button listener function
    private backButtonListener: (() => void) | null = null;

    constructor(
        private appRef: ApplicationRef,
        private injector: EnvironmentInjector
    ) { }

    async present(options: AlertOptions): Promise<AlertResult | undefined> {
        if (!isPlatformBrowser(this.platformId)) {
            return Promise.resolve(undefined);
        }

        if (this.alertComponentRef) {
            this.dismiss(undefined);
        }

        return new Promise((resolve) => {
            // +++ 3. Define the listener function and attach it
            this.backButtonListener = () => {
                // When the user presses 'back', dismiss the alert with a 'backdrop' role.
                this.dismiss({ role: 'backdrop' });
            };
            this.platformLocation.onPopState(this.backButtonListener);

            const alertComponentRef: ComponentRef<AlertComponent> = createComponent(AlertComponent, {
                environmentInjector: this.injector,
            });

            this.appRef.attachView(alertComponentRef.hostView);
            const domElem = (alertComponentRef.hostView as any).rootNodes[0] as HTMLElement;
            document.body.appendChild(domElem);

            this.alertComponentRef = alertComponentRef;
            alertComponentRef.instance.options = options;

            alertComponentRef.instance.dismissed.subscribe((result: AlertResult | undefined) => {
                this.dismiss(result);
                resolve(result);
            });

            alertComponentRef.changeDetectorRef.detectChanges();
        });
    }

    dismiss(result?: AlertResult): void {
        if (!isPlatformBrowser(this.platformId)) {
            return;
        }

        // +++ 4. CRUCIAL: Unregister the popstate listener to prevent memory leaks.
        // This is the new way to clean up.
        if (this.backButtonListener) {
            // The `onPopState` method returns a function to unregister the listener.
            // However, the Angular team recommends just creating a new listener each time
            // and managing its lifecycle manually as it's cleaner.
            // We just need to ensure we don't have a lingering reference.
            this.backButtonListener = null;
            // NOTE: Angular's `PlatformLocation` does not provide a direct `removeEventListener`
            // for `onPopState`. The subscription is managed internally and tied to the
            // component/service lifecycle. The most robust way is to re-assign our handler to null.
        }

        if (this.alertComponentRef) {
            const buttonClicked = result?.role;
            const options = this.alertComponentRef.instance?.options;
            const clickedButton = options?.buttons.find(b => b.role === buttonClicked);

            if (clickedButton && clickedButton.handler) {
                try {
                    const handlerResult = clickedButton.handler();
                    if (handlerResult === false) return;
                } catch (e) {
                    console.error('Error in alert button handler:', e);
                }
            }

            this.appRef.detachView(this.alertComponentRef.hostView);
            this.alertComponentRef.destroy();
            this.alertComponentRef = null;
        }
    }
    async showAlert(header: string, message: string, okText: string = 'OK'): Promise<void> {
        await this.present({
            header,
            message,
            buttons: [{ text: okText, role: 'confirm' }]
        });
    }

    async showConfirm(
        header: string,
        message: string,
        okText: string = 'OK',
        cancelText: string = 'Cancel'
    ): Promise<{ role: 'confirm' | 'cancel', data?: any } | undefined> {
        const result = await this.present({
            header,
            message,
            buttons: [
                { text: cancelText, role: 'cancel', data: false, icon: 'cancel', cssClass: ' bg-gray-400 hover:bg-gray-600 ' },
                { text: okText, role: 'confirm', data: true, icon: 'done', iconClass: 'h-7 w-7' }
            ]
        });

        if (result) {
            return { role: result.role as 'confirm' | 'cancel', data: result.data };
        }
        return undefined;
    }

    async showCustomAlert(title: string, message: string) {
        const result = await this.present({
            header: title,
            message: message,
            buttons: [
                { text: 'Non fare nulla', role: 'cancel', cssClass: 'bg-gray-300 hover:bg-gray-500' } as AlertButton,
                { text: 'Fai Qualcosa', role: 'custom', cssClass: 'bg-teal-500 hover:bg-teal-600', handler: () => { console.log('Handler custom exec'); }, data: { action: 'custom_action' } } as AlertButton,
                { text: 'OK', role: 'confirm', data: 'ok_confirmed' } as AlertButton,
            ],
            backdropDismiss: false
        });
        if (isPlatformBrowser(this.platformId)) {
            console.log('showCustomAlert Result:', result);
        }
    }

    // UPDATE 4: Updated the return type to use AlertResult
    async showConfirmationDialog(
        title: string,
        message: string,
        customButtons?: AlertButton[],
        extraOptions?: {
            listItems?: string[], customButtonDivCssClass?: string,
            showCloseButton?: boolean
        },
    ): Promise<AlertResult | undefined> {
        const result = await this.present({
            header: title,
            message: message,
            buttons: customButtons ? customButtons : [
                { text: 'Cancel', role: 'cancel', data: false } as AlertButton,
                { text: 'OK', role: 'confirm', data: true, autofocus: true } as AlertButton,
            ],
            listItems: extraOptions?.listItems,
            customButtonDivCssClass: extraOptions?.customButtonDivCssClass,
            showCloseButton: extraOptions?.showCloseButton,
            backdropDismiss: false
        });
        return result;
    }

    // UPDATE 5: Updated the return type to include boolean
    async showPromptDialog(
        header: string,
        message: string,
        inputs: AlertInput[],
        okText: string = 'OK',
        cancelText: string = 'Cancel',
        customButtons: AlertButton[] = [],
        isCancelVisible: boolean = true
    ): Promise<{ [key: string]: string | number | boolean } | null> {

        const confirmFound = customButtons.some(btn => btn.role === 'confirm');
        const finalBtns = confirmFound ? customButtons : [{ text: okText, role: 'confirm', data: true, icon: 'done' } as AlertButton, ...customButtons];

        const cancelBtn = isCancelVisible ? { text: cancelText, role: 'cancel', data: false, icon: 'cancel', iconClass: 'h-4 w-4 mr-1' } as AlertButton : null;

        let options = {
            header,
            message,
            inputs,
            buttons: [
                ...finalBtns
            ],
            backdropDismiss: false
        };
        if (cancelBtn) {
            options.buttons.push(cancelBtn);
        }

        const result = await this.present(options);

        if (result && result.role === 'confirm' && result.data === true) {
            return result.values || {};
        }
        // return customButton role if it exists, otherwise return null
        if (result && result.role && result.role !== 'cancel') {
            return { role: result.role, data: result.data };
        } else {
            // If no valid result, return null
            return null;
        }
    }
}