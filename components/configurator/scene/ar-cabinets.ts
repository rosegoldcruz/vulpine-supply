/**
 * Single cabinets for the in-page AR studio ("View in your space"): real cabinet types and sizes, built from the
 * current door style (the same front profiles as the procedural kitchen), the engine's live finish / hardware
 * materials, and DevGod's catalog hardware from hardware.glb (procedural shapes when a node is missing).
 *
 * Every cabinet: meters, Y-up, origin at the bottom-centre of its back face, front facing +Z.
 */
import * as THREE from 'three';
import type { ArKit } from './engine';
import type { KnobShape } from './hardware';
import { FRONT_PROFILES, FRONT_T, GAP, IN, SLAB_DRAWER_STYLES, buildFront, buildHardware } from './procedural';

export type CabinetGroup = 'wall' | 'base' | 'tall' | 'vanity';
export type CabinetKind = 'wall' | 'sink_base' | 'base' | 'drawer_base' | 'pantry' | 'vanity';

export interface CabinetType {
  kind: CabinetKind;
  group: CabinetGroup;
  label: string;
  /** SKU prefix, e.g. W -> W3036 */
  code: string;
  widths: number[];
  heights: number[];
  depth: number;
  hint: string;
}

/** Inches. Box heights exclude nothing: base / vanity heights include the toe kick. */
export const CABINET_TYPES: CabinetType[] = [
  { kind: 'wall', group: 'wall', label: 'Wall cabinet', code: 'W', widths: [12, 15, 18, 24, 30, 36], heights: [30, 36, 42], depth: 12, hint: 'Hangs on the wall' },
  { kind: 'sink_base', group: 'base', label: 'Sink base', code: 'SB', widths: [30, 33, 36], heights: [34.5], depth: 24, hint: 'False front + 2 doors' },
  { kind: 'base', group: 'base', label: 'Drawer + door base', code: 'B', widths: [12, 15, 18, 24, 30, 36], heights: [34.5], depth: 24, hint: 'Top drawer over doors' },
  { kind: 'drawer_base', group: 'base', label: '3-drawer base', code: 'DB', widths: [12, 15, 18, 24, 30, 36], heights: [34.5], depth: 24, hint: 'Three drawers' },
  { kind: 'pantry', group: 'tall', label: 'Tall pantry', code: 'P', widths: [18, 24, 30], heights: [84, 90, 96], depth: 24, hint: 'Floor to (almost) ceiling' },
  { kind: 'vanity', group: 'vanity', label: 'Bath vanity', code: 'V', widths: [24, 30, 36], heights: [34.5], depth: 21, hint: 'Sink vanity' },
];

export const typeOf = (kind: CabinetKind) => CABINET_TYPES.find((t) => t.kind === kind)!;

export interface CabinetSpec {
  kind: CabinetKind;
  w: number;
  h: number;
}

export interface CabinetLook {
  styleId: string;
  hwStyle: string;
  doorHardware: 'pull' | 'knob';
  knobShape?: KnobShape;
}

