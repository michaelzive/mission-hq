import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Session, SessionService, hashPin } from '../core/session.service';
import { SoundService } from '../core/sound.service';

const LENGTH = 4;

/**
 * A kid's secret code on a shared tablet. With no code yet it asks them to choose one (twice); otherwise it checks it.
 * Emits ok once the code is right (or newly set).
 */
@Component({
  selector: 'kid-pin-pad',
  template: `
    <div class="modal" (click)="cancel.emit()">
      <div class="sheet" (click)="$event.stopPropagation()">
        <h2>{{ heading() }}</h2>
        <p class="muted">{{ hint() }}</p>
        <div class="dots" [class.shake]="wrong()">
          @for (i of slots; track i) { <span [class.on]="digits().length > i"></span> }
        </div>
        <div class="pad">
          @for (k of keys; track k) {
            @if (k === '') { <span></span> }
            @else { <button class="key" (click)="press(k)">{{ k }}</button> }
          }
        </div>
        <button class="btn ghost" (click)="cancel.emit()">{{ cancelLabel() }}</button>
        @if (!setting() && offerForgot()) { <button class="link" (click)="forgot.emit()">Forgot your code?</button> }
      </div>
    </div>`,
  styles: `
    .modal { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: 40; }
    .sheet { background: var(--panel); border: 2px solid var(--line); border-radius: 18px; padding: 24px; width: 360px; max-width: 92vw; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
    h2 { font: 700 22px var(--display); }
    .dots { display: flex; gap: 14px; margin: 4px 0;
      span { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--line); }
      span.on { background: var(--accent); border-color: var(--accent); } }
    .shake { animation: shake .35s; }
    .pad { display: grid; grid-template-columns: repeat(3, 72px); gap: 10px; }
    .key { height: 64px; border-radius: 14px; border: 2px solid var(--line); background: var(--panel2); color: var(--ink); font: 700 26px var(--display); cursor: pointer;
      &:active { transform: scale(.94); } }
    .link { background: none; border: 0; color: var(--ink2); font: 700 13px var(--body); cursor: pointer; text-decoration: underline; }
    @keyframes shake { 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
  `,
})
export class PinPadComponent {
  private readonly session = inject(SessionService);
  private readonly sound = inject(SoundService);
  readonly kid = input.required<Session>();
  /** Why the code is being asked for, e.g. "to spend points". */
  readonly reason = input<string>('');
  readonly offerForgot = input(false);
  readonly ok = output<void>();
  readonly cancel = output<void>();
  readonly forgot = output<void>();

  readonly slots = Array.from({ length: LENGTH }, (_, i) => i);
  readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  readonly digits = signal('');
  readonly wrong = signal(false);
  /** While choosing a code: the first entry, waiting to be typed again. */
  private readonly first = signal<string | null>(null);

  readonly setting = computed(() => !this.kid().pinHash);
  readonly heading = computed(() => this.setting()
    ? (this.first() ? 'Type it again' : `Choose a secret code, ${this.kid().callsign}`)
    : `${this.kid().callsign}'s code`);
  readonly hint = computed(() => this.setting()
    ? 'Four numbers only you know. You need it to use this tablet.'
    : this.reason() ? `Enter your code ${this.reason()}.` : 'Enter your code.');
  readonly cancelLabel = computed(() => this.setting() ? 'Not now' : 'Cancel');

  async press(k: string) {
    this.wrong.set(false);
    if (k === '⌫') { this.digits.update(d => d.slice(0, -1)); return; }
    if (this.digits().length >= LENGTH) return;
    this.sound.tap();
    this.digits.update(d => d + k);
    if (this.digits().length === LENGTH) await this.complete(this.digits());
  }

  private async complete(pin: string) {
    const kid = this.kid();
    if (this.setting()) {
      const first = this.first();
      if (first === null) { this.first.set(pin); this.digits.set(''); return; }
      if (first !== pin) { this.first.set(null); return this.fail(); }
      this.session.setPin(kid.kidId, await hashPin(kid.kidId, pin));
      this.ok.emit();
      return;
    }
    if (await hashPin(kid.kidId, pin) === kid.pinHash) this.ok.emit();
    else this.fail();
  }

  private fail() {
    this.wrong.set(true);
    this.digits.set('');
  }
}
