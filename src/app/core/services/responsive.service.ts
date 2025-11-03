// responsive.service.ts
import { inject, Injectable, Signal, signal } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ResponsiveService {
  // 1. Declare the signal property without initializing it here.
  public readonly isMobile: Signal<boolean>;

  // 2. Inject the service using the modern `inject` function, or keep it as a constructor parameter.
  private breakpointObserver = inject(BreakpointObserver);

  constructor() {
    // 3. Now, inside the constructor, `this.breakpointObserver` is guaranteed to be available.
    //    Initialize the `isMobile` signal here.
    this.isMobile = toSignal(
      this.breakpointObserver.observe(Breakpoints.Handset).pipe(
        map(result => result.matches)
      ),
      { initialValue: false } // Providing an initial value is a good practice
    );
  }
}