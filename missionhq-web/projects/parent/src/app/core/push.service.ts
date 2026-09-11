import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { ParentApi } from 'shared';

/**
 * Web Push via the Angular service worker. Requires the production build (SW on) and HTTPS.
 * Flow: get the VAPID public key → ask the browser for a subscription → hand it to the backend.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly swPush = inject(SwPush);
  private readonly api = inject(ParentApi);
  readonly supported = signal(false);
  readonly state = signal<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown');

  constructor() {
    const ok = this.swPush.isEnabled && 'Notification' in window;
    this.supported.set(ok);
    this.state.set(ok ? (Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'unknown') : 'unsupported');
    if (ok && Notification.permission === 'granted') this.subscribe().catch(() => {});
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
