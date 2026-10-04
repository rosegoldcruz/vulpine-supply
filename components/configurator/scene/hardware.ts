/**
 * Data-driven hardware for GLB mode.
 *
 * hardware.glb node names (any subset may exist; new files just drop in):
 *   pull_<style>_<size>   e.g. pull_arch_6in, pull_arch_7_125in, pull_cottage_96mm, pull_bar_8in
 *   pull_<style>          unsized pull (e.g. current pull_bar = 6" bar)
 *   knob_<style>[_<size>] e.g. knob_square
 *   knob_round            generic knob (current file)
 * Local frame of every node: origin = mount point on the front face, +X along the bar, +Z out of the front.
 *
 * Lookup per mount: pull_<style> nearest size to the mount's nominal size -> generic bar/knob_round
 * (only for styles that look like it, see GENERIC_OK) -> procedural shape from ./procedural.
 *
 * mounts.json: { mounts: { <front>: { position, quaternion | (axis + normal), orientation, hardware,
 *   bar_length_m, center_to_center_m, size_class?, anchor?, anchor_dir?, knob_position?,
 *   by_style?: { <style>: { pull, length_m, position, knob, knob_position } } } } | [ { front, ... } ],
 *   fronts?: { <front>: { kind, ... } }, hardware_catalog?: { <style>: { small, large, knob, pulls } } }
 * Resolution order per mount: by_style[style] exact node + position -> catalog small/large by size_class ->
 * nearest size of the style -> pull_generic_* / knob_generic -> legacy pull_bar / knob_round -> procedural.
 * Mount convention: door mounts sit near the edge opposite the hinge (top corner on base doors,
 * bottom corner on uppers); drawer mounts are centered.
 */
import * as THREE from 'three';
import { IN, buildHardware } from './procedural';

export interface Mount {
  front: string;
  kind: 'door' | 'drawer';
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  /** world bar direction (local +X) */
  axis: THREE.Vector3;
  /** nominal size of the hardware the mount was designed for, inches (e.g. 6 for a 6" bar) */
  nominalIn: number;
  /** overall length of that hardware, meters */
  lengthM: number;
  sizeClass?: 'small' | 'large';
  /** door latch-side anchor (pull end) + direction the pull extends from it */
  anchor?: THREE.Vector3;
  anchorDir?: THREE.Vector3;
  knobPosition?: THREE.Vector3;
  byStyle: Record<string, { pull?: string; knob?: string; position?: THREE.Vector3; knobPosition?: THREE.Vector3; lengthM?: number }>;
}

export interface HardwareCatalogEntry {
  small?: string;
  large?: string;
  knob?: string;
}

export function normalizeCatalog(json: unknown): Record<string, HardwareCatalogEntry> {
  const out: Record<string, HardwareCatalogEntry> = {};
  const cat = (json && typeof json === 'object' ? (json as any).hardware_catalog : null) as Record<string, any> | null;
  if (!cat || typeof cat !== 'object') return out;
  for (const [k, v] of Object.entries(cat)) {
    if (!v || typeof v !== 'object') continue;
    const str = (x: unknown) => (typeof x === 'string' && x ? x : undefined);
    out[k.toLowerCase()] = { small: str(v.small), large: str(v.large), knob: str(v.knob) };
  }
  return out;
}

/** Parse "6in", "7_125in", "7-1_8in", "96mm", "12in" -> inches. */
export function parseSizeToken(tok: string | undefined): number | null {
  if (!tok) return null;
  const t = tok.toLowerCase();
  let m = t.match(/^(\d+)(?:[_.](\d+))?in$/);
  if (m) return m[2] ? Number(`${m[1]}.${m[2]}`) : Number(m[1]);
  m = t.match(/^(\d+)-(\d+)_(\d+)in$/); // 7-1_8in
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+(?:[_.]\d+)?)mm$/);
  if (m) return Number(m[1].replace('_', '.')) / 25.4;
  return null;
}

const vec3 = (a: unknown): THREE.Vector3 | null =>
  Array.isArray(a) && a.length >= 3 && a.every((n) => typeof n === 'number') ? new THREE.Vector3(a[0], a[1], a[2]) : null;

/** True when obj looks like a single mount record (has a position array). */
const isMountRecord = (v: unknown) => Boolean(v && typeof v === 'object' && Array.isArray((v as any).position));
/** True when obj is a { <front>: mount } map or a [mount] list. */
const isMountCollection = (v: unknown) =>
  Array.isArray(v) ? v.some(isMountRecord) : Boolean(v && typeof v === 'object' && Object.values(v as object).some(isMountRecord));

