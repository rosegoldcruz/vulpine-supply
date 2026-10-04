/**
 * Three.js engine for the configurator's 3D view.
 *
 * Asset layout (DevGod, synced with `npm run sync:configurator-assets`):
 *   public/models/configurator/kitchen.glb            door_*, drawer_*, panel_* take finish; pull_* + knob_* hardware; island_* toggleable
 *   public/models/configurator/fronts_<style_id>.glb  same mesh names/positions -> style change swaps meshes by name
 *   public/models/configurator/finishes.json (+ finishes/)  PBR finishes; preferred over our sampled swatch colors
 * When kitchen.glb is absent (or fails to load) the procedural kitchen in ./procedural is used.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildProceduralKitchen, placeHardware, type HardwareAnchor, type KitchenMaterials } from './procedural';
import type { DoorFinish, HardwareFinish } from '../data';

const MODEL_BASE = '/models/configurator/';
const FINISH_RE = /(^|_)(door|drawer|panel)(_|$)/i;
const HARDWARE_RE = /(^|_)(pull|knob|handle)(_|$)/i;
const FRONT_RE = /(^|_)(door|drawer)(_|$)/i;
const ISLAND_RE = /^island(_|$)/i;
const HOME_POS = new THREE.Vector3(0.55, 2.55, 6.4);
const HOME_TARGET = new THREE.Vector3(0, 1.05, 0.7);

interface Manifest {
  kitchen: string | null;
  fronts: Record<string, string>;
  finishesJson: string | null;
}

export interface FinishDef {
  color?: string;
  map?: string;
  normalMap?: string;
  roughnessMap?: string;
  roughness?: number;
  metalness?: number;
  repeat?: [number, number];
}

export type EngineMode = 'loading' | 'procedural' | 'glb' | 'error';

const normKey = (s: string) => s.toLowerCase().replace(/^finish[_-]?/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function resolveAsset(p: string | undefined): string | undefined {
  if (!p || typeof p !== 'string') return undefined;
  if (/^(https?:)?\//.test(p)) return p;
  const clean = p.replace(/^\.\//, '');
  return clean.startsWith('finishes/') ? MODEL_BASE + clean : `${MODEL_BASE}finishes/${clean}`;
}

/** Accepts a few plausible finishes.json shapes (map or array, flat or nested texture fields). */
export function normalizeFinishes(json: unknown): Record<string, FinishDef> {
  const out: Record<string, FinishDef> = {};
  if (!json || typeof json !== 'object') return out;
  const root = json as Record<string, unknown>;
  const container = (root.finishes ?? root.materials ?? root) as unknown;
  const entries: [string, Record<string, any>][] = Array.isArray(container)
    ? container.map((e: any) => [String(e?.id ?? e?.key ?? e?.slug ?? e?.name ?? ''), e])
    : Object.entries(container as Record<string, any>);
  for (const [rawKey, e] of entries) {
    if (!e || typeof e !== 'object') continue;
    const tex = (e.textures ?? e.maps ?? e.pbr ?? {}) as Record<string, any>;
    const pick = (...vals: any[]) => vals.find((v) => typeof v === 'string' && v.length > 0);
    const num = (...vals: any[]) => vals.find((v) => typeof v === 'number');
    const def: FinishDef = {
      color: pick(e.color, e.baseColor, e.base_color, e.hex, e.albedoColor),
      map: resolveAsset(pick(e.map, e.baseColorTexture, e.basecolor, e.albedo, e.diffuse, e.texture, tex.basecolor, tex.baseColor, tex.albedo, tex.diffuse, tex.color, tex.map)),
      normalMap: resolveAsset(pick(e.normalMap, e.normal, tex.normal, tex.normalMap)),
      roughnessMap: resolveAsset(pick(e.roughnessMap, e.roughness_map, tex.roughness, tex.roughnessMap)),
      roughness: num(e.roughness, e.roughnessFactor),
      metalness: num(e.metalness, e.metallic, e.metalnessFactor),
    };
    const rep = e.repeat ?? e.uvScale ?? e.scale;
    if (Array.isArray(rep) && rep.length === 2) def.repeat = [Number(rep[0]), Number(rep[1])];
    else if (typeof rep === 'number') def.repeat = [rep, rep];
    for (const k of [rawKey, e.id, e.key, e.slug, e.name].filter(Boolean)) out[normKey(String(k))] = def;
  }
  return out;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}
