// src/app/core/services/alert.service.ts
import { Injectable, ApplicationRef, createComponent, EnvironmentInjector, ComponentRef } from '@angular/core';
import { AlertComponent } from '../../shared/components/alert/alert.component';
import { AlertButton, AlertOptions, AlertInput } from '../models/alert.model';

@Injectable({
    providedIn: 'root'
})
export class AlertService {
    private alertComponentRef: ComponentRef<AlertComponent> | null = null;

    constructor(
        private appRef: ApplicationRef,
        private injector: EnvironmentInjector
    ) { }

    async present(options: AlertOptions): Promise<{ role: string, data?: any, values?: { [key: string]: string | number } } | undefined> {
        if (this.alertComponentRef) {
            this.dismiss(undefined); // Dismiss any existing alert
        }

        return new Promise((resolve) => {
            const alertComponentRef: ComponentRef<AlertComponent> = createComponent(AlertComponent, {
                environmentInjector: this.injector,
            });

            this.appRef.attachView(alertComponentRef.hostView);
            const domElem = (alertComponentRef.hostView as any).rootNodes[0] as HTMLElement;
            document.body.appendChild(domElem);

            this.alertComponentRef = alertComponentRef;

            alertComponentRef.instance.options = options;
            alertComponentRef.instance.dismissed.subscribe((result: { role: string, data?: any, values?: { [key: string]: string | number } } | undefined) => {
                this.dismiss(result); // Internal dismiss also handles handler logic
                resolve(result); // **MODIFIED: Always resolve with the full result object or undefined**
            });

            alertComponentRef.changeDetectorRef.detectChanges();
        });
    }

    dismiss(result?: { role: string, data?: any, values?: { [key: string]: string | number } }): void {
        if (this.alertComponentRef) {
            const buttonClicked = result?.role;
            
            const clickedButton = this.alertComponentRef.instance.options?.buttons.find(b => b.role === buttonClicked);
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
        // For showAlert, we don't typically care about the resolve value, just that it completed.
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
                { text: cancelText, role: 'cancel', data: false },
                { text: okText, role: 'confirm', data: true }
            ]
        });
        
        if (result) { // Result will be { role, data, values }
            return { role: result.role as 'confirm' | 'cancel', data: result.data };
        }
        return undefined; // Dismissed via backdrop/escape
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
      console.log('showCustomAlert Result:', result); // result is now the full object
    }

    async showConfirmationDialog(
        title: string, 
        message: string, 
        customButtons?: AlertButton[]
    ): Promise<{role: string, data?:any, values?: { [key: string]: string | number } } | undefined> { // Return the full result
      const result = await this.present({
        header: title,
        message: message,
        buttons: customButtons ? customButtons : [
          { text: 'Cancel', role: 'cancel', data: false } as AlertButton,
          { text: 'OK', role: 'confirm', data: true } as AlertButton,
        ],
        backdropDismiss: false
      });
      // console.log('showConfirmationDialog Result from present:', result); // For debugging
      return result; // Return the full result object passed from present()
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
                { text: cancelText, role: 'cancel', data: false }, // Added data:false for clearer cancel
                { text: okText, role: 'confirm', data: true }    // Added data:true for clearer confirm
            ],
            backdropDismiss: false
        });

        if (result && result.role === 'confirm' && result.data === true) { // Check for confirm role and data
            return result.values || {}; // Return input values or empty object if none
        }
        return null; // Cancelled or dismissed
    }
}