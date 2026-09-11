import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { CosmeticItem, KidApi, Slot, ThemeCode } from 'shared';
import { FxService } from '../../core/fx.service';
import { KidStateService } from '../../core/kid-state.service';
import { SoundService } from '../../core/sound.service';
import { ThemeService } from '../../core/theme.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { RailComponent } from '../../shared/rail.component';

const SLOTS: { slot: Slot; label: string }[] = [
  { slot: 'headgear', label: 'Headgear' }, { slot: 'eyes', label: 'Eyes' }, { slot: 'body', label: 'Body' },
  { slot: 'back', label: 'Back' }, { slot: 'background', label: 'Background' }, { slot: 'title', label: 'Title' },
];
const RANK_NAMES: Record<ThemeCode, string[]> = {
  AIRSOFT: ['Recruit', 'Private', 'Corporal', 'Sergeant', 'Lieutenant', 'Captain', 'Major', 'Commander'],
  HERO: ['Sidekick', 'Cadet', 'Titan 1', 'Titan 2', 'Titan 3', 'Hero', 'Champion', 'Legend'],
};

/** The locker: change how you look with what you own; see what rank unlocks next; switch worlds. */
@Component({
  selector: 'kid-locker',
  imports: [RailComponent, AvatarComponent],
  templateUrl: './locker.component.html',
  styleUrl: './locker.component.scss',
})
export class LockerComponent implements OnInit {
  private readonly api = inject(KidApi);
  private readonly fx = inject(FxService);
  private readonly sound = inject(SoundService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly state = inject(KidStateService);
  readonly theme = inject(ThemeService);
  readonly t = this.theme.t;
  readonly slots = SLOTS;

  readonly items = signal<CosmeticItem[]>([]);
  readonly error = signal<string | null>(null);
  readonly colours = computed(() => this.theme.config().avatarColours);
  readonly avatar = computed(() => this.state.me()?.avatar ?? { colour: 0, slots: {} });
  readonly title = computed(() => this.items().find(i => i.slot === 'title' && i.equipped)?.name ?? null);
  readonly ownedCount = computed(() => this.items().filter(i => i.state === 'OWNED' && !(i.price === 0 && i.unlockRankOrdinal === 0)).length);

  async ngOnInit() { await this.load(); }
  private async load() {
    try { const [, items] = await Promise.all([this.state.refresh(), this.api.cosmetics()]); this.items.set(items); }
    catch { this.error.set('Could not open the locker.'); }
  }

  forSlot(slot: Slot) { return this.items().filter(i => i.slot === slot); }
  rankName(ordinal: number) { return RANK_NAMES[this.theme.code()][ordinal] ?? `rank ${ordinal}`; }

  async pickColour(i: number) {
    this.sound.tap();
    try { const a = await this.api.setColour(i); this.state.me.update(m => m ? { ...m, avatar: a } : m); } catch { /* ignore */ }
  }

  async toggle(item: CosmeticItem) {
    if (item.state !== 'OWNED') { this.sound.tap(); return; }
    try {
      const a = await this.api.equipCosmetic(item.id);
      this.state.me.update(m => m ? { ...m, avatar: a } : m);
      this.items.set(await this.api.cosmetics());
      this.sound.tap();
      const el = this.host.nativeElement.querySelector('.preview');
      if (el) this.fx.burst(el, 12, 'var(--accent)');
    } catch { this.error.set('Could not equip that.'); setTimeout(() => this.error.set(null), 2000); }
  }

  async switchWorld(code: ThemeCode) {
    if (code === this.theme.code()) return;
    try { const me = await this.api.setTheme(code); this.state.me.set(me); this.theme.code.set(code); this.items.set(await this.api.cosmetics()); this.sound.missionSent(); }
    catch { this.error.set('Could not switch worlds.'); }
  }
}
