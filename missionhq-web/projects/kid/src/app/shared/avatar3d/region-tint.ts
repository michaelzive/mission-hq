import * as THREE from 'three';
import { REGIONS, Region } from './character-manifest';

/** Below this share of the mask's pixels, a channel is treated as absent, so the lab doesn't offer a colour that changes nothing. */
const MIN_COVERAGE = 0.005;
/** Caps how far a pixel can be brightened, so dark specks in a mostly light region don't flare. */
const MAX_SHADE = '1.5';
/** The texture and mask are sampled at this size to find each region's typical brightness. */
const SAMPLE = 256;

/**
 * Per-pixel recolouring for characters whose colours are baked into one texture (every Meshy export). A mask image in
 * the same UV layout marks main/trim/accent in its red/green/blue channels; inside a region the texture's colour is
 * swapped for the kid's colour, scaled by the pixel's brightness relative to the region's typical brightness, so folds,
 * seams and printed detail survive while orange stripes can turn blue. Untinted regions show the original texture.
 */
export class RegionTint {
  readonly regions: Region[];
  private readonly uniforms = {
    regionMask: { value: null as THREE.Texture | null },
    regionColour: { value: REGIONS.map(() => new THREE.Color()) },
    regionOn: { value: new THREE.Vector3() },
    regionRef: { value: new THREE.Vector3(1, 1, 1) },
  };

  private constructor(private readonly mask: THREE.Texture, ref: number[], coverage: number[]) {
    this.uniforms.regionMask.value = mask;
    this.uniforms.regionRef.value.fromArray(ref);
    this.regions = REGIONS.filter((_, i) => coverage[i] >= MIN_COVERAGE);
  }

  static async load(url: string): Promise<THREE.Texture> {
    const mask = await new THREE.TextureLoader().loadAsync(url);
    mask.flipY = false; // glTF textures aren't flipped; the mask must line up with them
    return mask;
  }

  /** Hooks every textured standard material on the model; null when none has a texture to recolour. */
  static attach(model: THREE.Object3D, mask: THREE.Texture): RegionTint | null {
    const materials = new Set<THREE.MeshStandardMaterial>();
    model.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const std = m as THREE.MeshStandardMaterial;
        if (std.isMeshStandardMaterial && std.map) materials.add(std);
      }
    });
    const first = materials.values().next().value;
    if (!first?.map) return null;
    const { ref, coverage } = measure(first.map.image as CanvasImageSource, mask.image as CanvasImageSource);
    const tint = new RegionTint(mask, ref, coverage);
    for (const m of materials) tint.hook(m);
    return tint;
  }

  set(region: Region, colour: string) {
    const i = REGIONS.indexOf(region);
    this.uniforms.regionColour.value[i].set(colour);
    this.uniforms.regionOn.value.setComponent(i, 1);
  }

  dispose() { this.mask.dispose(); }

  private hook(material: THREE.MeshStandardMaterial) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D regionMask;
uniform vec3 regionColour[3];
uniform vec3 regionOn;
uniform vec3 regionRef;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
#ifdef USE_MAP
  vec3 rw = texture2D(regionMask, vMapUv).rgb * regionOn;
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 shade = min(vec3(lum) / max(regionRef, vec3(1e-3)), vec3(${MAX_SHADE}));
  diffuseColor.rgb = mix(diffuseColor.rgb, regionColour[0] * shade.x, rw.x);
  diffuseColor.rgb = mix(diffuseColor.rgb, regionColour[1] * shade.y, rw.y);
  diffuseColor.rgb = mix(diffuseColor.rgb, regionColour[2] * shade.z, rw.z);
#endif`);
    };
    material.customProgramCacheKey = () => 'region-tint';
    material.needsUpdate = true;
  }
}

/** Each region's mean linear brightness (what maps to exactly the kid's colour) and its share of the mask. */
function measure(texture: CanvasImageSource, mask: CanvasImageSource) {
  const tex = pixels(texture), msk = pixels(mask);
  const sum = [0, 0, 0], weight = [0, 0, 0], covered = [0, 0, 0];
  for (let p = 0; p < tex.length; p += 4) {
    const lum = 0.2126 * linear(tex[p]) + 0.7152 * linear(tex[p + 1]) + 0.0722 * linear(tex[p + 2]);
    for (let c = 0; c < 3; c++) {
      const w = msk[p + c] / 255;
      sum[c] += lum * w;
      weight[c] += w;
      if (w > 0.5) covered[c]++;
    }
  }
  const n = tex.length / 4;
  return { ref: sum.map((s, c) => (weight[c] ? s / weight[c] : 1)), coverage: covered.map(c => c / n) };
}

function pixels(image: CanvasImageSource): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SAMPLE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, SAMPLE, SAMPLE);
  return ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
}

function linear(byte: number) {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
