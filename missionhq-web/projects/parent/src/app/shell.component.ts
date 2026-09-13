import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { PushService } from './core/push.service';

@Component({
  selector: 'parent-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header>
      <span class="brand">Mission HQ · Parent</span>
      <nav>
        <a routerLink="/approvals" routerLinkActive="on">Approvals</a>
        <a routerLink="/kids" routerLinkActive="on">Kids</a>
        <a routerLink="/missions" routerLinkActive="on">Missions</a>
      </nav>
      @if (push.supported() && push.state() !== 'granted') {
        <button class="link bell" (click)="push.enable()">{{ push.state() === 'denied' ? 'Alerts blocked' : 'Turn on alerts' }}</button>
      }
      <button class="link" (click)="signOut()">Sign out</button>
    </header>
    <main><router-outlet /></main>
  `,
  styles: `
    header { display: flex; align-items: center; gap: 18px; padding: 12px 16px; background: #fff; border-bottom: 1px solid #e3e0d8; position: sticky; top: 0; }
    .brand { font-weight: 800; }
    nav { display: flex; gap: 6px; flex: 1; }
    nav a { text-decoration: none; color: #444; font-weight: 700; padding: 6px 12px; border-radius: 999px; }
    nav a.on { background: #1d1d1d; color: #fff; }
    .bell { color: #1d7a45; font-weight: 800; }
    .link { background: none; border: 0; color: #666; font: inherit; cursor: pointer; }
    main { padding: 16px; max-width: 760px; margin: 0 auto; }
  `,
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  readonly push = inject(PushService);
  private readonly router = inject(Router);
  signOut() { this.auth.signOut(); this.router.navigate(['/login']); }
}
