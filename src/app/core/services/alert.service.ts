// src/app/core/services/alert.service.ts
import { Injectable, ApplicationRef, createComponent, EnvironmentInjector, ComponentRef, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common'; // Import isPlatformBrowser
import { AlertComponent } from '../../shared/components/alert/alert.component';
import { AlertButton, AlertOptions, AlertInput } from '../models/alert.model';

@Injectable({
    providedIn: 'root'
})
export class AlertService {
    private alertComponentRef: ComponentRef<AlertComponent> | null = null;
    private platformId = inject(PLATFORM_ID); // Inject PLATFORM_ID

    constructor(
        private appRef: ApplicationRef,
        private injector: EnvironmentInjector
    ) { }

    async present(options: AlertOptions): Promise<{ role: string, data?: any, values?: { [key: string]: string | number } } | undefined> {
        if (!isPlatformBrowser(this.platformId)) {
            // console.warn("AlertService.present called in a non-browser environment. Alert will not be shown.");
            // For methods like showConfirm that await a result, returning undefined or a default
            // "cancelled" response is often best on the server.
            return Promise.resolve(undefined);
        }

        // Dismiss any existing alert if on the browser
        if (this.alertComponentRef) {
            this.dismiss(undefined);
        }

        return new Promise((resolve) => {
            const alertComponentRef: ComponentRef<AlertComponent> = createComponent(AlertComponent, {
                environmentInjector: this.injector,
            });

            this.appRef.attachView(alertComponentRef.hostView);
            const domElem = (alertComponentRef.hostView as any).rootNodes[0] as HTMLElement;
            document.body.appendChild(domElem); // This line is browser-specific

            this.alertComponentRef = alertComponentRef;

            alertComponentRef.instance.options = options;
            alertComponentRef.instance.dismissed.subscribe((result: { role: string, data?: any, values?: { [key: string]: string | number } } | undefined) => {
                this.dismiss(result); // Internal dismiss also handles handler logic
                resolve(result);
            });

            alertComponentRef.changeDetectorRef.detectChanges();
        });
    }

    dismiss(result?: { role: string, data?: any, values?: { [key: string]: string | number } }): void {
        if (!isPlatformBrowser(this.platformId)) {
            return; // Do nothing on the server
        }

        if (this.alertComponentRef) {
            const buttonClicked = result?.role;
            
            // Safely access options only if alertComponentRef and its instance exist
            const options = this.alertComponentRef.instance?.options;
            const clickedButton = options?.buttons.find(b => b.role === buttonClicked);

            if (clickedButton && clickedButton.handler) {
                try {
                    const handlerResult = clickedButton.handler();
                    if (handlerResult === false) return; // If handler returns false, prevent dismiss
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
        // `present` is already guarded, so this will effectively be a no-op on the server
        // and the promise will resolve to undefined.
        await this.present({
            header,
            message,
            buttons: [{ text: okText, role: 'confirm' }]
        });
        // No return value needed here, the void promise is fine.
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
                { text: cancelText, role: 'cancel', data: false },
                { text: okText, role: 'confirm', data: true }
            ]
        });
        
        // `result` will be undefined if on the server (due to guard in `present`)
        if (result) { // This check also implicitly confirms we are on the browser if result is not undefined
            return { role: result.role as 'confirm' | 'cancel', data: result.data };
        }
        return undefined; // Dismissed via backdrop/escape or if on server
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
      if (isPlatformBrowser(this.platformId)) { // Only log in browser if you want to see console output
          console.log('showCustomAlert Result:', result);
      }
    }

    async showConfirmationDialog(
        title: string, 
        message: string, 
        customButtons?: AlertButton[]
    ): Promise<{role: string, data?:any, values?: { [key: string]: string | number } } | undefined> {
      const result = await this.present({
        header: title,
        message: message,
        buttons: customButtons ? customButtons : [
          { text: 'Cancel', role: 'cancel', data: false } as AlertButton,
          { text: 'OK', role: 'confirm', data: true } as AlertButton,
        ],
        backdropDismiss: false
      });
      return result; // `result` will be undefined if on server
    }

    async showPromptDialog(
        header: string,
        message: string,
        inputs: AlertInput[],
        okText: string = 'OK',
        cancelText: string = 'Cancel'
    ): Promise<{ [key: string]: string | number } | null> {
        const result = await this.present({
            header,
            message,
            inputs,
            buttons: [
                { text: cancelText, role: 'cancel', data: false },
                { text: okText, role: 'confirm', data: true }
            ],
            backdropDismiss: false
        });

        // `result` will be undefined if on server
        if (result && result.role === 'confirm' && result.data === true) {
            return result.values || {};
        }
        return null; // Cancelled, dismissed, or on server
    }
}