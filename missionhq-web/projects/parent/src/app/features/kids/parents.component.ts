import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ParentApi, ParentInviteView, ParentMember } from 'shared';
import { AuthService } from '../../core/auth.service';

/**
 * The household's parents and how more join: an invite link that works once and expires in a week, which the parent sends
 * themselves (share sheet or copy). Only the link's hash is stored, so an invite can't be shown again: lost links get
 * cancelled and replaced. Any parent can remove another; nobody can remove themselves. Admins also get family invites,
 * which let someone start their own household.
 */
@Component({
  selector: 'parent-parents',
  imports: [FormsModule, DatePipe, NgTemplateOutlet],
  template: `
    <h2>Parents</h2>
    @if (error(); as e) { <p class="error">{{ e }}</p> }
    <article class="card">
      @for (p of parents(); track p.id) {
        <div class="row person">
          @if (renaming() && p.you) {
            <input maxlength="60" [(ngModel)]="newName" (keyup.enter)="rename()" />
            <button class="btn small go" [disabled]="!newName.trim() || busy()" (click)="rename()">Save</button>
            <button class="btn small ghost" (click)="renaming.set(false)">Cancel</button>
          } @else if (removing() === p.id) {
            <span class="who">Remove <b>{{ p.name }}</b>? They lose access straight away.</span>
            <button class="btn small danger" [disabled]="busy()" (click)="remove(p)">Remove</button>
            <button class="btn small ghost" (click)="removing.set(null)">Keep</button>
          } @else {
            <div class="who"><b>{{ p.name }}</b>@if (p.you) { <span class="muted"> (you)</span> }<div class="muted">{{ p.email }}</div></div>
            @if (p.you) { <button class="link" (click)="startRename(p)">Rename</button> }
            @else { <button class="link" (click)="removing.set(p.id)">Remove</button> }
          }
        </div>
      }
    </article>

    <article class="card">
      <b>Invite a parent</b>
      <p class="muted">Makes a link that works once and expires in 7 days. Send it yourself, for example on WhatsApp.
        They sign in with Google or an email address and join this family.</p>
      @if (link(); as l) {
        <ng-container *ngTemplateOutlet="linkBox; context: { $implicit: l, done: clearLink }" />
      } @else {
        <div class="row"><button class="btn small go" [disabled]="busy()" (click)="create()">Create invite link</button></div>
      }
      <ng-container *ngTemplateOutlet="pending; context: { $implicit: invites() }" />
    </article>

    @if (admin()) {
      <article class="card">
        <b>Invite a family</b>
        <p class="muted">Only admins see this. Makes a link that works once and expires in 7 days; whoever opens it starts
          their own family on Mission HQ, with their own kids, missions and rewards. Nothing in your family is shared with them.</p>
        @if (familyLink(); as l) {
          <ng-container *ngTemplateOutlet="linkBox; context: { $implicit: l, done: clearFamilyLink }" />
        } @else {
          <div class="row"><button class="btn small go" [disabled]="busy()" (click)="createFamily()">Create family invite link</button></div>
        }
        <ng-container *ngTemplateOutlet="pending; context: { $implicit: familyInvites() }" />
      </article>
    }
    @if (toast(); as t) { <div class="toast">{{ t }}</div> }

    <ng-template #linkBox let-l let-done="done">
      <input class="link-box" readonly [value]="l" (focus)="$any($event.target).select()" />
      <div class="row">
        @if (canShare) { <button class="btn small go" (click)="share(l)">Share link</button> }
        <button class="btn small" [class.go]="!canShare" (click)="copy(l)">Copy link</button>
        <button class="btn small ghost" (click)="done()">Done</button>
      </div>
    </ng-template>

    <ng-template #pending let-list>
      @if (list.length) {
        <div class="muted pending">Waiting to be used (lost a link? cancel it and make a new one):</div>
        @for (i of list; track i.id) {
          <div class="row">
            <span class="who muted">From {{ i.invitedBy }} · expires {{ i.expiresAt | date:'EEE d MMM' }}</span>
            <button class="link" (click)="cancel(i)">Cancel</button>
          </div>
        }
      }
    </ng-template>
  `,
  styles: `
    h2 { font-size: 17px; font-weight: 800; margin: 22px 0 8px; }
    .card { background: #fff; border: 1px solid #e3e0d8; border-radius: 14px; padding: 14px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 10px; }
    .row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .person + .person { border-top: 1px solid #f0ede6; padding-top: 10px; }
    .who { flex: 1; min-width: 160px; }
    .link { background: none; border: 0; color: #666; font: 700 13px inherit; cursor: pointer; }
    .link-box { width: 100%; font: 13px monospace; }
    .pending { font-size: 13px; margin-top: 4px; }
    .danger { background: #c0392b; color: #fff; }
    .toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); background: #1d1d1d; color: #fff; padding: 10px 18px; border-radius: 999px; font-weight: 700; }
  `,
})
export class ParentsComponent implements OnInit {
  private readonly api = inject(ParentApi);
  private readonly auth = inject(AuthService);
  readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  readonly parents = signal<ParentMember[]>([]);
  readonly invites = signal<ParentInviteView[]>([]);
  readonly link = signal<string | null>(null);
  readonly admin = signal(false);
  readonly familyInvites = signal<ParentInviteView[]>([]);
  readonly familyLink = signal<string | null>(null);
  readonly clearLink = () => this.link.set(null);
  readonly clearFamilyLink = () => this.familyLink.set(null);
  readonly renaming = signal(false);
  readonly removing = signal<number | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly toast = signal<string | null>(null);
  newName = '';

