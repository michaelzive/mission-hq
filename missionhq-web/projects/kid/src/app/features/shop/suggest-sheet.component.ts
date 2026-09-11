import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RewardCategory } from 'shared';
import { ThemeService } from '../../core/theme.service';

const CATEGORIES: { code: RewardCategory; label: string }[] = [
  { code: 'GEAR', label: 'Gear' }, { code: 'GAME_TIME', label: 'Game time' }, { code: 'OUTING', label: 'Outing' }, { code: 'TREAT', label: 'Treat' }, { code: 'OTHER', label: 'Other' },
];

/** "Suggest a reward": the kid names it and guesses the cost; the parent prices it. */
@Component({
  selector: 'kid-suggest-sheet',
  imports: [FormsModule],
  template: `
    <div class="modal" (click)="cancel.emit()">
      <div class="sheet" (click)="$event.stopPropagation()">
        <h2>Suggest a reward</h2>
        <p class="muted">Your parents will check it and set the price.</p>
        <label>What is it?</label>
        <input [(ngModel)]="name" maxlength="80" placeholder="e.g. Bag of 0.25g BBs" autofocus />
        <label>Category</label>
        <div class="row">
          @for (c of categories; track c.code) {
            <button class="chip" [class.on]="category() === c.code" (click)="category.set(c.code)">{{ c.label }}</button>
          }
        </div>
        <label>Roughly how much? (R)</label>
        <input type="number" inputmode="numeric" min="0" [(ngModel)]="cost" placeholder="150" />
        <div class="row end">
          <button class="btn ghost" (click)="cancel.emit()">Cancel</button>
          <button class="btn" [disabled]="!name.trim()" (click)="send()">Send to {{ t().hq }}</button>
        </div>
      </div>
    </div>`,
  styles: `
    .modal { position: fixed; inset: 0; background: rgba(0,0,0,.65); display: flex; align-items: center; justify-content: center; z-index: 20; }
    .sheet { background: var(--panel); border: 2px solid var(--line); border-radius: 18px; padding: 24px; width: 520px; max-width: 92vw; display: flex; flex-direction: column; gap: 10px; }
    h2 { font: 700 22px var(--display); }
    label { font-size: 13px; color: var(--ink2); margin-top: 6px; }
    .chip { background: var(--panel2); border: 2px solid var(--line); color: var(--ink); border-radius: 999px; padding: 6px 14px; font: 700 14px var(--body); cursor: pointer; }
    .chip.on { border-color: var(--accent); background: var(--panel); }
    .end { justify-content: flex-end; margin-top: 8px; }
  `,
})
export class SuggestSheetComponent {
  readonly t = inject(ThemeService).t;
  readonly categories = CATEGORIES;
  name = ''; cost: number | null = null;
  readonly category = signal<RewardCategory>('GEAR');
  readonly submitted = output<{ name: string; category: RewardCategory; estimatedCost: number | null }>();
  readonly cancel = output<void>();

  send() { this.submitted.emit({ name: this.name.trim(), category: this.category(), estimatedCost: this.cost && this.cost > 0 ? this.cost : null }); }
}
