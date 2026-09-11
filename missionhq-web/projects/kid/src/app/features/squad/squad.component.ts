import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { KidApi, Sibling, SquadView } from 'shared';
import { FxService } from '../../core/fx.service';
import { KidStateService } from '../../core/kid-state.service';
import { SoundService } from '../../core/sound.service';
import { ThemeService } from '../../core/theme.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { RailComponent } from '../../shared/rail.component';
import { CelebrationPlayerComponent } from '../hq/celebration-player.component';

/** The squad: one goal both brothers fill, each other's rank (never points), and a way to give something. */
@Component({
  selector: 'kid-squad',
  imports: [RailComponent, AvatarComponent, CelebrationPlayerComponent],
  template: `
    <div class="tablet">
      <kid-rail />
      <main class="main">
        <h1>{{ t().squad }}</h1>
        <p class="muted">Your team goal. Both of you fill it.</p>

        @if (view()?.goal; as g) {
          <div class="goalwrap">
            <div class="goalhead"><b>{{ g.name }}</b><span class="muted">{{ g.progress }} / {{ g.target }}</span></div>
            <div class="goalbar"><div class="goalfill" [style.width.%]="g.percent"></div><span>{{ g.percent }}%</span></div>
            <div class="shares">
              <span class="me" [style.width.%]="mine()"></span>
              @for (s of view()!.siblings; track s.id) { <span class="sib" [style.width.%]="s.contributionPercent"></span> }
            </div>
            <div class="legend muted">
              <span><i class="sw me"></i> you {{ mine() }}%</span>
              @for (s of view()!.siblings; track s.id) { <span><i class="sw sib"></i> {{ s.callsign }} {{ s.contributionPercent }}%</span> }
            </div>
            @if (g.percent >= 100) { <p class="done">Goal reached. {{ t().hq }} owes you a day out.</p> }
          </div>
        } @else if (view()) {
          <p class="muted">No squad goal set yet. Ask {{ t().hq }} to pick one.</p>
        }

        @for (s of view()?.siblings ?? []; track s.id) {
          <div class="squad" [attr.data-sib]="s.id">
            <div class="ava"><kid-avatar [avatar]="s.avatar" [themeCode]="s.themeCode" [size]="90" /></div>
            <div class="who">
              <div class="callsign">{{ s.callsign }}</div>
              <div class="row"><span class="rank">{{ s.rankName }}</span><span class="muted">{{ s.themeCode === 'HERO' ? 'Hero league' : 'Airsoft ops' }}</span></div>
            </div>
            <button class="btn ghost" [disabled]="sent().has(s.id)" (click)="highFive(s)">{{ sent().has(s.id) ? 'High-five sent' : 'Send a high-five' }}</button>
          </div>
        }
        @if (error(); as e) { <p class="error">{{ e }}</p> }
      </main>
      <kid-celebration-player [balanceEl]="none" [missionEl]="noneById" (played)="state.refresh()" (acked)="ack($event.id)" />
    </div>
  `,
  styles: `
    .tablet { position: relative; min-height: 100vh; display: flex; overflow: hidden; }
    .main { flex: 1; padding: 22px 26px; overflow-y: auto; min-width: 0; }
    .goalwrap { background: var(--panel); border: 2px solid var(--line); border-radius: var(--radius); padding: 14px 16px; margin: 16px 0 18px; }
    .goalhead { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; b { font: 700 20px var(--display); } }
    .goalbar { height: 28px; background: var(--bg); border-radius: 14px; overflow: hidden; border: 2px solid var(--line); position: relative;
      span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; mix-blend-mode: difference; } }
    .goalfill { height: 100%; background: var(--accent); transition: width .8s cubic-bezier(.2,.8,.2,1); }
    .shares { display: flex; height: 8px; margin-top: 8px; border-radius: 4px; overflow: hidden; background: var(--bg); .me { background: var(--accent); } .sib { background: var(--tan); } }
    .legend { display: flex; gap: 14px; margin-top: 6px; font-size: 12px; .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: middle; } .sw.me { background: var(--accent); } .sw.sib { background: var(--tan); } }
    .done { color: var(--good); font-weight: 800; margin-top: 8px; }
    .squad { display: flex; gap: 16px; align-items: center; background: var(--panel); border: 2px solid var(--line); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; }
    .ava { width: 90px; height: 90px; border-radius: 50%; background: var(--panel2); overflow: hidden; flex-shrink: 0; }
    .who { flex: 1; }
    .callsign { font: 700 24px var(--display); }
    .rank { background: var(--accent); color: var(--accent-ink); font-weight: 800; font-size: 13px; padding: 4px 12px; border-radius: 999px; }
    .error { color: #ff5e5b; font-weight: 800; }
  `,
})
export class SquadComponent implements OnInit {
  private readonly api = inject(KidApi);
  private readonly fx = inject(FxService);
  private readonly sound = inject(SoundService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly player = viewChild.required(CelebrationPlayerComponent);
  readonly state = inject(KidStateService);
  readonly t = inject(ThemeService).t;

  readonly view = signal<SquadView | null>(null);
  readonly sent = signal<Set<number>>(new Set());
  readonly error = signal<string | null>(null);
  readonly mine = computed(() => this.view()?.myContribution ?? 0);
  readonly none = () => null;
  readonly noneById = () => null;

  async ngOnInit() {
    try { const [, v] = await Promise.all([this.state.refresh(), this.api.squad()]); this.view.set(v); }
    catch { this.error.set('Could not reach the squad.'); return; }
    try { const q = await this.api.celebrations(); if (q.length) await this.player().play(q); } catch { /* fine */ }
  }

  async highFive(s: Sibling) {
    try {
      await this.api.highFive(s.id);
      this.sent.update(x => new Set(x).add(s.id));
      this.sound.tap();
      const el = this.host.nativeElement.querySelector(`[data-sib="${s.id}"]`);
      if (el) this.fx.burst(el, 16, 'var(--tan)');
    } catch { this.error.set('Could not send that.'); setTimeout(() => this.error.set(null), 2000); }
  }

  async ack(id: number) { try { await this.api.ack(id); } catch { /* replays later */ } }
}
