import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AvatarComponent } from './avatar.component';
import { KidStateService } from '../core/kid-state.service';
import { SessionService } from '../core/session.service';
import { SoundService } from '../core/sound.service';
import { ThemeService } from '../core/theme.service';
import { PushService } from '../core/push.service';

/** Left rail: who you are, your rank, and where you can go. Shared by every kid screen. */
@Component({
  selector: 'kid-rail',
  imports: [RouterLink, RouterLinkActive, AvatarComponent],
  template: `
    <aside class="rail">
      <div class="avatar"><kid-avatar [avatar]="state.me()?.avatar" [size]="110" /></div>
      <div class="callsign">{{ state.me()?.callsign }}</div>
      <div class="rank">{{ state.me()?.rank?.name }}</div>
      <nav>
        <a class="navbtn" routerLink="/hq" routerLinkActive="on">{{ t().hq }}</a>
        <a class="navbtn" routerLink="/shop" routerLinkActive="on">{{ t().shop }}</a>
        <a class="navbtn" routerLink="/locker" routerLinkActive="on">{{ t().locker }}</a>
        <a class="navbtn" routerLink="/squad" routerLinkActive="on">{{ t().squad }}</a>
      </nav>
      <button class="mute" (click)="sound.muted.set(!sound.muted())">{{ sound.muted() ? 'Sound off' : 'Sound on' }}</button>
      @if (push.supported() && push.state() === 'unknown') {
        <button class="mute alert" (click)="push.enable()">Turn on HQ alerts</button>
      }
      <div class="muted small">1 point = R{{ state.me()?.pointsPerCurrencyUnit }}</div>
    </aside>
  `,
  styles: `
    .rail { width: 200px; min-height: 100vh; background: var(--panel); border-right: 2px solid var(--line); display: flex; flex-direction: column; align-items: center; padding: 20px 14px; gap: 14px; }
    .avatar { width: 110px; height: 110px; border-radius: 50%; background: var(--panel2); overflow: hidden; }
    .callsign { font: 700 24px var(--display); text-align: center; }
    .rank { background: var(--accent); color: var(--accent-ink); font-weight: 800; font-size: 13px; padding: 4px 12px; border-radius: 999px; }
    nav { width: 100%; display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
    .navbtn { display: block; width: 100%; border: 2px solid transparent; color: var(--ink); font: 700 15px var(--body); padding: 10px 12px; border-radius: var(--radius); text-decoration: none; cursor: pointer; }
    .navbtn.on { background: var(--panel2); border-color: var(--line); }
    .navbtn.off { opacity: .4; cursor: default; }
    .alert { margin-top: 0; border-color: var(--accent); color: var(--accent); }
    .mute { margin-top: auto; background: transparent; border: 2px solid var(--line); color: var(--ink2); font: 700 12px var(--body); padding: 6px 10px; border-radius: 999px; cursor: pointer; }
    .small { font-size: 12px; }
  `,
})
export class RailComponent {
  readonly state = inject(KidStateService);
  readonly sound = inject(SoundService);
  readonly push = inject(PushService);
  private readonly session = inject(SessionService);
  readonly t = inject(ThemeService).t;
  readonly initial = computed(() => (this.state.me()?.callsign ?? this.session.current()?.callsign ?? '?').charAt(0));
}
