import { Injectable, inject } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { DialogConfig, DialogOutput } from '../models/dialog.types';
import { DynamicDialogComponent } from '../../shared/components/dynamic-dialog.component/dynamic-dialog.component';

@Injectable({ providedIn: 'root' })
export class ModalService {
    private dialog = inject(Dialog);

    /**
     * Opens the dialog and returns an observable that ONLY emits if confirmed.
     */
    prompt<T = any>(config: DialogConfig): Observable<T> {
        const dialogRef = this.dialog.open<DialogOutput>(DynamicDialogComponent, {
            data: config,

            // 1. Force user to interact
            disableClose: true,

            // 2. Apply the Global CSS Class for Dark + Blur
            backdropClass: 'app-modal-backdrop',

            // 3. Apply class to the panel wrapper (optional, helps with mobile widths)
            panelClass: 'app-modal-panel',

            // 4. PREVENT SCROLLING
            // 'Dialog' uses the 'BlockScrollStrategy' by default, which adds
            // a class to the <html> tag to set overflow: hidden.
            // You usually don't need to change this line, but this is how you'd force it:
            // scrollStrategy: this.sso.block() 
        });

        return dialogRef.closed.pipe(
            filter(result => result?.action === 'CONFIRM'),
            map(result => result?.data as T)
        );
    }
}