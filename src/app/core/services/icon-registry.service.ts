import { Injectable } from '@angular/core';
// DomSanitizer is no longer needed here

import { ICONS } from '../../../assets/icons/icon-data';

@Injectable({
  providedIn: 'root'
})
export class IconRegistryService {
  private readonly registry = new Map<string, string>();

  constructor() {
    this.registerIcons(ICONS);
  }

  public registerIcons(icons: Record<string, string>): void {
    for (const [name, svg] of Object.entries(icons)) {
      this.registry.set(name, svg);
    }
  }

  /**
   * Retrieves the raw SVG string for a given icon name.
   * @param name The name of the icon to retrieve.
   * @returns The SVG string, or null if not found.
   */
  public getIconString(name: string): string | null {
    const svg = this.registry.get(name);
    if (!svg) {
      console.warn(`Icon '${name}' not found in registry.`);
      return null;
    }
    return svg;
  }
}