  async ngOnInit() { await this.refresh(); }

  async refresh() {
    try {
      const [parents, invites, me] = await Promise.all([this.api.parents(), this.api.invites(), this.auth.whoAmI()]);
      this.parents.set(parents); this.invites.set(invites); this.admin.set(me.admin);
      if (me.admin) this.familyInvites.set(await this.api.familyInvites());
    } catch { this.error.set('Could not load the parents.'); }
  }

  startRename(p: ParentMember) { this.newName = p.name; this.renaming.set(true); }

  rename() {
    return this.run(async () => { await this.api.renameMe(this.newName.trim()); this.renaming.set(false); await this.refresh(); }, 'Could not rename you.');
  }

  remove(p: ParentMember) {
    return this.run(async () => {
      await this.api.removeParent(p.id); this.removing.set(null);
      this.showToast(`${p.name} removed`); await this.refresh();
    }, `Could not remove ${p.name}.`);
  }

  create() {
    return this.run(async () => {
      const i = await this.api.createInvite();
      this.link.set(this.inviteUrl(i.token));
      await this.refresh();
    }, 'Could not create an invite.');
  }

  createFamily() {
    return this.run(async () => {
      const i = await this.api.createFamilyInvite();
      this.familyLink.set(this.inviteUrl(i.token));
      await this.refresh();
    }, 'Could not create a family invite.');
  }

  cancel(i: ParentInviteView) {
    return this.run(async () => {
      await this.api.cancelInvite(i.id); this.link.set(null); this.familyLink.set(null); await this.refresh();
    }, 'Could not cancel that invite.');
  }

  async share(url: string) {
    try { await navigator.share({ title: 'Mission HQ', text: 'Join our family on Mission HQ:', url }); }
    catch (e) { if ((e as DOMException)?.name !== 'AbortError') await this.copy(url); }
  }

  async copy(url: string) {
    try { await navigator.clipboard.writeText(url); this.showToast('Link copied'); }
    catch { this.showToast('Select the link and copy it'); }
  }

  private inviteUrl(token: string) { return `${location.origin}/login?invite=${encodeURIComponent(token)}`; }

  private async run(action: () => Promise<unknown>, fallback: string) {
    this.busy.set(true); this.error.set(null);
    try { await action(); }
    catch (e) { this.error.set((e as { error?: { error?: string } })?.error?.error ?? fallback); }
    finally { this.busy.set(false); }
  }

  private showToast(msg: string) { this.toast.set(msg); setTimeout(() => this.toast.set(null), 2000); }
}
