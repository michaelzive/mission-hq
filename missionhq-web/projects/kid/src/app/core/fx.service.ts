import { Injectable, inject } from '@angular/core';
import { SoundService } from './sound.service';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; dec: number; c: string; r: number; g: number; trail?: boolean; rect?: boolean; rot?: number; vr?: number; }

/** Particle effects on a full-screen canvas plus DOM coin flights. Call attach() once from the HQ screen. */
@Injectable({ providedIn: 'root' })
export class FxService {
  private readonly sound = inject(SoundService);
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private parts: Particle[] = [];
  private running = false;
  private host: HTMLElement | null = null;

  attach(canvas: HTMLCanvasElement, host: HTMLElement) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.host = host;
    const size = () => { canvas.width = host.clientWidth; canvas.height = host.clientHeight; };
    size(); new ResizeObserver(size).observe(host);
  }

  private center(el: Element) {
    const r = el.getBoundingClientRect(), h = this.host!.getBoundingClientRect();
    return { x: r.left - h.left + r.width / 2, y: r.top - h.top + r.height / 2 };
  }
  private cssColor(v: string) { return v.startsWith('var') ? getComputedStyle(document.documentElement).getPropertyValue(v.slice(4, -1)).trim() : v; }

  burst(el: Element, n: number, color: string) {
    if (!this.host) return;
    const p = this.center(el), c = this.cssColor(color);
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = 2 + Math.random() * 4; this.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, life: 1, dec: .02 + Math.random() * .02, c, r: 3 + Math.random() * 3, g: .12 }); }
    this.loop();
  }

  fireworks(count: number) {
    const cv = this.canvas; if (!cv) return; let i = 0;
    const next = () => {
      if (i++ >= count) return;
      const x = cv.width * (.15 + Math.random() * .7), y = cv.height * (.15 + Math.random() * .4);
      const c = ['#ffd23f', '#ff5e5b', '#29c7e6', '#3ee0a0', '#e63462', '#ffffff'][i % 6];
      for (let k = 0; k < 60; k++) { const a = (k / 60) * 6.28, sp = 3 + Math.random() * 3; this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, dec: .012, c, r: 2.5, g: .05, trail: true }); }
      this.sound.firework(); this.loop(); setTimeout(next, 260 + Math.random() * 250);
    };
    next();
  }

  confetti() {
    const cv = this.canvas; if (!cv) return;
    const cols = ['#ffd23f', '#ff5e5b', '#29c7e6', '#3ee0a0', '#e63462', '#a78bfa'];
    for (let i = 0; i < 120; i++) this.parts.push({ x: Math.random() * cv.width, y: -10 - Math.random() * 200, vx: (Math.random() - .5) * 2, vy: 2 + Math.random() * 3, life: 1, dec: .004, c: cols[i % 6], r: 4 + Math.random() * 4, g: .02, rect: true, rot: Math.random() * 6, vr: (Math.random() - .5) * .3 });
    this.loop();
  }

  /** DOM coins arcing from one element to another; resolves when the last coin lands. */
  coins(from: Element, to: Element, n = 10): Promise<void> {
    return new Promise(resolve => {
      const host = this.host; if (!host) { resolve(); return; }
      const a = this.center(from), b = this.center(to); let landed = 0;
      for (let i = 0; i < n; i++) {
        const c = document.createElement('div'); c.className = 'coin'; host.appendChild(c);
        const dur = 550 + Math.random() * 250, delay = i * 70, cx = (a.x + b.x) / 2 + (Math.random() - .5) * 160, cy = Math.min(a.y, b.y) - 80 - Math.random() * 80, s = performance.now() + delay;
        const f = (t: number) => {
          if (t < s) { requestAnimationFrame(f); return; }
          const p = Math.min(1, (t - s) / dur), q = 1 - p;
          c.style.left = (q * q * a.x + 2 * q * p * cx + p * p * b.x - 11) + 'px';
          c.style.top = (q * q * a.y + 2 * q * p * cy + p * p * b.y - 11) + 'px';
          c.style.transform = `scale(${1 - p * .3}) rotateY(${p * 720}deg)`;
          if (p < 1) requestAnimationFrame(f); else { c.remove(); this.sound.coinLand(i); if (++landed === n) resolve(); }
        };
        requestAnimationFrame(f);
      }
    });
  }

  private loop() {
    if (this.running || !this.ctx || !this.canvas) return; this.running = true;
    const ctx = this.ctx, cv = this.canvas;
    const frame = () => {
      ctx.clearRect(0, 0, cv.width, cv.height); this.parts = this.parts.filter(p => p.life > 0);
      for (const p of this.parts) {
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= .99; p.life -= p.dec; ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
        if (p.rect) { p.rot = (p.rot ?? 0) + (p.vr ?? 0); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.trail ? p.life : 1), 0, 6.28); ctx.fill(); }
      }
      ctx.globalAlpha = 1; if (this.parts.length) requestAnimationFrame(frame); else this.running = false;
    };
    frame();
  }
}
