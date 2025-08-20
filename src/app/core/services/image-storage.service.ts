import { Injectable, inject } from '@angular/core';
import { NgxIndexedDBService } from 'ngx-indexed-db';
import { firstValueFrom } from 'rxjs';


export interface PhotoBackup {
    date: string;
    type: string; // e.g., 'image/jpeg'
    data: string; // Base64 encoded image data
}

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

    /**
     * Retrieves all photos from IndexedDB and converts them to a serializable format for backup.
     * @returns A promise that resolves to an array of PhotoBackup objects.
     */
    async getAllImagesForBackup(): Promise<PhotoBackup[]> {
        const allEntries = await firstValueFrom(this.dbService.getAll(this.STORE_NAME)) as { date: string, image: Blob }[];

        const backupData: PhotoBackup[] = [];
        for (const entry of allEntries) {
            if (entry.image instanceof Blob) {
                const base64Data = await this.blobToBase64(entry.image);
                backupData.push({
                    date: entry.date,
                    type: entry.image.type,
                    data: base64Data
                });
            }
        }
        return backupData;
    }

    /**
     * Imports an array of photos from a backup, converting them from Base64 and storing them in IndexedDB.
     * This will overwrite any existing photos for the same dates.
     * @param photos The array of PhotoBackup objects to import.
     */
    async importImages(photos: PhotoBackup[]): Promise<any> {
        if (!photos || photos.length === 0) {
            return Promise.resolve();
        }

        const entriesToStore = photos.map(photo => {
            const imageBlob = this.base64ToBlob(photo.data, photo.type);
            return { date: photo.date, image: imageBlob };
        });

        // Use bulkPut to efficiently add/update all entries at once.
        return firstValueFrom(this.dbService.bulkPut(this.STORE_NAME, entriesToStore));
    }

    // --- HELPER METHODS ---

    /**
     * Converts a Blob object to a Base64 encoded string.
     */
    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Converts a Base64 string back into a Blob object.
     */
    private base64ToBlob(base64: string, contentType: string = ''): Blob {
        // The data URL format is "data:[<mediatype>];base64,<data>"
        const byteCharacters = atob(base64.split(',')[1]);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }

        return new Blob(byteArrays, { type: contentType });
    }
}