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
 *   bar_length_m, center_to_center_m } } | [ { front, ... } ], fronts?: { <front>: { kind, ... } } }
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

export function normalizeMounts(json: unknown): Mount[] {
  if (!json || typeof json !== 'object') return [];
  const root = json as Record<string, any>;
  const src = root.mounts ?? root;
  const fronts = (root.fronts ?? {}) as Record<string, any>;
  const list: [string, any][] = Array.isArray(src) ? src.map((m: any) => [String(m?.front ?? m?.name ?? ''), m]) : Object.entries(src);
  const out: Mount[] = [];
  for (const [key, m] of list) {
    if (!m || typeof m !== 'object') continue;
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
    out.push({ front, kind, position, quaternion, axis, nominalIn, lengthM });
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

  /** Returns a model candidate or null (caller then builds a procedural shape). */
  pick(style: string, kind: 'pull' | 'knob', targetIn: number): Candidate | null {
    if (kind === 'knob') {
      const own = this.nearest(this.knobs.get(style), targetIn);
      if (own) return own;
      if (GENERIC_OK[style]?.knob ?? true) return this.nearest(this.knobs.get('round'), targetIn) || this.nearest(this.knobs.get('bar'), targetIn);
      return null;
    }
    const own = this.nearest(this.pulls.get(style), targetIn);
    if (own) return own;
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
    const cand = lib.pick(style, kind, target);
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
    const pos = m.position.clone();
    if (m.kind === 'door') {
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
