// src/app/core/services/personal-gym.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { AlertService } from './alert.service';
import { PersonalGymEquipment } from '../models/personal-gym.model';
import { Equipment } from '../models/equipment.model';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class PersonalGymService {
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
  private alertService = inject(AlertService);
  private translate = inject(TranslateService);

  private readonly PERSONAL_GYM_STORAGE_KEY = 'fitTrackPro_personalGym';

  // --- State Management ---
  private equipmentSubject = new BehaviorSubject<PersonalGymEquipment[]>(this._loadFromStorage());
  public equipment$: Observable<PersonalGymEquipment[]> = this.equipmentSubject.asObservable();

  constructor() { }

  /**
   * Loads the user's saved equipment from local storage.
   */
  private _loadFromStorage(): PersonalGymEquipment[] {
    const equipment = this.storageService.getItem<PersonalGymEquipment[]>(this.PERSONAL_GYM_STORAGE_KEY);
    return equipment ? this._sortEquipment(equipment) : [];
  }

  /**
   * Saves the complete list of equipment to local storage and updates the observable.
   */
  private _saveToStorage(equipment: PersonalGymEquipment[]): void {
    const sortedEquipment = this._sortEquipment(equipment);
    this.storageService.setItem(this.PERSONAL_GYM_STORAGE_KEY, sortedEquipment);
    this.equipmentSubject.next(sortedEquipment);
  }

  /**
   * Sorts equipment primarily by category, then alphabetically by name for consistent display.
   */
  private _sortEquipment(equipment: PersonalGymEquipment[]): PersonalGymEquipment[] {
    return equipment.sort((a, b) => {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  // --- Public API Methods ---

  /**
   * Returns an observable of all equipment in the user's Personal Gym.
   */
  public getAllEquipment(): Observable<PersonalGymEquipment[]> {
    return this.equipment$;
  }

  /**
   * Retrieves a single piece of equipment by its unique ID.
   * @param id The ID of the equipment to retrieve.
   */
  public getEquipmentById(id: string): Observable<PersonalGymEquipment | undefined> {
    return this.equipment$.pipe(
      map(equipmentList => equipmentList.find(item => item.id === id))
    );
  }

  /**
   * Adds a new piece of equipment to the user's gym.
   * @param equipmentData The data for the new equipment, without an ID.
   * @returns The newly created equipment object with its generated ID.
   */
  public addEquipment<T extends Omit<PersonalGymEquipment, 'id'>>(equipmentData: T): PersonalGymEquipment {
    const newItem = {
      ...equipmentData,
      id: uuidv4(),
    } as PersonalGymEquipment;

    const currentItems = this.equipmentSubject.getValue();
    const updatedItems = [...currentItems, newItem];
    this._saveToStorage(updatedItems);

    const title = this.translate.instant('personalGymService.addSuccessTitle');
    const message = this.translate.instant('personalGymService.addSuccessMessage', { name: newItem.name });
    this.toastService.success(message, 3000, title);
    return newItem;
  }

  /**
   * Updates an existing piece of equipment.
   * @param updatedEquipment The complete, updated equipment object.
   */
  public updateEquipment(updatedEquipment: PersonalGymEquipment): void {
    const currentItems = this.equipmentSubject.getValue();
    const index = currentItems.findIndex(item => item.id === updatedEquipment.id);

    if (index > -1) {
      const updatedItemsArray = [...currentItems];
      updatedItemsArray[index] = updatedEquipment;
      this._saveToStorage(updatedItemsArray);
      const title = this.translate.instant('personalGymService.updateSuccessTitle');
      const message = this.translate.instant('personalGymService.updateSuccessMessage', { name: updatedEquipment.name });
      this.toastService.success(message, 3000, title);
    } else {
      const title = this.translate.instant('personalGymService.updateFailedTitle');
      const message = this.translate.instant('personalGymService.updateFailedMessage', { name: updatedEquipment.name });
      this.toastService.error(message, 0, title);
    }
  }

  /**
   * Deletes a piece of equipment from the user's gym after confirmation.
   * @param equipmentId The ID of the equipment to delete.
   */
  public async deleteEquipment(equipmentId: string): Promise<void> {
    const currentItems = this.equipmentSubject.getValue();
    const itemToDelete = currentItems.find(item => item.id === equipmentId);

    if (!itemToDelete) {
      const title = this.translate.instant('personalGymService.deleteFailedTitle');
      const message = this.translate.instant('personalGymService.deleteFailedMessage');
      this.toastService.error(message, 0, title);
      return;
    }

    const confirmTitle = this.translate.instant('personalGymService.deleteConfirmTitle');
    const confirmMessage = this.translate.instant('personalGymService.deleteConfirmMessage', { name: itemToDelete.name });

    const confirm = await this.alertService.showConfirm(confirmTitle, confirmMessage);


    if (confirm && confirm.data) {
      const updatedItems = currentItems.filter(item => item.id !== equipmentId);
      this._saveToStorage(updatedItems);
      const deletedTitle = this.translate.instant('personalGymService.deletedTitle');
      const deletedMessage = this.translate.instant('personalGymService.deletedMessage', { name: itemToDelete.name });
      this.toastService.info(deletedMessage, 3000, deletedTitle);
    }
  }

  // --- Data Management for Backup/Restore ---

  /**
   * Retrieves the current list of equipment for data backup.
   */
  public getDataForBackup(): PersonalGymEquipment[] {
    return this.equipmentSubject.getValue();
  }

  /**
   * Merges imported equipment data with existing data.
   * - Overwrites items with the same ID.
   * - Adds new items.
   * - Preserves local items not in the import file.
   * @param newEquipment The array of equipment to merge.
   */
  public mergeData(newEquipment: PersonalGymEquipment[]): void {
    if (!Array.isArray(newEquipment)) {
      console.error('PersonalGymService: Imported data for equipment is not an array.');
      const errorTitle = this.translate.instant('personalGymService.importErrorTitle');
      const errorMessage = this.translate.instant('personalGymService.importFailed');
      this.toastService.error(errorMessage, 0, errorTitle);
      return;
    }

    const currentItems = this.equipmentSubject.getValue();
    const equipmentMap = new Map<string, PersonalGymEquipment>(
      currentItems.map(item => [item.id, item])
    );

    let updatedCount = 0;
    let addedCount = 0;

    newEquipment.forEach(importedItem => {
      if (!importedItem.id || !importedItem.name) {
        console.warn('Skipping invalid equipment during import:', importedItem);
        return;
      }

      if (equipmentMap.has(importedItem.id)) {
        updatedCount++;
      } else {
        addedCount++;
      }
      equipmentMap.set(importedItem.id, importedItem);
    });

    const mergedEquipment = Array.from(equipmentMap.values());
    this._saveToStorage(mergedEquipment);

    const successTitle = this.translate.instant('personalGymService.mergeSuccessTitle');
    const successMessage = this.translate.instant('personalGymService.mergeSuccessMessage', { updatedCount, addedCount });
    this.toastService.success(successMessage, 6000, successTitle);
  }

  /**
     * Hides an equipment by setting its `isHidden` flag to true.
     * The equipment is filtered out from the main `equipment$` observable but remains in storage.
     * @param equipmentId The ID of the equipment to hide.
     * @returns An Observable of the updated equipment or undefined if not found.
     */
  public hideEquipment(equipmentId: string): Observable<Equipment | undefined> {
    const currentEquipments = this.equipmentSubject.getValue();
    const equipmentIndex = currentEquipments.findIndex(ex => ex.id === equipmentId);

    if (equipmentIndex === -1) {
      this.toastService.error('Failed to hide equipment: not found.', 0, "Error");
      return of(undefined);
    }

    const updatedEquipments = [...currentEquipments];
    const equipmentToUpdate = { ...updatedEquipments[equipmentIndex], isHidden: true };
    updatedEquipments[equipmentIndex] = equipmentToUpdate;

    this._saveToStorage(updatedEquipments);
    this.toastService.info(`'${equipmentToUpdate.name}' is now hidden.`, 3000, "Hidden");
    return of(equipmentToUpdate);
  }

  /**
   * Un-hides an equipment by setting its `isHidden` flag to false.
   * The equipment will reappear in the main `equipment$` observable.
   * @param equipmentId The ID of the equipment to make visible.
   * @returns An Observable of the updated equipment or undefined if not found.
   */
  public unhideEquipment(equipmentId: string): Observable<Equipment | undefined> {
    const currentEquipments = this.equipmentSubject.getValue();
    const equipmentIndex = currentEquipments.findIndex(ex => ex.id === equipmentId);

    if (equipmentIndex === -1) {
      this.toastService.error('Failed to un-hide equipment: not found.', 0, "Error");
      return of(undefined);
    }

    const updatedEquipments = [...currentEquipments];
    const equipmentToUpdate = { ...updatedEquipments[equipmentIndex], isHidden: false };
    updatedEquipments[equipmentIndex] = equipmentToUpdate;

    this._saveToStorage(updatedEquipments);
    this.toastService.success(`'${equipmentToUpdate.name}' is now visible.`, 3000, "Visible");
    return of(equipmentToUpdate);
  }

  /**
   * Returns an observable list of ONLY the exercises that are currently hidden.
   * This is useful for a management page where a user can un-hide them.
   * @returns An Observable emitting an array of hidden Exercise objects.
   */
  public getHiddenEquipments(): Observable<Equipment[]> {
    return this.equipmentSubject.asObservable().pipe(
      map(equipments => equipments.filter(eq => eq.isHidden))
    );
  }
}