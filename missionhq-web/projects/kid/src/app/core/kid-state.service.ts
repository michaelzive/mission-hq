import { Injectable, inject, signal } from '@angular/core';
import { KidApi, MeView } from 'shared';
import { ThemeService } from './theme.service';

/** The kid's own summary (/me), shared by every screen so the rail and counters stay in sync. */
@Injectable({ providedIn: 'root' })
export class KidStateService {
  private readonly api = inject(KidApi);
  private readonly theme = inject(ThemeService);
  readonly me = signal<MeView | null>(null);

  async refresh() {
    const me = await this.api.me();
    this.me.set(me); this.theme.code.set(me.themeCode);
    return me;
  }
}
