import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../core/theme.service';
import { ACCESSORIES, Accessory } from '../../shared/avatar3d/accessories';
import { AvatarStage, Capabilities, StageStats, Tier } from '../../shared/avatar3d/avatar-stage';
import { CharacterManifest, Emote, Region, STAND_IN, SocketName } from '../../shared/avatar3d/character-manifest';

type TierMode = 'auto' | Tier;
const TIER_KEY = 'mhq.avatar.tier';
const EMOTE_LABELS: Record<Emote, string> = { wave: 'Wave', cheer: 'Cheer', dance: 'Dance', celebrate: 'Celebrate' };
const REGION_LABELS: Record<Region, string> = { main: 'Main colour', trim: 'Trim colour', accent: 'Accent colour' };

/**
 * Spike page for the 3D avatar: one character on a live stage, moves, colour regions, socket gear, quality tiers and
 * the 2D portrait. Not linked from anywhere and needs no pairing; open /avatar-lab on the tablet directly.
 * "Try your own model" loads a .glb from the device, so a fresh Blender export can be checked without a deploy.
 */
@Component({
  selector: 'kid-avatar-lab',
  templateUrl: './avatar-lab.component.html',
  styleUrl: './avatar-lab.component.scss',
})
export class AvatarLabComponent {
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private stage: AvatarStage | null = null;
  private fileUrl: string | null = null;

  readonly emoteLabels = EMOTE_LABELS;
  readonly regionLabels = REGION_LABELS;
  readonly accessories = ACCESSORIES;
  readonly tierModes: TierMode[] = ['auto', 'high', 'low'];
  readonly colours = computed(() => this.theme.config().avatarColours);

  readonly character = signal(STAND_IN.name);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly stats = signal<StageStats | null>(null);
  readonly caps = signal<Capabilities>({ regions: [], sockets: [], emotes: [] });
  readonly tints = signal<Partial<Record<Region, number>>>({});
  readonly gear = signal<Partial<Record<SocketName, string>>>({});
  readonly tierMode = signal<TierMode>(readTier() ?? 'auto');
  readonly measured = signal<Tier | null>(null);
  readonly portrait = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      const stored = readTier();
      this.stage = new AvatarStage(this.canvas().nativeElement, {
        tier: stored ?? undefined,
        onStats: s => this.stats.set(s),
        onAutoTier: t => { this.measured.set(t); writeTier(t); },
      });
      void this.load(STAND_IN);
    });
    inject(DestroyRef).onDestroy(() => {
      this.stage?.dispose();
      this.revoke(this.fileUrl);
      this.revoke(this.portrait());
    });
  }

  emote(e: Emote) { this.stage?.emote(e); }

  pickColour(region: Region, index: number) {
    this.tints.update(t => ({ ...t, [region]: index }));
    this.stage?.tint(region, this.colours()[index]);
  }

  toggleGear(a: Accessory) {
    const on = this.gear()[a.socket] === a.id;
    this.gear.update(g => ({ ...g, [a.socket]: on ? undefined : a.id }));
    this.stage?.equip(a.socket, on ? null : a);
  }

  setTierMode(mode: TierMode) {
    this.tierMode.set(mode);
    this.measured.set(null);
    if (mode === 'auto') { clearTier(); this.stage?.remeasure(); }
    else { writeTier(mode); this.stage?.setTier(mode); }
  }

  async snapshot() {
    if (!this.stage) return;
    const blob = await this.stage.portrait();
    this.revoke(this.portrait());
    this.portrait.set(URL.createObjectURL(blob));
  }

  async loadFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const previous = this.fileUrl;
    this.fileUrl = url;
    if (await this.load({ id: 'local', name: file.name, url })) this.revoke(previous);
  }

  back() { void this.router.navigateByUrl('/'); }

  /** Loads a character, then re-applies the current tints and gear, since a fresh model starts bare. */
  private async load(manifest: CharacterManifest): Promise<boolean> {
    if (!this.stage) return false;
    this.loading.set(true);
    this.error.set(null);
    try {
      const caps = await this.stage.load(manifest);
      this.caps.set(caps);
      this.character.set(manifest.name);
      for (const [region, i] of Object.entries(this.tints()) as [Region, number][]) this.stage.tint(region, this.colours()[i]);
      for (const a of this.accessories) if (this.gear()[a.socket] === a.id) this.stage.equip(a.socket, a);
      return true;
    } catch (e) {
      this.error.set(`Could not load ${manifest.name}: ${e instanceof Error ? e.message : e}`);
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  private revoke(url: string | null) { if (url) URL.revokeObjectURL(url); }
}

// Per-device setting, so storage being unavailable just means re-measuring next time.
function readTier(): Tier | null {
  try { const v = localStorage.getItem(TIER_KEY); return v === 'high' || v === 'low' ? v : null; } catch { return null; }
}
function writeTier(t: Tier) { try { localStorage.setItem(TIER_KEY, t); } catch { /* not persisted */ } }
function clearTier() { try { localStorage.removeItem(TIER_KEY); } catch { /* nothing to clear */ } }
