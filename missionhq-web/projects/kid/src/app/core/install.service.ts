import { Injectable, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>; }

/** Captures Chrome's install prompt so the pairing screen can offer "Add to home screen" at the right moment. */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private deferred: BeforeInstallPromptEvent | null = null;
  readonly canInstall = signal(false);
  readonly isInstalled = signal(window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches);

  constructor() {
    window.addEventListener('beforeinstallprompt', (e: Event) => { e.preventDefault(); this.deferred = e as BeforeInstallPromptEvent; this.canInstall.set(true); });
    window.addEventListener('appinstalled', () => { this.isInstalled.set(true); this.canInstall.set(false); this.deferred = null; });
  }

  async prompt() {
    if (!this.deferred) return;
    await this.deferred.prompt();
    const { outcome } = await this.deferred.userChoice;
    if (outcome === 'accepted') this.canInstall.set(false);
    this.deferred = null;
  }
}
