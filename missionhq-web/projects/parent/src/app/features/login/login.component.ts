import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { InviteKind, InviteStatus, ParentApi } from 'shared';
import { AuthService } from '../../core/auth.service';

type Step = 'signin' | 'create' | 'verify' | 'reset' | 'invite' | 'join' | 'already' | 'household';

/** An invite link (/login?invite=…) is remembered until it's used, so it survives email verification and the guard's redirects. */
const INVITE_KEY = 'missionhq.invite';
const INVITE_GONE: Record<Exclude<InviteStatus, 'OPEN'>, string> = {
  EXPIRED: 'That invite link has expired. Ask for a new one.',
  USED: 'That invite link has already been used. Ask for a new one.',
  CANCELLED: 'That invite link was cancelled. Ask for a new one.',
};

/**
 * Parent sign-in. Google or email/password through Firebase; new email accounts verify their address before the backend
 * will link them. Someone signed in without a household joins one from an invite link, or is told to ask for one. An
 * account already in a household can't use an invite (one household per account). The household password form is the
 * pre-Firebase sign-in, kept for one transition release (and the only form on builds without Firebase).
 */
@Component({
  selector: 'parent-login',
  imports: [FormsModule, NgTemplateOutlet],
  template: `
    <div class="login">
      <h1>Mission HQ</h1>
      @if (invitedBy() && (step() === 'signin' || step() === 'create')) {
        <p class="banner"><b>{{ invitedBy() }}</b> invited you to {{ inviteKind() === 'FAMILY' ? 'start your own family' : 'join their family' }} on Mission HQ.
          Sign in, or create an account, to accept.</p>
      }
      @switch (step()) {
        @case ('signin') {
          <p class="muted">Parent sign in</p>
          <button class="btn google" [disabled]="busy()" (click)="google()">Sign in with Google</button>
          <div class="or muted">or</div>
          <input type="email" placeholder="Email" [(ngModel)]="email" autocomplete="username" />
          <input type="password" placeholder="Password" [(ngModel)]="password" autocomplete="current-password" (keyup.enter)="signInWithEmail()" />
          <ng-container *ngTemplateOutlet="feedback" />
          <button class="btn" [disabled]="!email || !password || busy()" (click)="signInWithEmail()">{{ busy() ? 'Checking…' : 'Sign in' }}</button>
          <p class="links">
            <button class="link" (click)="go('create')">Create an account</button> ·
            <button class="link" (click)="go('reset')">Forgot password?</button>
          </p>
          <button class="link small" (click)="go('household')">Use the household password instead</button>
        }
        @case ('create') {
          <p class="muted">Create your parent account</p>
          <input type="email" placeholder="Email" [(ngModel)]="email" autocomplete="username" />
          <input type="password" placeholder="Password (at least 6 characters)" [(ngModel)]="password" autocomplete="new-password" (keyup.enter)="create()" />
          <ng-container *ngTemplateOutlet="feedback" />
          <button class="btn" [disabled]="!email || password.length < 6 || busy()" (click)="create()">{{ busy() ? 'Creating…' : 'Create account' }}</button>
          <button class="link" (click)="go('signin')">I already have an account</button>
        }
        @case ('verify') {
          <p>We sent a link to <b>{{ shownEmail() }}</b>.</p>
          <p class="muted center">Open it (on any device), then come back here.</p>
          <ng-container *ngTemplateOutlet="feedback" />
          <button class="btn" [disabled]="busy()" (click)="verified()">{{ busy() ? 'Checking…' : "I've verified my email" }}</button>
          <p class="links">
            <button class="link" [disabled]="busy()" (click)="resend()">Send the link again</button> ·
            <button class="link" (click)="signOut()">Use a different account</button>
          </p>
        }
        @case ('reset') {
          <p class="muted">We'll email you a link to choose a new password.</p>
          <input type="email" placeholder="Email" [(ngModel)]="email" autocomplete="username" (keyup.enter)="reset()" />
          <ng-container *ngTemplateOutlet="feedback" />
          <button class="btn" [disabled]="!email || busy()" (click)="reset()">Send reset link</button>
          <button class="link" (click)="go('signin')">Back to sign in</button>
        }
        @case ('invite') {
          <p>You're signed in as <b>{{ shownEmail() }}</b>,</p>
          <p class="muted center">but this account isn't part of a family on Mission HQ yet. It's invite-only for now: ask the parent
            who set up your family's Mission HQ to invite you.</p>
          <ng-container *ngTemplateOutlet="feedback" />
          <button class="btn ghost" (click)="signOut()">Sign out</button>
        }
        @case ('join') {
          @if (inviteKind() === 'FAMILY') {
            <p><b>{{ invitedBy() }}</b> invited you to start your family on Mission HQ.</p>
            <p class="muted center">Signed in as {{ shownEmail() }}. You'll add your kids next. What should they call you?</p>
          } @else {
            <p><b>{{ invitedBy() }}</b> invited you to join their family.</p>
            <p class="muted center">Signed in as {{ shownEmail() }}. What should the family call you?</p>
          }
          <input placeholder="Your name, e.g. Mum" maxlength="60" [(ngModel)]="name" (keyup.enter)="join()" />
          <ng-container *ngTemplateOutlet="feedback" />
          <button class="btn" [disabled]="!name.trim() || busy()" (click)="join()">{{ busy() ? 'Joining…' : inviteKind() === 'FAMILY' ? 'Start our family' : 'Join the family' }}</button>
          <button class="link" (click)="signOut()">Use a different account</button>
        }
        @case ('already') {
          <p>You're already part of a family on Mission HQ,</p>
          <p class="muted center">so this invite can't be used with this account (one family per account for now).</p>
          <button class="btn" (click)="continueToApp()">Continue</button>
          <button class="link" (click)="signOut()">Use a different account</button>
        }
        @case ('household') {
          <p class="muted">Sign in with the household password</p>
          <input type="email" placeholder="Email" [(ngModel)]="email" autocomplete="username" />
          <input type="password" placeholder="Password" [(ngModel)]="password" autocomplete="current-password" (keyup.enter)="signInWithHouseholdPassword()" />
          <ng-container *ngTemplateOutlet="feedback" />
          <button class="btn" [disabled]="!email || !password || busy()" (click)="signInWithHouseholdPassword()">{{ busy() ? 'Checking…' : 'Sign in' }}</button>
          @if (auth.firebaseEnabled) { <button class="link" (click)="go('signin')">Back to sign in</button> }
        }
      }
    </div>
    <ng-template #feedback>
      @if (error(); as e) { <p class="error">{{ e }}</p> }
      @if (info(); as i) { <p class="info">{{ i }}</p> }
    </ng-template>`,
  styles: `
    .login { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; }
    input, .btn { width: 320px; max-width: 90vw; }
    .google { background: #fff; color: #1d1d1d; border: 1px solid #ccc; }
    .or { font-size: 13px; }
    .center { text-align: center; max-width: 360px; }
    .links { display: flex; gap: 6px; align-items: center; }
    .link { background: none; border: 0; color: #555; font: 700 14px inherit; cursor: pointer; padding: 0; }
    .small { font-size: 12px; font-weight: 600; color: #888; }
    .error { color: #c0392b; font-weight: 700; text-align: center; max-width: 360px; }
    .banner { background: #fff; border: 1px solid #e3e0d8; border-radius: 12px; padding: 10px 14px; text-align: center; max-width: 360px; }
    .info { color: #1d7a45; font-weight: 700; text-align: center; max-width: 360px; }
  `,
})
export class LoginComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ParentApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  email = ''; password = ''; name = '';
  /** Who sent the pending invite, once the backend confirmed it's still open. */
  readonly invitedBy = signal<string | null>(null);
  readonly inviteKind = signal<InviteKind>('PARENT');
  readonly step = signal<Step>(this.auth.firebaseEnabled ? 'signin' : 'household');
  readonly shownEmail = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);

  /** Picks up an invite link, then shows a visitor sent here by the guard (unverified, no household yet) the right screen. */
  async ngOnInit() {
    const fromLink = this.route.snapshot.queryParamMap.get('invite');
    if (fromLink) { store(INVITE_KEY, fromLink); await this.router.navigate([], { queryParams: {}, replaceUrl: true }); }
    const problem = await this.loadInvite();
    if (this.auth.firebaseEmail()) await this.run(() => this.finish());
    if (problem) this.error.set(problem);
  }

  join() {
    return this.run(async () => {
      await this.auth.acceptInvite(read(INVITE_KEY)!, this.name.trim());
      store(INVITE_KEY, null);
      await this.router.navigate([this.inviteKind() === 'FAMILY' ? '/kids' : '/approvals']);
    });
  }

  continueToApp() { store(INVITE_KEY, null); return this.router.navigate(['/approvals']); }

  go(step: Step) { this.error.set(null); this.info.set(null); this.step.set(step); }

  google() { return this.run(async () => { await this.auth.signInWithGoogle(); await this.finish(); }); }
  signInWithEmail() { return this.run(async () => { await this.auth.signInWithEmail(this.email.trim(), this.password); await this.finish(); }); }
  create() { return this.run(async () => { await this.auth.createAccount(this.email.trim(), this.password); await this.finish(); }); }
  resend() { return this.run(async () => { await this.auth.resendVerification(); this.info.set('Sent. Check your inbox (and spam).'); }); }

  verified() {
    return this.run(async () => {
      if (await this.auth.refreshVerification()) await this.finish();
      else this.error.set("Not verified yet. Open the link in the email, then try again.");
    });
  }

  reset() {
    return this.run(async () => {
      await this.auth.sendPasswordReset(this.email.trim());
      this.info.set(`If there's an account for ${this.email.trim()}, a reset link is on its way.`);
    });
  }

  signInWithHouseholdPassword() {
    return this.run(async () => {
      this.auth.signInWithHouseholdPassword(this.email.trim(), this.password);
      try { await this.finish(); } catch (e) { await this.auth.signOut(); throw e; }
    });
  }

  async signOut() { await this.auth.signOut(); this.password = ''; this.go(this.auth.firebaseEnabled ? 'signin' : 'household'); }

  /**
   * Ask the backend who this is: parents go in (or are told their account can't take the invite); unverified accounts
   * verify; verified accounts with an open invite join; anyone else needs an invite.
   */
  private async finish() {
    const me = await this.auth.whoAmI();
    const invited = !!this.invitedBy();
    if (me.parent) {
      if (invited) this.go('already');
      else await this.router.navigate(['/approvals']);
      return;
    }
    this.shownEmail.set(me.email ?? this.auth.firebaseEmail() ?? '');
    if (!me.emailVerified) this.go('verify');
    else if (invited) { this.name ||= this.auth.firebaseDisplayName() ?? me.email.split('@')[0]; this.go('join'); }
    else this.go('invite');
  }

  /** Checks the remembered invite; returns why it can't be used (and forgets it), or null. */
  private async loadInvite(): Promise<string | null> {
    const token = read(INVITE_KEY);
    if (!token) return null;
    try {
      const p = await this.api.invitePreview(token);
      if (p.status === 'OPEN') { this.invitedBy.set(p.invitedBy); this.inviteKind.set(p.kind); return null; }
      store(INVITE_KEY, null);
      return INVITE_GONE[p.status];
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) { store(INVITE_KEY, null); return "That invite link isn't valid. Check you copied all of it."; }
      return failure(e);
    }
  }

  private async run(action: () => Promise<unknown>) {
    this.busy.set(true); this.error.set(null); this.info.set(null);
    try { await action(); }
    catch (e) { const m = failure(e); if (m) this.error.set(m); }
    finally { this.busy.set(false); }
  }
}

