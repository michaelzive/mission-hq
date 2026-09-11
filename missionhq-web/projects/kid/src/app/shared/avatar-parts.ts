import { Slot } from 'shared';

/**
 * Avatar part registry: one SVG fragment per (slot, assetKey), drawn on a 100x100 canvas.
 * `c` is the kid's chosen colour. This is where real artwork goes: replace a fragment (or point it at
 * a <use href="#..."> symbol from an illustrated sprite) without touching the slot model, the backend or the shop.
 * Draw order is fixed by AvatarComponent: background → back → torso → body → neck/head → headgear → eyes → mouth.
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
    jetpack: () => `<rect x="14" y="66" width="12" height="28" rx="4" fill="#9aa4b2"/><rect x="74" y="66" width="12" height="28" rx="4" fill="#9aa4b2"/><path d="M20 94 l-4 6 8 0z M80 94 l-4 6 8 0z" fill="#ff8c42"/>`,
  },
  body: {
    base: () => ``,
    vest: () => `<rect x="28" y="76" width="44" height="24" rx="6" fill="#2b2b2b"/><rect x="34" y="80" width="10" height="8" fill="#555"/><rect x="56" y="80" width="10" height="8" fill="#555"/>`,
    cape: c => `<path d="M22 72 Q8 90 14 100 L30 100 Z" fill="${c}" opacity=".9"/><path d="M78 72 Q92 90 86 100 L70 100 Z" fill="${c}" opacity=".9"/>`,
  },
  headgear: {
    none: () => ``,
    cap: c => `<path d="M28 44 Q50 22 72 44 L78 46 L22 46 Z" fill="${c}"/>`,
    helmet: c => `<path d="M24 48 Q50 14 76 48 Z" fill="${c}"/><rect x="24" y="46" width="52" height="5" fill="#1a1a1a"/>`,
    beanie: c => `<path d="M27 46 Q50 18 73 46 Z" fill="${c}"/><rect x="27" y="42" width="46" height="6" fill="${c}" opacity=".7"/>`,
    mask: c => `<path d="M30 50 L70 50 L66 62 L34 62 Z" fill="${c}"/>`,
    crown: () => `<path d="M30 42 L38 30 L46 42 L54 30 L62 42 L70 30 L70 46 L30 46 Z" fill="#ffd23f"/>`,
    antenna: c => `<line x1="50" y1="30" x2="50" y2="14" stroke="${c}" stroke-width="3"/><circle cx="50" cy="12" r="4" fill="${c}"/>`,
  },
  eyes: {
    plain: () => `<circle cx="42" cy="56" r="3" fill="#222"/><circle cx="58" cy="56" r="3" fill="#222"/>`,
    goggles: () => `<rect x="32" y="50" width="36" height="12" rx="6" fill="#1a1a1a"/><rect x="34" y="52" width="32" height="4" rx="2" fill="#6fa8dc" opacity=".8"/>`,
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
