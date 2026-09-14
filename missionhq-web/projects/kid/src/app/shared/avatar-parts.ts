import { Slot } from 'shared';

/**
 * Avatar part registry: one SVG fragment per (slot, assetKey), drawn on a 100x100 canvas.
 * `c` is the kid's chosen colour. This is where real artwork goes: replace a fragment (or point it at
 * a <use href="#..."> symbol from an illustrated sprite) without touching the slot model, the backend or the shop.
 * Draw order is fixed by AvatarComponent: background → back → torso → body → neck/head → headgear → eyes → mouth.
 *
 * Use flat shapes and opacity for shading, never <defs>/gradients: the squad screen renders several avatars at once,
 * so any id here would collide between siblings and the first one would win for all of them.
 * Two occlusions to design around: the torso rect covers x22-78 below y72 (so `back` items only read outside that),
 * and the svg is clipped to a circle, which cuts anything past r=50 from the centre.
 */
export type PartRenderer = (c: string) => string;
export const AVATAR_PARTS: Record<Slot, Record<string, PartRenderer>> = {
  background: {
    none: c => `<rect width="100" height="100" fill="${c}" opacity=".18"/>`,
    camo: () => `<rect width="100" height="100" fill="#3b4a2a"/><ellipse cx="20" cy="30" rx="22" ry="14" fill="#5a6b3a"/><ellipse cx="75" cy="20" rx="18" ry="12" fill="#2a331c"/><ellipse cx="80" cy="80" rx="24" ry="16" fill="#5a6b3a"/><ellipse cx="25" cy="85" rx="20" ry="12" fill="#2a331c"/>`,
    night: () => `<rect width="100" height="100" fill="#0b1020"/><circle cx="75" cy="22" r="9" fill="#dfe6f2"/><circle cx="70" cy="20" r="8" fill="#0b1020"/>`,
    starfield: () => `<rect width="100" height="100" fill="#0f1a4a"/>${[12, 30, 55, 80, 90, 40, 68].map((x, i) => `<circle cx="${x}" cy="${(i * 37) % 60 + 8}" r="${1 + (i % 2)}" fill="#fff"/>`).join('')}`,
    city: () => `<rect width="100" height="100" fill="#2a2f6b"/><rect x="5" y="55" width="12" height="45" fill="#141a44"/><rect x="22" y="40" width="10" height="60" fill="#1b2255"/><rect x="38" y="62" width="14" height="38" fill="#141a44"/><rect x="70" y="35" width="12" height="65" fill="#1b2255"/><rect x="86" y="58" width="10" height="42" fill="#141a44"/>`,
  },
  back: {
    pack: () => `<rect x="16" y="66" width="18" height="30" rx="5" fill="#3d3a2a"/>`,
    jetpack: c =>
      `<rect x="11" y="50" width="14" height="30" rx="6" fill="#8e99a8"/>` +
      `<rect x="75" y="50" width="14" height="30" rx="6" fill="#8e99a8"/>` +
      `<rect x="13.5" y="53" width="4" height="22" rx="2" fill="#fff" opacity=".35"/>` +
      `<rect x="77.5" y="53" width="4" height="22" rx="2" fill="#fff" opacity=".35"/>` +
      `<rect x="11" y="62" width="14" height="4" fill="${c}"/>` +
      `<rect x="75" y="62" width="14" height="4" fill="${c}"/>` +
      `<rect x="14" y="79" width="8" height="5" rx="2" fill="#4a525e"/>` +
      `<rect x="78" y="79" width="8" height="5" rx="2" fill="#4a525e"/>` +
      `<path d="M18 83 Q13.5 87 18 90 Q22.5 87 18 83 Z" fill="#ff8c42"/>` +
      `<path d="M82 83 Q77.5 87 82 90 Q86.5 87 82 83 Z" fill="#ff8c42"/>` +
      `<path d="M18 85 Q15.5 87.5 18 89 Q20.5 87.5 18 85 Z" fill="#ffd23f"/>` +
      `<path d="M82 85 Q79.5 87.5 82 89 Q84.5 87.5 82 85 Z" fill="#ffd23f"/>`,
  },
  body: {
    base: () => ``,
    vest: () => `<rect x="28" y="76" width="44" height="24" rx="6" fill="#2b2b2b"/><rect x="34" y="80" width="10" height="8" fill="#555"/><rect x="56" y="80" width="10" height="8" fill="#555"/>`,
    // darkened over the same-coloured torso it sits on, or the silhouette vanishes into it
    cape: c => {
      const left = 'M34 69 Q11 80 10 95 L31 99 Q28 82 38 72 Z';
      const right = 'M66 69 Q89 80 90 95 L69 99 Q72 82 62 72 Z';
      const collar = 'M30 67 Q50 77 70 67 L70 73 Q50 83 30 73 Z';
      return `<path d="${left}" fill="${c}"/><path d="${right}" fill="${c}"/>` +
        `<path d="${left}" fill="#000" opacity=".32"/><path d="${right}" fill="#000" opacity=".32"/>` +
        `<path d="${collar}" fill="${c}"/><path d="${collar}" fill="#000" opacity=".16"/>`;
    },
  },
  headgear: {
    none: () => ``,
    cap: c => `<path d="M28 44 Q50 22 72 44 L78 46 L22 46 Z" fill="${c}"/>`,
    helmet: c =>
      `<path d="M23 48 Q23 20 50 20 Q77 20 77 48 Q77 52 72 52 L28 52 Q23 52 23 48 Z" fill="${c}"/>` +
      `<path d="M23 45 Q50 51 77 45 L77 48 Q77 52 72 52 L28 52 Q23 52 23 48 Z" fill="#000" opacity=".22"/>` +
      `<path d="M31 43 Q32 26 47 23" stroke="#fff" stroke-width="3.5" fill="none" opacity=".3" stroke-linecap="round"/>` +
      `<rect x="23" y="37" width="6" height="12" rx="3" fill="#000" opacity=".28"/>` +
      `<rect x="71" y="37" width="6" height="12" rx="3" fill="#000" opacity=".28"/>`,
    beanie: c => `<path d="M27 46 Q50 18 73 46 Z" fill="${c}"/><rect x="27" y="42" width="46" height="6" fill="${c}" opacity=".7"/>`,
    mask: c => `<path d="M30 50 L70 50 L66 62 L34 62 Z" fill="${c}"/>`,
    crown: () => `<path d="M30 42 L38 30 L46 42 L54 30 L62 42 L70 30 L70 46 L30 46 Z" fill="#ffd23f"/>`,
    antenna: c => `<line x1="50" y1="30" x2="50" y2="14" stroke="${c}" stroke-width="3"/><circle cx="50" cy="12" r="4" fill="${c}"/>`,
  },
  eyes: {
    plain: () => `<circle cx="42" cy="56" r="3" fill="#222"/><circle cx="58" cy="56" r="3" fill="#222"/>`,
    goggles: c =>
      `<path d="M26 54 L74 54" stroke="${c}" stroke-width="5" stroke-linecap="round"/>` +
      `<rect x="30" y="48" width="40" height="15" rx="7" fill="#15171c"/>` +
      `<rect x="33" y="51" width="34" height="9" rx="4.5" fill="#6fa8dc"/>` +
      `<rect x="48" y="51" width="4" height="9" fill="#15171c"/>` +
      `<path d="M36 59 L43 52" stroke="#fff" stroke-width="2.5" opacity=".5" stroke-linecap="round"/>` +
      `<path d="M56 59 L63 52" stroke="#fff" stroke-width="2" opacity=".35" stroke-linecap="round"/>`,
    visor: () => `<rect x="32" y="50" width="36" height="12" rx="6" fill="#1a1a1a"/><rect x="34" y="52" width="32" height="4" rx="2" fill="#29c7e6" opacity=".8"/>`,
    shades: () => `<rect x="33" y="52" width="14" height="8" rx="3" fill="#111"/><rect x="53" y="52" width="14" height="8" rx="3" fill="#111"/>`,
    stars: () => `<text x="36" y="61" font-size="12" fill="#ffd23f">★</text><text x="54" y="61" font-size="12" fill="#ffd23f">★</text>`,
  },
  title: {}, // titles are text under the callsign, not drawn on the avatar
};

export function part(slot: Slot, key: string | undefined, c: string, fallback = ''): string {
  const r = key ? AVATAR_PARTS[slot][key] : undefined;
  return r ? r(c) : (fallback ? (AVATAR_PARTS[slot][fallback]?.(c) ?? '') : '');
}
