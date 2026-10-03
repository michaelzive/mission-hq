import { Injectable, effect, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { KidApi } from 'shared';
import { SessionService } from './session.service';

/**
 * Web Push via the Angular service worker. Requires the production build (SW on) and HTTPS.
 * Flow: get the VAPID public key → ask the browser for a subscription → hand it to the backend.
 * A shared tablet never subscribes: "HQ has news for you" can't say which kid it's for, and each kid's own tablet
 * already gets their alerts. When a second kid is paired here, the existing subscription is dropped (the backend
 * forgets it the next time a push to it comes back 404/410).
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(KidApi);
  private readonly session = inject(SessionService);
  readonly supported = signal(false);
  readonly state = signal<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown');

  constructor() {
    const ok = this.swPush.isEnabled && 'Notification' in window;
    this.supported.set(ok && !this.session.shared());
    this.state.set(ok ? (Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'unknown') : 'unsupported');
    if (ok && Notification.permission === 'granted' && !this.session.shared() && this.session.current()) this.subscribe().catch(() => {});
    effect(() => {
      if (!this.session.shared()) return;
      this.supported.set(false);
      if (ok) this.swPush.unsubscribe().catch(() => { /* wasn't subscribed */ });
    });
  }

  /** Call from a user gesture (a tap) the first time; browsers block permission prompts otherwise. */
  async enable() {
    if (!this.supported()) return false;
    const ok = await this.subscribe();
    this.state.set(ok ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'unknown');
    return ok;
  }

  private async subscribe() {
    const { publicKey } = await this.api.pushPublicKey();
    if (!publicKey) return false;
    const sub = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
    await this.api.pushSubscribe(sub.toJSON());
    return true;
  }
}
