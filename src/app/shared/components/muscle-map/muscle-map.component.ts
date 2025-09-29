import { Component, Input, ElementRef, ViewChild, OnChanges, SimpleChanges, Renderer2, inject, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MuscleHighlight, MuscleMapService } from '../../../core/services/muscle-map.service';

@Component({
  selector: 'app-muscle-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './muscle-map.component.html',
  styleUrls: ['./muscle-map.component.scss']
})
// --- FIX: Add AfterViewInit to the implemented interfaces ---
export class MuscleMapComponent implements OnChanges, AfterViewInit {
  @Input() muscles: MuscleHighlight = { primary: [], secondary: [] };

  @ViewChild('muscleSvg', { static: false }) muscleSvgRef!: ElementRef<SVGElement>;

  private muscleMapService = inject(MuscleMapService);
  private renderer = inject(Renderer2);

  private isViewInitialized = false;

  ngAfterViewInit(): void {
    // 1. Set the flag to true because the view is now ready.
    this.isViewInitialized = true;
    
    // 2. Call the coloring logic to handle the initial @Input value.
    this.updateMuscleColors();
  }

  /**
   * --- FIX: This hook now safely checks if the view is ready before proceeding. ---
   * It will handle all subsequent changes to the `muscles` input property.
   */
  ngOnChanges(changes: SimpleChanges): void {
    // Only run the update logic if:
    // 1. The 'muscles' property has actually changed.
    // 2. The view has already been initialized (ngAfterViewInit has run).
    if (changes['muscles'] && this.isViewInitialized) {
      this.updateMuscleColors();
    }
  }

  /**
   * A central method to trigger the muscle coloring logic.
   * It is now called safely from both ngAfterViewInit and ngOnChanges.
   */
  private updateMuscleColors(): void {
    // --- FIX: The guard clause here is now a secondary safety measure. ---
    // The main protection comes from the isViewInitialized flag.
    if (!this.muscleSvgRef || !this.muscles) {
      return;
    }

    // Delegate the coloring logic to the MuscleMapService.
    this.muscleMapService.colorMuscles(
      this.renderer,
      this.muscleSvgRef.nativeElement,
      this.muscles
    );
  }
}