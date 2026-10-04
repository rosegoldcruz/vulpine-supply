/**
 * Three.js engine for the configurator's 3D view.
 *
 * Asset layout (DevGod, synced with `npm run sync:configurator-assets`):
 *   public/models/configurator/kitchen.glb            door_*, drawer_*, panel_* take finish; pull_* + knob_* hardware; island_* toggleable
 *   public/models/configurator/fronts_<style_id>.glb  same mesh names/positions -> style change swaps meshes by name
 *   public/models/configurator/finishes.json (+ finishes/)  PBR finishes; preferred over our sampled swatch colors
 *   public/models/configurator/hardware.glb + mounts.json   pull/knob models placed at each front's mount (see ./hardware)
 *   public/models/configurator/camera_presets.json          DevGod's camera views (engine metres, vertical FOV at 16:9)
 * glass_* nodes are the panes of glass-front doors: room meshes with their own material, never finished or style-swapped.
 * GLBs are Draco-compressed; the decoder is self-hosted in public/draco/.
 * When kitchen.glb is absent (or fails to load) the procedural kitchen in ./procedural is used.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildProceduralKitchen, placeHardware, type HardwareAnchor, type KitchenMaterials } from './procedural';
import { HardwareLibrary, normalizeCatalog, normalizeMountSets, placeMountedHardware, type KnobShape, type Mount, type MountSets } from './hardware';
import type { DoorFinish, HardwareFinish } from '../data';

const MODEL_BASE = '/models/configurator/';
const FINISH_RE = /(^|_)(door|drawer|panel)(_|$)/i;
const HARDWARE_RE = /(^|_)(pull|knob|handle)(_|$)/i;
const FRONT_RE = /(^|_)(door|drawer)(_|$)/i;
const ISLAND_RE = /^island(_|$)/i;
/** Decor that may hang between a preset camera and its subject (island pendants, flowers, stools). */
const OCCLUDER_RE = /pendant|bloom|stem|vase|fruitbowl|stool/i;
/** share of the sampled view rays a decor mesh must block before a preset hides it */
const OCCLUDER_SHARE = 0.12;
/** Glass panes of glass-front doors (glass_<door suffix>): keep their own material, skip finish + style swaps. */
const GLASS_RE = /^glass_/i;
/** Room shell + decor left out of "View in your space" (the cabinet run, counters, sinks and appliances stay). */
export const AR_EXCLUDE_RE =
  /^(room_|walls?_|floor|baseboard|window|backsplash|sofa|pillow|rug|coffeetable|books|plant|armchair|floorlamp|art\d|fruitbowl|cuttingboard|coffeemaker|utensil|canister|floatingshel|shelf_|island_stool|island_fruitbowl|island_bloom|island_stem|island_vase|island_pendant)/i;
const DOOR_STYLE_IDS = ['shaker_classic', 'shaker_slide', 'slab', 'fusion_shaker', 'fusion_slide'];
const HOME_POS = new THREE.Vector3(0.55, 2.55, 6.4);
const HOME_TARGET = new THREE.Vector3(0, 1.05, 0.7);
/** camera_presets.json FOVs are vertical at this aspect */
const PRESET_ASPECT = 16 / 9;
/** beyond this vertical FOV a preset dollies back instead of widening (no fisheye on tall phone screens) */
const MAX_VFOV = 60;
/** portrait screens keep this share of a preset's 16:9 width (a slight side crop reads better than a tiny kitchen) */
const PORTRAIT_WIDTH = 0.9;

interface Manifest {
  kitchen: string | null;
  fronts: Record<string, string>;
  finishesJson: string | null;
  hardware: string | null;
  mounts: string | null;
  cameraPresets: string | null;
}

interface PresetDef {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  /** vertical FOV (deg) at 16:9 */
  fov: number;
}

export interface FinishDef {
  color?: string;
  map?: string;
  normalMap?: string;
  roughnessMap?: string;
  roughness?: number;
  metalness?: number;
  repeat?: [number, number];
  clearcoat?: number;
  clearcoatRoughness?: number;
  /** flat fallback when the map can't load */
  averageColor?: string;
  normalScale?: number;
}

export type EngineMode = 'loading' | 'procedural' | 'glb' | 'error';
export type CameraPreset = 'overview' | 'uppers' | 'island' | 'sink' | 'door';
const PRESET_KEYS: [RegExp, CameraPreset][] = [
  [/overview/i, 'overview'],
  [/upper/i, 'uppers'],
  [/island/i, 'island'],
  [/sink/i, 'sink'],
  [/close|door/i, 'door'],
];

