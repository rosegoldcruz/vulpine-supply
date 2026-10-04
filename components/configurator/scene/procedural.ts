/**
 * Procedural kitchen used when DevGod's GLBs are not in public/models/configurator/.
 *
 * Naming follows the GLB contract so the same material/toggle logic works for both:
 *   door_*, drawer_*, panel_*  -> take the door finish
 *   pull_*, knob_*             -> hardware
 *   island_*                   -> toggleable island (island_root)
 *
 * Front specs (cabinet expert): 3/4" thick, full overlay, ~1/8" gaps between fronts.
 * Shaker Classic: 2-1/4" stiles/rails, recessed flat center panel. Slab: completely flat.
 * Shaker Slide / Fusion profiles are read off the cabs_clean door photos (swatch ~15" wide):
 *   Shaker Slide  - 2-1/4" frame + a ~1/2" stepped ledge before the recessed panel
 *   Fusion Shaker - slimmer ~2" frame, shallow (~3/32") crisp recess
 *   Fusion Slide  - wider ~2-1/2" frame + ~1/2" shallow step, shallow recess
 */
import * as THREE from 'three';

export const IN = 0.0254; // meters per inch
export const FRONT_T = 0.75;
export const GAP = 0.125;

export interface FrontProfile {
  frame: number; // stile/rail width (in)
  step: number; // inner stepped ledge width (in), 0 = none
  stepDepth: number; // how far the ledge sits back from the frame face (in)
  recess: number; // how far the center panel sits back from the frame face (in)
}

export const FRONT_PROFILES: Record<string, FrontProfile | null> = {
  slab: null,
  shaker_classic: { frame: 2.25, step: 0, stepDepth: 0, recess: 0.25 },
  shaker_slide: { frame: 2.25, step: 0.5, stepDepth: 0.125, recess: 0.25 },
  fusion_shaker: { frame: 2, step: 0, stepDepth: 0, recess: 0.09375 },
  fusion_slide: { frame: 2.5, step: 0.5, stepDepth: 0.0625, recess: 0.125 },
};

export interface KitchenMaterials {
  finish: THREE.Material;
  /** same finish, slightly darker: recessed panels/steps (stands in for baked AO) */
  finishRecess: THREE.Material;
  carcass: THREE.Material;
  interior: THREE.Material;
  counter: THREE.Material;
  steel: THREE.Material;
  toe: THREE.Material;
  wall: THREE.Material;
  backsplash: THREE.Material;
  floor: THREE.Material;
  hardware: THREE.Material;
}

export interface HardwareAnchor {
  name: string;
  parent: THREE.Object3D;
  /** position in parent space (meters), on the front face */
  position: THREE.Vector3;
  orientation: 'h' | 'v';
  front: 'door' | 'drawer';
}

/** Box in inches. (x, y) = center, z = back face; depth grows toward +z. */
function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, name?: string) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w * IN, h * IN, d * IN), mat);
  m.position.set(x * IN, y * IN, (z + d / 2) * IN);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}

