import { Injectable, inject, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  Auth, GoogleAuthProvider, browserLocalPersistence, browserPopupRedirectResolver, createUserWithEmailAndPassword,
  indexedDBLocalPersistence, initializeAuth, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword,
  signInWithPopup, signOut,
} from 'firebase/auth';
import { AuthMe, ParentApi } from 'shared';
import { environment } from '../../environments/environment';

const BASIC_KEY = 'missionhq.parent';

/**
 * Who the parent is. Firebase Authentication (email/password or Google) when this build has a Firebase project: Firebase
 * keeps the sign-in in IndexedDB across app restarts and refreshes the ID token itself. The household password (HTTP Basic,
 * held in sessionStorage) stays available for one transition release and is the only option on builds without Firebase.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ParentApi);
  private readonly basic = signal<string | null>(sessionStorage.getItem(BASIC_KEY));
  private readonly auth: Auth | null = environment.firebase
    ? initializeAuth(initializeApp(environment.firebase), {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        popupRedirectResolver: browserPopupRedirectResolver,
      })
    : null;
  private readonly ready: Promise<void> = this.auth?.authStateReady() ?? Promise.resolve();
  /** Cached answer from /auth/me for the current sign-in; cleared on sign-out. */
  private me: AuthMe | null = null;

  readonly firebaseEnabled = this.auth !== null;

  /** Header value for API calls, or null when signed out. */
  async authorization(): Promise<string | null> {
    const b = this.basic();
    if (b) return `Basic ${btoa(b)}`;
    await this.ready;
    const user = this.auth?.currentUser;
    return user ? `Bearer ${await user.getIdToken()}` : null;
  }

  async isSignedIn(): Promise<boolean> {
    await this.ready;
    return this.basic() !== null || !!this.auth?.currentUser;
  }

  /** Signed in AND a parent in a household. Asks the backend once per sign-in. */
  async isParent(): Promise<boolean> {
    if (!(await this.isSignedIn())) return false;
    return (await this.whoAmI()).parent;
  }

  async whoAmI(): Promise<AuthMe> {
    return this.me ??= await this.api.authMe();
  }

  signInWithHouseholdPassword(email: string, password: string) {
    const c = `${email}:${password}`;
    this.basic.set(c); sessionStorage.setItem(BASIC_KEY, c); this.me = null;
  }

  async signInWithGoogle() { await signInWithPopup(this.firebase(), new GoogleAuthProvider()); this.me = null; }
  async signInWithEmail(email: string, password: string) { await signInWithEmailAndPassword(this.firebase(), email, password); this.me = null; }

  async createAccount(email: string, password: string) {
    const { user } = await createUserWithEmailAndPassword(this.firebase(), email, password);
    await sendEmailVerification(user);
    this.me = null;
  }

  resendVerification() { const u = this.firebase().currentUser; return u ? sendEmailVerification(u) : Promise.resolve(); }
  sendPasswordReset(email: string) { return sendPasswordResetEmail(this.firebase(), email); }

  /** After the user clicks the emailed link: reload the user and force a fresh token so the backend sees email_verified. */
  async refreshVerification(): Promise<boolean> {
    const u = this.firebase().currentUser;
    if (!u) return false;
    await reload(u);
    if (!u.emailVerified) return false;
    await u.getIdToken(true);
    this.me = null;
    return true;
  }

  /** The Firebase account's own view of its email, for screens shown before the backend knows the user. */
  firebaseEmail(): string | null { return this.auth?.currentUser?.email ?? null; }
  firebaseEmailVerified(): boolean { return this.auth?.currentUser?.emailVerified ?? false; }

  async signOut() {
    this.basic.set(null); sessionStorage.removeItem(BASIC_KEY); this.me = null;
    if (this.auth) await signOut(this.auth);
  }

  private firebase(): Auth {
    if (!this.auth) throw new Error('Firebase sign-in is not configured for this build');
    return this.auth;
  }
}
