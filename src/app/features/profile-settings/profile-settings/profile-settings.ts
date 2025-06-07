// src/app/features/profile-settings/profile-settings.component.ts
import { Component, inject, signal } from '@angular/core'; // Added signal
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { format } from 'date-fns'; // For file naming
import { WorkoutService } from '../../../core/services/workout.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { StorageService } from '../../../core/services/storage.service';
import { UnitsService, WeightUnit } from '../../../core/services/units.service';
import { AlertService } from '../../../core/services/alert.service';
import { SpinnerService } from '../../../core/services/spinner.service';
import { ThemeService } from '../../../core/services/theme.service'; // Import ThemeService

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './profile-settings.html',
  styleUrl: './profile-settings.scss',
})
export class ProfileSettingsComponent {
  private workoutService = inject(WorkoutService);
  private trackingService = inject(TrackingService);
  private storageService = inject(StorageService); // For clearing data
  private unitsService = inject(UnitsService); // Inject UnitsService
  private alertService = inject(AlertService); // Inject UnitsService
  private spinnerService = inject(SpinnerService); // Inject UnitsService
  themeService = inject(ThemeService); // Inject ThemeService and make public for template

  // Define a version for your backup format
  private readonly BACKUP_VERSION = 1;
  private readonly BACKUP_KEY = 'fitTrackPro_backup'; // A key to store the combined object if needed internally
  // or just used as a signature
  // Signal to hold the current unit preference for UI binding
  currentUnit = this.unitsService.currentUnit;

  constructor() {
    window.scrollTo(0, 0);
  }

  // --- Unit Preference Logic ---
  selectUnit(unit: WeightUnit): void {
    this.unitsService.setUnitPreference(unit);
  }

  // --- Export Logic ---
  exportData(): void {
    this.spinnerService.show('Exporting data...');

    // 1. Get data from all relevant services
    const backupData = {
      version: this.BACKUP_VERSION,
      timestamp: new Date().toISOString(), // When backup was created
      routines: this.workoutService.getDataForBackup(),
      workoutLogs: this.trackingService.getLogsForBackup(),
      personalBests: this.trackingService.getPBsForBackup(),
      // Add other data here if you store more things (e.g., exercise customizations if implemented)
    };

    // 2. Convert the data object to a JSON string
    const jsonString = JSON.stringify(backupData, null, 2); // Use null, 2 for pretty-printing

    // 3. Create a Blob from the JSON string
    const blob = new Blob([jsonString], { type: 'application/json' });

    // 4. Create a download link and trigger the download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateString = format(new Date(), 'yyyyMMdd_HHmmss');
    a.download = `FitTrackPro_backup_${dateString}.json`;
    a.href = url;
    a.click();

    // 5. Clean up the URL object
    URL.revokeObjectURL(url);
    console.log('Data export initiated.');
    // Add user feedback (e.g., toast notification)
    this.spinnerService.hide();
  }

  // --- Import Logic ---
  importData(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      console.log('No file selected for import.');
      // Add user feedback
      return;
    }

    if (file.type !== 'application/json') {
      alert('Invalid file type. Please select a JSON file.'); // Replace with better feedback
      input.value = ''; // Clear the file input
      return;
    }

    console.log(`Importing file: ${file.name}`);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result as string;
        const importedData = JSON.parse(fileContent);

        // --- Validation ---
        if (typeof importedData !== 'object' || importedData === null) {
          alert('Invalid backup file format. Expected an object.');
          input.value = '';
          return;
        }
        if (importedData.version !== this.BACKUP_VERSION) {
          alert(`Invalid backup file version. Expected ${this.BACKUP_VERSION}, got ${importedData.version}. Please use a compatible backup file.`);
          input.value = '';
          return;
        }
        if (!importedData.routines || !importedData.workoutLogs || !importedData.personalBests) {
          alert('Invalid backup file content. Missing essential data sections (routines, workoutLogs, personalBests).');
          input.value = '';
          return;
        }
        // TODO: More granular validation of each data section (e.g., are routines items arrays? Do they have expected keys?)

        // --- Confirmation ---

        this.alertService.showConfirm("WARNING", "Importing data will OVERWRITE your current workout logs, routines, and personal bests. Are you sure you want to proceed?").then((result) => {
          if (result && (result.data)) {
            // --- Import Data ---
            this.workoutService.replaceData(importedData.routines);
            this.trackingService.replaceLogs(importedData.workoutLogs);
            this.trackingService.replacePBs(importedData.personalBests);
            console.log('Data import successful.');
            // Optionally navigate or reload data displays
            this.alertService.showAlert("Info", "Data imported successfully!");
          } else {
            console.log('Data import cancelled by user.');
            alert('Data import cancelled.'); // Replace with better feedback
          }
        })
      } catch (error) {
        console.error('Error processing imported file:', error);
        alert('Error processing backup file. Please ensure it is a valid JSON file.'); // Replace with better feedback
      } finally {
        input.value = ''; // Clear the file input regardless of success/failure
      }
    };

    reader.onerror = (error) => {
      console.error('File reading error:', error);
      alert('Error reading file.'); // Replace with better feedback
      input.value = '';
    };

    // Read the file content as text
    reader.readAsText(file);
  }

  // --- Other Settings / Actions ---

  // Example: Placeholder for unit preferences (requires significant app-wide changes)
  // units: 'kg' | 'lbs' = 'kg';
  // setUnits(units: 'kg' | 'lbs'): void { ... }

  // Clear All Data (using the dev method from TrackingService/WorkoutService)
  clearAllAppData(): void {
    this.alertService.showConfirm("WARNING", "This will delete ALL your workout data (routines, logs, PBs). This cannot be undone. Are you sure?").then((result) => {
      if (result && (result.data)) {
        // Call the specific clear methods you added earlier
        if (this.trackingService.clearAllWorkoutLogs_DEV_ONLY) this.trackingService.clearAllWorkoutLogs_DEV_ONLY();
        if (this.trackingService.clearAllPersonalBests_DEV_ONLY) this.trackingService.clearAllPersonalBests_DEV_ONLY();
        // Assuming you added a clearAllRoutines_DEV_ONLY to WorkoutService
        if (this.workoutService.clearAllRoutines_DEV_ONLY) this.workoutService.clearAllRoutines_DEV_ONLY();

        console.log("All application data cleared.");
        this.alertService.showConfirm("Info","All workout data has been cleared."); // Replace with better feedback
      }
    });
  }
}