/** A single front centered at (0,0), back face at z=0, facing +z. */
export function buildFront(name: string, w: number, h: number, styleId: string, mat: THREE.Material, recessMat: THREE.Material = mat): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  const p = FRONT_PROFILES[styleId] ?? null;
  const T = FRONT_T;
  if (!p) {
    g.add(box(w, h, T, 0, 0, 0, mat));
    return g;
  }
  let { frame: f, step: s } = p;
  // Short drawer fronts: shrink the frame so a panel still reads; very short ones go flat.
  const minPanel = 1.5;
  const fit = (dim: number) => {
    if (dim - 2 * (f + s) < minPanel) {
      const avail = (dim - minPanel) / 2;
      s = Math.min(s, Math.max(0, avail * 0.2));
      f = Math.max(0, avail - s);
    }
  };
  fit(h);
  fit(w);
  if (f < 0.75) {
    g.add(box(w, h, T, 0, 0, 0, mat));
    return g;
  }
  // stiles (full height) + rails (between stiles)
  g.add(box(f, h, T, -w / 2 + f / 2, 0, 0, mat));
  g.add(box(f, h, T, w / 2 - f / 2, 0, 0, mat));
  g.add(box(w - 2 * f, f, T, 0, h / 2 - f / 2, 0, mat));
  g.add(box(w - 2 * f, f, T, 0, -h / 2 + f / 2, 0, mat));
  if (s > 0) {
    const Ts = T - p.stepDepth;
    g.add(box(s, h - 2 * f, Ts, -w / 2 + f + s / 2, 0, 0, recessMat));
    g.add(box(s, h - 2 * f, Ts, w / 2 - f - s / 2, 0, 0, recessMat));
    g.add(box(w - 2 * f - 2 * s, s, Ts, 0, h / 2 - f - s / 2, 0, recessMat));
    g.add(box(w - 2 * f - 2 * s, s, Ts, 0, -h / 2 + f + s / 2, 0, recessMat));
  }
  g.add(box(w - 2 * (f + s), h - 2 * (f + s), T - p.recess, 0, 0, 0, recessMat));
  return g;
}

// ------------------------------------------------------------------ hardware
const PULL_CC: Record<string, number> = { arch: 6, artisan: 4.75, cottage: 3.78, loft: 4.625, square: 4.25, bar: 5 };

function arcGeometry(chord: number, angleDeg: number, tube: number) {
  const theta = (angleDeg * Math.PI) / 180;
  const R = chord / (2 * Math.sin(theta / 2));
  const geo = new THREE.TorusGeometry(R * IN, tube * IN, 10, 32, theta);
  geo.rotateZ(Math.PI / 2 - theta / 2);
  geo.translate(0, -R * Math.cos(theta / 2) * IN, 0);
  geo.rotateX(Math.PI / 2); // bow out of the door (+z), pull axis = x
  return geo;
}

/** Builds a pull (axis along x) or knob, sitting on z=0 and protruding toward +z. */
export function buildHardware(style: string, kind: 'pull' | 'knob', mat: THREE.Material, name: string): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  const add = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x * IN, y * IN, z * IN);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  if (kind === 'knob') {
    if (style === 'square' || style === 'loft') {
      add(new THREE.BoxGeometry(0.4 * IN, 0.4 * IN, 0.9 * IN), 0, 0, 0.45);
      add(new THREE.BoxGeometry(0.95 * IN, 0.95 * IN, 0.35 * IN), 0, 0, 1.05);
    } else {
      const stem = new THREE.CylinderGeometry(0.2 * IN, 0.28 * IN, 0.9 * IN, 16);
      stem.rotateX(Math.PI / 2);
      add(stem, 0, 0, 0.45);
      const head = new THREE.SphereGeometry(0.6 * IN, 24, 16);
      head.scale(1, 1, 0.7);
      add(head, 0, 0, 1.15);
    }
    return g;
  }
  const L = PULL_CC[style] ?? 5;
  switch (style) {
    case 'arch':
      add(arcGeometry(L, 110, 0.19));
      break;
    case 'cottage':
      add(arcGeometry(L, 80, 0.24));
      break;
    case 'square':
    case 'loft': {
      const sec = style === 'loft' ? [0.22, 0.6] : [0.38, 0.38];
      add(new THREE.BoxGeometry((L + 1) * IN, sec[1] * IN, sec[0] * IN), 0, 0, 1.15);
      for (const x of [-L / 2, L / 2]) add(new THREE.BoxGeometry(0.32 * IN, 0.32 * IN, 1.1 * IN), x, 0, 0.55);
      break;
    }
    case 'artisan': {
      const bar = new THREE.CapsuleGeometry(0.22 * IN, (L + 0.6) * IN, 6, 16);
      bar.rotateZ(Math.PI / 2);
      add(bar, 0, 0, 1.1);
      for (const x of [-L / 2, L / 2]) {
        const post = new THREE.CylinderGeometry(0.17 * IN, 0.24 * IN, 1.0 * IN, 12);
        post.rotateX(Math.PI / 2);
        add(post, x, 0, 0.5);
      }
      break;
    }
    case 'bar':
    default: {
      const bar = new THREE.CylinderGeometry(0.25 * IN, 0.25 * IN, (L + 2) * IN, 20);
      bar.rotateZ(Math.PI / 2);
      add(bar, 0, 0, 1.2);
      for (const x of [-L / 2, L / 2]) {
        const post = new THREE.CylinderGeometry(0.19 * IN, 0.19 * IN, 1.1 * IN, 12);
        post.rotateX(Math.PI / 2);
        add(post, x, 0, 0.55);
      }
    }
  }
  return g;
}