async function exists(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
    return r.ok && !(r.headers.get('content-type') || '').includes('text/html');
  } catch {
    return false;
  }
}

export interface EngineState {
  styleId: string;
  finishId: string;
  finish: DoorFinish | undefined;
  hwStyle: string;
  hwFinish: HardwareFinish | undefined;
  doorHardware: 'pull' | 'knob';
  showIsland: boolean;
}

export class ConfiguratorEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private resizeObs: ResizeObserver;
  private dirty = true;
  private disposed = false;
  private texLoader = new THREE.TextureLoader();
  private texCache = new Map<string, Promise<THREE.Texture | null>>();
  private gltf = new GLTFLoader();
  private frontsCache = new Map<string, Promise<THREE.Object3D | null>>();
  private mats: KitchenMaterials;
  private content: THREE.Object3D | null = null;
  private anchors: HardwareAnchor[] = [];
  private hardwareObjs: THREE.Object3D[] = [];
  private manifest: Manifest = { kitchen: null, fronts: {}, finishesJson: null };
  private glbFinishes: Record<string, FinishDef> = {};
  private glbKitchen: THREE.Object3D | null = null;
  private state: EngineState | null = null;
  private buildToken = 0;
  mode: EngineMode = 'loading';
  onMode?: (mode: EngineMode, detail?: string) => void;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color('#ece6df');
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = 0.35;

    this.camera = new THREE.PerspectiveCamera(38, 16 / 10, 0.05, 60);
    this.camera.position.copy(HOME_POS);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(HOME_TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.zoomToCursor = true;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 9;
    this.controls.maxPolarAngle = Math.PI * 0.53;
    this.controls.minAzimuthAngle = -Math.PI * 0.42;
    this.controls.maxAzimuthAngle = Math.PI * 0.42;
    this.controls.addEventListener('change', () => (this.dirty = true));

    const hemi = new THREE.HemisphereLight('#fffaf3', '#8f877e', 0.5);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff4e6', 1.9);
    sun.position.set(3.2, 4.6, 3.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -4;
    sun.shadow.camera.right = 4;
    sun.shadow.camera.top = 4;
    sun.shadow.camera.bottom = -1;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight('#e9f0ff', 0.5);
    fill.position.set(-3, 2.5, 3);
    this.scene.add(fill);

    this.mats = {
      finish: new THREE.MeshStandardMaterial({ color: '#d3d1cf', roughness: 0.55 }),
      finishRecess: new THREE.MeshStandardMaterial({ color: '#c4c2c0', roughness: 0.6 }),
      carcass: new THREE.MeshStandardMaterial({ color: '#e7e2db', roughness: 0.8 }),
      interior: new THREE.MeshStandardMaterial({ color: '#1d1d1f', roughness: 0.35, metalness: 0.2 }),
      counter: new THREE.MeshStandardMaterial({ color: '#f4f2ef', roughness: 0.22 }),
      steel: new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.3, metalness: 0.85 }),
      toe: new THREE.MeshStandardMaterial({ color: '#2a2724', roughness: 0.9 }),
      wall: new THREE.MeshStandardMaterial({ color: '#f1ece6', roughness: 0.95 }),
      backsplash: new THREE.MeshStandardMaterial({ color: '#f7f6f4', roughness: 0.3 }),
      floor: new THREE.MeshStandardMaterial({ color: '#b79f84', roughness: 0.75 }),
      hardware: new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5, metalness: 0.6 }),
    };

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      const moved = this.controls.update();
      if (moved || this.dirty) {
        this.dirty = false;
        this.renderer.render(this.scene, this.camera);
      }
    });
  }

  private setMode(mode: EngineMode, detail?: string) {
    this.mode = mode;
    this.onMode?.(mode, detail);
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // pull the camera back on narrow (portrait) screens so the run still fits
    this.camera.fov = w / h < 1 ? 55 : 38;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private loadTexture(url: string | undefined, srgb: boolean): Promise<THREE.Texture | null> {
    if (!url) return Promise.resolve(null);
    const key = `${url}|${srgb}`;
    if (!this.texCache.has(key)) {
      this.texCache.set(
        key,
        this.texLoader
          .loadAsync(url)
          .then((t) => {
            t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
            return t;
          })
          .catch(() => null),
      );
    }
    return this.texCache.get(key)!;
  }

  /** Resolve (once) which DevGod assets exist. */
  async init(): Promise<void> {
    const manifest = await fetchJson<Partial<Manifest>>(`${MODEL_BASE}manifest.json`);
    if (manifest) {
      this.manifest = { kitchen: manifest.kitchen ?? null, fronts: manifest.fronts ?? {}, finishesJson: manifest.finishesJson ?? null };
    } else if (await exists(`${MODEL_BASE}kitchen.glb`)) {
      this.manifest.kitchen = `${MODEL_BASE}kitchen.glb`;
    }
    const finishesUrl = this.manifest.finishesJson || `${MODEL_BASE}finishes.json`;
    const fj = await fetchJson<unknown>(finishesUrl);
    if (fj) this.glbFinishes = normalizeFinishes(fj);
    if (this.manifest.kitchen) {
      try {
        const g = await this.gltf.loadAsync(this.manifest.kitchen);
        this.glbKitchen = g.scene;
      } catch (e) {
        console.warn('[configurator] kitchen.glb failed to load, using procedural kitchen', e);
        this.glbKitchen = null;
      }
    }
  }

  private async frontsFor(styleId: string): Promise<THREE.Object3D | null> {
    if (!this.glbKitchen) return null;
    if (!this.frontsCache.has(styleId)) {
      const url = this.manifest.fronts[styleId] || `${MODEL_BASE}fronts_${styleId}.glb`;
      this.frontsCache.set(
        styleId,
        (this.manifest.fronts[styleId] || (await exists(url)) ? this.gltf.loadAsync(url).then((g) => g.scene) : Promise.resolve(null)).catch(() => null),
      );
    }
    return this.frontsCache.get(styleId)!;
  }

  /** Apply full state; rebuilds geometry only when style changes. */
  async update(next: EngineState) {
    const prev = this.state;
    this.state = next;
    const token = ++this.buildToken;
    if (!prev || prev.styleId !== next.styleId) {
      await this.buildGeometry(next.styleId, token);
      if (token !== this.buildToken) return;
    }
    if (!prev || !this.hardwareObjs.length || prev.hwStyle !== next.hwStyle || prev.doorHardware !== next.doorHardware || prev.styleId !== next.styleId) {
      this.rebuildHardware(next);
    }
    await this.applyFinish(next.finishId, next.finish);
    this.applyHardwareFinish(next.hwFinish);
    this.setIsland(next.showIsland);
    this.dirty = true;
  }

  private async buildGeometry(styleId: string, token: number) {
    if (this.glbKitchen) {
      const kitchen = this.glbKitchen.clone(true);
      const fronts = await this.frontsFor(styleId);
      if (token !== this.buildToken) return;
      if (fronts) this.swapFronts(kitchen, fronts);
      this.setContent(kitchen);
      this.anchors = [];
      this.assignGlbMaterials(kitchen);
      if (!this.framedGlb) this.frameObject(kitchen);
      this.setMode('glb', fronts ? undefined : `fronts_${styleId}.glb not found; showing kitchen.glb fronts`);
    } else {
      const { root, anchors } = buildProceduralKitchen(styleId, this.mats);
      this.setContent(root);
      this.anchors = anchors;
      this.setMode('procedural');
    }
  }

  private framedGlb = false;
  private frameObject(obj: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const dist = Math.max(size.x, size.y) / (2 * Math.tan((this.camera.fov * Math.PI) / 360)) + size.z;
    this.controls.target.copy(center);
    this.camera.position.set(center.x + size.x * 0.12, center.y + size.y * 0.25, center.z + dist * 1.05);
    this.controls.maxDistance = dist * 3;
    this.framedGlb = true;
  }

  private setContent(obj: THREE.Object3D) {
    if (this.content) {
      this.scene.remove(this.content);
      this.content.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && this.state && !this.glbKitchen) m.geometry?.dispose();
      });
    }
    this.hardwareObjs = [];
    this.content = obj;
    this.scene.add(obj);
  }

  /** Replace each named door_/drawer_ node in kitchen with the same-named node from the style's fronts GLB. */
  private swapFronts(kitchen: THREE.Object3D, fronts: THREE.Object3D) {
    kitchen.updateMatrixWorld(true);
    fronts.updateMatrixWorld(true);
    const replacements: [THREE.Object3D, THREE.Object3D][] = [];
    fronts.traverse((src) => {
      if (!src.name || !FRONT_RE.test(src.name)) return;
      // only the top-most matching node of each front
      if (src.parent && src.parent.name && FRONT_RE.test(src.parent.name)) return;
      const target = kitchen.getObjectByName(src.name);
      if (target && target.parent) replacements.push([target, src]);
    });
    for (const [target, src] of replacements) {
      const parent = target.parent!;
      const clone = src.clone(true);
      // keep the fronts file's world placement
      const local = new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(src.matrixWorld);
      local.decompose(clone.position, clone.quaternion, clone.scale);
      parent.add(clone);
      parent.remove(target);
    }
  }

  private assignGlbMaterials(root: THREE.Object3D) {
    const walk = (o: THREE.Object3D, role: 'finish' | 'hardware' | null) => {
      let r = role;
      if (o.name && FINISH_RE.test(o.name)) r = 'finish';
      if (o.name && HARDWARE_RE.test(o.name)) r = 'hardware';
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (r === 'finish') mesh.material = this.mats.finish;
        else if (r === 'hardware') {
          mesh.material = this.mats.hardware;
          this.hardwareObjs.push(mesh);
        }
      }
      o.children.forEach((c) => walk(c, r));
    };
    walk(root, null);
  }

  private rebuildHardware(s: EngineState) {
    if (this.glbKitchen) return; // GLB pulls are modeled; only their finish changes
    for (const o of this.hardwareObjs) {
      o.parent?.remove(o);
      o.traverse((c) => (c as THREE.Mesh).geometry?.dispose());
    }
    this.hardwareObjs = placeHardware(this.anchors, s.hwStyle, s.doorHardware, this.mats.hardware);
  }

  private async applyFinish(finishId: string, finish: DoorFinish | undefined) {
    const mat = this.mats.finish as THREE.MeshStandardMaterial;
    const def = this.glbFinishes[normKey(finishId)] || (finish ? this.glbFinishes[normKey(finish.name)] : undefined);
    if (def) {
      const [map, normalMap, roughnessMap] = await Promise.all([
        this.loadTexture(def.map, true),
        this.loadTexture(def.normalMap, false),
        this.loadTexture(def.roughnessMap, false),
      ]);
      if (this.state?.finishId !== finishId) return;
      for (const t of [map, normalMap, roughnessMap]) if (t && def.repeat) t.repeat.set(def.repeat[0], def.repeat[1]);
      mat.color.set(map ? '#ffffff' : def.color || finish?.color || '#cccccc');
      if (map && def.color) mat.color.set(def.color);
      mat.map = map;
      mat.normalMap = normalMap;
      mat.roughnessMap = roughnessMap;
      mat.roughness = def.roughness ?? finish?.roughness ?? 0.55;
      mat.metalness = def.metalness ?? 0;
    } else {
      // sampled from the cabs_clean swatch (scripts/build-cabs-dataset.mjs)
      const map = finish?.textured ? await this.loadTexture(finish.texture, true) : null;
      if (this.state?.finishId !== finishId) return;
      mat.map = map;
      mat.color.set(map ? '#ffffff' : finish?.color || '#cccccc');
      mat.normalMap = null;
      mat.roughnessMap = null;
      mat.roughness = finish?.roughness ?? 0.55;
      mat.metalness = 0;
    }
    mat.needsUpdate = true;
    // recessed panels: same finish, a touch darker so the profile reads at a distance
    const rec = this.mats.finishRecess as THREE.MeshStandardMaterial;
    rec.copy(mat);
    rec.color.copy(mat.color).multiplyScalar(0.86);
    rec.needsUpdate = true;
    this.dirty = true;
  }

  private applyHardwareFinish(f: HardwareFinish | undefined) {
    const mat = this.mats.hardware as THREE.MeshStandardMaterial;
    if (!f) return;
    mat.color.set(f.color);
    mat.metalness = f.metalness;
    mat.roughness = f.roughness;
    mat.needsUpdate = true;
  }

  private setIsland(show: boolean) {
    this.content?.traverse((o) => {
      if (o.name && ISLAND_RE.test(o.name)) o.visible = show;
    });
  }

  resetView() {
    if (this.glbKitchen && this.content) this.frameObject(this.content);
    else {
      this.camera.position.copy(HOME_POS);
      this.controls.target.copy(HOME_TARGET);
    }
    this.dirty = true;
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObs.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry?.dispose();
    });
    Object.values(this.mats).forEach((m) => m.dispose());
    this.texCache.forEach((p) => p.then((t) => t?.dispose()));
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
