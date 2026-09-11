import { Injectable, signal } from '@angular/core';

const KEY = 'missionhq.parent';

/**
 * First cut: HTTP Basic against the single parent account in application.yml.
 * Credentials live in sessionStorage (cleared when the browser closes). Swap for JWT when real parent accounts land.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly creds = signal<string | null>(sessionStorage.getItem(KEY));
  credentials(): string | null { return this.creds(); }
  isSignedIn(): boolean { return this.creds() !== null; }
  signIn(email: string, password: string) { const c = `${email}:${password}`; this.creds.set(c); sessionStorage.setItem(KEY, c); }
  signOut() { this.creds.set(null); sessionStorage.removeItem(KEY); }
}
