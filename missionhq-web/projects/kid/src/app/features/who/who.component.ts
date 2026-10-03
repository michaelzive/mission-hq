import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AvatarView, KidApi } from 'shared';
import { KidStateService } from '../../core/kid-state.service';
import { Session, SessionService } from '../../core/session.service';
import { SoundService } from '../../core/sound.service';
import { ThemeService } from '../../core/theme.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { PinPadComponent } from '../../shared/pin-pad.component';

interface Tile { kid: Session; avatar: AvatarView | null; open: number | null; }

/**
 * The shared tablet's front door, and the after-dinner debrief: every kid paired here, with how many of today's
 * missions they still haven't reported. Picking yourself takes your secret code.
 */
@Component({
  selector: 'kid-who',
  imports: [AvatarComponent, PinPadComponent, RouterLink],
  template: `
    <div class="who">
      <h1>Who's reporting?</h1>
      <div class="tiles">
        @for (t of tiles(); track t.kid.kidId) {
          <button class="tile" (click)="pick(t.kid)">
            <div class="av"><kid-avatar [avatar]="t.avatar" [size]="120" /></div>
            <b>{{ t.kid.callsign }}</b>
            @if (t.open === null) { <span class="muted">…</span> }
            @else if (t.open === 0) { <span class="done">All done ✓</span> }
            @else { <span class="open">{{ t.open }} to report</span> }
          </button>
        }
      </div>
      <div class="foot">
        <a class="btn ghost" routerLink="/pair">+ Add a kid to this tablet</a>
        @if (forgetting(); as k) {
          <span class="muted">Take {{ k.callsign }} off this tablet? A parent will need to make a new pairing code.</span>
          <button class="btn small" (click)="forget(k)">Yes, remove</button>
          <button class="btn small ghost" (click)="forgetting.set(null)">No</button>
        }
      </div>
    </div>
    @if (picking(); as k) {
      <kid-pin-pad [kid]="k" [offerForgot]="true" (ok)="enter(k)" (cancel)="picking.set(null)" (forgot)="forgetting.set(k); picking.set(null)" />
    }`,
  styles: `
    .who { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; padding: 24px; }
    h1 { font: 700 36px var(--display); }
    .tiles { display: flex; gap: 22px; flex-wrap: wrap; justify-content: center; }
    .tile { background: var(--panel); border: 2px solid var(--line); border-radius: var(--radius); padding: 20px 26px; display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--ink); font: inherit; cursor: pointer; min-width: 190px;
      &:active { transform: scale(.96); }
      b { font: 700 24px var(--display); } }
    .av { width: 120px; height: 120px; border-radius: 50%; background: var(--panel2); overflow: hidden; }
    .open { font-weight: 800; color: var(--accent); }
    .done { font-weight: 800; color: var(--good); }
    .foot { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: center; }
  `,
})
export class WhoComponent implements OnInit {
  private readonly api = inject(KidApi);
  private readonly session = inject(SessionService);
  private readonly state = inject(KidStateService);
  private readonly theme = inject(ThemeService);
  private readonly sound = inject(SoundService);
  private readonly router = inject(Router);

  readonly tiles = signal<Tile[]>([]);
  readonly picking = signal<Session | null>(null);
  readonly forgetting = signal<Session | null>(null);

  async ngOnInit() {
    const kids = this.session.all();
    if (!kids.length) { await this.router.navigate(['/pair']); return; }
    if (!this.session.shared()) { this.session.activate(kids[0].kidId); await this.router.navigate(['/hq']); return; }
    this.tiles.set(kids.map(kid => ({ kid, avatar: null, open: null })));
    await Promise.all(kids.map(async kid => {
      try {
        const [me, missions] = await Promise.all([this.api.meAs(kid.deviceToken), this.api.missionsAs(kid.deviceToken)]);
        this.patch(kid.kidId, { avatar: me.avatar, open: missions.filter(m => m.status === 'TODO').length });
      } catch { /* leave the tile as is; picking still works */ }
    }));
  }

  /** The pad works on the stored session so a freshly set code is seen straight away. */
  pick(kid: Session) {
    this.sound.tap();
    this.forgetting.set(null);
    this.picking.set(this.session.all().find(s => s.kidId === kid.kidId) ?? kid);
  }

  async enter(kid: Session) {
    this.picking.set(null);
    this.state.me.set(null);
    this.session.activate(kid.kidId);
    this.theme.code.set(kid.themeCode);
    await this.router.navigate(['/hq']);
  }

  forget(kid: Session) {
    this.session.remove(kid.kidId);
    this.forgetting.set(null);
    this.picking.set(null);
    if (!this.session.shared()) { this.router.navigate(['/hq']); return; }
    this.tiles.update(list => list.filter(t => t.kid.kidId !== kid.kidId));
  }

  private patch(kidId: number, p: Partial<Tile>) { this.tiles.update(list => list.map(t => t.kid.kidId === kidId ? { ...t, ...p } : t)); }
}