export function placeHardware(
  anchors: HardwareAnchor[],
  style: string,
  doorKind: 'pull' | 'knob',
  mat: THREE.Material,
): THREE.Object3D[] {
  const placed: THREE.Object3D[] = [];
  for (const a of anchors) {
    const kind = a.front === 'door' ? doorKind : 'pull';
    const hw = buildHardware(style, kind, mat, a.name.replace('hw_', `${kind}_`));
    hw.position.copy(a.position);
    if (a.orientation === 'v' && kind === 'pull') hw.rotation.z = Math.PI / 2;
    a.parent.add(hw);
    placed.push(hw);
  }
  return placed;
}

// -------------------------------------------------------------------- layout
type Row = { kind: 'door' | 'drawer' | 'false'; h?: number; n?: number };
type CabSpec = { w: number; rows?: Row[]; appliance?: 'range' };

const BASE_H = 30.5; // carcass above toe kick
const TOE = 4;
const BASE_D = 24;
const UPPER_D = 12;
const UPPER_BOTTOM = 54;
const UPPER_TOP = 84;

const std = (w: number): CabSpec => ({ w, rows: [{ kind: 'drawer', h: 6 }, { kind: 'door', n: w >= 24 ? 2 : 1 }] });
const drawers3 = (w: number): CabSpec => ({ w, rows: [{ kind: 'drawer', h: 6 }, { kind: 'drawer' }, { kind: 'drawer' }] });
const sink = (w: number): CabSpec => ({ w, rows: [{ kind: 'false', h: 6 }, { kind: 'door', n: 2 }] });

interface BuildCtx {
  styleId: string;
  mats: KitchenMaterials;
  anchors: HardwareAnchor[];
  counters: Record<string, number>;
}
const nextName = (ctx: BuildCtx, prefix: string) => {
  ctx.counters[prefix] = (ctx.counters[prefix] || 0) + 1;
  return `${prefix}_${String(ctx.counters[prefix]).padStart(2, '0')}`;
};

/**
 * Lays out fronts for one cabinet face. x0..x1, y0..y1 = cabinet face in inches (front plane at z).
 * `upper` puts door hardware at the bottom corner, base doors get it at the top corner.
 */
