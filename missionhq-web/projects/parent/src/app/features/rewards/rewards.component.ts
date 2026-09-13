import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KidSummary, OpenRedemption, ParentApi, REWARD_CATEGORIES, RewardAdmin, RewardAdminInput, RewardCategory } from 'shared';

const CATEGORY_LABEL: Record<RewardCategory, string> = { GEAR: 'Gear', GAME_TIME: 'Game time', OUTING: 'Outing', TREAT: 'Treat', OTHER: 'Other' };
const EVERYONE = 0;
const blank = (kidId: number): RewardAdminInput => ({ kidId, name: '', category: 'GEAR', price: 100, termGoal: false, repeatable: false, retired: false });

/**
 * Each kid's shop plus everyone's shop: what they can spend points on, the term goal each is saving for, and redemptions
 * waiting to be delivered. kidId 0 stands for "everyone" in the form and is sent as null.
 */
@Component({
  selector: 'parent-rewards',
  imports: [FormsModule, NgTemplateOutlet, DatePipe],
  template: `
    <h1>Rewards</h1>
    @if (error(); as e) { <p class="error">{{ e }}</p> }

    @if (open().length) {
      <h2>To deliver <span class="count">{{ open().length }}</span></h2>
      @for (r of open(); track r.id) {
        <article class="card deliver">
          <div class="who"><b>{{ r.callsign }}</b> redeemed <b>{{ r.rewardName }}</b><div class="muted">{{ r.pricePaid }} pts · {{ r.redeemedAt | date:'EEE d MMM HH:mm' }}</div></div>
          <button class="btn small go" [disabled]="busy()" (click)="fulfil(r)">Delivered</button>
        </article>
      }
    }

    <section class="card add">
      <div class="row">
        <label class="muted">For</label>
        <select [ngModel]="draft().kidId" (ngModelChange)="setDraft({ kidId: +$event, termGoal: +$event === 0 ? false : draft().termGoal })">
          <option [value]="0">Everyone</option>
          @for (k of kids(); track k.id) { <option [value]="k.id">{{ k.callsign }}</option> }
        </select>
      </div>
      <ng-container *ngTemplateOutlet="form; context: { $implicit: draft, set: setDraft }" />
      <div class="row"><button class="btn small go" [disabled]="!valid(draft()) || busy()" (click)="add()">Add reward</button></div>
    </section>

    <h2>Everyone's shop <span class="muted">every kid sees these</span></h2>
    @if (!byKid()[0]?.length) { <p class="muted">Nothing shared yet.</p> }
    @for (r of byKid()[0]; track r.id) { <ng-container *ngTemplateOutlet="card; context: { $implicit: r }" /> }

    @for (k of kids(); track k.id) {
      <h2>{{ k.callsign }}'s shop <span class="muted">{{ k.balance }} pts to spend</span></h2>
      @if (!byKid()[k.id]?.length) { <p class="muted">Nothing of their own yet.</p> }
      @for (r of byKid()[k.id]; track r.id) { <ng-container *ngTemplateOutlet="card; context: { $implicit: r }" /> }
    }
    @if (toast(); as t) { <div class="toast">{{ t }}</div> }

    <ng-template #card let-r>
      <article class="card" [class.off]="r.status === 'RETIRED'">
        @if (editing() === r.id) {
          <ng-container *ngTemplateOutlet="form; context: { $implicit: edit, set: setEdit }" />
          <div class="row">
            <button class="btn small go" [disabled]="!valid(edit()) || busy()" (click)="save(r)">Save</button>
            <button class="btn small ghost" (click)="editing.set(null)">Cancel</button>
          </div>
        } @else {
          <div class="top">
            <div class="who">
              <b>{{ r.name }}</b> <span class="pts">{{ r.price }} pts</span>
              @if (r.termGoal) { <span class="tag goal">term goal</span> } @else if (r.tier) { <span class="tag">tier {{ r.tier }}</span> }
              <div class="muted">
                {{ label(r) }}{{ r.repeatable ? ' · repeatable' : (r.kidId === null ? ' · once per kid' : '') }}
                @if (r.status === 'PENDING') { · <b>suggested by {{ r.callsign }}, waiting in Approvals</b> }
                @if (r.status === 'RETIRED') { · <b>retired</b> }
              </div>
            </div>
            @if (r.status !== 'PENDING') {
              <button class="link" (click)="startEdit(r)">Edit</button>
              <button class="link" (click)="toggle(r)">{{ r.status === 'RETIRED' ? 'Bring back' : 'Retire' }}</button>
            }
          </div>
        }
      </article>
    </ng-template>

    <ng-template #form let-model let-set="set">
      <div class="row">
        <input class="name" placeholder="Reward, e.g. Bag of BBs" maxlength="80" [ngModel]="model().name" (ngModelChange)="set({ name: $event })" />
        <select [ngModel]="model().category" (ngModelChange)="set({ category: $event })">
          @for (c of categories; track c) { <option [value]="c">{{ categoryLabel[c] }}</option> }
        </select>
        <label class="muted">Price</label>
        <input class="price" type="number" min="1" [ngModel]="model().price" (ngModelChange)="set({ price: +$event })" />
      </div>
      <div class="row">
        @if (model().kidId) {
          <label class="check"><input type="checkbox" [ngModel]="model().termGoal" (ngModelChange)="set({ termGoal: $event })" /> Term goal (the big one on HQ; one per kid)</label>
        }
        <label class="check"><input type="checkbox" [ngModel]="model().repeatable" (ngModelChange)="set({ repeatable: $event })" /> Repeatable</label>
      </div>
    </ng-template>
  `,
  styles: `
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 12px; }
    h2 { font-size: 17px; font-weight: 800; margin: 18px 0 8px; display: flex; align-items: center; gap: 8px; }
    .count { background: #1d1d1d; color: #fff; border-radius: 999px; padding: 1px 8px; font-size: 13px; }
    .big { font-size: 16px; margin: 24px 0; }
    .card { background: #fff; border: 1px solid #e3e0d8; border-radius: 14px; padding: 14px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 10px; }
    .card.off { opacity: .6; }
    .deliver { flex-direction: row; align-items: center; border-color: #1d7a45; }
    .top { display: flex; align-items: center; gap: 12px; }
    .who { flex: 1; }
    .pts { font-weight: 800; color: #1d7a45; margin-left: 4px; }
    .tag { font-size: 11px; font-weight: 800; text-transform: uppercase; background: #f1efe8; padding: 2px 8px; border-radius: 999px; margin-left: 6px; }
    .tag.goal { background: #ffe9a8; }
    .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .name { flex: 1; min-width: 180px; }
    .price { width: 90px; }
    .check { display: flex; align-items: center; gap: 6px; font-size: 14px; }
    .check input { width: auto; }
    .link { background: none; border: 0; color: #666; font: 700 13px inherit; cursor: pointer; }
    .toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); background: #1d1d1d; color: #fff; padding: 10px 18px; border-radius: 999px; font-weight: 700; }
  `,
})
export class RewardsComponent implements OnInit {
  private readonly api = inject(ParentApi);
  readonly categories = REWARD_CATEGORIES;
  readonly categoryLabel = CATEGORY_LABEL;
  readonly kids = signal<KidSummary[]>([]);
  readonly rewards = signal<RewardAdmin[]>([]);
  readonly open = signal<OpenRedemption[]>([]);
  readonly byKid = computed(() => {
    const m: Record<number, RewardAdmin[]> = {};
    for (const r of this.rewards()) (m[r.kidId ?? EVERYONE] ??= []).push(r);
    return m;
  });
  readonly draft = signal<RewardAdminInput>(blank(EVERYONE));
  readonly editing = signal<number | null>(null);
  readonly edit = signal<RewardAdminInput>(blank(EVERYONE));
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly toast = signal<string | null>(null);
  readonly setDraft = (patch: Partial<RewardAdminInput>) => this.draft.update(d => ({ ...d, ...patch }));
  readonly setEdit = (patch: Partial<RewardAdminInput>) => this.edit.update(d => ({ ...d, ...patch }));

