import * as THREE from 'three';
import { SocketName } from './character-manifest';

/**
 * Placeholder gear, built from primitives so the spike needs no art. Each one is authored in stage units with its
 * origin at the socket: the bottom of a hat sits on y=0, glasses are centred on the origin, a backpack hangs off it
 * towards -Z. Real gear will be small GLBs exported to the same rule (see ASSETS.md).
 */
export interface Accessory {
  id: string;
  name: string;
  socket: SocketName;
  build: () => THREE.Object3D;
}

const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export const ACCESSORIES: Accessory[] = [
  {
    id: 'party-hat', name: 'Party hat', socket: 'head',
    build: () => {
      const g = new THREE.Group();
      g.add(mesh(new THREE.ConeGeometry(0.2, 0.45, 24), mat(0xff4f9a), 0, 0.225, 0));
      g.add(mesh(new THREE.SphereGeometry(0.06, 16, 12), mat(0xffe14d), 0, 0.47, 0));
      return g;
    },
  },
  {
    id: 'crown', name: 'Crown', socket: 'head',
    build: () => {
      const gold = mat(0xffc93c, { metalness: 0.8, roughness: 0.3 });
      const g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 24, 1, true), gold, 0, 0.06, 0));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(mesh(new THREE.ConeGeometry(0.05, 0.14, 8), gold, Math.sin(a) * 0.22, 0.18, Math.cos(a) * 0.22));
      }
      return g;
    },
  },
  {
    id: 'shades', name: 'Shades', socket: 'face',
    build: () => {
      const black = mat(0x111111, { metalness: 0.6, roughness: 0.15 });
      const g = new THREE.Group();
      g.add(mesh(new THREE.BoxGeometry(0.2, 0.1, 0.04), black, -0.12, 0, 0));
      g.add(mesh(new THREE.BoxGeometry(0.2, 0.1, 0.04), black, 0.12, 0, 0));
      g.add(mesh(new THREE.BoxGeometry(0.06, 0.025, 0.03), black, 0, 0.02, 0));
      return g;
    },
  },
  {
    id: 'jetpack', name: 'Jetpack', socket: 'back',
    build: () => {
      const metal = mat(0x9aa4ad, { metalness: 0.7, roughness: 0.35 });
      const flame = mat(0xff7a00, { emissive: 0xff5a00, emissiveIntensity: 1.5 });
      const g = new THREE.Group();
      for (const x of [-0.12, 0.12]) {
        g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.45, 16), metal, x, 0, -0.1));
        const f = mesh(new THREE.ConeGeometry(0.06, 0.18, 12), flame, x, -0.32, -0.1);
        f.rotation.x = Math.PI;
        g.add(f);
      }
      g.add(mesh(new THREE.BoxGeometry(0.18, 0.3, 0.06), metal, 0, 0, -0.02));
      return g;
    },
  },
  {
    id: 'star-wand', name: 'Star wand', socket: 'hand',
    build: () => {
      const g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), mat(0x6b4a2b), 0, 0.15, 0));
      g.add(mesh(new THREE.OctahedronGeometry(0.09), mat(0xffe14d, { emissive: 0xffc800, emissiveIntensity: 0.6 }), 0, 0.42, 0));
      return g;
    },
  },
];
