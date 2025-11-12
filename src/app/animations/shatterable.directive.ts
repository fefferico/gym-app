import { Directive, ElementRef, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appShatterable]',
  standalone: true // For modern Angular apps
})
export class ShatterableDirective {

  constructor(
    public el: ElementRef<HTMLElement>, 
    private renderer: Renderer2
  ) {}

  // This public method will be called by the trigger directive
  public shatter(): void {
  // Fade out the card
  this.renderer.setStyle(this.el.nativeElement, 'transition', 'opacity 0.3s, transform 0.3s');
  this.renderer.setStyle(this.el.nativeElement, 'opacity', '0');
  this.renderer.setStyle(this.el.nativeElement, 'transform', 'scale(0.7)');

  const rect = this.el.nativeElement.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  const particleCount = 60;
  for (let i = 0; i < particleCount; i++) {
    this.createParticle(rect, w, h);
  }
}

  
private createParticle(rect: DOMRect, w: number, h: number): void {
  const particle = this.renderer.createElement('div');
  this.renderer.appendChild(document.body, particle);

  const size = Math.floor(Math.random() * 12 + 8);
  const startX = rect.left + Math.random() * w - size / 2 + window.scrollX;
  const startY = rect.top + Math.random() * h - size / 2 + window.scrollY;

  const destX = startX + (Math.random() - 0.5) * 200;
  const destY = startY + (Math.random() - 0.5) * 200;
  const rotation = (Math.random() - 0.5) * 720;

  this.renderer.setStyle(particle, 'position', 'absolute');
  this.renderer.setStyle(particle, 'left', `${startX}px`);
  this.renderer.setStyle(particle, 'top', `${startY}px`);
  this.renderer.setStyle(particle, 'width', `${size}px`);
  this.renderer.setStyle(particle, 'height', `${size}px`);
  this.renderer.setStyle(particle, 'background', 'linear-gradient(45deg, #4b5563, #1f2937)');
  this.renderer.setStyle(particle, 'border-radius', '4px');
  this.renderer.setStyle(particle, 'transition', 'transform 1s ease-out, opacity 1s ease-out');
  this.renderer.setStyle(particle, 'pointer-events', 'none');
  this.renderer.setStyle(particle, 'z-index', '9999');

  requestAnimationFrame(() => {
    this.renderer.setStyle(particle, 'transform', `translate(${destX - startX}px, ${destY - startY}px) rotate(${rotation}deg)`);
    this.renderer.setStyle(particle, 'opacity', '0');
  });

  setTimeout(() => {
    this.renderer.removeChild(document.body, particle);
  }, 1000);
}
}