/** camera_presets.json: { "<name>": { position, target, fov_vertical_deg_16x9 } } -> presets by id (names matched loosely). */
export function normalizeCameraPresets(json: unknown): Partial<Record<CameraPreset, PresetDef>> {
  const out: Partial<Record<CameraPreset, PresetDef>> = {};
  if (!json || typeof json !== 'object') return out;
  const v3 = (a: unknown) => (Array.isArray(a) && a.length === 3 && a.every((n) => typeof n === 'number') ? new THREE.Vector3(a[0], a[1], a[2]) : null);
  for (const [name, e] of Object.entries(json as Record<string, any>)) {
    const id = PRESET_KEYS.find(([re]) => re.test(name))?.[1];
    const pos = v3(e?.position);
    const target = v3(e?.target);
    const fov = Number(e?.fov_vertical_deg_16x9 ?? e?.fov);
    if (id && !out[id] && pos && target && fov > 1 && fov < 120) out[id] = { pos, target, fov };
  }
  return out;
}
export interface LoadProgress {
  label: string;
  /** 0..1, or null when the server didn't send sizes */
  fraction: number | null;
  done: boolean;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function worldVisible(o: THREE.Object3D | null): boolean {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

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
      clearcoat: num(e.clearcoat, e.clearcoatFactor),
      clearcoatRoughness: num(e.clearcoatRoughness, e.clearcoat_roughness),
      averageColor: pick(e.averageColor, e.average_color, e.baseColor),
      normalScale: num(e.normalScale, e.normal_scale),
    };
    const rep = e.repeat ?? e.uvScale ?? e.scale;
    if (Array.isArray(rep) && rep.length === 2) def.repeat = [Number(rep[0]), Number(rep[1])];
    else if (typeof rep === 'number') def.repeat = [rep, rep];
    for (const k of [rawKey, e.id, e.key, e.slug, e.name].filter(Boolean)) out[normKey(String(k))] = def;
  }
  return out;
}

