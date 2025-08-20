import { Injectable, inject } from '@angular/core';
import { NgxIndexedDBService } from 'ngx-indexed-db';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ImageStorageService {
    private readonly STORE_NAME = 'progress_photos';
    private dbService = inject(NgxIndexedDBService);

    /**
     * Saves or updates an image for a specific date.
     * @param date The date string (YYYY-MM-DD) used as the key.
     * @param imageBlob The image file/blob to store.
     */
    async saveImage(date: string, imageBlob: Blob): Promise<any> {
        return firstValueFrom(
            this.dbService.update(this.STORE_NAME, { date, image: imageBlob })
        );
    }

    /**
     * Retrieves an image blob for a specific date.
     * @param date The date string (YYYY-MM-DD) to look up.
     * @returns A promise that resolves to the image Blob or undefined if not found.
     */
    async getImage(date: string): Promise<Blob | undefined> {
        if (!date) {
            return Promise.resolve(undefined);
        }

        const result = await firstValueFrom(this.dbService.getByKey(this.STORE_NAME, date)) as { image?: Blob } | undefined;
        return result ? result.image : undefined;
    }

    /**
    * Deletes an image for a specific date.
    * @param date The date string (YYYY-MM-DD) key of the image to delete.
    */
    async deleteImage(date: string): Promise<any> {
        if (!date) {
            return Promise.resolve();
        }
        return firstValueFrom(this.dbService.delete(this.STORE_NAME, date));
    }
}