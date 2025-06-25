import { Directive, ElementRef, HostListener, OnInit, inject } from '@angular/core';

@Directive({
  selector: 'textarea[appAutoGrow]',
  standalone: true,
})
export class AutoGrowDirective implements OnInit {
  // inject(ElementRef) gives us a safe, typed reference to the host element.
  private textAreaElement = inject(ElementRef<HTMLTextAreaElement>).nativeElement;

  // Listen for the 'input' event on the host element itself.
  // We don't need to pass $event.target because we already have a reference.
  @HostListener('input')
  onInput(): void {
    // The method is now guaranteed to be called on the correct element.
    this.adjustHeight();
  }

  ngOnInit(): void {
    // On initialization, and after the initial value is set, adjust the height.
    // The timeout is a good practice to ensure rendering is complete.
    setTimeout(() => this.adjustHeight(), 0);
  }

  /**
   * Adjusts the height of the textarea to fit its content.
   */
  private adjustHeight(): void {
    // 1. Reset height to 'auto' to correctly handle shrinking when text is deleted.
    this.textAreaElement.style.height = 'auto';

    // 2. Set the height to match the content's full scroll height.
    this.textAreaElement.style.height = `${this.textAreaElement.scrollHeight}px`;
  }
}