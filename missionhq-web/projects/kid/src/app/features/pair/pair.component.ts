import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { KidApi } from 'shared';
import { SessionService } from '../../core/session.service';
import { ThemeService } from '../../core/theme.service';
import { InstallService } from '../../core/install.service';
import { PushService } from '../../core/push.service';

@Component({
  selector: 'kid-pair',
  imports: [FormsModule],
  template: `
    <div class="pair">
      <h1>Pair this tablet</h1>
      <p class="muted">Ask a parent for your six-digit code.</p>
      <input inputmode="numeric" maxlength="6" placeholder="000000" [(ngModel)]="code" (keyup.enter)="pair()" autofocus />
      @if (error()) { <p class="error">{{ error() }}</p> }
      <button class="btn" [disabled]="code.length !== 6 || busy()" (click)="pair()">{{ busy() ? 'Pairing…' : 'Report for duty' }}</button>
      @if (install.canInstall()) {
        <button class="btn ghost" (click)="install.prompt()">Add to home screen</button>
      } @else if (!install.isInstalled()) {
        <p class="muted small">Tip: add this page to the home screen so it opens like a game.</p>
      }
    </div>`,
  styles: `
    .pair { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 24px; text-align: center; }
    input { font: 700 40px var(--display); letter-spacing: 12px; text-align: center; width: 320px; max-width: 90vw; }
    .error { color: #ff5e5b; font-weight: 800; }
    .small { font-size: 12px; }
  `,
})
export class PairComponent {
  private readonly api = inject(KidApi);
  private readonly session = inject(SessionService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  readonly install = inject(InstallService);
  readonly push = inject(PushService);
  code = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async pair() {
    this.busy.set(true); this.error.set(null);
    try {
      const r = await this.api.pair(this.code);
      this.session.set(r); this.theme.code.set(r.themeCode);
      // Still inside the tap that pressed "Report for duty", so the permission prompt is allowed.
      if (this.push.supported() && this.push.state() === 'unknown') await this.push.enable().catch(() => {});
      await this.router.navigate(['/hq']);
    } catch { this.error.set('That code did not work. Ask for a new one.'); }
    finally { this.busy.set(false); }
  }
}
