// src/app/features/measurement-history/measurement-history.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgxChartsModule, Color, ScaleType } from '@swimlane/ngx-charts'; // Keep NgxChartsModule import
import { UserProfileService } from '../../core/services/user-profile.service';
import { MeasurementEntry, UserMeasurements, UserProfile, Gender } from '../../core/models/user-profile.model';
import { ToastService } from '../../core/services/toast.service';
import { ImageStorageService } from '../../core/services/image-storage.service';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { AlertService } from '../../core/services/alert.service';

// Data format for ngx-charts
export interface ChartData {
  name: string;
  series: { name: string; value: number }[];
}

export interface ComparisonRow {
  metricLabel: string;
  unit: string;
  fromValue: number | string;
  toValue: number | string;
  difference: number | null;
}

export interface ComparisonData {
  from: MeasurementEntry & { photoUrl?: string };
  to: MeasurementEntry & { photoUrl?: string };
  rows: ComparisonRow[];
}


@Component({
  selector: 'app-measurement-history',
  standalone: true,
  imports: [CommonModule, NgxChartsModule, ReactiveFormsModule, IconComponent],
  templateUrl: './measurement-history.html',
  styleUrls: ['./measurement-history.scss']
})
export class MeasurementHistoryComponent implements OnInit {
  // Injected Services
  private userProfileService = inject(UserProfileService);
  private imageStorageService = inject(ImageStorageService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  private alertService = inject(AlertService);

  compareFromDate: string = '';
  compareToDate: string = '';

  // Component State
  private userProfile: UserProfile | null = null;
  measurementHistory: (MeasurementEntry & { photoUrl?: string })[] = [];
  fullScreenImageUrl: string | null = null;
  isAddEntryModalOpen = false;
  comparisonData: ComparisonData | null = null;

  // Forms
  entryForm!: FormGroup;

  // Chart Properties
  chartData: ChartData[] = [];
  yAxisLabel: string = 'Value';
  referenceLines: { name: string, value: any }[] = [];

  // --- THE FIX IS HERE ---
  // Change the colorScheme property from a complex object to a simple string.
  colorScheme: string = 'vivid'; 

  availableMetrics: { key: string, label: string }[] = [];

  // Notes Auto-Save
  private notesUpdate$ = new Subject<{ date: string, notes: string }>();

  ngOnInit(): void {
    this.userProfile = this.userProfileService.getProfile();
    this.setupAvailableMetrics();
    this.loadHistory();
    this.initEntryForm();
    this.notesUpdate$.pipe(debounceTime(1000)).subscribe(data => this.saveNotes(data.date, data.notes));
  }

  setupAvailableMetrics(): void {
    this.availableMetrics = [
      { key: 'weightKg', label: 'Weight (kg)' },
      { key: 'bmi', label: 'Body Mass Index (BMI)' },
      { key: 'bodyFat', label: 'Body Fat % (Navy)' },
      { key: 'chestCm', label: 'Chest (cm)' },
      { key: 'waistCm', label: 'Waist (cm)' },
      { key: 'hipsCm', label: 'Hips (cm)' },
      { key: 'neckCm', label: 'Neck (cm)' },
      { key: 'rightArmCm', label: 'Right Arm (cm)' },
    ];
  }

  async loadHistory(): Promise<void> {
    // Refresh profile data on load
    this.userProfile = this.userProfileService.getProfile();
    const history = this.userProfile?.measurementHistory?.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || []; // Show newest first

    // Asynchronously load photos for each entry
    this.measurementHistory = await Promise.all(history.map(async (entry) => {
      if (!entry.date) return null; // Safety check
      const photoBlob = await this.imageStorageService.getImage(entry.date);
      const photoUrl = photoBlob ? URL.createObjectURL(photoBlob) : undefined;
      return { ...entry, photoUrl };
    })).then(results => results.filter(Boolean) as (MeasurementEntry & { photoUrl?: string })[]); // Filter out any nulls from safety check

    // Re-prepare chart data after history is loaded
    if (this.measurementHistory.length > 0) {
      // Find the currently selected metric to maintain the user's view
      const currentMetric = document.getElementById('metric-select') as HTMLSelectElement;
      this.prepareChartData(currentMetric?.value || 'weightKg');
    } else {
        this.chartData = []; // Ensure chart is cleared if history is empty
    }
  }

  // --- Chart Logic with Goals & Calculated Metrics ---
  prepareChartData(metricKey: string): void {
    const metricInfo = this.availableMetrics.find(m => m.key === metricKey);
    this.yAxisLabel = metricInfo ? metricInfo.label : 'Value';

    const processedSeries = this.measurementHistory
      .slice()
      .reverse()
      .map(entry => {
        let value: number | null = null;

        if (metricKey === 'bmi') {
                if (entry.weightKg && this.userProfile?.heightCm && this.userProfile.heightCm > 0) {
                    value = this.userProfileService.calculateBMI(entry.weightKg, this.userProfile.heightCm);
                }
            } else if (metricKey === 'bodyFat') {
          const { gender, heightCm } = this.userProfile || {};
          const { waistCm, neckCm, hipsCm } = entry;

          if (gender && heightCm && waistCm && neckCm) {
            const measurementsForCalc = {
              waistCm,
              neckCm,
              heightCm,
              hipsCm: hipsCm ?? undefined
            };
            value = this.userProfileService.calculateBodyFatNavy(gender, measurementsForCalc);
          }
        } else {
          const directValue = (entry as any)[metricKey];
          if (typeof directValue === 'number') {
            value = directValue;
          }
        }
        return { name: entry.date, value: value };
      });

    const finalSeries = processedSeries.filter(
      (item): item is { name: string; value: number } => item.value !== null && item.value !== undefined && !isNaN(item.value)
    );

    this.chartData = [{ name: this.yAxisLabel, series: finalSeries }];
    this.updateReferenceLine(metricKey);
  }

  updateReferenceLine(metricKey: string): void {
    const goalValue = this.userProfile?.measurementGoals?.[metricKey as keyof UserMeasurements];
    if (typeof goalValue === 'number') {
      this.referenceLines = [{ name: 'Goal', value: goalValue }];
    } else {
      this.referenceLines = [];
    }
  }

  updateChart(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.prepareChartData(selectElement.value);
  }

  // --- Modal & Form Logic ---
  initEntryForm(): void {
    this.entryForm = this.fb.group({
      date: ['', Validators.required],
      weightKg: [null, [Validators.min(0)]],
      waistCm: [null, [Validators.min(0)]],
      neckCm: [null, [Validators.min(0)]],
      chestCm: [null, [Validators.min(0)]],
      hipsCm: [null, [Validators.min(0)]],
      rightArmCm: [null, [Validators.min(0)]],
      notes: ['']
    });
  }

  openAddEntryModal(): void {
    this.entryForm.reset({ date: new Date().toISOString().split('T')[0] });
    this.isAddEntryModalOpen = true;
  }

  saveEntry(): void {
    if (this.entryForm.invalid) return;
    this.userProfileService.addOrUpdateMeasurementEntry(this.entryForm.value);
    this.isAddEntryModalOpen = false;
    this.loadHistory(); // Reload to reflect changes
    this.toastService.success('Entry Saved!');
  }

  // --- Notes Logic ---
  updateNotes(date: string, event: Event): void {
    const notes = (event.target as HTMLTextAreaElement).value;
    this.notesUpdate$.next({ date, notes });
  }

  saveNotes(date: string, notes: string): void {
    const entry = this.measurementHistory.find(e => e.date === date);
    if (entry) {
      const updatedEntry = { ...entry, notes };
      delete updatedEntry.photoUrl; // Ensure temporary property is not saved
      this.userProfileService.addOrUpdateMeasurementEntry(updatedEntry);
      this.toastService.info('Notes auto-saved.', 1500);
    }
  }

  // --- Image Logic ---
  async uploadPhoto(event: Event, date: string): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    try {
      await this.imageStorageService.saveImage(date, file);
      const entryToUpdate = this.measurementHistory.find(e => e.date === date);
      if (entryToUpdate) {
        if (entryToUpdate.photoUrl) URL.revokeObjectURL(entryToUpdate.photoUrl);
        entryToUpdate.photoUrl = URL.createObjectURL(file);
      }
      this.toastService.success('Photo saved!');
    } catch (error) {
      console.error('Failed to save photo:', error);
      this.toastService.error('Could not save photo.');
    } finally {
      input.value = '';
    }
  }