export interface MountSets {
  /** flat mounts (style-independent), may be empty */
  shared: Mount[];
  /** per door style (shaker_classic, slab, ...) when mounts.json is keyed by style */
  byDoorStyle: Record<string, Mount[]>;
}

/**
 * mounts.json may be flat ({ mounts: { <front>: {...} } }) or keyed per door style, as any of
 * { mounts: { <styleId>: { <front>: {...} } } }, { styles: { <styleId>: { mounts: {...} } | {...} } }, { <styleId>: { mounts | fronts... } }.
 */
export function normalizeMountSets(json: unknown, styleIds: string[] = []): MountSets {
  const out: MountSets = { shared: [], byDoorStyle: {} };
  if (!json || typeof json !== 'object') return out;
  const root = json as Record<string, any>;
  const fronts = root.fronts;
  const addStyle = (id: string, v: any) => {
    const coll = isMountCollection(v) ? v : isMountCollection(v?.mounts) ? v.mounts : null;
    if (!coll) return;
    const list = normalizeMounts({ mounts: coll, fronts: v?.fronts ?? fronts });
    if (list.length) out.byDoorStyle[id] = list;
  };
  if (isMountCollection(root.mounts)) {
    out.shared = normalizeMounts(root);
    // DevGod contract: flat mounts carrying mount.by_door_style[<door style>] (pull positions move with the door style:
    // framed styles centre the pull on the latch stile, Slab sits 2-1/2" in). Resolve one mount list per door style.
    const recs: any[] = Array.isArray(root.mounts) ? root.mounts : Object.values(root.mounts);
    const doorStyles = new Set<string>();
    for (const r of recs) if (r?.by_door_style && typeof r.by_door_style === 'object') Object.keys(r.by_door_style).forEach((k) => doorStyles.add(k));
    for (const ds of doorStyles) {
      const list = normalizeMounts(root, ds);
      if (list.length) out.byDoorStyle[ds] = list;
    }
  }
  else if (root.mounts && typeof root.mounts === 'object') for (const [id, v] of Object.entries(root.mounts)) addStyle(id, v);
  if (root.styles && typeof root.styles === 'object') for (const [id, v] of Object.entries(root.styles)) addStyle(id, v);
  for (const id of styleIds) if (!out.byDoorStyle[id] && root[id] && typeof root[id] === 'object') addStyle(id, root[id]);
  if (!out.shared.length && !Object.keys(out.byDoorStyle).length && isMountCollection(root)) out.shared = normalizeMounts(root);
  return out;
}

/** @param doorStyle when set, each record's by_door_style[doorStyle] (anchor, position, knob_position, by_style) overrides its top-level values */
export function normalizeMounts(json: unknown, doorStyle?: string): Mount[] {
  if (!json || typeof json !== 'object') return [];
  const root = json as Record<string, any>;
  const src = root.mounts ?? root;
  const fronts = (root.fronts && typeof root.fronts === 'object' && !isMountRecord(root.fronts) ? root.fronts : {}) as Record<string, any>;
  const list: [string, any][] = Array.isArray(src) ? src.map((m: any) => [String(m?.front ?? m?.name ?? ''), m]) : Object.entries(src);
  const out: Mount[] = [];
  for (const [key, rec] of list) {
    if (!rec || typeof rec !== 'object') continue;
    const ds = doorStyle && rec.by_door_style && typeof rec.by_door_style === 'object' ? rec.by_door_style[doorStyle] : null;
    const m = ds && typeof ds === 'object' ? { ...rec, ...ds, door_style: doorStyle } : rec;
    const front = String(m.front ?? key);
    const position = vec3(m.position);
    if (!front || !position) continue;
    let quaternion: THREE.Quaternion | null = null;
    if (Array.isArray(m.quaternion) && m.quaternion.length === 4) quaternion = new THREE.Quaternion().fromArray(m.quaternion);
    const axisIn = vec3(m.axis);
    const normal = vec3(m.normal);
    if (!quaternion && axisIn && normal) {
      const x = axisIn.clone().normalize();
      const z = normal.clone().normalize();
      const y = new THREE.Vector3().crossVectors(z, x).normalize();
      quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    }
    if (!quaternion) continue;
    const axis = axisIn ? axisIn.normalize() : new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const kindRaw = String(fronts[front]?.kind ?? m.kind ?? '');
    const kind: 'door' | 'drawer' = /drawer/.test(kindRaw) || (!kindRaw && /(^|_)drawer_/.test(front)) ? 'drawer' : 'door';
    const hwName = String(m.hardware ?? '');
    const lengthM = typeof m.bar_length_m === 'number' ? m.bar_length_m : typeof m.center_to_center_m === 'number' ? m.center_to_center_m + 1.5 * IN : 6 * IN;
    const nominalIn = parseSizeToken(hwName.split('_').pop()) ?? lengthM / IN;
    const byStyle: Mount['byStyle'] = {};
    if (m.by_style && typeof m.by_style === 'object') {
      for (const [st, e] of Object.entries(m.by_style as Record<string, any>)) {
        if (!e || typeof e !== 'object') continue;
        byStyle[st.toLowerCase()] = {
          pull: typeof e.pull === 'string' ? e.pull : undefined,
          knob: typeof e.knob === 'string' ? e.knob : undefined,
          position: vec3(e.position) ?? undefined,
          knobPosition: vec3(e.knob_position) ?? undefined,
          lengthM: typeof e.length_m === 'number' ? e.length_m : undefined,
        };
      }
    }
    const anchorDir = vec3(m.anchor_dir);
    out.push({
      front,
      kind,
      position,
      quaternion,
      axis,
      nominalIn,
      lengthM,
      sizeClass: m.size_class === 'large' ? 'large' : m.size_class === 'small' ? 'small' : undefined,
      anchor: vec3(m.anchor) ?? undefined,
      anchorDir: anchorDir && anchorDir.lengthSq() > 1e-6 ? anchorDir.normalize() : undefined,
      knobPosition: vec3(m.knob_position) ?? undefined,
      byStyle,
    });
  }
  return out;
}

