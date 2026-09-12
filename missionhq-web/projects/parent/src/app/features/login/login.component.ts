import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ParentApi } from 'shared';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'parent-login',
  imports: [FormsModule],
  template: `
    <div class="login">
      <h1>Mission HQ</h1>
      <p class="muted">Parent sign in</p>
      <input type="email" placeholder="Email" [(ngModel)]="email" autocomplete="username" />
      <input type="password" placeholder="Password" [(ngModel)]="password" autocomplete="current-password" (keyup.enter)="signIn()" />
      @if (error(); as e) { <p class="error">{{ e }}</p> }
      <button class="btn" [disabled]="!email || !password || busy()" (click)="signIn()">{{ busy() ? 'Checking…' : 'Sign in' }}</button>
    </div>`,
  styles: `
    .login { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; }
    input { width: 320px; max-width: 90vw; }
    .error { color: #c0392b; font-weight: 700; }
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ParentApi);
  private readonly router = inject(Router);
  email = ''; password = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async signIn() {
    this.busy.set(true); this.error.set(null);
    this.auth.signIn(this.email, this.password);
    try { await this.api.household(); await this.router.navigate(['/approvals']); }
    catch { this.auth.signOut(); this.error.set('Sign in failed. Check your email and password.'); }
    finally { this.busy.set(false); }
  }
}
