import { AfterViewInit, Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { Celebration } from 'shared';
import { FxService } from '../../core/fx.service';
import { SoundService } from '../../core/sound.service';
import { ThemeService } from '../../core/theme.service';

interface Takeover { badge: string; kicker: string; title: string; sub: string; }

/**
 * Drains the celebration queue one item at a time, in order, acking each after it plays.
 * The host passes element lookups so coins fly from the right card into the balance counter.
 */
@Component({
  selector: 'kid-celebration-player',
  template: `
    <canvas #fx class="fx"></canvas>
    @if (takeover(); as tk) {
      <div class="takeover" (click)="dismissTakeover()">
        <div class="badge">{{ tk.badge }}</div>
        <p class="kicker">{{ tk.kicker }}</p>
        <h1>{{ tk.title }}</h1>
        <p>{{ tk.sub }}</p>
        <p class="hint">tap to continue</p>
      </div>
    }
    @if (toast(); as msg) { <div class="toast">{{ msg }}</div> }
  `,
  styles: `
    .fx { position: absolute; inset: 0; pointer-events: none; z-index: 7; width: 100%; height: 100%; }
    .takeover { position: absolute; inset: 0; background: var(--accent); color: var(--accent-ink); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 9; text-align: center; gap: 10px; animation: pop .5s cubic-bezier(.2,1.4,.3,1); }
    .takeover h1 { font-size: 64px; }
    .badge { width: 150px; height: 150px; border-radius: 50%; background: var(--accent-ink); color: var(--accent); display: flex; align-items: center; justify-content: center; font: 700 60px var(--display); animation: spin 1.2s cubic-bezier(.3,1.4,.4,1); }
    .kicker { font-weight: 800; font-size: 18px; }
    .hint { opacity: .7; margin-top: 10px; }
    .toast { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); background: var(--ink); color: var(--bg); padding: 10px 18px; border-radius: 999px; font-weight: 800; z-index: 8; }
    @keyframes pop { from { transform: scale(.6); opacity: 0; } }
    @keyframes spin { from { transform: rotateY(720deg) scale(.2); } }
  `,
})
export class CelebrationPlayerComponent implements AfterViewInit {
  private readonly fx = inject(FxService);
  private readonly sound = inject(SoundService);
  private readonly theme = inject(ThemeService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('fx');

  /** Where coins fly to (the balance counter). */
  readonly balanceEl = input.required<() => Element | null>();
  /** Where a mission celebration starts (its card). */
  readonly missionEl = input.required<(behaviourId: number | null) => Element | null>();
  /** Fired after each celebration so the host can refresh /me and re-render points. */
  readonly played = output<Celebration>();
  readonly acked = output<Celebration>();

  readonly takeover = signal<Takeover | null>(null);
  readonly toast = signal<string | null>(null);
  private resumeTakeover: (() => void) | null = null;

  ngAfterViewInit() {
    const parent = this.host.nativeElement.parentElement;
    if (parent) this.fx.attach(this.canvas().nativeElement, parent);
  }

  async play(queue: Celebration[]) {
    for (const c of queue) { await this.playOne(c); this.acked.emit(c); }
  }

  private async playOne(c: Celebration) {
    const t = this.theme.t();
    const bal = this.balanceEl()();
    switch (c.type) {
      case 'MISSION_APPROVED': {
        this.sound.hqConfirmed();
        await this.coinsThenBump(this.missionEl()(c.payload ? Number(c.payload) : null) ?? bal, bal, c);
        break;
      }
      case 'BONUS':
      case 'STREAK': {
        this.showToast(c.type === 'STREAK' ? `${c.payload} — +${c.points} bonus` : `+${c.points} ${c.payload ?? 'bonus'}`);
        await this.coinsThenBump(bal, bal, c);
        break;
      }
      case 'RANK_UP':
        await this.showTakeover({ badge: (c.payload ?? '?').charAt(0), kicker: t.rankUp, title: c.payload ?? '', sub: 'New gear unlocked in your locker' });
        break;
      case 'REDEEMED':
        this.sound.win(); this.fx.confetti(); if ((c.points ?? 1) >= 2) this.fx.fireworks(4);
        this.showToast(`Redeemed: ${c.payload}`); await wait(2500);
        break;
      case 'SIBLING_RANK_UP': this.showToast(`Squadmate: ${c.payload}`); await wait(2000); break;
      case 'HIGH_FIVE': this.showToast(`High-five from ${c.payload}!`); if (bal) this.fx.burst(bal, 16, 'var(--tan)'); await wait(1800); break;
      case 'SQUAD_MILESTONE': this.fx.fireworks(3); this.showToast(`Squad goal: ${c.payload}`); await wait(2500); break;
    }
    this.played.emit(c);
  }

  private async coinsThenBump(from: Element | null, to: Element | null, c: Celebration) {
    if (from && to) await this.fx.coins(from, to, Math.min(14, 6 + Math.round((c.points ?? 0) / 5)));
    if (to) { this.sound.coinBurst(); this.fx.burst(to, 24, '#ffd23f'); to.classList.add('bump'); setTimeout(() => to.classList.remove('bump'), 600); }
    await wait(700);
  }

  private showTakeover(v: Takeover) {
    this.takeover.set(v); this.sound.win(); this.fx.fireworks(6);
    return new Promise<void>(resolve => { this.resumeTakeover = resolve; });
  }
  dismissTakeover() { this.takeover.set(null); this.resumeTakeover?.(); this.resumeTakeover = null; }

  private showToast(msg: string) { this.toast.set(msg); setTimeout(() => this.toast.set(null), 1800); }
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
