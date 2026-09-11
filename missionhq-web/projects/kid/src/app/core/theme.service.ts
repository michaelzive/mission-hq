import { Injectable, computed, effect, signal } from '@angular/core';
import { THEMES, ThemeCode, ThemeConfig } from 'shared';

/** Applies the active theme as CSS custom properties on :root, so every component just uses var(--accent) etc. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly code = signal<ThemeCode>('AIRSOFT');
  readonly config = computed<ThemeConfig>(() => THEMES[this.code()]);
  readonly t = computed(() => this.config().vocabulary);

  constructor() {
    effect(() => {
      const c = this.config();
      const root = document.documentElement;
      root.dataset['theme'] = c.code;
      for (const [k, v] of Object.entries(c.palette)) root.style.setProperty(`--${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`, v);
      root.style.setProperty('--display', c.fonts.display);
      root.style.setProperty('--body', c.fonts.body);
      root.style.setProperty('--radius', c.radius);
    });
  }
}
