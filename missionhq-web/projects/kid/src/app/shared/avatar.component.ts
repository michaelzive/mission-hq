import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { AvatarView, THEMES, ThemeCode } from 'shared';
import { ThemeService } from '../core/theme.service';
import { part } from './avatar-parts';

/**
 * Renders the avatar from its slot asset keys as inline SVG. Parts live in avatar-parts.ts;
 * swap those fragments for real illustrations without touching the slot model.
 */
@Component({
  selector: 'kid-avatar',
  template: `<svg [attr.viewBox]="'0 0 100 100'" [attr.width]="size()" [attr.height]="size()" aria-hidden="true" [innerHTML]="svg()"></svg>`,
  styles: `:host { display: inline-block; line-height: 0; } svg { border-radius: 50%; overflow: hidden; }`,
})
export class AvatarComponent {
  private readonly theme = inject(ThemeService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly avatar = input<AvatarView | null | undefined>(null);
  readonly size = input(110);
  /** Defaults to the active theme; pass a sibling's theme so their colours render as they see them. */
  readonly themeCode = input<ThemeCode | null>(null);

  readonly svg = computed(() => {
    const a = this.avatar() ?? { colour: 0, slots: {} };
    const cols = (this.themeCode() ? THEMES[this.themeCode()!] : this.theme.config()).avatarColours;
    const c = cols[a.colour % cols.length];
    const s = a.slots;
    const skin = '#e8b98a';
    // Generated locally from a fixed set of keys, never from user input, so bypassing sanitization is safe here.
    return this.sanitizer.bypassSecurityTrustHtml([
      part('background', s.background, c, 'none'),
      part('back', s.back, c),
      `<rect x="22" y="72" width="56" height="30" rx="10" fill="${c}"/>`,
      part('body', s.body, c),
      `<rect x="35" y="60" width="30" height="20" rx="6" fill="${skin}"/>`,
      `<circle cx="50" cy="50" r="24" fill="${skin}"/>`,
      part('headgear', s.headgear, c),
      part('eyes', s.eyes, c, 'plain'),
      `<path d="M42 66 Q50 72 58 66" stroke="#7a4a2a" stroke-width="2" fill="none"/>`,
    ].join(''));
  });
}
