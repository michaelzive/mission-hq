import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Behaviour, BehaviourInput, BehaviourKind, KidSummary, ParentApi } from 'shared';

const EVERYONE = 0;
/** New missions default to no photo: the kid taps "done" and the points land straight away. Tick "photo" where you want proof. */
const blank = (kidId: number): BehaviourInput => ({ kidId, title: '', points: 10, kind: 'DAILY', requiresPhoto: false, bonusDate: null, active: true });
const KIND_LABEL: Record<BehaviourKind, string> = { DAILY: 'Daily', WEEKLY: 'Weekly', BONUS: 'Bonus' };

/**
 * The household's missions — for everyone or directed at one kid: daily missions and one-day bonus missions, with
 * points and whether a photo is needed. kidId 0 stands for "everyone" in the form and is sent as null.
 */
@Component({
  selector: 'parent-missions',
  imports: [FormsModule, NgTemplateOutlet],
  template: `
    <h1>Missions</h1>
    <p class="muted">A mission is for everyone or for one kid. Daily ones can be done once a day by each kid who sees them, weekly ones once a week (Monday to Sunday); a bonus mission only shows on its date.</p>
    <p class="muted">Missions without a photo are trusted: the kid taps "done" and gets the points straight away. Ask for a photo where you want to check first; those wait in Approvals.</p>
    @if (error(); as e) { <p class="error">{{ e }}</p> }

    <section class="card add">
      <ng-container *ngTemplateOutlet="form; context: { $implicit: draft, set: setDraft }" />
      <div class="row">
        <button class="btn small go" [disabled]="!valid(draft()) || busy()" (click)="add()">Add mission</button>
      </div>
    </section>

    @if (!missions().length) { <p class="muted big">No missions yet. Add the first one above — "Homework done" and "20 minutes reading" are good starters.</p> }
    @else {
      <h2>Everyone <span class="muted">every kid sees these</span></h2>
      @if (!byKid()[0]?.length) { <p class="muted">Nothing for everyone yet.</p> }
      @for (m of byKid()[0]; track m.id) { <ng-container *ngTemplateOutlet="card; context: { $implicit: m }" /> }

      @for (k of kids(); track k.id) {
        <h2>{{ k.callsign }}'s missions <span class="muted">only {{ k.callsign }} sees these</span></h2>
        @if (!byKid()[k.id]?.length) { <p class="muted">Nothing just for {{ k.callsign }} yet.</p> }
        @for (m of byKid()[k.id]; track m.id) { <ng-container *ngTemplateOutlet="card; context: { $implicit: m }" /> }
      }
    }
    @if (toast(); as t) { <div class="toast">{{ t }}</div> }

    <ng-template #card let-m>
      <article class="card" [class.off]="!m.active">
        @if (editing() === m.id) {
          <ng-container *ngTemplateOutlet="form; context: { $implicit: edit, set: setEdit }" />
          <div class="row">
            <button class="btn small go" [disabled]="!valid(edit()) || busy()" (click)="save(m)">Save</button>
            <button class="btn small ghost" (click)="editing.set(null)">Cancel</button>
          </div>
        } @else {
          <div class="top">
            <div class="who">
              <b>{{ m.title }}</b> <span class="pts">+{{ m.points }}</span>
              <div class="muted">
                {{ m.kind === 'BONUS' ? 'Bonus on ' + m.bonusDate : kindLabel(m) }} · {{ m.requiresPhoto ? 'photo, you approve' : 'no photo, approved straight away' }}
                @if (!m.active) { · <b>retired</b> }
              </div>
            </div>
            <button class="link" (click)="startEdit(m)">Edit</button>
            <button class="link" (click)="toggle(m)">{{ m.active ? 'Retire' : 'Bring back' }}</button>
          </div>
        }
      </article>
    </ng-template>

    <ng-template #form let-model let-set="set">
      <div class="row">
        <label class="muted">For</label>
        <select [ngModel]="model().kidId" (ngModelChange)="set({ kidId: +$event })">
          <option [value]="0">Everyone</option>
          @for (k of kids(); track k.id) { <option [value]="k.id">{{ k.callsign }}</option> }
        </select>
      </div>
      <div class="row">
        <input class="title" placeholder="Mission, e.g. Homework done" maxlength="80" [ngModel]="model().title" (ngModelChange)="set({ title: $event })" />
        <label class="muted">Points</label>
        <input class="pts-in" type="number" min="1" [ngModel]="model().points" (ngModelChange)="set({ points: +$event })" />
      </div>
      <div class="row">
        <select [ngModel]="model().kind" (ngModelChange)="set({ kind: $event })">
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly (once a week)</option>
          <option value="BONUS">Bonus (one day only)</option>
        </select>
        @if (model().kind === 'BONUS') {
          <input type="date" [ngModel]="model().bonusDate" (ngModelChange)="set({ bonusDate: $event || null })" />
        }
        <label class="check"><input type="checkbox" [ngModel]="model().requiresPhoto" (ngModelChange)="set({ requiresPhoto: $event })" /> Photo required (you approve it)</label>
      </div>
    </ng-template>
  `,
  styles: `
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 6px; }
    h2 { font-size: 17px; font-weight: 800; margin: 18px 0 8px; display: flex; align-items: center; gap: 8px; }
    .big { font-size: 16px; margin: 24px 0; }
    .card { background: #fff; border: 1px solid #e3e0d8; border-radius: 14px; padding: 14px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 10px; }
    .card.off { opacity: .6; }
    .add { margin-top: 12px; }
    .top { display: flex; align-items: center; gap: 12px; }
    .who { flex: 1; }
    .pts { font-weight: 800; color: #1d7a45; margin-left: 4px; }
    .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .title { flex: 1; min-width: 200px; }
    .pts-in { width: 80px; }
    .check { display: flex; align-items: center; gap: 6px; font-size: 14px; }
    .check input { width: auto; }
    .link { background: none; border: 0; color: #666; font: 700 13px inherit; cursor: pointer; }
    .toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); background: #1d1d1d; color: #fff; padding: 10px 18px; border-radius: 999px; font-weight: 700; }
  `,
})
export class MissionsComponent implements OnInit {
  kindLabel(m: Behaviour) { return KIND_LABEL[m.kind]; }
  private readonly api = inject(ParentApi);
  readonly kids = signal<KidSummary[]>([]);
  readonly missions = signal<Behaviour[]>([]);
  readonly byKid = computed(() => {
    const m: Record<number, Behaviour[]> = {};
    for (const b of this.missions()) (m[b.kidId ?? EVERYONE] ??= []).push(b);
    return m;
  });
  readonly draft = signal<BehaviourInput>(blank(EVERYONE));
  readonly editing = signal<number | null>(null);
  readonly edit = signal<BehaviourInput>(blank(EVERYONE));
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly toast = signal<string | null>(null);
  readonly setDraft = (patch: Partial<BehaviourInput>) => this.draft.update(d => ({ ...d, ...patch }));
  readonly setEdit = (patch: Partial<BehaviourInput>) => this.edit.update(d => ({ ...d, ...patch }));

