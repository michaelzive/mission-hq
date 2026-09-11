import { ThemeCode } from '../api/models';

/** Everything a theme changes. Palette is applied as CSS custom properties on :root. */
export interface ThemeConfig {
  code: ThemeCode;
  vocabulary: { hq: string; shop: string; locker: string; squad: string; missions: string; missionSent: string; hqConfirmed: string; rankUp: string; };
  palette: Record<string, string>;
  fonts: { display: string; body: string };
  radius: string;
  /** Avatar colour swatches; AvatarView.colour indexes into this. */
  avatarColours: string[];
  soundPack: 'airsoft' | 'hero';
}

export const THEMES: Record<ThemeCode, ThemeConfig> = {
  AIRSOFT: {
    code: 'AIRSOFT',
    vocabulary: { hq: 'HQ', shop: 'Armoury', locker: 'Locker', squad: 'Squad', missions: "Today's missions", missionSent: 'Mission report sent to HQ', hqConfirmed: 'HQ confirmed', rankUp: 'Rank up' },
    palette: { bg: '#1b1d16', panel: '#262a1f', panel2: '#30362a', ink: '#efeadb', ink2: '#b8b39f', accent: '#f26b1d', accentInk: '#1b1d16', good: '#8fbf4d', tan: '#c9b27c', line: '#3c4233' },
    fonts: { display: "'Chakra Petch', sans-serif", body: "'Nunito', sans-serif" },
    radius: '10px',
    avatarColours: ['#4d5a35', '#8a7a4a', '#2b2b2b', '#6e3b1f', '#7a8a92', '#3f6b4a', '#a0522d', '#5c5470'],
    soundPack: 'airsoft',
  },
  HERO: {
    code: 'HERO',
    vocabulary: { hq: 'The Tower', shop: 'Gadget lab', locker: 'Suit room', squad: 'Team', missions: "Today's quests", missionSent: 'Quest report sent to the Tower', hqConfirmed: 'Tower confirmed', rankUp: 'Level up' },
    palette: { bg: '#0f1a4a', panel: '#182562', panel2: '#22317a', ink: '#ffffff', ink2: '#b9c3f2', accent: '#ffd23f', accentInk: '#1a1a1a', good: '#3ee0a0', tan: '#29c7e6', line: '#2f3f8f' },
    fonts: { display: "'Bangers', cursive", body: "'Nunito', sans-serif" },
    radius: '18px',
    avatarColours: ['#e63462', '#ffd23f', '#29c7e6', '#7c4dff', '#3ee0a0', '#ff8c42', '#ffffff', '#1a1a1a'],
    soundPack: 'hero',
  },
};
