/**
 * What the 3D stage needs to know about a character file. A file authored to the convention in ASSETS.md
 * (clips named idle/wave/…, materials named region_main/…, empties named socket_head/…) needs only id, name and url;
 * the optional maps exist so files that predate the convention (like the stand-in robot) can still be wired up.
 */
export type Region = 'main' | 'trim' | 'accent';
export type SocketName = 'head' | 'face' | 'back' | 'hand';
export type Emote = 'wave' | 'cheer' | 'dance' | 'celebrate';
export type Clip = 'idle' | Emote;

export const REGIONS: Region[] = ['main', 'trim', 'accent'];
export const SOCKETS: SocketName[] = ['head', 'face', 'back', 'hand'];
export const EMOTES: Emote[] = ['wave', 'cheer', 'dance', 'celebrate'];

/**
 * Fallback socket for a file without a socket_<name> empty: a node to follow plus an offset from that node's position,
 * both in stage units (the character is scaled to STAGE_HEIGHT tall, feet on the floor, facing the camera).
 */
export interface SocketSpec {
  node: string;
  offset?: [number, number, number];
  /** Euler angles in radians, applied in stage space. */
  rotation?: [number, number, number];
  scale?: number;
}

export interface CharacterManifest {
  id: string;
  name: string;
  url: string;
  /** Turn the model to face the camera, in degrees, for exports that don't face +Z. */
  yaw?: number;
  clips?: Partial<Record<Clip, string>>;
  regions?: Partial<Record<Region, string>>;
  sockets?: Partial<Record<SocketName, SocketSpec>>;
}

/** Characters are scaled to this height so accessories can be authored once, in the same units, for every body. */
export const STAGE_HEIGHT = 2;

/** three.js's RobotExpressive (Tomás Laulhé / Quaternius, CC0): a rigged, animated humanoid to build against until the first Meshy character exists. */
export const STAND_IN: CharacterManifest = {
  id: 'stand-in-robot',
  name: 'Stand-in robot',
  url: 'avatars/3d/stand-in-robot.glb',
  clips: { idle: 'Idle', wave: 'Wave', cheer: 'ThumbsUp', dance: 'Dance', celebrate: 'Jump' },
  regions: { main: 'Main', trim: 'Grey', accent: 'Black' },
  sockets: {
    // The robot's head is about twice a normal one, so its head and face sockets scale gear up to match.
    head: { node: 'Head', offset: [0, 0.64, 0], scale: 1.4 },
    face: { node: 'Head', offset: [0, 0.36, 0.68], scale: 2 },
    back: { node: 'Torso', offset: [0, 0.05, -0.3] },
    hand: { node: 'Palm2.R', offset: [0, 0, 0] },
  },
};