function addFronts(
  parent: THREE.Object3D,
  ctx: BuildCtx,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
  rows: Row[],
  opts: { upper?: boolean; prefix?: string } = {},
) {
  const pre = opts.prefix || '';
  const fixed = rows.reduce((s, r) => s + (r.h || 0), 0);
  const flex = rows.filter((r) => !r.h).length;
  const flexH = flex ? (y1 - y0 - fixed) / flex : 0;
  let top = y1;
  for (const r of rows) {
    const rh = r.h || flexH;
    const ry0 = top - rh;
    const n = r.n || 1;
    const cw = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const fx0 = x0 + i * cw + GAP / 2;
      const fx1 = x0 + (i + 1) * cw - GAP / 2;
      const fy0 = ry0 + GAP / 2;
      const fy1 = top - GAP / 2;
      const w = fx1 - fx0;
      const h = fy1 - fy0;
      const kindName = r.kind === 'door' ? 'door' : r.kind === 'drawer' ? 'drawer' : 'drawer_false';
      const front = buildFront(nextName(ctx, `${pre}${kindName}`), w, h, ctx.styleId, ctx.mats.finish, ctx.mats.finishRecess);
      front.position.set(((fx0 + fx1) / 2) * IN, ((fy0 + fy1) / 2) * IN, z * IN);
      parent.add(front);
      const hz = (z + FRONT_T) * IN;
      if (r.kind === 'drawer') {
        ctx.anchors.push({
          name: nextName(ctx, `${pre}hw`),
          parent,
          position: new THREE.Vector3(((fx0 + fx1) / 2) * IN, ((fy0 + fy1) / 2) * IN, hz),
          orientation: 'h',
          front: 'drawer',
        });
      } else if (r.kind === 'door') {
        // hinge on the outside; hardware near the meeting edge
        const hingeLeft = n === 1 ? true : i === 0;
        const hx = hingeLeft ? fx1 - 1.75 : fx0 + 1.75;
        const hy = opts.upper ? fy0 + 4 : fy1 - 4;
        ctx.anchors.push({
          name: nextName(ctx, `${pre}hw`),
          parent,
          position: new THREE.Vector3(hx * IN, hy * IN, hz),
          orientation: 'v',
          front: 'door',
        });
      }
    }
    top = ry0;
  }
}

function addBaseRun(parent: THREE.Object3D, ctx: BuildCtx, cabs: CabSpec[], startX: number, z0: number, opts: { prefix?: string } = {}) {
  const { mats } = ctx;
  const carD = BASE_D - FRONT_T;
  let x = startX;
  for (const c of cabs) {
    if (c.appliance === 'range') {
      parent.add(box(c.w - 0.25, 36, 25, x + c.w / 2, 18, z0, mats.steel, 'appliance_range'));
      // oven window + cooktop grates hint
      parent.add(box(c.w - 6, 12, 0.2, x + c.w / 2, 16, z0 + 25, mats.interior, 'appliance_range_window'));
      parent.add(box(c.w - 2, 0.6, 22, x + c.w / 2, 36.3, z0 + 1.5, mats.interior, 'appliance_range_top'));
    } else {
      parent.add(box(c.w, BASE_H, carD, x + c.w / 2, TOE + BASE_H / 2, z0, mats.carcass, `${opts.prefix || ''}carcass`));
      parent.add(box(c.w, TOE, carD - 3, x + c.w / 2, TOE / 2, z0, mats.toe, `${opts.prefix || ''}toe_kick`));
      addFronts(parent, ctx, x, x + c.w, TOE, TOE + BASE_H, z0 + carD, c.rows || [], { prefix: opts.prefix });
    }
    x += c.w;
  }
  return x;
}

