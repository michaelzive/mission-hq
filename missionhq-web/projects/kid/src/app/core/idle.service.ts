import { Injectable, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { KidStateService } from './kid-state.service';
import { SessionService } from './session.service';

const IDLE_MS = 60_000;
/** After a report goes in, the next sibling is probably waiting: hand the tablet back sooner unless the kid keeps going. */
const AFTER_REPORT_MS = 10_000;

/**
 * Shared tablets only: hand the tablet back to "who's reporting?" when nobody has touched it for a minute, so the
 * next kid doesn't report a mission under their sibling's name. One-kid tablets are never released.
 */
@Injectable({ providedIn: 'root' })
export class IdleService {
  private readonly session = inject(SessionService);
  private readonly state = inject(KidStateService);
  private readonly router = inject(Router);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => this.arm(IDLE_MS), { passive: true, capture: true });
    effect(() => { if (this.session.shared() && this.session.current()) this.arm(IDLE_MS); else this.disarm(); });
  }

  /** A report was just sent. */
  reported() { this.arm(AFTER_REPORT_MS); }

  /** Back to the picker now. */
  async release() {
    this.disarm();
    this.session.release();
    this.state.me.set(null);
    await this.router.navigate(['/who']);
  }

  private arm(ms: number) {
    if (!this.session.shared() || !this.session.current()) return;
    this.disarm();
    this.timer = setTimeout(() => this.release(), ms);
  }
  private disarm() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }
}
