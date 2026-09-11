import { Component, inject, input, output, signal } from '@angular/core';
import { KidApi, MissionCard } from 'shared';
import { SoundService } from '../../core/sound.service';

/**
 * The "evidence upload" beat. Opens the camera directly, resizes the photo client-side (~1000px, JPEG 0.7)
 * so uploads are 100–200 KB, PUTs it to a presigned URL, then hands back the photoKey.
 */
@Component({
  selector: 'kid-mission-sheet',
  template: `
    <div class="modal" (click)="cancel.emit()">
      <div class="sheet" (click)="$event.stopPropagation()">
        <h2>{{ mission().title }}</h2>
        <p class="muted">Take a photo of the finished work. HQ checks it and confirms your points.</p>
        <label class="camera" [class.shot]="preview()">
          @if (preview(); as src) { <img [src]="src" alt="Your photo" /> } @else { <span>Tap to take photo</span> }
          <input type="file" accept="image/*" capture="environment" hidden (change)="onPhoto($event)" />
        </label>
        @if (error(); as e) { <p class="error">{{ e }}</p> }
        <div class="row end">
          <button class="btn ghost" (click)="cancel.emit()">Not yet</button>
          <button class="btn" [disabled]="!preview() || busy()" (click)="send()">{{ busy() ? 'Sending…' : 'Send mission report' }}</button>
        </div>
      </div>
    </div>`,
  styles: `
    .modal { position: fixed; inset: 0; background: rgba(0,0,0,.65); display: flex; align-items: center; justify-content: center; z-index: 20; }
    .sheet { background: var(--panel); border: 2px solid var(--line); border-radius: 18px; padding: 24px; width: 520px; max-width: 92vw; display: flex; flex-direction: column; gap: 14px; }
    h2 { font: 700 22px var(--display); }
    .camera { background: #000; border-radius: 12px; height: 220px; display: flex; align-items: center; justify-content: center; color: #888; border: 2px dashed #444; cursor: pointer; overflow: hidden; }
    .camera.shot { border-style: solid; border-color: var(--good); }
    .camera img { width: 100%; height: 100%; object-fit: cover; }
    .end { justify-content: flex-end; }
    .error { color: #ff5e5b; font-weight: 800; }
  `,
})
export class MissionSheetComponent {
  private readonly sound = inject(SoundService);
  private readonly api = inject(KidApi);
  readonly mission = input.required<MissionCard>();
  readonly submitted = output<{ behaviourId: number; photoKey: string }>();
  readonly cancel = output<void>();
  readonly preview = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  private blob: Blob | null = null;

  async onPhoto(ev: Event) {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const { dataUrl, blob } = await resize(file, 1000, 0.7);
    this.preview.set(dataUrl); this.blob = blob;
    this.sound.tap();
  }

  async send() {
    if (!this.blob) return;
    this.busy.set(true); this.error.set(null);
    try {
      const id = this.mission().behaviourId;
      const ticket = await this.api.photoTicket(id);
      const photoKey = await this.api.uploadPhoto(ticket, this.blob);
      this.submitted.emit({ behaviourId: id, photoKey });
    } catch {
      this.error.set('The photo did not upload. Try again.');
      this.busy.set(false);
    }
  }
}

async function resize(file: File, max: number, quality: number): Promise<{ dataUrl: string; blob: Blob }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('encode failed')), 'image/jpeg', quality));
  return { dataUrl: c.toDataURL('image/jpeg', quality), blob };
}