interface Candidate {
  node: THREE.Object3D;
  sizeIn: number | null;
  lengthM: number;
}

/** Styles that may borrow the generic bar/knob_round when hardware.glb has nothing for them. */
const GENERIC_OK: Record<string, { pull: boolean; knob: boolean }> = {
  bar: { pull: true, knob: true },
  arch: { pull: false, knob: true },
  artisan: { pull: false, knob: true },
  cottage: { pull: false, knob: true },
  loft: { pull: false, knob: false },
  square: { pull: false, knob: false },
};

export class HardwareLibrary {
  private pulls = new Map<string, Candidate[]>();
  private knobs = new Map<string, Candidate[]>();
  private byName = new Map<string, Candidate>();
  catalog: Record<string, HardwareCatalogEntry> = {};
  names: string[] = [];

  constructor(scene: THREE.Object3D | null) {
    if (!scene) return;
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const m = o.name.match(/^(pull|knob)_([a-z0-9]+)(?:_(.+))?$/i);
      if (!m) return;
      // only take the top-most named node (skip child meshes like pull_bar_1 of a pull_bar group)
      if (o.parent && /^(pull|knob)_/i.test(o.parent.name)) return;
      const [, type, style, size] = m;
      const box = new THREE.Box3().setFromObject(o);
      const sz = box.getSize(new THREE.Vector3());
      const cand: Candidate = { node: o, sizeIn: parseSizeToken(size), lengthM: Math.max(sz.x, 1e-3) };
      // "pull_bar_8in" -> style bar size 8in; "pull_bar_1" style bar (Blender dup) -> treat as unsized
      const map = type.toLowerCase() === 'pull' ? this.pulls : this.knobs;
      const key = style.toLowerCase();
      map.set(key, [...(map.get(key) || []), cand]);
      this.byName.set(o.name, cand);
      this.names.push(o.name);
    });
  }

  get empty() {
    return this.names.length === 0;
  }

  private nearest(list: Candidate[] | undefined, targetIn: number): Candidate | null {
    if (!list?.length) return null;
    const size = (c: Candidate) => c.sizeIn ?? c.lengthM / IN;
    return [...list].sort((a, b) => Math.abs(size(a) - targetIn) - Math.abs(size(b) - targetIn))[0];
  }

  named(name: string | undefined): Candidate | null {
    return (name && this.byName.get(name)) || null;
  }

  /** The style's shorter ('small') or longer ('large') pull. */
  bySizeClass(style: string, sizeClass: 'small' | 'large'): Candidate | null {
    const fromCatalog = this.named(this.catalog[style]?.[sizeClass]);
    if (fromCatalog) return fromCatalog;
    const list = this.pulls.get(style)?.filter((c) => c.sizeIn != null);
    if (!list?.length) return null;
    const sorted = [...list].sort((a, b) => a.sizeIn! - b.sizeIn!);
    return sizeClass === 'small' ? sorted[0] : sorted[sorted.length - 1];
  }

  /** Returns a model candidate or null (caller then builds a procedural shape). */
  pick(style: string, kind: 'pull' | 'knob', targetIn: number): Candidate | null {
    if (kind === 'knob') {
      const own = this.named(this.catalog[style]?.knob) || this.nearest(this.knobs.get(style), targetIn);
      if (own) return own;
      const generic = this.nearest(this.knobs.get('generic'), targetIn);
      if (generic) return generic;
      if (GENERIC_OK[style]?.knob ?? true) return this.nearest(this.knobs.get('round'), targetIn) || this.nearest(this.knobs.get('bar'), targetIn);
      return null;
    }
    const own = this.nearest(this.pulls.get(style), targetIn);
    if (own) return own;
    const generic = this.nearest(this.pulls.get('generic'), targetIn);
    if (generic) return generic;
    if (GENERIC_OK[style]?.pull ?? false) return this.nearest(this.pulls.get('bar'), targetIn);
    return null;
  }
}

