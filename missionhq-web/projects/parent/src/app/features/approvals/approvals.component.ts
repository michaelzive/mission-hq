import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApprovalQueue, Household, ParentApi, PendingMission, PendingReward } from 'shared';

const BONUS_PRESETS = [0, 5, 15];
const TIERS = [1, 2, 3];

/**
 * The parent's inbox. One glance per item, one tap to approve.
 * Everything a kid submits lands here: mission photos and reward suggestions.
 */
@Component({
  selector: 'parent-approvals',
  imports: [FormsModule, DatePipe, CurrencyPipe],
  templateUrl: './approvals.component.html',
  styleUrl: './approvals.component.scss',
})
export class ApprovalsComponent implements OnInit {
  private readonly api = inject(ParentApi);
  readonly bonusPresets = BONUS_PRESETS;
  readonly tiers = TIERS;

  readonly queue = signal<ApprovalQueue>({ missions: [], rewards: [] });
  readonly household = signal<Household | null>(null);
  readonly busy = signal<Set<number>>(new Set());
  readonly error = signal<string | null>(null);
  readonly toast = signal<string | null>(null);
  readonly lightbox = signal<string | null>(null);
  readonly empty = computed(() => !this.queue().missions.length && !this.queue().rewards.length);

  /** Per-item editable state, keyed by id. Kept outside the DTOs so a refresh does not wipe what the parent typed. */
  readonly bonus = signal<Record<number, number>>({});
  readonly note = signal<Record<number, string>>({});
  readonly price = signal<Record<number, number>>({});
  readonly tier = signal<Record<number, number | null>>({});
  readonly rate = signal<number>(1);

  async ngOnInit() { await this.refresh(); }

  async refresh() {
    try {
      const [q, hh] = await Promise.all([this.api.queue(), this.api.household()]);
      this.queue.set(q); this.household.set(hh); this.rate.set(hh.pointsPerCurrencyUnit);
      // Seed the editable price with the rate-derived suggestion, but keep any value already typed.
      this.price.update(p => { const next = { ...p }; for (const r of q.rewards) next[r.rewardId] ??= r.suggestedPrice; return next; });
      this.error.set(null);
    } catch { this.error.set('Could not load the queue.'); }
  }

  bonusFor(m: PendingMission) { return this.bonus()[m.completionId] ?? 0; }
  setBonus(m: PendingMission, v: number) { this.bonus.update(b => ({ ...b, [m.completionId]: v })); }
  noteFor(m: PendingMission) { return this.note()[m.completionId] ?? ''; }
  setNote(m: PendingMission, v: string) { this.note.update(n => ({ ...n, [m.completionId]: v })); }
  priceFor(r: PendingReward) { return this.price()[r.rewardId] ?? r.suggestedPrice; }
  setPrice(r: PendingReward, v: number) { this.price.update(p => ({ ...p, [r.rewardId]: v })); }
  tierFor(r: PendingReward) { return this.tier()[r.rewardId] ?? autoTier(this.priceFor(r)); }
  setTier(r: PendingReward, v: number) { this.tier.update(t => ({ ...t, [r.rewardId]: v })); }
  isManual(r: PendingReward) { return this.priceFor(r) !== r.suggestedPrice; }
  isBusy(id: number) { return this.busy().has(id); }

  async approveMission(m: PendingMission) {
    await this.run(m.completionId, () => this.api.approveMission(m.completionId, this.bonusFor(m)),
      `Approved · ${m.points + this.bonusFor(m)} pts to ${m.callsign}`);
  }
  async sendBack(m: PendingMission) {
    await this.run(m.completionId, () => this.api.sendBack(m.completionId, this.noteFor(m) || 'Have another go'), `Sent back to ${m.callsign}`);
  }
  async approveReward(r: PendingReward) {
    const price = this.priceFor(r); if (price <= 0) { this.error.set('Price must be positive.'); return; }
    await this.run(r.rewardId, () => this.api.approveReward(r.rewardId, price, this.tierFor(r)), `${r.name} added to ${r.callsign}'s shop at ${price} pts`);
  }
  async declineReward(r: PendingReward) { await this.run(r.rewardId, () => this.api.declineReward(r.rewardId), 'Declined'); }

  async saveRate() {
    try { await this.api.setRate(this.rate()); this.showToast('Rate updated for future rewards'); await this.refresh(); }
    catch { this.error.set('Could not update the rate.'); }
  }

  private async run(id: number, action: () => Promise<unknown>, success: string) {
    this.busy.update(s => new Set(s).add(id));
    try { await action(); this.showToast(success); await this.refresh(); }
    catch { this.error.set('That did not go through. Try again.'); }
    finally { this.busy.update(s => { const n = new Set(s); n.delete(id); return n; }); }
  }
  private showToast(msg: string) { this.toast.set(msg); setTimeout(() => this.toast.set(null), 2200); }
}

/** Mirrors Reward.tierFor on the server so the pre-selected tier matches what the server would choose. */
function autoTier(price: number) { return price > 500 ? 3 : price > 200 ? 2 : 1; }
