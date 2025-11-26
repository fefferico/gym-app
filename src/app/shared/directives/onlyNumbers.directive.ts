import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
    selector: 'input[numbersOnly]',
    standalone: true
})
export class NumbersOnlyDirective {

    constructor(private _el: ElementRef) { }

    @HostListener('input', ['$event']) onInputChange(event: any) {
        let initialValue = this._el.nativeElement.value;

        // 1. Replace anything that is NOT 0-9 or a Dot (.)
        // Note: If you want to support commas (European style), use /[^0-9.,]*/g
        let newValue = initialValue.replace(/[^0-9.]*/g, '');

        // 2. Ensure only ONE decimal point exists.
        // We split by the dot. If there are more than 2 parts, it means there are multiple dots.
        const parts = newValue.split('.');
        if (parts.length > 2) {
            // Keep the first part, add the first dot, and join the rest (removing extra dots)
            newValue = parts.shift() + '.' + parts.join('');
        }

        // 3. Update the value if it changed
        if (initialValue !== newValue) {
            this._el.nativeElement.value = newValue;

            // Dispatch input event manually if needed for some reactive forms, 
            // but usually stopPropagation is enough to keep the model clean
            event.stopPropagation();

            // If using ngModel, we sometimes need to force an update cycle
            // providing the sanitized value back to the model
            this._el.nativeElement.dispatchEvent(new Event('input'));
        }
    }
}