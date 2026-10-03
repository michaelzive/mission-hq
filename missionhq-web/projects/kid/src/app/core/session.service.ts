import { Injectable, computed, signal } from '@angular/core';
import { ThemeCode } from 'shared';

const KEY = 'missionhq.sessions';
const LEGACY_KEY = 'missionhq.session';

/** pinHash: set once this kid shares the tablet; a sibling's code is only a speed bump, checked on the tablet alone. */
export interface Session { deviceToken: string; kidId: number; callsign: string; themeCode: ThemeCode; pinHash?: string; }

/**
 * Every kid paired on this tablet, and which one is using it right now. A tablet paired once opens straight onto that
 * kid's HQ. Pair more kids and it becomes a shared tablet: it starts at "who's reporting?" and nobody is active until
 * they pick themselves (with their code). Tokens live in localStorage; who's active is memory only, so a reload on a
 * shared tablet goes back to the picker.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly sessions = signal<Session[]>(load());
  private readonly activeKidId = signal<number | null>(this.sessions().length === 1 ? this.sessions()[0].kidId : null);

  readonly all = this.sessions.asReadonly();
  readonly current = computed(() => this.sessions().find(s => s.kidId === this.activeKidId()) ?? null);
  readonly shared = computed(() => this.sessions().length > 1);

  deviceToken(): string | null { return this.current()?.deviceToken ?? null; }
  isPaired(): boolean { return this.sessions().length > 0; }

  /** A newly paired kid. Re-pairing a kid already here replaces their token but keeps their code. */
  add(s: Session) {
    const pinHash = this.sessions().find(x => x.kidId === s.kidId)?.pinHash;
    this.save([...this.sessions().filter(x => x.kidId !== s.kidId), { ...s, pinHash }]);
    this.activeKidId.set(this.shared() ? null : s.kidId);
  }
  activate(kidId: number) { this.activeKidId.set(kidId); }
  /** Back to the picker. Only meaningful on a shared tablet; a one-kid tablet always has its kid active. */
  release() { if (this.shared()) this.activeKidId.set(null); }
  remove(kidId: number) {
    this.save(this.sessions().filter(x => x.kidId !== kidId));
    const left = this.sessions();
    this.activeKidId.set(left.length === 1 ? left[0].kidId : null);
  }
  setPin(kidId: number, pinHash: string) { this.save(this.sessions().map(x => x.kidId === kidId ? { ...x, pinHash } : x)); }

  private save(list: Session[]) {
    this.sessions.set(list);
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private mode: lasts until reload */ }
  }
}

/** Codes are hashed so they don't sit in plain sight; with four digits that is courtesy, not security. */
export async function hashPin(kidId: number, pin: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`missionhq:${kidId}:${pin}`));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

function load(): Session[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
    const legacy = localStorage.getItem(LEGACY_KEY);   // tablets paired before shared tablets existed
    if (!legacy) return [];
    const list = [JSON.parse(legacy) as Session];
    localStorage.setItem(KEY, JSON.stringify(list));
    localStorage.removeItem(LEGACY_KEY);
    return list;
  } catch { return []; }
}
