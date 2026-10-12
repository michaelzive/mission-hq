import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Accessory } from './accessories';
import { CharacterManifest, Clip, EMOTES, Emote, REGIONS, Region, SOCKETS, STAGE_HEIGHT, SocketName, SocketSpec } from './character-manifest';

export type Tier = 'high' | 'low';
/** cap: the frame-rate limit in force, 0 while the auto-tier measurement runs uncapped. */
export interface StageStats { fps: number; cap: number; triangles: number; drawCalls: number; pixelRatio: number; tier: Tier }
export interface StageOptions {
  /** Omit to measure: start high, drop to low if the first seconds run under AUTO_MIN_FPS, and report via onAutoTier. */
  tier?: Tier;
  onStats?: (s: StageStats) => void;
  onAutoTier?: (t: Tier) => void;
}
/** What the loaded file actually supports, so the UI only offers what works. */
export interface Capabilities { regions: Region[]; sockets: SocketName[]; emotes: Emote[] }

const AUTO_MIN_FPS = 40;
// An idle loop looks the same at 30 fps; rendering at the screen's 90-120 Hz would only drain the battery and warm the tablet.
const IDLE_FPS = 30;
const ACTIVE_FPS = 60;
/** How long to stay at ACTIVE_FPS after a finger lifts, while the orbit damping glides to a stop. */
const SETTLE_MS = 1000;
const FADE = 0.25;

/**
 * One live 3D avatar on one canvas: the locker stage. Framework-free so the locker and the celebration overlay can share it.
 * Only one should exist at a time (each owns a WebGL context, and tablets cap how many can be alive); everywhere else
 * shows the 2D portrait this produces. Call dispose() when the host goes away.
 */
