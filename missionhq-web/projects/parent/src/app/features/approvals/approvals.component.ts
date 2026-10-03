import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApprovalQueue, Household, HouseholdSettings, KidSummary, MissionCard, ParentApi, PendingMission, PendingReward } from 'shared';

const BONUS_PRESETS = [0, 5, 15];
const TIERS = [1, 2, 3];

/**
 * The parent's inbox. One glance per item, one tap to approve.
 * Everything a kid submits lands here: mission photos and reward suggestions. Missions a parent saw done but the kid
 * didn't report can be logged here too, at the household's reduced parent-log rate.
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
  readonly settings = signal<HouseholdSettings>({ timezone: 'Africa/Johannesburg', reminderTime: '18:30', parentLogPercent: 50 });
  readonly timezones = Intl.supportedValuesOf('timeZone');

  /** "Saw them do it?": whose missions are showing, and for which day. */
  readonly kids = signal<KidSummary[]>([]);
  readonly logKid = signal<number | null>(null);
  readonly logDay = signal<'today' | 'yesterday'>('today');
  readonly logMissions = signal<MissionCard[]>([]);

  async ngOnInit() { await this.refresh(); }

  async refresh() {
    try {
      const [q, hh, kids] = await Promise.all([this.api.queue(), this.api.household(), this.api.kids()]);
      this.queue.set(q); this.household.set(hh); this.rate.set(hh.pointsPerCurrencyUnit); this.kids.set(kids);
      this.settings.set({ timezone: hh.timezone, reminderTime: hh.reminderTime?.slice(0, 5) ?? null, parentLogPercent: hh.parentLogPercent });
      if (this.logKid() !== null) await this.loadLog();
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

  // ---- late reports ----
  /** The family's local date, so "for yesterday" is right whatever time zone this phone is in. */
  localDate(offsetDays = 0) {
    const tz = this.household()?.timezone;
    return new Intl.DateTimeFormat('en-CA', tz ? { timeZone: tz } : {}).format(new Date(Date.now() + offsetDays * 86_400_000));
  }
  isLate(m: PendingMission) { return m.missionDate !== this.localDate(); }

  // ---- saw them do it ----
  async pickLogKid(id: number) { this.logKid.set(this.logKid() === id ? null : id); await this.loadLog(); }
  async pickLogDay(d: 'today' | 'yesterday') { this.logDay.set(d); await this.loadLog(); }
  private logDate() { return this.localDate(this.logDay() === 'yesterday' ? -1 : 0); }
  private async loadLog() {
    const kid = this.logKid();
    if (kid === null) { this.logMissions.set([]); return; }
    try { this.logMissions.set(await this.api.kidMissions(kid, this.logDate())); }
    catch { this.error.set('Could not load their missions.'); }
  }
  /** Mirrors Household.parentLogPoints on the server. */
  logPoints(m: MissionCard) { return Math.max(1, Math.ceil(m.points * (this.household()?.parentLogPercent ?? 50) / 100)); }
  async logIt(m: MissionCard) {
    const kid = this.logKid(); if (kid === null) return;
    const name = this.kids().find(k => k.id === kid)?.callsign ?? 'them';
    await this.run(m.behaviourId, () => this.api.logMission(kid, m.behaviourId, this.logDate()), `Logged ${m.title} for ${name} · +${this.logPoints(m)} pts`);
  }

  async saveSettings() {
    const s = this.settings();
    if (s.parentLogPercent < 1 || s.parentLogPercent > 100) { this.error.set('Parent-logged share must be 1 to 100%.'); return; }
    try { await this.api.saveSettings(s); this.showToast('Settings saved'); await this.refresh(); }
    catch { this.error.set('Could not save the settings.'); }
  }
  setSetting(patch: Partial<HouseholdSettings>) { this.settings.update(s => ({ ...s, ...patch })); }

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
