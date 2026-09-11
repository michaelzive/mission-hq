import { Injectable, signal } from '@angular/core';
import { ThemeCode } from 'shared';

const KEY = 'missionhq.session';
export interface Session { deviceToken: string; kidId: number; callsign: string; themeCode: ThemeCode; }

/** The tablet is paired once; the token lives in localStorage so the PWA opens straight onto HQ. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly session = signal<Session | null>(load());
  readonly current = this.session.asReadonly();

  deviceToken(): string | null { return this.session()?.deviceToken ?? null; }
  isPaired(): boolean { return this.session() !== null; }
  set(s: Session) { this.session.set(s); localStorage.setItem(KEY, JSON.stringify(s)); }
  clear() { this.session.set(null); localStorage.removeItem(KEY); }
}

function load(): Session | null {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
