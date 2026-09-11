import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KidSummary, ParentApi } from 'shared';

const REASONS = ['HQ impressed', 'Great effort', 'Helped without being asked', 'Kind to your brother'];

/** Per-kid view: rank and balance at a glance, surprise bonuses, and tablet pairing codes. */
@Component({
  selector: 'parent-kids',
  imports: [FormsModule],
  template: `
    <h1>Kids</h1>
    @if (error(); as e) { <p class="error">{{ e }}</p> }
    @for (k of kids(); track k.id) {
      <article class="kid">
        <div class="top">
          <div class="avatar">{{ k.callsign.charAt(0) }}</div>
          <div class="who"><b>{{ k.callsign }}</b><div class="muted">{{ k.rankName }} · {{ k.balance }} pts to spend · {{ k.lifetimeEarned }} lifetime · {{ k.streakDays }} day streak</div></div>
        </div>
        <div class="row">
          <span class="muted">Surprise bonus:</span>
          @for (p of [5, 15, 30]; track p) { <button class="chip" [class.on]="points()[k.id] === p" (click)="setPoints(k.id, p)">+{{ p }}</button> }
          <select [ngModel]="reason()[k.id] ?? reasons[0]" (ngModelChange)="setReason(k.id, $event)">
            @for (r of reasons; track r) { <option [value]="r">{{ r }}</option> }
          </select>
          <button class="btn small go" [disabled]="!points()[k.id]" (click)="bonus(k)">Send</button>
        </div>
        <div class="row">
          <button class="btn small ghost" (click)="pair(k)">New pairing code</button>
          @if (codes()[k.id]; as c) { <span class="code">{{ c }}</span><span class="muted">type this on {{ k.callsign }}'s tablet</span> }
        </div>
      </article>
    }
    @if (toast(); as t) { <div class="toast">{{ t }}</div> }
  `,
  styles: `
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 12px; }
    .kid { background: #fff; border: 1px solid #e3e0d8; border-radius: 14px; padding: 14px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 10px; }
    .top { display: flex; align-items: center; gap: 12px; }
    .avatar { width: 44px; height: 44px; border-radius: 50%; background: #1d1d1d; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; }
    .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .chip { border: 1px solid #ccc; background: #fff; font: 700 12px inherit; padding: 4px 10px; border-radius: 999px; cursor: pointer; &.on { background: #1d1d1d; color: #fff; border-color: #1d1d1d; } }
    .code { font: 800 26px monospace; letter-spacing: 4px; background: #f1efe8; padding: 4px 12px; border-radius: 8px; }
    .toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); background: #1d1d1d; color: #fff; padding: 10px 18px; border-radius: 999px; font-weight: 700; }
  `,
})
export class KidsComponent implements OnInit {
  private readonly api = inject(ParentApi);
  readonly reasons = REASONS;
  readonly kids = signal<KidSummary[]>([]);
  readonly points = signal<Record<number, number>>({});
  readonly reason = signal<Record<number, string>>({});
  readonly codes = signal<Record<number, string>>({});
  readonly error = signal<string | null>(null);
  readonly toast = signal<string | null>(null);

  async ngOnInit() { await this.refresh(); }
  async refresh() { try { this.kids.set(await this.api.kids()); } catch { this.error.set('Could not load kids.'); } }

  setPoints(id: number, p: number) { this.points.update(x => ({ ...x, [id]: x[id] === p ? 0 : p })); }
  setReason(id: number, r: string) { this.reason.update(x => ({ ...x, [id]: r })); }

  async bonus(k: KidSummary) {
    const p = this.points()[k.id]; if (!p) return;
    try {
      await this.api.bonus(k.id, p, this.reason()[k.id] ?? REASONS[0]);
      this.setPoints(k.id, p); this.showToast(`+${p} sent to ${k.callsign}, plays when they next open HQ`); await this.refresh();
    } catch { this.error.set('Bonus failed.'); }
  }

  async pair(k: KidSummary) {
    try { const r = await this.api.pairingCode(k.id); this.codes.update(c => ({ ...c, [k.id]: r.pairingCode })); }
    catch { this.error.set('Could not create a pairing code.'); }
  }

  private showToast(msg: string) { this.toast.set(msg); setTimeout(() => this.toast.set(null), 2500); }
}