/** finishes.json -> hardwareFinishes (or mounts.json -> hardware): { <id>: { color, metalness, roughness } } */
export function normalizeHardwareFinishes(json: unknown): Record<string, HardwareFinish> {
  const out: Record<string, HardwareFinish> = {};
  const root = (json && typeof json === 'object' ? json : {}) as Record<string, any>;
  const src = root.hardwareFinishes ?? root.hardware;
  if (!src || typeof src !== 'object' || Array.isArray(src)) return out;
  for (const [k, v] of Object.entries(src as Record<string, any>)) {
    if (v && typeof v === 'object' && typeof v.color === 'string') {
      out[normKey(k)] = { name: String(v.name ?? k), color: v.color, metalness: Number(v.metalness ?? 1), roughness: Number(v.roughness ?? 0.35) };
    }
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
  hwFinishId: string;
  hwFinish: HardwareFinish | undefined;
  doorHardware: 'pull' | 'knob';
  showIsland: boolean;
  /** door knob shape; 't' = Bar 2" T-knob (knob_bar_t), other styles ignore it */
  knobShape?: KnobShape;
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
  private manifest: Manifest = { kitchen: null, fronts: {}, finishesJson: null, hardware: null, mounts: null, cameraPresets: null };
  private glbFinishes: Record<string, FinishDef> = {};
  private glbHwFinishes: Record<string, HardwareFinish> = {};
  private hwLib = new HardwareLibrary(null);
  private mountSets: MountSets = { shared: [], byDoorStyle: {} };
  /** mounts for the current door style (per-style set when mounts.json has one, else the shared list) */
  private mounts: Mount[] = [];
  private glbKitchen: THREE.Object3D | null = null;
  private state: EngineState | null = null;
  private buildToken = 0;
  private loads = new Map<string, { loaded: number; total: number; done: boolean; label: string }>();
  private tween: {
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    fromFov: number;
    toFov: number;
    t0: number;
    dur: number;
  } | null = null;
  private presetDefs: Partial<Record<CameraPreset, PresetDef>> = {};
  /** decor hidden because it blocks the current preset's view, and that view (restored once the user orbits away) */
  private occluders: THREE.Object3D[] = [];
  private occluderView: { pos: THREE.Vector3; target: THREE.Vector3; fov: number } | null = null;
  /** design FOV (vertical at 16:9) of the last preset; null = legacy aspect-based FOV (procedural kitchen) */
  private fov16: number | null = null;
  private fadeEl: HTMLCanvasElement;
  private recentStyles: string[] = [];
  private recentFinishTex = new Map<string, string[]>();
  mode: EngineMode = 'loading';
  onMode?: (mode: EngineMode, detail?: string) => void;
  onProgress?: (p: LoadProgress) => void;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral (Khronos PBR Neutral) keeps paint colors true to the door swatches; ACES shifts hues
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);
    // freeze-frame overlay used to cross-fade style / finish swaps
    this.fadeEl = document.createElement('canvas');
    Object.assign(this.fadeEl.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', opacity: '0' });
    this.fadeEl.setAttribute('aria-hidden', 'true');
    container.appendChild(this.fadeEl);
    this.gltf.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));

    this.scene.background = new THREE.Color('#ece6df');
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = 0.35;

    this.camera = new THREE.PerspectiveCamera(38, 16 / 10, 0.05, 90);
    this.camera.position.copy(HOME_POS);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(HOME_TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.zoomToCursor = true;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 9;
    this.controls.maxPolarAngle = Math.PI * 0.53;
    this.controls.minAzimuthAngle = -Math.PI * 0.42;
    this.controls.maxAzimuthAngle = Math.PI * 0.42;
    this.controls.addEventListener('change', () => {
      this.dirty = true;
      // decor hidden for a preset comes back once the user has moved well away from that view
      if (this.occluderView && !this.tween && this.camera.position.distanceTo(this.occluderView.pos) > 0.75) this.clearOccluders(true);
    });
    this.controls.addEventListener('start', () => (this.tween = null)); // user input cancels a fly-to
    this.controls.listenToKeyEvents(container); // arrows pan, shift/ctrl+arrows orbit (container is focusable)

    const hemi = new THREE.HemisphereLight('#fffaf3', '#8f877e', 0.5);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff4e6', 1.9);
    // far enough out (and a wide enough shadow frustum) for the ~7 m U-kitchen
    sun.position.set(3.2, 4.6, 3.6).multiplyScalar(1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 3;
    sun.shadow.camera.left = -6;
    sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -4;
    sun.shadow.camera.far = 30;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight('#e9f0ff', 0.5);
    fill.position.set(-3, 2.5, 3);
    this.scene.add(fill);

    this.mats = {
      // physical so snow_gloss can use clearcoat
      finish: new THREE.MeshPhysicalMaterial({ color: '#d3d1cf', roughness: 0.55 }),
      finishRecess: new THREE.MeshPhysicalMaterial({ color: '#c4c2c0', roughness: 0.6 }),
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
      if (this.tween) {
        const tw = this.tween;
        const t = Math.min(1, (performance.now() - tw.t0) / tw.dur);
        const e = easeInOutCubic(t);
        this.camera.position.lerpVectors(tw.fromPos, tw.toPos, e);
        this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e);
        if (tw.fromFov !== tw.toFov) {
          this.camera.fov = THREE.MathUtils.lerp(tw.fromFov, tw.toFov, e);
          this.camera.updateProjectionMatrix();
        }
        if (t >= 1) this.tween = null;
        this.dirty = true;
      }
      const moved = this.controls.update();
      if (moved || this.dirty) {
        this.dirty = false;
        this.renderer.render(this.scene, this.camera);
      }
    });
  }

  private setMode(mode: EngineMode, detail?: string) {
    if (mode !== this.mode || detail) console.info(`[configurator] 3D mode: ${mode}${detail ? ` (${detail})` : ''}`);
    this.mode = mode;
    this.onMode?.(mode, detail);
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (!this.tween) {
      // presets: their 16:9 FOV fitted to this aspect; legacy: pull back on narrow (portrait) screens so the run still fits
      this.camera.fov = this.fov16 != null ? this.fitFov(this.fov16).fov : w / h < 1 ? 55 : 38;
    }
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private loadTexture(url: string | undefined, srgb: boolean, flipY = true): Promise<THREE.Texture | null> {
    if (!url) return Promise.resolve(null);
    const key = this.texKey(url, srgb, flipY);
    if (!this.texCache.has(key)) {
      this.texCache.set(
        key,
        this.texLoader
          .loadAsync(url)
          .then((t) => {
            t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            t.flipY = flipY;
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
            return t;
          })
          .catch(() => null),
      );
    }
    return this.texCache.get(key)!;
  }

  private emitProgress(label: string) {
    let loaded = 0;
    let total = 0;
    let unknown = false;
    let allDone = true;
    for (const v of this.loads.values()) {
      loaded += v.loaded;
      total += v.total;
      if (!v.total) unknown = true;
      if (!v.done) allDone = false;
    }
    if (allDone) {
      this.loads.clear();
      this.onProgress?.({ label, fraction: 1, done: true });
    } else this.onProgress?.({ label, fraction: unknown || !total ? null : Math.min(1, loaded / total), done: false });
  }

  /** GLTFLoader with byte progress reported through onProgress (aggregated over parallel loads). */
  private loadGltf(url: string, label: string): Promise<GLTF | null> {
    return new Promise((resolve) => {
      this.loads.set(url, { loaded: 0, total: 0, done: false, label });
      this.emitProgress(label);
      const finish = (g: GLTF | null) => {
        const e = this.loads.get(url);
        if (e) {
          e.done = true;
          e.loaded = e.total = Math.max(e.total, e.loaded);
        }
        this.emitProgress(label);
        resolve(g);
      };
      this.gltf.load(
        url,
        (g) => finish(g),
        (ev) => {
          const e = this.loads.get(url);
          if (!e) return;
          e.loaded = ev.loaded;
          e.total = ev.lengthComputable ? ev.total : 0;
          this.emitProgress(label);
        },
        (err) => {
          console.warn(`[configurator] ${url} failed to load`, err);
          finish(null);
        },
      );
    });
  }

  /** Resolve (once) which DevGod assets exist. */
  async init(): Promise<void> {
    const manifest = await fetchJson<Partial<Manifest>>(`${MODEL_BASE}manifest.json`);
    if (manifest) {
      this.manifest = {
        kitchen: manifest.kitchen ?? null,
        fronts: manifest.fronts ?? {},
        finishesJson: manifest.finishesJson ?? null,
        hardware: manifest.hardware ?? null,
        mounts: manifest.mounts ?? null,
        cameraPresets: manifest.cameraPresets ?? null,
      };
    } else if (await exists(`${MODEL_BASE}kitchen.glb`)) {
      this.manifest.kitchen = `${MODEL_BASE}kitchen.glb`;
      this.manifest.hardware = `${MODEL_BASE}hardware.glb`;
      this.manifest.mounts = `${MODEL_BASE}mounts.json`;
    }
    const finishesUrl = this.manifest.finishesJson || `${MODEL_BASE}finishes.json`;
    const fj = await fetchJson<unknown>(finishesUrl);
    if (fj) {
      this.glbFinishes = normalizeFinishes(fj);
      this.glbHwFinishes = normalizeHardwareFinishes(fj);
    }
    if (!this.manifest.kitchen) return;
    const [kitchen, hardware, mountsJson, presetsJson] = await Promise.all([
      this.loadGltf(this.manifest.kitchen, 'Loading kitchen'),
      this.manifest.hardware ? this.loadGltf(this.manifest.hardware, 'Loading kitchen') : Promise.resolve(null),
      this.manifest.mounts ? fetchJson<unknown>(this.manifest.mounts) : Promise.resolve(null),
      fetchJson<unknown>(this.manifest.cameraPresets || `${MODEL_BASE}camera_presets.json`),
    ]);
    this.glbKitchen = kitchen?.scene ?? null;
    // presets are in kitchen.glb's frame, so they only apply to the GLB kitchen
    this.presetDefs = this.glbKitchen ? normalizeCameraPresets(presetsJson) : {};
    if (!this.glbKitchen) console.warn('[configurator] kitchen.glb unavailable, using procedural kitchen');
    this.hwLib = new HardwareLibrary(hardware?.scene ?? null);
    this.mountSets = normalizeMountSets(mountsJson, Object.keys(this.manifest.fronts).length ? Object.keys(this.manifest.fronts) : DOOR_STYLE_IDS);
    this.hwLib.catalog = normalizeCatalog(mountsJson);
    if (mountsJson && !Object.keys(this.glbHwFinishes).length) this.glbHwFinishes = normalizeHardwareFinishes(mountsJson);
    if (this.glbKitchen) {
      console.info(
        `[configurator] GLB assets: kitchen.glb, ${Object.keys(this.manifest.fronts).length} fronts files, ` +
          `hardware.glb nodes [${this.hwLib.names.join(', ') || 'none'}], ${this.mountSets.shared.length} shared mounts` +
          `${Object.keys(this.mountSets.byDoorStyle).length ? ` + per-style mounts [${Object.keys(this.mountSets.byDoorStyle).join(', ')}]` : ''}, ` +
          `${Object.keys(this.glbFinishes).length} finish keys`,
      );
    }
  }

  private async frontsFor(styleId: string): Promise<THREE.Object3D | null> {
    if (!this.glbKitchen) return null;
    if (!this.frontsCache.has(styleId)) {
      const url = this.manifest.fronts[styleId] || `${MODEL_BASE}fronts_${styleId}.glb`;
      this.frontsCache.set(
        styleId,
        (this.manifest.fronts[styleId] || (await exists(url)) ? this.loadGltf(url, 'Loading door style').then((g) => g?.scene ?? null) : Promise.resolve(null)).catch(() => null),
      );
    }
    this.touchStyle(styleId);
    return this.frontsCache.get(styleId)!;
  }

  /** Lazy fronts: keep the current + previous style's fronts in memory, release the rest (re-fetch is HTTP-cached). */
  private touchStyle(styleId: string) {
    this.recentStyles = [styleId, ...this.recentStyles.filter((s) => s !== styleId)];
    for (const old of this.recentStyles.splice(2)) {
      const p = this.frontsCache.get(old);
      this.frontsCache.delete(old);
      p?.then((root) =>
        root?.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.geometry?.dispose();
            (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm?.dispose());
          }
        }),
      );
    }
  }

  /** Keep textures for the 3 most recent finishes; dispose older ones. */
  private touchFinishTextures(finishId: string, keys: string[]) {
    this.recentFinishTex.delete(finishId);
    this.recentFinishTex.set(finishId, keys);
    const inUse = new Set([...this.recentFinishTex.values()].slice(-3).flat());
    while (this.recentFinishTex.size > 3) {
      const [oldId, oldKeys] = this.recentFinishTex.entries().next().value as [string, string[]];
      this.recentFinishTex.delete(oldId);
      for (const k of oldKeys) {
        if (inUse.has(k)) continue;
        this.texCache.get(k)?.then((t) => t?.dispose());
        this.texCache.delete(k);
      }
    }
  }

  private texKey(url: string | undefined, srgb: boolean, flipY = true) {
    return url ? `${url}|${srgb}|${flipY}` : '';
  }

  /** Apply full state; rebuilds geometry only when style changes. */
  async update(next: EngineState) {
    const prev = this.state;
    this.state = next;
    const token = ++this.buildToken;
    if (prev && this.content) this.freezeFrame();
    if (!prev || prev.styleId !== next.styleId) {
      await this.buildGeometry(next.styleId, token);
      if (token !== this.buildToken) return;
    }
    if (
      !prev ||
      prev.hwStyle !== next.hwStyle ||
      prev.doorHardware !== next.doorHardware ||
      prev.knobShape !== next.knobShape ||
      prev.styleId !== next.styleId
    ) {
      this.rebuildHardware(next);
    }
    await this.applyFinish(next.finishId, next.finish);
    this.applyHardwareFinish(next.hwFinishId, next.hwFinish);
    this.setIsland(next.showIsland);
    if (this.occluderView) this.hideOccluders(this.occluderView); // new content (style change) / island toggled
    this.dirty = true;
    if (token === this.buildToken) this.releaseFrame();
  }

  /** Copy the last frame onto the overlay canvas (shown instantly), so the swap underneath can cross-fade. */
  private freezeFrame() {
    const src = this.renderer.domElement;
    this.renderer.render(this.scene, this.camera); // drawing buffer is valid until this task ends
    const c = this.fadeEl;
    if (c.width !== src.width || c.height !== src.height) {
      c.width = src.width;
      c.height = src.height;
    }
    c.getContext('2d')?.drawImage(src, 0, 0);
    c.style.transition = 'none';
    c.style.opacity = '1';
  }

  private releaseFrame() {
    // two frames: one to render the new state, one so the transition starts from opacity 1
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.fadeEl.style.transition = 'opacity 0.55s ease';
        this.fadeEl.style.opacity = '0';
      }),
    );
  }

  /** JPEG of the current view (for the printable design summary). */
  captureImage(maxWidth = 1400): string | null {
    if (!this.content) return null;
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    const scale = Math.min(1, maxWidth / src.width);
    const c = document.createElement('canvas');
    c.width = Math.round(src.width * scale);
    c.height = Math.round(src.height * scale);
    c.getContext('2d')?.drawImage(src, 0, 0, c.width, c.height);
    try {
      return c.toDataURL('image/jpeg', 0.86);
    } catch {
      return null;
    }
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
  /** Frame the cabinetry from the open +Z side: DevGod's overview preset, else fitted to the finish meshes. */
  private frameObject(obj: THREE.Object3D) {
    const def = this.presetDefs.overview;
    if (def) {
      const v = this.fitPreset(def);
      this.controls.target.copy(v.target);
      this.camera.position.copy(v.pos);
      this.fov16 = def.fov;
      this.camera.fov = v.fov;
      this.camera.updateProjectionMatrix();
      this.controls.maxDistance = Math.max(v.dist * 1.6, 6);
      this.framedGlb = true;
      return;
    }
    const v = this.overviewView(obj);
    if (!v) return;
    this.controls.target.copy(v.target);
    this.camera.position.copy(v.pos);
    this.controls.maxDistance = Math.max(v.dist * 2, 6);
    this.framedGlb = true;
  }

  /** Vertical FOV for a 16:9 design FOV at the current aspect (+ how far to dolly back when it hits MAX_VFOV). */
  private fitFov(fov16: number): { fov: number; dolly: number } {
    const aspect = this.camera.aspect;
    const t16 = Math.tan(THREE.MathUtils.degToRad(fov16) / 2);
    // wider than 16:9: keep the vertical FOV; narrower: keep (most of) the horizontal coverage
    let t = aspect >= PRESET_ASPECT ? t16 : Math.max(t16, (t16 * PRESET_ASPECT * (aspect < 1 ? PORTRAIT_WIDTH : 1)) / aspect);
    const tMax = Math.tan(THREE.MathUtils.degToRad(MAX_VFOV) / 2);
    let dolly = 1;
    if (t > tMax) {
      dolly = t / tMax;
      t = tMax;
    }
    return { fov: THREE.MathUtils.radToDeg(2 * Math.atan(t)), dolly };
  }

  /** A camera_presets.json view fitted to the current aspect ratio. */
  private fitPreset(def: PresetDef) {
    const { fov, dolly } = this.fitFov(def.fov);
    const dir = def.pos.clone().sub(def.target);
    const dist = dir.length() * dolly;
    return { pos: def.target.clone().addScaledVector(dir.normalize(), dist), target: def.target.clone(), fov, dist };
  }

  /** Presets this kitchen offers, in button order. */
  availablePresets(): CameraPreset[] {
    const order: CameraPreset[] = ['overview', 'uppers', 'island', 'sink', 'door'];
    return Object.keys(this.presetDefs).length ? order.filter((p) => this.presetDefs[p]) : order.filter((p) => p !== 'sink');
  }

  private fitDistance(box: THREE.Box3, factor: number) {
    const size = box.getSize(new THREE.Vector3());
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const radius = 0.5 * Math.hypot(size.x, size.y, size.z);
    return Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2)) * factor;
  }

  private meshBox(filter: (m: THREE.Mesh) => boolean): THREE.Box3 {
    const box = new THREE.Box3();
    this.content?.updateMatrixWorld(true);
    this.content?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && filter(m) && worldVisible(m)) box.expandByObject(m);
    });
    return box;
  }

  private overviewView(obj: THREE.Object3D) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3();
    obj.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name && FINISH_RE.test(o.name)) box.expandByObject(o);
    });
    if (box.isEmpty()) box.setFromObject(obj);
    if (box.isEmpty()) return null;
    const center = box.getCenter(new THREE.Vector3());
    const dist = this.fitDistance(box, 0.82);
    const dir = new THREE.Vector3(0.12, 0.42, 1).normalize();
    const target = center.clone().setY(Math.min(center.y, 1.0));
    return { pos: target.clone().addScaledVector(dir, dist), target, dist };
  }

  /** Outward normal of a front: from mounts.json when available, else the front's local +Z. */
  private frontNormal(o: THREE.Object3D): THREE.Vector3 {
    const m = this.mounts.find((mm) => mm.front === o.name);
    if (m) return new THREE.Vector3(0, 0, 1).applyQuaternion(m.quaternion).setY(0).normalize();
    const q = o.getWorldQuaternion(new THREE.Quaternion());
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q).setY(0);
    return n.lengthSq() > 1e-4 ? n.normalize() : new THREE.Vector3(0, 0, 1);
  }

  /** Camera pose for a preset, or null when it doesn't apply (e.g. island hidden). */
  presetView(preset: CameraPreset): { pos: THREE.Vector3; target: THREE.Vector3; fov?: number; fov16?: number } | null {
    if (!this.content) return null;
    const def = this.presetDefs[preset];
    if (def) {
      if (preset === 'island' && !worldVisible(this.content.getObjectByName('island') ?? null)) return null;
      return { ...this.fitPreset(def), fov16: def.fov };
    }
    if (preset === 'sink') return null;
    if (preset === 'overview') {
      if (!this.glbKitchen) return { pos: HOME_POS.clone(), target: HOME_TARGET.clone() };
      return this.overviewView(this.content);
    }
    const isIsland = (o: THREE.Object3D) => {
      for (let p: THREE.Object3D | null = o; p && p !== this.content; p = p.parent) if (p.name && ISLAND_RE.test(p.name)) return true;
      return false;
    };
    // top-level fronts (door_/drawer_ nodes), world-space boxes
    const fronts: { obj: THREE.Object3D; box: THREE.Box3; island: boolean }[] = [];
    this.content.updateMatrixWorld(true);
    this.content.traverse((o) => {
      if (!o.name || !FRONT_RE.test(o.name) || HARDWARE_RE.test(o.name)) return;
      if (o.parent && o.parent.name && FRONT_RE.test(o.parent.name)) return;
      if (!worldVisible(o)) return;
      const box = new THREE.Box3().setFromObject(o);
      if (!box.isEmpty()) fronts.push({ obj: o, box, island: isIsland(o) });
    });
    if (preset === 'island') {
      const box = this.meshBox((m) => isIsland(m) && (FINISH_RE.test(m.name) || /counter/i.test(m.name)));
      if (box.isEmpty()) return null;
      const target = box.getCenter(new THREE.Vector3());
      // look at the island's cabinet face as far as the orbit limits allow: blend its fronts' normal with the open side
      const n = new THREE.Vector3();
      const islandFronts = fronts.filter((f) => f.island);
      const mountedIsland = islandFronts.filter((f) => this.mounts.some((m) => m.front === f.obj.name));
      for (const f of mountedIsland.length ? mountedIsland : islandFronts) n.add(this.frontNormal(f.obj));
      if (n.lengthSq() > 1e-4) n.normalize();
      const h = n.add(new THREE.Vector3(0.12, 0, 1).multiplyScalar(1.2));
      if (h.lengthSq() < 0.05) h.set(0.45, 0, 1);
      const dir = new THREE.Vector3(h.x, 0.75 * h.length(), h.z).normalize();
      return { pos: target.clone().addScaledVector(dir, this.fitDistance(box, 1.0)), target };
    }
    const walls = fronts.filter((f) => !f.island);
    if (!walls.length) return null;
    if (preset === 'uppers') {
      const uppers = walls.filter((f) => f.box.getCenter(new THREE.Vector3()).y > 1.25);
      if (!uppers.length) return null;
      const box = new THREE.Box3();
      const n = new THREE.Vector3();
      for (const f of uppers) {
        box.union(f.box);
        n.add(this.frontNormal(f.obj));
      }
      if (n.lengthSq() < 1e-4) n.set(0, 0, 1);
      n.normalize();
      const target = box.getCenter(new THREE.Vector3());
      const dir = new THREE.Vector3(n.x, 0.08, n.z).normalize();
      return { pos: target.clone().addScaledVector(dir, this.fitDistance(box, 0.78)), target };
    }
    // close-up: the base door closest to the middle of the run (prefer doors that carry a mount)
    const overview = this.overviewView(this.content);
    const mid = overview?.target ?? new THREE.Vector3();
    const doors = walls.filter((f) => /(^|_)door(_|$)/i.test(f.obj.name) && f.box.getCenter(new THREE.Vector3()).y < 1.0);
    const pool = doors.length ? doors : walls;
    const mounted = pool.filter((f) => this.mounts.some((m) => m.front === f.obj.name));
    const pick = (mounted.length ? mounted : pool)
      .map((f) => ({ f, d: f.box.getCenter(new THREE.Vector3()).setY(0).distanceTo(mid.clone().setY(0)) }))
      .sort((a, b) => a.d - b.d)[0].f;
    const size = pick.box.getSize(new THREE.Vector3());
    // aim at the upper part of the door, where base-door hardware sits, with the counter edge in frame
    const target = pick.box.getCenter(new THREE.Vector3()).setY(pick.box.max.y - size.y * 0.32);
    const n = this.frontNormal(pick.obj);
    let dist = Math.max(1.0, Math.max(size.y, Math.hypot(size.x, size.z)) * 2.3);
    // don't back the camera into the island / whatever stands across the aisle
    const rc = new THREE.Raycaster(target.clone().addScaledVector(n, 0.05), n, 0, dist + 0.3);
    const obstacles: THREE.Object3D[] = [];
    this.content.traverse((o) => (o as THREE.Mesh).isMesh && worldVisible(o) && obstacles.push(o));
    const hit = rc.intersectObjects(obstacles, false)[0];
    if (hit) dist = Math.max(0.45, Math.min(dist, hit.distance - 0.12));
    const pos = target.clone().addScaledVector(n, dist).add(new THREE.Vector3(0, 0.22 + dist * 0.2, 0));
    pos.addScaledVector(new THREE.Vector3(-n.z, 0, n.x), dist * 0.18); // slight 3/4 angle so the profile reads
    return { pos, target };
  }

  /** Show decor hidden by hideOccluders() again (forget = also drop the view it was hidden for). */
  private clearOccluders(forget = false) {
    for (const o of this.occluders) o.visible = !ISLAND_RE.test(o.name) || (this.state?.showIsland ?? true);
    this.occluders = [];
    if (forget) this.occluderView = null;
    this.dirty = true;
  }

  /**
   * Hide decor meshes (island pendants etc.) that cover a big share of a view, e.g. the pendant hanging in front of
   * the close-up door preset. Samples a 9x9 grid of rays over the central 80% of the view.
   */
  private hideOccluders(view: { pos: THREE.Vector3; target: THREE.Vector3; fov: number }) {
    this.clearOccluders();
    this.occluderView = view;
    if (!this.content) return;
    const cands: THREE.Object3D[] = [];
    this.content.traverse((o) => (o as THREE.Mesh).isMesh && OCCLUDER_RE.test(o.name) && worldVisible(o) && cands.push(o));
    if (!cands.length) return;
    const cam = new THREE.PerspectiveCamera(view.fov, this.camera.aspect, 0.05, 100);
    cam.position.copy(view.pos);
    cam.lookAt(view.target);
    cam.updateMatrixWorld(true);
    const dist = view.pos.distanceTo(view.target);
    const rc = new THREE.Raycaster();
    // a fixture is several meshes (island_pendant_shades / _glass / _bulbs / _cords): count blocked rays per fixture
    const fixture = (o: THREE.Object3D) => o.name.replace(/_[^_]+$/, '');
    const hits = new Map<string, number>();
    const N = 9;
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        rc.setFromCamera(new THREE.Vector2(-0.8 + (1.6 * i) / (N - 1), -0.8 + (1.6 * j) / (N - 1)), cam);
        const h = rc.intersectObjects(cands, false)[0];
        if (h && h.distance < dist * 0.9) hits.set(fixture(h.object), (hits.get(fixture(h.object)) ?? 0) + 1);
      }
    for (const o of cands) {
      if ((hits.get(fixture(o)) ?? 0) / (N * N) < OCCLUDER_SHARE) continue;
      o.visible = false;
      this.occluders.push(o);
    }
    this.dirty = true;
  }

  /** Smoothly fly the camera to a preset. Returns false when the preset doesn't apply. */
  setPreset(preset: CameraPreset, durationMs = 900): boolean {
    const v = this.presetView(preset);
    if (!v) return false;
    this.hideOccluders({ pos: v.pos, target: v.target, fov: v.fov ?? this.camera.fov });
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (v.fov16 != null) this.fov16 = v.fov16;
    this.tween = {
      fromPos: this.camera.position.clone(),
      toPos: v.pos,
      fromTarget: this.controls.target.clone(),
      toTarget: v.target,
      fromFov: this.camera.fov,
      toFov: v.fov ?? this.camera.fov,
      t0: performance.now(),
      dur: reduce ? 1 : durationMs,
    };
    this.dirty = true;
    return true;
  }

  /**
   * Yaw (rad) of the cabinetry's open side: the sum of the distinct wall normals of the (non-island) mounted fronts.
   * Straight run: its normal; L: the bisector; U: the back wall's normal (the arms face each other and cancel).
   * The v2 U-kitchen sits at 45° in kitchen.glb (open side toward -X+Z), so this is -45° there.
   */
  private openSideYaw(): number {
    const seen: THREE.Vector3[] = [];
    for (const m of this.mounts) {
      if (m.front.startsWith('island_')) continue;
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(m.quaternion).setY(0);
      if (n.lengthSq() < 1e-4) continue;
      n.normalize();
      if (!seen.some((s) => s.dot(n) > 0.95)) seen.push(n);
    }
    const sum = seen.reduce((a, b) => a.add(b), new THREE.Vector3());
    return sum.lengthSq() < 1e-4 ? 0 : Math.atan2(sum.x, sum.z);
  }

  /**
   * A flat, self-contained copy of the configured cabinet run for AR: visible cabinetry, counters, sinks,
   * appliances and hardware with the live materials, room shell/decor left out. Meters, Y-up,
   * origin at floor level under the run's footprint center; turned so the open (viewing) side faces +Z.
   */
  buildArModel(): THREE.Group | null {
    if (!this.content) return null;
    const content = this.content;
    content.updateMatrixWorld(true);
    const excluded = (o: THREE.Object3D) => {
      for (let p: THREE.Object3D | null = o; p && p !== content; p = p.parent) if (p.name && AR_EXCLUDE_RE.test(p.name)) return true;
      return false;
    };
    const group = new THREE.Group();
    group.name = 'vulpine_cabinet_run';
    content.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !worldVisible(m) || excluded(m)) return;
      const c = new THREE.Mesh(m.geometry, m.material);
      c.name = m.name || 'part';
      m.matrixWorld.decompose(c.position, c.quaternion, c.scale);
      c.castShadow = true;
      c.receiveShadow = true;
      group.add(c);
    });
    if (!group.children.length) return null;
    const yaw = this.openSideYaw();
    if (Math.abs(yaw) > 1e-3) {
      const turn = new THREE.Matrix4().makeRotationY(-yaw);
      for (const c of group.children) c.applyMatrix4(turn);
    }
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group, true); // precise: turned AABBs of the merged boxes overshoot
    const shift = new THREE.Vector3(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    for (const c of group.children) c.position.add(shift);
    group.updateMatrixWorld(true);
    return group;
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
    this.occluders = [];
    this.content = obj;
    this.scene.add(obj);
  }

  /** Replace each named door_/drawer_ node in kitchen with the same-named node from the style's fronts GLB. */
  private swapFronts(kitchen: THREE.Object3D, fronts: THREE.Object3D) {
    kitchen.updateMatrixWorld(true);
    fronts.updateMatrixWorld(true);
    const replacements: [THREE.Object3D, THREE.Object3D][] = [];
    fronts.traverse((src) => {
      if (!src.name || !FRONT_RE.test(src.name) || GLASS_RE.test(src.name)) return;
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
      // glass panes keep their own (transparent) material, even if one ever ends up under a door node
      if (o.name && GLASS_RE.test(o.name)) r = null;
      else if (o.name && FINISH_RE.test(o.name)) r = 'finish';
      if (o.name && !GLASS_RE.test(o.name) && HARDWARE_RE.test(o.name)) r = 'hardware';
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

  private mountedObjs: THREE.Object3D[] = [];

  private rebuildHardware(s: EngineState) {
    this.mounts = this.mountSets.byDoorStyle[s.styleId] ?? (this.mountSets.shared.length ? this.mountSets.shared : Object.values(this.mountSets.byDoorStyle)[0] ?? []);
    const disposeAll = (list: THREE.Object3D[]) => {
      for (const o of list) {
        o.parent?.remove(o);
        o.traverse((c) => {
          const m = c as THREE.Mesh;
          if (m.isMesh && !m.userData.sharedGeometry) m.geometry?.dispose();
        });
      }
    };
    if (this.glbKitchen) {
      disposeAll(this.mountedObjs);
      this.mountedObjs = [];
      if (!this.mounts.length || !this.content) return; // no mounts.json: keep the modeled pulls, recolor only
      const content = this.content;
      // hide the kitchen's own modeled pulls/knobs; mounted instances replace them
      for (const o of this.hardwareObjs) o.visible = false;
      const island = content.getObjectByName('island');
      const present = new Set<string>();
      content.traverse((o) => o.name && present.add(o.name));
      this.mountedObjs = placeMountedHardware({
        mounts: this.mounts.filter((m) => present.has(m.front)),
        lib: this.hwLib,
        style: s.hwStyle,
        doorKind: s.doorHardware,
        knobShape: s.knobShape,
        material: this.mats.hardware,
        parentFor: (front) => (front.startsWith('island_') && island ? island : content),
      });
      return;
    }
    disposeAll(this.hardwareObjs);
    this.hardwareObjs = placeHardware(this.anchors, s.hwStyle, s.doorHardware, this.mats.hardware);
  }

  private async applyFinish(finishId: string, finish: DoorFinish | undefined) {
    const mat = this.mats.finish as THREE.MeshPhysicalMaterial;
    const glb = Boolean(this.glbKitchen);
    const def = this.glbFinishes[normKey(finishId)] || (finish ? this.glbFinishes[normKey(finish.name)] : undefined);
    if (def) {
      // finishes.json textures follow the glTF UV convention (no flip); UVs are in metres, repeat = 1/tile size
      const [map, normalMap, roughnessMap] = await Promise.all([
        this.loadTexture(def.map, true, !glb),
        this.loadTexture(def.normalMap, false, !glb),
        this.loadTexture(def.roughnessMap, false, !glb),
      ]);
      if (this.state?.finishId !== finishId) return;
      this.touchFinishTextures(finishId, [this.texKey(def.map, true, !glb), this.texKey(def.normalMap, false, !glb), this.texKey(def.roughnessMap, false, !glb)].filter(Boolean));
      for (const t of [map, normalMap, roughnessMap]) if (t) t.repeat.set(glb && def.repeat ? def.repeat[0] : 1, glb && def.repeat ? def.repeat[1] : 1);
      if (map) mat.color.set(def.color || '#ffffff');
      else mat.color.set(def.map ? def.averageColor || finish?.color || '#cccccc' : def.color || def.averageColor || finish?.color || '#cccccc');
      mat.map = map;
      mat.normalMap = normalMap;
      mat.normalScale.setScalar(def.normalScale ?? 1);
      mat.roughnessMap = roughnessMap;
      mat.roughness = def.roughness ?? finish?.roughness ?? 0.55;
      mat.metalness = def.metalness ?? 0;
      mat.clearcoat = def.clearcoat ?? 0;
      mat.clearcoatRoughness = def.clearcoatRoughness ?? 0.05;
    } else {
      // sampled from the cabs_clean swatch (scripts/build-cabs-dataset.mjs)
      const map = finish?.textured ? await this.loadTexture(finish.texture, true) : null;
      if (this.state?.finishId !== finishId) return;
      if (finish?.textured) this.touchFinishTextures(finishId, [this.texKey(finish.texture, true)]);
      mat.map = map;
      mat.color.set(map ? '#ffffff' : finish?.color || '#cccccc');
      mat.normalMap = null;
      mat.roughnessMap = null;
      mat.roughness = finish?.roughness ?? 0.55;
      mat.metalness = 0;
      mat.clearcoat = 0;
    }
    mat.needsUpdate = true;
    // recessed panels: same finish, a touch darker so the profile reads at a distance
    const rec = this.mats.finishRecess as THREE.MeshPhysicalMaterial;
    rec.copy(mat);
    rec.color.copy(mat.color).multiplyScalar(0.86);
    rec.needsUpdate = true;
    this.dirty = true;
  }

  private applyHardwareFinish(id: string, fallback: HardwareFinish | undefined) {
    const mat = this.mats.hardware as THREE.MeshStandardMaterial;
    // calibrated values from finishes.json when present, else dataset.json
    const f = this.glbHwFinishes[normKey(id)] || fallback;
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

  private debugObj: THREE.Object3D | null = null;
  /** Dev aid (?debug=1): show an object, e.g. the AR model, in place of the kitchen; null restores. */
  debugShow(obj: THREE.Object3D | null) {
    if (this.debugObj) this.scene.remove(this.debugObj);
    this.debugObj = obj;
    if (this.content) this.content.visible = !obj;
    if (obj) {
      this.scene.add(obj);
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      const target = box.getCenter(new THREE.Vector3());
      this.controls.target.copy(target);
      this.camera.position.copy(target).addScaledVector(new THREE.Vector3(0.35, 0.45, 1).normalize(), this.fitDistance(box, 0.9));
    }
    this.dirty = true;
  }

  resetView() {
    this.setPreset('overview');
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
    this.fadeEl.remove();
  }
}
