import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Behaviour, BehaviourInput, ParentApi } from 'shared';

const BLANK: BehaviourInput = { title: '', points: 10, kind: 'DAILY', requiresPhoto: true, bonusDate: null, active: true };

/** The household's mission list: daily missions and one-day bonus missions, with points and whether a photo is needed. */
@Component({
  selector: 'parent-missions',
  imports: [FormsModule, NgTemplateOutlet],
  template: `
    <h1>Missions</h1>
    <p class="muted">Every kid in the household sees the same missions. Daily ones can be done once a day; a bonus mission only shows on its date.</p>
    @if (error(); as e) { <p class="error">{{ e }}</p> }

    <section class="card add">
      <ng-container *ngTemplateOutlet="form; context: { $implicit: draft, set: setDraft }" />
      <div class="row">
        <button class="btn small go" [disabled]="!valid(draft()) || busy()" (click)="add()">Add mission</button>
      </div>
    </section>

    @if (!missions().length) { <p class="muted big">No missions yet. Add the first one above — "Homework done" and "20 minutes reading" are good starters.</p> }

    @for (m of missions(); track m.id) {
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
                {{ m.kind === 'BONUS' ? 'Bonus on ' + m.bonusDate : 'Daily' }} · {{ m.requiresPhoto ? 'photo required' : 'no photo' }}
                @if (!m.active) { · <b>retired</b> }
              </div>
            </div>
            <button class="link" (click)="startEdit(m)">Edit</button>
            <button class="link" (click)="toggle(m)">{{ m.active ? 'Retire' : 'Bring back' }}</button>
          </div>
        }
      </article>
    }
    @if (toast(); as t) { <div class="toast">{{ t }}</div> }

    <ng-template #form let-model let-set="set">
      <div class="row">
        <input class="title" placeholder="Mission, e.g. Homework done" maxlength="80" [ngModel]="model().title" (ngModelChange)="set({ title: $event })" />
        <label class="muted">Points</label>
        <input class="pts-in" type="number" min="1" [ngModel]="model().points" (ngModelChange)="set({ points: +$event })" />
      </div>
      <div class="row">
        <select [ngModel]="model().kind" (ngModelChange)="set({ kind: $event })">
          <option value="DAILY">Daily</option>
          <option value="BONUS">Bonus (one day only)</option>
        </select>
        @if (model().kind === 'BONUS') {
          <input type="date" [ngModel]="model().bonusDate" (ngModelChange)="set({ bonusDate: $event || null })" />
        }
        <label class="check"><input type="checkbox" [ngModel]="model().requiresPhoto" (ngModelChange)="set({ requiresPhoto: $event })" /> Photo required</label>
      </div>
    </ng-template>
  `,
  styles: `
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 6px; }
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
  private readonly api = inject(ParentApi);
  readonly missions = signal<Behaviour[]>([]);
  readonly draft = signal<BehaviourInput>({ ...BLANK });
  readonly editing = signal<number | null>(null);
  readonly edit = signal<BehaviourInput>({ ...BLANK });
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly toast = signal<string | null>(null);
  readonly setDraft = (patch: Partial<BehaviourInput>) => this.draft.update(d => ({ ...d, ...patch }));
  readonly setEdit = (patch: Partial<BehaviourInput>) => this.edit.update(d => ({ ...d, ...patch }));

  async ngOnInit() { await this.refresh(); }
  async refresh() { try { this.missions.set(await this.api.behaviours()); } catch { this.error.set('Could not load missions.'); } }

  valid(b: BehaviourInput) { return b.title.trim().length > 0 && b.points > 0 && (b.kind !== 'BONUS' || !!b.bonusDate); }
  startEdit(m: Behaviour) { const { id, ...rest } = m; this.edit.set(rest); this.editing.set(m.id); }

  async add() {
    if (!this.valid(this.draft()) || this.busy()) return;
    this.busy.set(true); this.error.set(null);
    try {
      const m = await this.api.createBehaviour(this.clean(this.draft()));
      this.draft.set({ ...BLANK });
      this.showToast(`"${m.title}" added — it's on the tablets from now`);
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
    const { id, ...rest } = m;
    try { await this.api.updateBehaviour(id, { ...rest, active: !m.active }); await this.refresh(); }
    catch { this.error.set('Could not update that mission.'); }
  }

  private clean(b: BehaviourInput): BehaviourInput { return { ...b, title: b.title.trim(), bonusDate: b.kind === 'BONUS' ? b.bonusDate : null }; }
  private showToast(msg: string) { this.toast.set(msg); setTimeout(() => this.toast.set(null), 2500); }
}