const UPPER_Y = 1.2; // m above finished floor: mounts higher than this are on wall cabinets

/**
 * Builds hardware for every mount. Door hardware keeps its corner end where the mount's own pull
 * ended (so longer pulls grow away from the corner and knobs sit at the corner); drawers stay centered.
 */
export function placeMountedHardware(opts: {
  mounts: Mount[];
  lib: HardwareLibrary;
  style: string;
  doorKind: 'pull' | 'knob';
  material: THREE.Material;
  parentFor: (front: string) => THREE.Object3D;
}): THREE.Object3D[] {
  const { mounts, lib, style, doorKind, material, parentFor } = opts;
  const placed: THREE.Object3D[] = [];
  for (const m of mounts) {
    const kind = m.kind === 'door' ? doorKind : 'pull';
    const target = kind === 'knob' ? 1.25 : m.nominalIn;
    const exact = m.byStyle[style];
    const exactCand = exact ? lib.named(kind === 'knob' ? exact.knob : exact.pull) : null;
    const cand =
      exactCand ||
      (kind === 'pull' && m.sizeClass ? lib.bySizeClass(style, m.sizeClass) : null) ||
      lib.pick(style, kind, target);
    let obj: THREE.Object3D;
    let lengthM: number;
    if (cand) {
      obj = cand.node.clone(true);
      obj.traverse((c) => {
        const mesh = c as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.material = material;
          mesh.castShadow = true;
          mesh.userData.sharedGeometry = true;
        }
      });
      lengthM = kind === 'knob' ? 0 : cand.lengthM;
    } else {
      // procedural: wide drawers (8"+ mounts) get the style's longer size
      const scale = kind === 'pull' && m.nominalIn >= 7.5 ? 1.35 : 1;
      obj = buildHardware(style, kind, material, '', scale);
      const box = new THREE.Box3().setFromObject(obj);
      lengthM = kind === 'knob' ? 0 : box.getSize(new THREE.Vector3()).x;
    }
    obj.name = `${m.front.startsWith('island_') ? 'island_' : ''}${kind}_${m.front.replace(/^island_/, '').replace(/^(door|drawer)_/, '')}`;
    obj.userData.mountedHardware = true;
    let pos = m.position.clone();
    const exactPos = exactCand ? (kind === 'knob' ? exact?.knobPosition : exact?.position) : undefined;
    if (exactPos) pos = exactPos.clone();
    else if (kind === 'knob' && m.knobPosition) pos = m.knobPosition.clone();
    else if (m.kind === 'door' && m.anchor && m.anchorDir && kind === 'pull') {
      // placement rule: pull end sits at the anchor, the bar extends along anchor_dir
      pos = m.anchor.clone().addScaledVector(m.anchorDir, lengthM / 2);
    } else if (m.kind === 'door') {
      const towardCorner = m.axis.clone();
      const upper = m.position.y > UPPER_Y;
      if ((upper && towardCorner.y > 0) || (!upper && towardCorner.y < 0)) towardCorner.negate();
      pos.addScaledVector(towardCorner, (m.lengthM - lengthM) / 2 - (kind === 'knob' ? 0.75 * IN : 0));
    }
    obj.position.copy(pos);
    obj.quaternion.copy(m.quaternion);
    parentFor(m.front).add(obj);
    placed.push(obj);
  }
  return placed;
}