  openFullScreenImage(url: string): void { this.fullScreenImageUrl = url; }
  closeFullScreenImage(): void { this.fullScreenImageUrl = null; }


   /**
   * Updates the 'compareFromDate' property when the user changes the start date dropdown.
   * @param event The DOM event from the select element.
   */
  onCompareFromChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.compareFromDate = selectElement.value;
  }

  /**
   * Updates the 'compareToDate' property when the user changes the end date dropdown.
   * @param event The DOM event from the select element.
   */
  onCompareToChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.compareToDate = selectElement.value;
  }

  // --- Comparison Logic ---

  closeCompareModal(): void {
    this.comparisonData = null;
    this.compareFromDate = '';
    this.compareToDate = '';
  }

  openCompareModal(fromDate: string, toDate: string): void {
    if (!fromDate || !toDate) {
      this.toastService.error('Please select two dates to compare.');
      return;
    }

    let fromEntry = this.measurementHistory.find(e => e.date === fromDate);
    let toEntry = this.measurementHistory.find(e => e.date === toDate);

    if (!fromEntry || !toEntry) {
      this.toastService.error('Could not find the selected entries.');
      return;
    }
    
    // Ensure "from" is always the earlier date for correct calculations
    if (new Date(fromEntry.date) > new Date(toEntry.date)) {
        [fromEntry, toEntry] = [toEntry, fromEntry];
    }

    const rows = this.calculateComparisonRows(fromEntry, toEntry);

    this.comparisonData = {
      from: fromEntry,
      to: toEntry,
      rows: rows
    };
  }

  private calculateComparisonRows(from: MeasurementEntry, to: MeasurementEntry): ComparisonRow[] {
    const metricsToCompare: { key: keyof UserMeasurements, label: string, unit: string }[] = [
      { key: 'weightKg', label: 'Weight', unit: 'kg' },
      { key: 'chestCm', label: 'Chest', unit: 'cm' },
      { key: 'waistCm', label: 'Waist', unit: 'cm' },
      { key: 'hipsCm', label: 'Hips', unit: 'cm' },
      { key: 'neckCm', label: 'Neck', unit: 'cm' },
      { key: 'rightArmCm', label: 'Right Arm', unit: 'cm' },
    ];

    return metricsToCompare.map(metric => {
      const fromValue = from[metric.key as keyof MeasurementEntry] as number | null;
      const toValue = to[metric.key as keyof MeasurementEntry] as number | null;

      let difference: number | null = null;
      if (typeof fromValue === 'number' && typeof toValue === 'number') {
        // Round to 2 decimal places to avoid floating point issues
        difference = parseFloat((toValue - fromValue).toFixed(2));
      }

      return {
        metricLabel: metric.label,
        unit: metric.unit,
        fromValue: fromValue ?? 'N/A',
        toValue: toValue ?? 'N/A',
        difference: difference
      };
    });
  }

  editEntry(date: string): void {
    const entry = this.measurementHistory.find(e => e.date === date);
    if (!entry) {
      this.toastService.error('Entry not found.');
      return;
    }
    // Populate the form with the entry's data
    this.entryForm.setValue({
      date: entry.date,
      weightKg: entry.weightKg ?? null,
      waistCm: entry.waistCm ?? null,
      neckCm: entry.neckCm ?? null,
      chestCm: entry.chestCm ?? null,
      hipsCm: entry.hipsCm ?? null,
      rightArmCm: entry.rightArmCm ?? null,
      notes: entry.notes ?? ''
    });
    this.isAddEntryModalOpen = true;
  }
  
  /**
   * Shows a confirmation dialog before deleting an entry.
   * If confirmed, it removes the entry and its photo, then refreshes the history.
   * @param date The date of the entry to delete.
   */
  async confirmDeleteEntry(date: string): Promise<void> {
    const confirmation = await this.alertService.showConfirm(
      'Delete Entry',
      `Are you sure you want to permanently delete all data for ${date}? This includes any associated photo and cannot be undone.`
    );

    // Proceed only if the user confirmed
    if (confirmation && confirmation.data) {
      try {
        // 1. Delete the measurement data from the user profile
        this.userProfileService.deleteMeasurementEntry(date);

        // 2. Delete the associated photo from IndexedDB
        await this.imageStorageService.deleteImage(date);
        
        this.toastService.success('Entry deleted successfully.');

        // 3. Refresh the component's view to reflect the changes
        await this.loadHistory();

      } catch (error) {
        console.error('Failed to delete entry:', error);
        this.toastService.error('Could not delete the entry.');
      }
    }
  }
}