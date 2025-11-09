import { Directive, ElementRef, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appShatterable]',
  standalone: true // For modern Angular apps
})
export class ShatterableDirective {

  constructor(
    private el: ElementRef<HTMLElement>, 
    private renderer: Renderer2
  ) {}

  // This public method will be called by the trigger directive
  public shatter(): void {
    // 1. Get the exact position and size of the host element
    const rect = this.el.nativeElement.getBoundingClientRect();

    // 2. Hide the original element
    this.renderer.setStyle(this.el.nativeElement, 'transition', 'opacity 0.3s ease-out, transform 0.3s ease-out');
    this.renderer.setStyle(this.el.nativeElement, 'opacity', '0');
    this.renderer.setStyle(this.el.nativeElement, 'transform', 'scale(0.7)');

    // 3. Create a burst of particles
    const particleCount = 60;
    for (let i = 0; i < particleCount; i++) {
      this.createParticle(rect.left, rect.top, rect.width, rect.height);
    }

    // 4. Remove the original element from the DOM after the animation
    setTimeout(() => {
      this.renderer.removeChild(this.el.nativeElement.parentNode, this.el.nativeElement);
    }, 300);
  }

  private createParticle(x: number, y: number, w: number, h: number): void {
    const particle = this.renderer.createElement('div');
    this.renderer.appendChild(document.body, particle);

    const size = Math.floor(Math.random() * 12 + 8);
    const startX = x + Math.random() * w - size / 2;
    const startY = y + Math.random() * h - size / 2;

    const destX = (Math.random() - 0.5) * 600;
    const destY = (Math.random() - 0.5) * 600;
    const rotation = (Math.random() - 0.5) * 720;

    // Apply styles to the particle
    this.renderer.setStyle(particle, 'position', 'absolute');
    this.renderer.setStyle(particle, 'left', `${startX}px`);
    this.renderer.setStyle(particle, 'top', `${startY}px`);
    this.renderer.setStyle(particle, 'width', `${size}px`);
    this.renderer.setStyle(particle, 'height', `${size}px`);
    this.renderer.setStyle(particle, 'background', 'linear-gradient(45deg, #4b5563, #1f2937)'); // gray-600 to gray-800
    this.renderer.setStyle(particle, 'border-radius', '4px');
    this.renderer.setStyle(particle, 'transition', 'transform 1s ease-out, opacity 1s ease-out');

    // Animate the particle
    requestAnimationFrame(() => {
      this.renderer.setStyle(particle, 'transform', `translate(${destX}px, ${destY}px) rotate(${rotation}deg)`);
      this.renderer.setStyle(particle, 'opacity', '0');
    });

    // Remove the particle from the DOM after animation
    setTimeout(() => {
      this.renderer.removeChild(document.body, particle);
    }, 1000);
  }
}