export function buildProceduralKitchen(styleId: string, mats: KitchenMaterials) {
  const root = new THREE.Group();
  root.name = 'procedural_kitchen';
  const ctx: BuildCtx = { styleId, mats, anchors: [], counters: {} };

  const run: CabSpec[] = [std(15), sink(36), drawers3(24), { w: 30, appliance: 'range' }, drawers3(18), std(33)];
  const runW = run.reduce((s, c) => s + c.w, 0);
  const cx = runW / 2;
  const kitchen = new THREE.Group();
  kitchen.position.x = -cx * IN;
  root.add(kitchen);

  // room
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'room_floor';
  root.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 4), mats.wall);
  wall.position.set(0, 2, 0);
  wall.receiveShadow = true;
  wall.name = 'room_wall';
  root.add(wall);

  // base run
  addBaseRun(kitchen, ctx, run, 0, 0);
  // finished end panels
  kitchen.add(box(FRONT_T, TOE + BASE_H, BASE_D, -FRONT_T / 2, (TOE + BASE_H) / 2, 0, mats.finish, 'panel_base_end_l'));
  kitchen.add(box(FRONT_T, TOE + BASE_H, BASE_D, runW + FRONT_T / 2, (TOE + BASE_H) / 2, 0, mats.finish, 'panel_base_end_r'));
  // countertops (split around the range) + backsplash
  let x = 0;
  const counterSegs: [number, number][] = [];
  let segStart = -FRONT_T - 1;
  for (const c of run) {
    if (c.appliance) {
      counterSegs.push([segStart, x]);
      segStart = x + c.w;
    }
    x += c.w;
  }
  counterSegs.push([segStart, runW + FRONT_T + 1]);
  counterSegs.forEach(([a, b], i) => kitchen.add(box(b - a, 1.5, 25.5, (a + b) / 2, TOE + BASE_H + 0.75, 0, mats.counter, `counter_${i + 1}`)));
  kitchen.add(box(runW + 2 * FRONT_T, UPPER_BOTTOM - 36, 0.3, runW / 2, (36 + UPPER_BOTTOM) / 2, 0, mats.backsplash, 'backsplash'));

  // uppers
  const carUD = UPPER_D - FRONT_T;
  x = 0;
  for (const c of run) {
    if (c.appliance === 'range') {
      const y0 = 70;
      kitchen.add(box(c.w, UPPER_TOP - y0, carUD, x + c.w / 2, (y0 + UPPER_TOP) / 2, 0, mats.carcass, 'upper_carcass'));
      addFronts(kitchen, ctx, x, x + c.w, y0, UPPER_TOP, carUD, [{ kind: 'door', n: 2 }], { upper: true });
      // hood
      kitchen.add(box(c.w, 6, 18, x + c.w / 2, y0 - 3, 0, mats.steel, 'appliance_hood'));
    } else {
      kitchen.add(box(c.w, UPPER_TOP - UPPER_BOTTOM, carUD, x + c.w / 2, (UPPER_BOTTOM + UPPER_TOP) / 2, 0, mats.carcass, 'upper_carcass'));
      addFronts(kitchen, ctx, x, x + c.w, UPPER_BOTTOM, UPPER_TOP, carUD, [{ kind: 'door', n: c.w > 21 ? 2 : 1 }], { upper: true });
    }
    x += c.w;
  }
  kitchen.add(box(FRONT_T, UPPER_TOP - UPPER_BOTTOM, UPPER_D, -FRONT_T / 2, (UPPER_BOTTOM + UPPER_TOP) / 2, 0, mats.finish, 'panel_upper_end_l'));
  kitchen.add(box(FRONT_T, UPPER_TOP - UPPER_BOTTOM, UPPER_D, runW + FRONT_T / 2, (UPPER_BOTTOM + UPPER_TOP) / 2, 0, mats.finish, 'panel_upper_end_r'));
  // crown/top filler
  kitchen.add(box(runW + 2 * FRONT_T, 3, UPPER_D + 0.75, runW / 2, UPPER_TOP + 1.5, 0, mats.finish, 'panel_crown'));

  // island (toggleable)
  const island = new THREE.Group();
  island.name = 'island_root';
  const islandCabs = [drawers3(24), std(24), drawers3(24)];
  const iw = 72;
  const iz = 78; // back of island carcass (in), leaves a ~40" aisle
  island.position.set(-(iw / 2) * IN, 0, 0);
  root.add(island);
  addBaseRun(island, ctx, islandCabs, 0, iz, { prefix: 'island_' });
  island.add(box(FRONT_T, TOE + BASE_H, BASE_D, -FRONT_T / 2, (TOE + BASE_H) / 2, iz, mats.finish, 'island_panel_l'));
  island.add(box(FRONT_T, TOE + BASE_H, BASE_D, iw + FRONT_T / 2, (TOE + BASE_H) / 2, iz, mats.finish, 'island_panel_r'));
  island.add(box(iw + 2 * FRONT_T, TOE + BASE_H, FRONT_T, iw / 2, (TOE + BASE_H) / 2, iz - FRONT_T, mats.finish, 'island_panel_back'));
  island.add(box(iw + 2 * FRONT_T + 2, 1.5, BASE_D + 13, iw / 2, TOE + BASE_H + 0.75, iz - 12, mats.counter, 'island_counter'));

  return { root, anchors: ctx.anchors };
}