  async ngOnInit() { await this.refresh(); }
  async refresh() {
    try {
      const [kids, rewards, open] = await Promise.all([this.api.kids(), this.api.rewards(), this.api.redemptions()]);
      this.kids.set(kids); this.rewards.set(rewards); this.open.set(open);
    } catch { this.error.set('Could not load rewards.'); }
  }

  valid(r: RewardAdminInput) { return r.name.trim().length > 0 && r.price > 0; }
  label(r: RewardAdmin) { return CATEGORY_LABEL[r.category]; }
  startEdit(r: RewardAdmin) {
    this.edit.set({ kidId: r.kidId ?? EVERYONE, name: r.name, category: r.category, price: r.price ?? 1, termGoal: r.termGoal, repeatable: r.repeatable, retired: r.status === 'RETIRED' });
    this.editing.set(r.id);
  }

  async add() {
    if (!this.valid(this.draft()) || this.busy()) return;
    this.busy.set(true); this.error.set(null);
    try {
      const r = await this.api.createReward(this.payload(this.draft()));
      this.draft.set(blank(this.draft().kidId ?? EVERYONE));
      this.showToast(`${r.name} is in ${r.callsign ? r.callsign + "'s" : "everyone's"} shop`);
      await this.refresh();
    } catch (e) { this.error.set(this.message(e, 'Could not add that reward.')); }
    finally { this.busy.set(false); }
  }

  async save(r: RewardAdmin) {
    if (!this.valid(this.edit()) || this.busy()) return;
    this.busy.set(true); this.error.set(null);
    try { await this.api.updateReward(r.id, this.payload(this.edit())); this.editing.set(null); await this.refresh(); }
    catch (e) { this.error.set(this.message(e, 'Could not save those changes.')); }
    finally { this.busy.set(false); }
  }

  async toggle(r: RewardAdmin) {
    try {
      await this.api.updateReward(r.id, { kidId: r.kidId, name: r.name, category: r.category, price: r.price ?? 1, termGoal: r.termGoal, repeatable: r.repeatable, retired: r.status !== 'RETIRED' });
      await this.refresh();
    } catch (e) { this.error.set(this.message(e, 'Could not update that reward.')); }
  }

  /** Form state uses 0 for "everyone"; the API wants null. */
  private payload(b: RewardAdminInput): RewardAdminInput { return { ...b, kidId: b.kidId || null, name: b.name.trim(), termGoal: b.kidId ? b.termGoal : false }; }

  async fulfil(r: OpenRedemption) {
    this.busy.set(true);
    try { await this.api.fulfilRedemption(r.id); this.showToast(`${r.rewardName} marked delivered`); await this.refresh(); }
    catch { this.error.set('Could not mark that as delivered.'); }
    finally { this.busy.set(false); }
  }

  /** The backend explains price and term-goal rules; surface that text rather than a generic failure. */
  private message(e: unknown, fallback: string) { return (e as { error?: { error?: string } })?.error?.error ?? fallback; }
  private showToast(msg: string) { this.toast.set(msg); setTimeout(() => this.toast.set(null), 2500); }
}
