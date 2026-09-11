import { ApplicationRef, Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, first } from 'rxjs';

/**
 * Keeps the installed app current without asking anyone to press "update":
 * checks on launch and hourly; when a new version is ready it activates and reloads.
 * The reload waits until the app is stable so it never interrupts a celebration or a photo upload.
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly updates = inject(SwUpdate);
  private readonly appRef = inject(ApplicationRef);

  constructor() {
    if (!this.updates.isEnabled) return;
    this.appRef.isStable.pipe(first(stable => stable)).subscribe(() => {
      this.updates.checkForUpdate().catch(() => {});
      setInterval(() => this.updates.checkForUpdate().catch(() => {}), 60 * 60 * 1000);
    });
    this.updates.versionUpdates.pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY')).subscribe(() => {
      this.updates.activateUpdate().then(() => document.location.reload());
    });
    this.updates.unrecoverable.subscribe(() => document.location.reload());
  }
}