  async ngOnInit() { await this.refresh(); }
  async refresh() {
    try {
      const [kids, missions] = await Promise.all([this.api.kids(), this.api.behaviours()]);
      this.kids.set(kids); this.missions.set(missions);
    } catch { this.error.set('Could not load missions.'); }
  }

  valid(b: BehaviourInput) { return b.title.trim().length > 0 && b.points > 0 && (b.kind !== 'BONUS' || !!b.bonusDate); }
  startEdit(m: Behaviour) { const { id, callsign, ...rest } = m; this.edit.set({ ...rest, kidId: m.kidId ?? EVERYONE }); this.editing.set(m.id); }

  async add() {
    if (!this.valid(this.draft()) || this.busy()) return;
    this.busy.set(true); this.error.set(null);
    try {
      const m = await this.api.createBehaviour(this.clean(this.draft()));
      this.draft.set(blank(this.draft().kidId ?? EVERYONE));
      this.showToast(`"${m.title}" added — it's on ${m.callsign ? m.callsign + "'s tablet" : 'the tablets'} from now`);
      await this.refresh();
    } catch { this.error.set('Could not add that mission.'); }
    finally { this.busy.set(false); }
  }

  async save(m: Behaviour) {
    if (!this.valid(this.edit()) || this.busy()) return;
    this.busy.set(true); this.error.set(null);
    try { await this.api.updateBehaviour(m.id, this.clean(this.edit())); this.editing.set(null); await this.refresh(); }
    catch { this.error.set('Could not save those changes.'); }
    finally { this.busy.set(false); }
  }

  async toggle(m: Behaviour) {
    const { id, callsign, ...rest } = m;
    try { await this.api.updateBehaviour(id, { ...rest, active: !m.active }); await this.refresh(); }
    catch { this.error.set('Could not update that mission.'); }
  }

  /** Form state uses 0 for "everyone"; the API wants null. */
  private clean(b: BehaviourInput): BehaviourInput { return { ...b, kidId: b.kidId || null, title: b.title.trim(), bonusDate: b.kind === 'BONUS' ? b.bonusDate : null }; }
  private showToast(msg: string) { this.toast.set(msg); setTimeout(() => this.toast.set(null), 2500); }
}
