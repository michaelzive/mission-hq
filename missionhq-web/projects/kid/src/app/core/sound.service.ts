import { Injectable, signal } from '@angular/core';

/** Synthesised sounds, same event hooks as the prototype. Swap for sample packs per theme later. */
@Injectable({ providedIn: 'root' })
export class SoundService {
  readonly muted = signal(false);
  private ctx: AudioContext | null = null;

  private beep(freq: number, dur: number, wave: OscillatorType = 'triangle', vol = 0.08) {
    if (this.muted()) return;
    try {
      this.ctx ??= new AudioContext();
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = wave; o.frequency.value = freq; g.gain.value = vol;
      o.connect(g); g.connect(this.ctx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
      o.stop(this.ctx.currentTime + dur);
    } catch { /* audio not available */ }
  }

  tap() { this.beep(880, 0.05); }
  missionSent() { this.beep(660, 0.08); setTimeout(() => this.beep(990, 0.08), 90); }
  hqConfirmed() { this.beep(392, 0.12); }
  coinLand(i: number) { this.beep(1200 + i * 60, 0.05, 'square', 0.03); }
  coinBurst() { [1318, 1568, 1760, 2093].forEach((f, i) => setTimeout(() => this.beep(f, 0.09, 'square', 0.05), i * 60)); }
  firework() { this.beep(200 + Math.random() * 200, 0.25, 'sawtooth', 0.05); }
  win() {
    const seq: [number, number][] = [[523, .1], [659, .1], [784, .1], [1046, .1], [784, .1], [1046, .35], [1318, .5]];
    let t = 0;
    seq.forEach(([f, d]) => { setTimeout(() => { this.beep(f, d, 'square', 0.06); this.beep(f / 2, d, 'triangle', 0.05); }, t * 1000); t += d * 0.9; });
    for (let i = 0; i < 12; i++) setTimeout(() => this.beep(1500 + Math.random() * 1500, 0.04, 'square', 0.025), 900 + i * 45);
  }
}
