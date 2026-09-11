import { AfterViewInit, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { Celebration, KidApi, MissionCard } from 'shared';
import { FxService } from '../../core/fx.service';
import { SessionService } from '../../core/session.service';
import { SoundService } from '../../core/sound.service';
import { ThemeService } from '../../core/theme.service';
import { KidStateService } from '../../core/kid-state.service';
import { RailComponent } from '../../shared/rail.component';
import { CelebrationPlayerComponent } from './celebration-player.component';
import { MissionSheetComponent } from './mission-sheet.component';

@Component({
  selector: 'kid-hq',
  imports: [MissionSheetComponent, CelebrationPlayerComponent, RailComponent],
  templateUrl: './hq.component.html',
  styleUrl: './hq.component.scss',
})
export class HqComponent implements OnInit, AfterViewInit {
  private readonly api = inject(KidApi);
  private readonly session = inject(SessionService);
  private readonly theme = inject(ThemeService);
  private readonly fx = inject(FxService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly player = viewChild.required(CelebrationPlayerComponent);
  readonly sound = inject(SoundService);
  private readonly state = inject(KidStateService);

  readonly me = this.state.me;
  readonly missions = signal<MissionCard[]>([]);
  readonly sheet = signal<MissionCard | null>(null);
  readonly error = signal<string | null>(null);
  readonly t = this.theme.t;
  readonly goalPct = computed(() => { const g = this.me()?.termGoal; return g ? Math.min(100, Math.round(g.progress / g.target * 100)) : 0; });

  /** Element lookups the celebration player uses to aim coin flights. */
  readonly balanceLookup = () => this.host.nativeElement.querySelector('.stat .n');
  readonly missionLookup = (behaviourId: number | null) =>
    (behaviourId !== null ? this.host.nativeElement.querySelector(`[data-behaviour="${behaviourId}"]`) : null)
    ?? this.host.nativeElement.querySelector('.card.approved') ?? this.host.nativeElement.querySelector('.grid');

  async ngOnInit() {
    const s = this.session.current(); if (s) this.theme.code.set(s.themeCode);
    await this.load();
  }

  async ngAfterViewInit() { await this.drainCelebrations(); }

  private async load() {
    try {
      const [, missions] = await Promise.all([this.state.refresh(), this.api.missions()]);
      this.missions.set(missions);
    } catch { this.error.set('Could not reach HQ. Check the connection.'); }
  }

  async refreshMe() {
    try { await this.state.refresh(); this.missions.set(await this.api.missions()); } catch { /* keep the last good view */ }
  }

  /** On open: fetch unplayed celebrations and play them in order; each is acked after it plays. */
  async drainCelebrations() {
    let queue: Celebration[] = [];
    try { queue = await this.api.celebrations(); } catch { return; }
    if (queue.length) await this.player().play(queue);
  }

  async ack(c: Celebration) { try { await this.api.ack(c.id); } catch { /* replays next open; acceptable */ } }

  open(c: MissionCard) { if (c.status === 'TODO') { this.sound.tap(); this.sheet.set(c); } }

  async submit(e: { behaviourId: number; photoKey: string }) {
    this.sheet.set(null);
    try {
      await this.api.submit(e.behaviourId, e.photoKey);
      this.missions.update(list => list.map(m => m.behaviourId === e.behaviourId ? { ...m, status: 'PENDING' as const } : m));
      const card = this.host.nativeElement.querySelector(`[data-behaviour="${e.behaviourId}"]`);
      if (card) this.fx.burst(card, 18, 'var(--good)');
      this.sound.missionSent();
    } catch {
      this.error.set('HQ did not accept that. Try again.');
      setTimeout(() => this.error.set(null), 2500);
    }
  }
}
