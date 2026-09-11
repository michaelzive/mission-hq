import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CosmeticItem, KidApi, Reward, RewardCategory, ThemeCode } from 'shared';
import { FxService } from '../../core/fx.service';
import { KidStateService } from '../../core/kid-state.service';
import { SoundService } from '../../core/sound.service';
import { ThemeService } from '../../core/theme.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { RailComponent } from '../../shared/rail.component';
import { CelebrationPlayerComponent } from '../hq/celebration-player.component';
import { SuggestSheetComponent } from './suggest-sheet.component';

const MAX_PENDING = 3;
const RANK_NAMES: Record<ThemeCode, string[]> = {
  AIRSOFT: ['Recruit', 'Private', 'Corporal', 'Sergeant', 'Lieutenant', 'Captain', 'Major', 'Commander'],
  HERO: ['Sidekick', 'Cadet', 'Titan 1', 'Titan 2', 'Titan 3', 'Hero', 'Champion', 'Legend'],
};
const SLOT_LABEL: Record<string, string> = { headgear: 'Headgear', eyes: 'Eyes', body: 'Body', back: 'Back', background: 'Background', title: 'Title' };

/**
 * The shop. Real rewards priced in points; the term goal is pinned first; kids can suggest their own.
 * Redeeming plays the REDEEMED celebration straight away (it is fetched and acked here, not left for HQ).
 */
@Component({
  selector: 'kid-shop',
  imports: [RailComponent, SuggestSheetComponent, CelebrationPlayerComponent, AvatarComponent],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.scss',
})
export class ShopComponent implements OnInit {
  private readonly api = inject(KidApi);
  private readonly fx = inject(FxService);
  private readonly sound = inject(SoundService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly player = viewChild.required(CelebrationPlayerComponent);
  readonly state = inject(KidStateService);
  private readonly theme = inject(ThemeService);
  readonly t = this.theme.t;

  readonly rewards = signal<Reward[]>([]);
  readonly cosmetics = signal<CosmeticItem[]>([]);
  readonly justBought = signal<CosmeticItem | null>(null);
  readonly tab = signal<'real' | 'gear'>('real');
  readonly suggesting = signal(false);
  readonly confirming = signal<Reward | null>(null);
  readonly error = signal<string | null>(null);
  readonly toast = signal<string | null>(null);

  readonly balance = computed(() => this.state.me()?.balance ?? 0);
  readonly pendingCount = computed(() => this.rewards().filter(r => r.status === 'PENDING').length);
  readonly canSuggest = computed(() => this.pendingCount() < MAX_PENDING);
  /** Term goal first, then active by price, then the kid's own pending suggestions at the end. */
  readonly sorted = computed(() => [...this.rewards()].sort((a, b) =>
    Number(b.termGoal) - Number(a.termGoal) || Number(a.status === 'PENDING') - Number(b.status === 'PENDING') || (a.price ?? 0) - (b.price ?? 0)));

  /** Gear tab: hide starter items (everyone has them), buyable first, then locked by rank, owned last. */
  readonly gear = computed(() => this.cosmetics()
    .filter(i => !(i.price === 0 && i.unlockRankOrdinal === 0))
    .sort((a, b) => order(a) - order(b) || a.unlockRankOrdinal - b.unlockRankOrdinal || a.price - b.price));

  readonly balanceLookup = () => this.host.nativeElement.querySelector('.bal');
  readonly missionLookup = () => null;

  async ngOnInit() { await this.load(); }

  private async load() {
    try {
      const [, rewards, cosmetics] = await Promise.all([this.state.refresh(), this.api.rewards(), this.api.cosmetics()]);
      this.rewards.set(rewards); this.cosmetics.set(cosmetics);
    }
    catch { this.error.set('Could not reach the shop. Check the connection.'); }
  }

  affordable(r: Reward) { return r.status === 'ACTIVE' && (r.price ?? Infinity) <= this.balance(); }
  shortBy(r: Reward) { return Math.max(0, (r.price ?? 0) - this.balance()); }
  tierLabel(r: Reward) { return r.termGoal ? 'Term goal' : r.tier ? `Tier ${r.tier}` : ''; }

  askRedeem(r: Reward) { if (this.affordable(r)) { this.sound.tap(); this.confirming.set(r); } }

  async redeem(r: Reward) {
    this.confirming.set(null);
    try {
      await this.api.redeem(r.id);
      await this.load();
      const queue = await this.api.celebrations();
      await this.player().play(queue);
    } catch { this.error.set('That did not work. Maybe not enough points yet?'); setTimeout(() => this.error.set(null), 2500); }
  }

  slotLabel(i: CosmeticItem) { return SLOT_LABEL[i.slot] ?? i.slot; }
  rankName(ordinal: number) { return RANK_NAMES[this.theme.code()][ordinal] ?? `rank ${ordinal}`; }
  canBuy(i: CosmeticItem) { return i.state === 'BUYABLE' && i.price <= this.balance(); }

  async buy(i: CosmeticItem) {
    if (!this.canBuy(i)) return;
    try {
      const bought = await this.api.buyCosmetic(i.id);   // buys and equips in one go
      await this.load();
      this.justBought.set(bought);
      this.sound.coinBurst();
      const el = this.host.nativeElement.querySelector(`[data-item="${i.id}"]`);
      if (el) this.fx.burst(el, 20, 'var(--accent)');
      setTimeout(() => this.justBought.set(null), 2500);
    } catch { this.error.set('Could not buy that.'); setTimeout(() => this.error.set(null), 2500); }
  }

  async ack(id: number) { try { await this.api.ack(id); } catch { /* replays later */ } }

  async suggest(e: { name: string; category: RewardCategory; estimatedCost: number | null }) {
    this.suggesting.set(false);
    try {
      await this.api.suggestReward(e.name, e.category, e.estimatedCost);
      this.rewards.set(await this.api.rewards());
      this.sound.missionSent();
      const card = this.host.nativeElement.querySelector('.item.pending');
      if (card) this.fx.burst(card, 18, 'var(--tan)');
      this.showToast(`Sent to ${this.t().hq}`);
    } catch { this.error.set(`You already have ${MAX_PENDING} suggestions waiting.`); setTimeout(() => this.error.set(null), 2500); }
  }

  private showToast(msg: string) { this.toast.set(msg); setTimeout(() => this.toast.set(null), 1800); }
}

function order(i: CosmeticItem) { return i.state === 'BUYABLE' ? 0 : i.state === 'LOCKED' ? 1 : 2; }