export class AvatarStage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  private readonly portraitCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private readonly controls: OrbitControls;
  private readonly sun = new THREE.DirectionalLight(0xffffff, 2.2);
  private readonly ground: THREE.Mesh;
  private readonly resize: ResizeObserver;

  private root: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<Clip, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private regionMaterials = new Map<Region, THREE.MeshStandardMaterial[]>();
  private sockets = new Map<SocketName, THREE.Object3D>();
  private gear = new Map<SocketName, THREE.Object3D>();
  private loadSeq = 0;
  private lastTime = 0;
  private nextFrame = 0;
  private dragging = false;
  private settleUntil = 0;

  private tier: Tier;
  private measuring: boolean;
  private measureFrames = 0;
  private measureTime = 0;
  private fpsFrames = 0;
  private fpsTime = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: StageOptions = {}) {
    this.tier = options.tier ?? 'high';
    this.measuring = options.tier === undefined;
    // antialias is fixed at context creation, so only a device already known to be slow starts without it.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.tier === 'high', alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.camera.position.set(0, 1.25, 6);
    // Frames roughly chest to just above the head (y ≈ 0.85-2.35), leaving room for tall headgear.
    this.portraitCamera.position.set(0, 1.65, 2.9);
    this.portraitCamera.lookAt(0, 1.6, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 1, 0);
    Object.assign(this.controls, { enablePan: false, enableZoom: false, enableDamping: true, minPolarAngle: Math.PI / 3, maxPolarAngle: Math.PI / 1.9 });
    this.controls.update();
    this.controls.addEventListener('start', () => { this.dragging = true; });
    this.controls.addEventListener('end', () => { this.dragging = false; this.settleUntil = performance.now() + SETTLE_MS; });

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    this.sun.position.set(2.5, 5, 4);
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: 1, far: 15 });
    this.scene.add(this.sun);

    this.ground = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.ShadowMaterial({ opacity: 0.3 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.applyTier();
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(canvas);
    this.fit();
    this.renderer.setAnimationLoop(t => this.frame(t));
  }

  /** Replaces the current character. Gear and tints are not carried over; the caller re-applies its own state. */
  async load(manifest: CharacterManifest): Promise<Capabilities> {
    const seq = ++this.loadSeq;
    const gltf = await new GLTFLoader().loadAsync(manifest.url);
    if (seq !== this.loadSeq) { disposeTree(gltf.scene); return this.capabilities(); }
    this.unloadCharacter();

    const model = gltf.scene;
    model.rotation.y = THREE.MathUtils.degToRad(manifest.yaw ?? 0);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const scale = STAGE_HEIGHT / Math.max(box.max.y - box.min.y, 1e-6);
    model.scale.multiplyScalar(scale);
    model.position.set(-(box.min.x + box.max.x) / 2 * scale, -box.min.y * scale, -(box.min.z + box.max.z) / 2 * scale);

    const root = new THREE.Group();
    root.add(model);
    this.scene.add(root);
    root.updateMatrixWorld(true);
    this.root = root;

    this.collectMaterials(model, manifest);
    this.collectSockets(model, manifest);
    this.collectClips(model, gltf.animations, manifest);
    this.play('idle');
    if (this.measuring) { this.measureFrames = 0; this.measureTime = 0; }
    return this.capabilities();
  }

  tint(region: Region, colour: string) {
    for (const m of this.regionMaterials.get(region) ?? []) m.color.set(colour);
  }

  /** Puts gear on its socket, replacing whatever was there; null clears the socket. */
  equip(socket: SocketName, accessory: Accessory | null) {
    const old = this.gear.get(socket);
    if (old) { old.removeFromParent(); disposeTree(old); this.gear.delete(socket); }
    const anchor = this.sockets.get(socket);
    if (!accessory || !anchor) return;
    const obj = accessory.build();
    anchor.add(obj);
    this.gear.set(socket, obj);
    if (this.tier === 'high') obj.traverse(o => { o.castShadow = true; });
  }

  /** Plays a one-shot move, then eases back to idle. */
  emote(name: Emote) { this.play(name); }

  setTier(tier: Tier) { this.measuring = false; this.tier = tier; this.applyTier(); }
  remeasure() { this.tier = 'high'; this.applyTier(); this.measuring = true; this.measureFrames = 0; this.measureTime = 0; }

  /**
   * Head-and-shoulders PNG for every screen that isn't the stage (rail, squad, who, shop). Renders once from a fixed
   * front camera and copies the centre square in the same task, before the browser clears the drawing buffer.
   */
  portrait(size = 256): Promise<Blob> {
    const c = this.renderer.domElement;
    this.portraitCamera.aspect = c.width / c.height;
    this.portraitCamera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.portraitCamera);
    const side = Math.min(c.width, c.height);
    const out = document.createElement('canvas');
    out.width = out.height = size;
    out.getContext('2d')!.drawImage(c, (c.width - side) / 2, (c.height - side) / 2, side, side, 0, 0, size, size);
    return new Promise((resolve, reject) => out.toBlob(b => (b ? resolve(b) : reject(new Error('portrait failed'))), 'image/png'));
  }

  dispose() {
    this.loadSeq++;
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    this.controls.dispose();
    this.unloadCharacter();
    disposeTree(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private frame(time: number) {
    const cap = this.cap(time);
    if (cap) {
      // Render on the first screen refresh at or after each slot, so a 90 Hz screen capped at 60 renders 2 frames in 3.
      // The 1 ms slack absorbs timestamp jitter that would otherwise push a frame into the next refresh.
      if (time < this.nextFrame - 1) return;
      const interval = 1000 / cap;
      this.nextFrame = time - this.nextFrame > interval ? time + interval : this.nextFrame + interval;
    }
    // Clamped so a stretch in the background (screen off, app switched) doesn't land as one giant animation step.
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.1) : 0;
    this.lastTime = time;
    this.mixer?.update(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.track(dt);
  }

  /** Rolling fps for the HUD, plus the one-off auto-tier measurement after a character loads. */
  private track(dt: number) {
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      const info = this.renderer.info.render;
      this.options.onStats?.({ fps: Math.round(this.fpsFrames / this.fpsTime), triangles: info.triangles, drawCalls: info.calls,
        cap: this.cap(performance.now()), pixelRatio: this.renderer.getPixelRatio(), tier: this.tier });
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    if (!this.measuring || !this.root) return;
    // Skip the first frames after a load: shader compilation makes them slow on every device.
    if (++this.measureFrames <= 20) return;
    this.measureTime += dt;
    if (this.measureFrames < 20 + 120) return;
    this.measuring = false;
    const fps = 120 / this.measureTime;
    if (fps < AUTO_MIN_FPS) { this.tier = 'low'; this.applyTier(); }
    this.options.onAutoTier?.(this.tier);
  }

  /** Uncapped while measuring (a cap would read as a slow device), 60 while moving or being spun, else 30. */
  private cap(now: number): number {
    if (this.measuring) return 0;
    const idle = this.actions.get('idle');
    const moving = this.current !== null && this.current !== idle;
    return moving || this.dragging || now < this.settleUntil ? ACTIVE_FPS : IDLE_FPS;
  }

  private applyTier() {
    const high = this.tier === 'high';
    this.renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 2) : 1);
    this.renderer.shadowMap.enabled = high;
    this.sun.castShadow = high;
    this.ground.visible = high;
    this.scene.traverse(o => {
      const m = (o as THREE.Mesh).material;
      if (m) for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true;
    });
    this.fit();
  }

  private fit() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Each instance gets its own copy of every material, so tinting one avatar never recolours another. */
  private collectMaterials(model: THREE.Object3D, manifest: CharacterManifest) {
    const names = new Map(REGIONS.map(r => [manifest.regions?.[r] ?? `region_${r}`, r] as const));
    const copies = new Map<string, THREE.Material>();
    model.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const clone = (m: THREE.Material) => {
        let c = copies.get(m.uuid);
        if (!c) {
          c = m.clone();
          copies.set(m.uuid, c);
          const region = names.get(m.name);
          if (region && (c as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            this.regionMaterials.set(region, [...(this.regionMaterials.get(region) ?? []), c as THREE.MeshStandardMaterial]);
          }
        }
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
    });
  }

  private collectSockets(model: THREE.Object3D, manifest: CharacterManifest) {
    for (const name of SOCKETS) {
      const authored = model.getObjectByName(`socket_${name}`);
      if (authored) { this.sockets.set(name, authored); continue; }
      const spec = manifest.sockets?.[name];
      const anchor = spec && this.socketFromSpec(model, spec);
      if (anchor) this.sockets.set(name, anchor);
    }
  }

  /** Places an empty at node + offset in stage space, then re-parents it to the node, keeping that world transform. */
  private socketFromSpec(model: THREE.Object3D, spec: SocketSpec): THREE.Object3D | null {
    // GLTFLoader strips characters three.js reserves for animation paths, so "Palm2.R" in the file is "Palm2R" here.
    const node = model.getObjectByName(spec.node) ?? model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(spec.node));
    if (!node) return null;
    const socket = new THREE.Object3D();
    node.getWorldPosition(socket.position).add(new THREE.Vector3(...(spec.offset ?? [0, 0, 0])));
    if (spec.rotation) socket.rotation.set(...spec.rotation);
    socket.scale.setScalar(spec.scale ?? 1);
    this.scene.add(socket);
    socket.updateMatrixWorld(true);
    node.attach(socket);
    return socket;
  }

  private collectClips(model: THREE.Object3D, clips: THREE.AnimationClip[], manifest: CharacterManifest) {
    this.mixer = new THREE.AnimationMixer(model);
    this.mixer.addEventListener('finished', e => { if (e.action === this.current) this.play('idle'); });
    for (const clip of ['idle', ...EMOTES] as Clip[]) {
      const wanted = (manifest.clips?.[clip] ?? clip).toLowerCase();
      const found = clips.find(c => c.name.toLowerCase() === wanted);
      if (!found) continue;
      const action = this.mixer.clipAction(found);
      if (clip !== 'idle') { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
      this.actions.set(clip, action);
    }
  }

  private play(clip: Clip) {
    const next = this.actions.get(clip);
    if (!next) return;
    if (next === this.current) { if (clip !== 'idle') next.reset().play(); return; }
    this.current?.fadeOut(FADE);
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(FADE).play();
    this.current = next;
  }

  private capabilities(): Capabilities {
    return {
      regions: REGIONS.filter(r => this.regionMaterials.has(r)),
      sockets: SOCKETS.filter(s => this.sockets.has(s)),
      emotes: EMOTES.filter(e => this.actions.has(e)),
    };
  }

  private unloadCharacter() {
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.actions.clear();
    this.current = null;
    this.regionMaterials.clear();
    this.sockets.clear();
    this.gear.clear();
    if (this.root) { this.root.removeFromParent(); disposeTree(this.root); this.root = null; }
  }
}

function disposeTree(root: THREE.Object3D) {
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
      m.dispose();
    }
  });
}
