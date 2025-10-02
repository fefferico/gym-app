import { Directive, Input, TemplateRef, ViewContainerRef, ViewRef } from '@angular/core';

interface NgLetContext<T> {
  ngLet: T;
}

@Directive({
  selector: '[ngLet]',
  standalone: true,
})
export class NgLetDirective<T> {
  private context: NgLetContext<T> = { ngLet: null! };
  private viewRef: ViewRef | null = null;

  constructor(
    private readonly viewContainer: ViewContainerRef,
    private readonly templateRef: TemplateRef<NgLetContext<T>>
  ) {}

  @Input()
  set ngLet(value: T) {
    this.context.ngLet = value;
    if (!this.viewRef) {
      this.viewRef = this.viewContainer.createEmbeddedView(this.templateRef, this.context);
    }
  }
}