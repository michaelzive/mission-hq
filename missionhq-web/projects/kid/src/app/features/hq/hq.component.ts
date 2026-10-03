import { AfterViewInit, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Celebration, KidApi, LateMissions, MissionCard, MissionStatus } from 'shared';
import { FxService } from '../../core/fx.service';
import { IdleService } from '../../core/idle.service';
import { SessionService } from '../../core/session.service';
import { SoundService } from '../../core/sound.service';
import { ThemeService } from '../../core/theme.service';
import { KidStateService } from '../../core/kid-state.service';
import { RailComponent } from '../../shared/rail.component';
import { CelebrationPlayerComponent } from './celebration-player.component';
import { MissionReport, MissionSheetComponent } from './mission-sheet.component';

@Component({
  selector: 'kid-hq',
  imports: [MissionSheetComponent, CelebrationPlayerComponent, RailComponent, NgTemplateOutlet],
  templateUrl: './hq.component.html',
  styleUrl: './hq.component.scss',
})
export class HqComponent implements OnInit, AfterViewInit {
  private readonly api = inject(KidApi);
  private readonly session = inject(SessionService);
  private readonly theme = inject(ThemeService);
  private readonly fx = inject(FxService);
  private readonly idle = inject(IdleService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly player = viewChild.required(CelebrationPlayerComponent);
  readonly sound = inject(SoundService);
  private readonly state = inject(KidStateService);

  readonly me = this.state.me;
  readonly missions = signal<MissionCard[]>([]);
  /** Yesterday's unreported missions while the late window is open. */
  readonly late = signal<LateMissions | null>(null);
  readonly sheet = signal<{ mission: MissionCard; date: string | null } | null>(null);
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
      const [, missions, late] = await Promise.all([this.state.refresh(), this.api.missions(), this.api.lateMissions()]);
      this.missions.set(missions); this.late.set(late);
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

  todoHint(c: MissionCard) {
    const how = c.requiresPhoto ? 'photo proof' : 'tap when done';
    const when = c.bonus ? 'Expires tonight · ' : c.weekly ? 'Once this week · ' : '';
    return when + (when ? how : how.charAt(0).toUpperCase() + how.slice(1));
  }

  /** "12:00:00" → "12:00". */
  until(t: string | null) { return t ? t.slice(0, 5) : ''; }

  open(c: MissionCard, date: string | null) { if (c.status === 'TODO') { this.sound.tap(); this.sheet.set({ mission: c, date }); } }

  async submit(e: MissionReport) {
    this.sheet.set(null);
    const id = e.mission.behaviourId;
    try {
      await this.api.submit(id, e.photoKey, e.date ?? undefined);
      // No photo means approved on the spot; a photo waits for a parent.
      const status: MissionStatus = e.mission.requiresPhoto ? 'PENDING' : 'APPROVED';
      const mark = (list: MissionCard[]) => list.map(m => m.behaviourId === id ? { ...m, status } : m);
      if (e.date) this.late.update(l => l && { ...l, missions: mark(l.missions) });
      else this.missions.update(mark);
      const card = this.host.nativeElement.querySelector(e.date ? `[data-late="${id}"]` : `[data-behaviour="${id}"]`);
      if (card) this.fx.burst(card, 18, 'var(--good)');
      this.sound.missionSent();
      this.idle.reported();
      if (!e.mission.requiresPhoto) await this.drainCelebrations();
    } catch {
      this.error.set('HQ did not accept that. Try again.');
      setTimeout(() => this.error.set(null), 2500);
    }
  }
}