/** Firebase and backend failures in words a parent can act on; null for ones that need no message (closing the Google popup). */
function failure(e: unknown): string | null {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 401) return 'Wrong email or password.';
    const said = (e.error as { error?: string } | null)?.error;
    if (said && e.status >= 400 && e.status < 500) return said.charAt(0).toUpperCase() + said.slice(1) + '.';
    if (e.status === 0 || e.status >= 500) return 'Could not reach the HQ server. Check that it is running, then try again.';
    return 'Sign in failed. Try again in a moment.';
  }
  switch ((e as { code?: string })?.code) {
    case 'auth/popup-closed-by-user': case 'auth/cancelled-popup-request': return null;
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': return 'Wrong email or password.';
    case 'auth/invalid-email': return "That doesn't look like an email address.";
    case 'auth/email-already-in-use': return 'There is already an account with that email. Sign in instead.';
    case 'auth/weak-password': return 'Use a password of at least 6 characters.';
    case 'auth/too-many-requests': return 'Too many attempts. Wait a few minutes, or reset your password.';
    case 'auth/popup-blocked': return 'The Google window was blocked. Allow pop-ups for this site and try again.';
    case 'auth/network-request-failed': return 'Could not reach Google. Check the connection.';
    case 'auth/unauthorized-domain': return "This site isn't on Firebase's list of authorized domains yet.";
    default: return 'Sign in failed. Try again in a moment.';
  }
}

function read(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function store(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private mode: the link just has to be reopened */ }
}
