// src/app/shared/components/barbell-calculator-modal/plate-summary.component.ts
import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlateLoadout } from '../../../../core/services/barbell-calculator.service';

@Component({
  selector: 'app-plate-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="summary-container" *ngIf="sortedLoadout().length > 0">
      <div *ngFor="let item of sortedLoadout()" class="plate-group">
        <div class="summary-plate"
             [style.background-color]="item.plate.color"
             [style.border-color]="item.plate.color === '#FAFAFA' || !item.plate.color ? '#ccc' : item.plate.color">
          <span [style.color]="getTextColor(item.plate.color)">
            {{ item.plate.weight }}
          </span>
        </div>
        <span class="plate-quantity-badge">
          {{ item.count }}x
        </span>
      </div>
    </div>
  `,
  // --- STYLES UPDATED TO REPOSITION THE TEXT ---
  styles: [`
    :host {
      --modal-bg: #1e1e1e;
      --border-color: #333333;
      --border-color-white: white;
    }
    .summary-container {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      padding: 8px;
    }
    .plate-group {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .summary-plate {
      width: 48px;
      height: 48px;
      border-radius: 80%;
      border: 2px solid var(--border-color);
      position: relative; 
      flex-shrink: 0;
      display: flex;
      align-items: flex-start; /* Aligns text to the top */
      justify-content: center; /* Keeps text centered horizontally */
      font-size: 12px;
      font-weight: bold;
      box-sizing: border-box; /* Ensures padding is included in the height */
    }
    .summary-plate::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 12px;
      height: 12px;
      background-color: var(--modal-bg);
      border-radius: 50%;
      border: 2px solid var(--border-color-white);
    }
    .plate-quantity-badge {
      position: absolute;
      bottom: -4px;
      right: -4px;
      background-color: rgba(0, 0, 0, 0.75);
      color: #ffffff;
      font-size: 0.7rem;
      font-weight: bold;
      line-height: 1;
      padding: 3px 6px;
      border-radius: 10px;
      pointer-events: none;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  `]
})
export class PlateSummaryComponent {
  // --- The TypeScript logic remains unchanged ---
  private readonly loadoutSignal = signal<PlateLoadout[]>([]);

  @Input({ required: true })
  set loadout(value: PlateLoadout[]) {
    this.loadoutSignal.set(value);
  }

  sortedLoadout = computed(() => {
    return [...this.loadoutSignal()].sort((a, b) => b.plate.weight - a.plate.weight);
  });

  getTextColor(plateColor: string | undefined): string {
    if (!plateColor) return '#FFFFFF';
    const darkColors = ['#D32F2F', '#FF0000', '#1976D2', '#424242', '#111111', '#000000FF', '#0000FF','#43A047'];
    return darkColors.includes(plateColor.toUpperCase()) ? '#FFFFFF' : '#111111';
  }
}