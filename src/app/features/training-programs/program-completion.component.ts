import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { TrainingProgram } from '../../core/models/training-program.model';
import { TrainingProgramService } from '../../core/services/training-program.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-program-completion',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <div class="flex flex-col items-center justify-center h-full text-center p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <ng-container *ngIf="program$ | async as program; else loading">
        <div class="max-w-md w-full">
          <div class="text-6xl mb-4">🎉</div>
          <h1 class="text-3xl font-bold text-primary mb-2">Congratulations!</h1>
          <p class="text-lg mb-4">You have successfully completed the</p>
          <h2 class="text-2xl font-semibold mb-6">{{ program.name }}</h2>

          <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <p class="mb-4">
              You've shown incredible dedication and consistency. Take a moment to be proud of your hard work and the progress you've made.
            </p>
            <p class="font-semibold">What's next? You've earned it!</p>
          </div>

          <div class="flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-4 pt-4">
            <a [routerLink]="['/workout/summary', workoutLogId]" class="flex justify-center items-center w-full sm:w-auto px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md shadow-sm text-lg disabled:opacity-50 disabled:cursor-not-allowed">
              <app-icon name="schedule" class="w-8 h-8"></app-icon>
              WORKOUT SUMMARY
            </a>
            <a [routerLink]="['/training-programs']" class="flex justify-center items-center w-full sm:w-auto px-6 py-3 bg-primary hover:bg-primary-dark text-white font-semibold rounded-md shadow-sm text-lg disabled:opacity-50 disabled:cursor-not-allowed">
              <app-icon name="calendar" class="w-8 h-8"></app-icon>
              EXPLORE PROGRAMS
            </a>
          </div>
        </div>
      </ng-container>
      <ng-template #loading>
        <p>Loading program details...</p>
      </ng-template>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
    `
  ]
})
export class ProgramCompletionComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private programService = inject(TrainingProgramService);

  program$!: Observable<TrainingProgram | undefined>;
  workoutLogId: string | null = null;

  ngOnInit(): void {
    const programId = this.route.snapshot.paramMap.get('programId');
    this.workoutLogId = this.route.snapshot.queryParamMap.get('logId');

    if (programId) {
      this.program$ = this.programService.getProgramById(programId);
    }
  }
}