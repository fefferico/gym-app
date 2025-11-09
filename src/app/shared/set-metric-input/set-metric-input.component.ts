import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '../components/icon/icon.component';
import { CommonModule } from '@angular/common';
import { METRIC } from '../../core/models/workout.model';

@Component({
  selector: 'app-set-metric-input',
  templateUrl: './set-metric-input.component.html',
  styleUrls: ['./set-metric-input.component.scss'],
  imports: [TranslateModule, IconComponent, FormsModule, ReactiveFormsModule, CommonModule],
})
export class SetMetricInputComponent {
  @Input() setControl!: FormGroup;
  @Input() field!: METRIC | 'incrementer';
  @Input() exIndex?: number;
  @Input() setIndex?: number;
  @Input() mode?: string;
  @Input() isViewMode = false;
  @Input() metricEnum: any;
  @Input() unitService: any;
  @Input() workoutUtilsService: any;
  @Input() getFormControlName!: (field: METRIC | string) => string;
  @Input() onShortPressDecrement?: any;
  @Input() onLongPressDecrement?: any;
  @Input() onPressRelease?: any;
  @Input() onShortPressIncrement?: any;
  @Input() onLongPressIncrement?: any;
  @Input() onExactInputChange?: any;
  @Input() onInputFocus?: any;
  @Input() selectInputText?: any;
  @Input() onInputBlur?: any;
  @Input() onInputWheel?: any;
  @Input() onInputTouchStart?: any;
  @Input() onInputTouchMove?: any;
  @Input() openMetricSchemeModal?: any;
  @Input() getSetMetricDisplayValue?: any;
  @Input() getExactInputValue?: any;
  @Input() isAnimatingSet?: any;
  @Input() updateTargetField?: any;
  // Add missing properties for compatibility
  @Input() focusInput?: any;
  @Input() animatingInputText?: any;
  @Input() input_number_class?: any;
  @Input() input_number_class_separator?: any;
}