const fmtIn = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}″`;
export const skuOf = (s: CabinetSpec) => {
  const t = typeOf(s.kind);
  return t.group === 'wall' || t.group === 'tall' ? `${t.code}${s.w}${s.h}` : `${t.code}${s.w}`;
};
export const specLabel = (s: CabinetSpec) => `${typeOf(s.kind).label} ${skuOf(s)} · ${fmtIn(s.w)} W × ${fmtIn(s.h)} H × ${fmtIn(typeOf(s.kind).depth)} D`;
/** Floor-standing cabinets sit on the floor; wall cabinets hang (54″ to the bottom in a kitchen). */
export const isWallHung = (kind: CabinetKind) => typeOf(kind).group === 'wall';
export const WALL_CABINET_BOTTOM_IN = 54;

type Row = { kind: 'door' | 'drawer' | 'false'; h?: number; n?: number; upper?: boolean };

const TOE = 4.5;
const TOE_SETBACK = 3;

function layoutFor(s: CabinetSpec): { rows: Row[]; toe: boolean } {
  const doors = (w: number) => (w >= 24 ? 2 : 1);
  switch (s.kind) {
    case 'wall':
      return { rows: [{ kind: 'door', n: doors(s.w), upper: true }], toe: false };
    case 'sink_base':
      return { rows: [{ kind: 'false', h: 6 }, { kind: 'door', n: 2 }], toe: true };
    case 'base':
      return { rows: [{ kind: 'drawer', h: 6, n: s.w >= 36 ? 2 : 1 }, { kind: 'door', n: doors(s.w) }], toe: true };
    case 'drawer_base':
      return { rows: [{ kind: 'drawer', h: 6 }, { kind: 'drawer' }, { kind: 'drawer' }], toe: true };
    case 'vanity':
      return { rows: [{ kind: 'false', h: 6 }, { kind: 'door', n: doors(s.w) }], toe: true };
    case 'pantry': {
      // lower doors at base-cabinet height, uppers above (pull at the bottom like a wall cabinet)
      const lower = 34.5 - TOE;
      return { rows: [{ kind: 'door', n: doors(s.w), upper: true }, { kind: 'door', n: doors(s.w), h: lower + 12 }], toe: true };
    }
  }
}

/** Metre UVs with V along the grain (DevGod's convention: finishes.json repeat = 1 / tile size in metres). */
function meterUvs(geo: THREE.BufferGeometry, grain: 'v' | 'h', offset: THREE.Vector2) {
  const p = (geo as THREE.BoxGeometry).parameters;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!p || !uv) return;
  // BoxGeometry faces (+x, -x, +y, -y, +z, -z), 4 vertices each: (u, v) spans
  const spans: [number, number][] = [
    [p.depth, p.height],
    [p.depth, p.height],
    [p.width, p.depth],
    [p.width, p.depth],
    [p.width, p.height],
    [p.width, p.height],
  ];
  const per = uv.count / 6;
  for (let f = 0; f < 6; f++)
    for (let i = 0; i < per; i++) {
      const k = f * per + i;
      let u = uv.getX(k) * spans[f][0];
      let v = uv.getY(k) * spans[f][1];
      if (grain === 'h') [u, v] = [v, u];
      uv.setXY(k, u + offset.x, v + offset.y);
    }
  uv.needsUpdate = true;
}

function grainUvs(root: THREE.Object3D, drawer: boolean) {
  const offset = new THREE.Vector2(Math.random() * 0.6, Math.random() * 0.6); // neighbours don't repeat the same grain
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const p = (m.geometry as THREE.BoxGeometry).parameters;
    if (!p) return;
    meterUvs(m.geometry, drawer || p.width > p.height ? 'h' : 'v', offset);
  });
}

function slab(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, name: string, grain: 'v' | 'h' = 'v') {
  const g = new THREE.BoxGeometry(w * IN, h * IN, d * IN);
  meterUvs(g, grain, new THREE.Vector2(Math.random(), Math.random()));
  const m = new THREE.Mesh(g, mat);
  m.position.set(x * IN, y * IN, z * IN);
  m.castShadow = m.receiveShadow = true;
  m.name = name;
  return m;
}

/**
 * Builds one cabinet. Carcass sides / top / bottom take the door finish (finished ends, as delivered for a stand-alone
 * cabinet); fronts use the style's real profile (Fusion styles: slab drawer + false fronts); hardware is the selected style.
 */
export function buildCabinet(spec: CabinetSpec, look: CabinetLook, kit: ArKit): THREE.Group {
  const t = typeOf(spec.kind);
  const { mats } = kit;
  const root = new THREE.Group();
  root.name = `ar_cabinet_${skuOf(spec)}`;
  root.userData.spec = spec;
  const W = spec.w;
  const H = spec.h;
  const D = t.depth;
  const { rows, toe } = layoutFor(spec);
  const y0 = toe ? TOE : 0;
  const boxD = D - FRONT_T; // carcass depth behind the fronts
  const side = 0.75;
  // carcass: two finished sides, top, bottom, back
  root.add(slab(side, H - y0, boxD, -W / 2 + side / 2, y0 + (H - y0) / 2, boxD / 2, mats.finish, 'panel_side_l'));
  root.add(slab(side, H - y0, boxD, W / 2 - side / 2, y0 + (H - y0) / 2, boxD / 2, mats.finish, 'panel_side_r'));
  root.add(slab(W - 2 * side, side, boxD, 0, H - side / 2, boxD / 2, mats.finish, 'panel_top', 'h'));
  root.add(slab(W - 2 * side, side, boxD, 0, y0 + side / 2, boxD / 2, mats.finish, 'panel_bottom', 'h'));
  root.add(slab(W - 2 * side, H - y0 - 2 * side, 0.5, 0, y0 + (H - y0) / 2, 0.25, mats.carcass, 'carcass_back'));
  if (toe) root.add(slab(W - 1, TOE, 0.75, 0, TOE / 2, boxD - TOE_SETBACK, mats.toe, 'toe_kick'));

  // fronts
  const frameIn = FRONT_PROFILES[look.styleId]?.frame ?? 0;
  const fixed = rows.reduce((a, r) => a + (r.h || 0), 0);
  const flex = rows.filter((r) => !r.h).length;
  const flexH = flex ? (H - y0 - fixed) / flex : 0;
  let top = H;
  let n = 0;
  for (const r of rows) {
    const rh = r.h || flexH;
    const cols = r.n || 1;
    const cw = W / cols;
    for (let i = 0; i < cols; i++) {
      const fx0 = -W / 2 + i * cw + GAP / 2;
      const fx1 = -W / 2 + (i + 1) * cw - GAP / 2;
      const fy0 = top - rh + GAP / 2;
      const fy1 = top - GAP / 2;
      const w = fx1 - fx0;
      const h = fy1 - fy0;
      const isDoor = r.kind === 'door';
      const frontStyle = !isDoor && SLAB_DRAWER_STYLES.has(look.styleId) ? 'slab' : look.styleId;
      const front = buildFront(`${isDoor ? 'door' : r.kind === 'drawer' ? 'drawer' : 'drawer_false'}_${++n}`, w, h, frontStyle, mats.finish, mats.finishRecess);
      grainUvs(front, !isDoor);
      front.position.set(((fx0 + fx1) / 2) * IN, ((fy0 + fy1) / 2) * IN, boxD * IN);
      root.add(front);
      const faceZ = (boxD + FRONT_T) * IN;
      if (r.kind === 'drawer') {
        const hw = hardwareFor(kit, look, 'pull', w >= 24 ? 'large' : 'small');
        hw.position.set(((fx0 + fx1) / 2) * IN, ((fy0 + fy1) / 2) * IN, faceZ);
        root.add(hw);
      } else if (isDoor) {
        const knob = look.doorHardware === 'knob';
        const hw = hardwareFor(kit, look, knob ? 'knob' : 'pull', 'small');
        const hingeLeft = cols === 1 ? true : i === 0;
        // framed styles centre the pull on the stile; slab keeps it 2" in from the edge
        const inset = frameIn > 0 ? frameIn / 2 : 2;
        const hx = hingeLeft ? fx1 - inset : fx0 + inset;
        let hy: number;
        if (knob) hy = r.upper ? fy0 + 3 : fy1 - 3;
        else {
          hw.rotation.z = Math.PI / 2; // vertical pull
          const len = new THREE.Box3().setFromObject(hw).getSize(new THREE.Vector3()).y / IN;
          hy = r.upper ? fy0 + 2.5 + len / 2 : fy1 - 2.5 - len / 2;
        }
        hw.position.set(hx * IN, hy * IN, faceZ);
        root.add(hw);
      }
    }
    top -= rh;
  }
  root.userData.size = new THREE.Vector3(W * IN, H * IN, D * IN);
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });
  return root;
}

function hardwareFor(kit: ArKit, look: CabinetLook, kind: 'pull' | 'knob', sizeClass: 'small' | 'large'): THREE.Object3D {
  const real = kit.hardware(look.hwStyle, kind, { sizeClass, targetIn: sizeClass === 'large' ? 7 : 5, knobShape: look.knobShape });
  if (real) return real;
  return buildHardware(look.hwStyle, kind, kit.mats.hardware, `${kind}_${look.hwStyle}`, sizeClass === 'large' ? 1.35 : 1);
}

/** Frees a cabinet's own geometry (materials and catalog hardware geometry are shared with the engine). */
export function disposeCabinet(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.sharedGeometry) m.geometry?.dispose();
  });
}
