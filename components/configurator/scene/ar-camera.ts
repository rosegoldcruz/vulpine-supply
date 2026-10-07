/**
 * In-page camera AR ("View in your space"), for iPhone Safari and Android Chrome alike: the rear camera
 * (getUserMedia) is a full-screen <video>, a transparent three.js canvas on top draws the cabinets.
 *
 * Tracking is 3DoF: DeviceOrientation rotates the virtual camera, so a placed cabinet stays roughly where it was put
 * while the phone turns (it cannot follow the phone moving sideways; WebXR on Android does real 6DoF, see ./ar).
 * Without orientation data (desktop webcam, denied permission) the camera is fixed: level in wall mode, tilted ~30°
 * down in floor mode.
 *
 *   wall mode   cabinets stand upright, facing the camera, their back on a virtual wall 1.6 m ahead
 *   floor mode  cabinets stand on a ground plane 1.35 m below the phone (wall cabinets hang 54″ above it)
 *
 * Gestures: one finger drags the selected cabinet (tap selects), pinch scales and two-finger twist turns the whole
 * arrangement around the selected cabinet. lock() ignores gestures.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ArKit } from './engine';
import { buildCabinet, disposeCabinet, isWallHung, specLabel, WALL_CABINET_BOTTOM_IN, type CabinetLook, type CabinetSpec } from './ar-cabinets';
import { IN } from './procedural';

export type PlaceMode = 'wall' | 'floor';

const WALL_DIST = 1.6; // m from the phone to the virtual wall
const CAM_HEIGHT = 1.35; // m, phone above the floor
/** assumed rear-camera field of view across the long side of the sensor (phones: ~65-70°) */
const CAMERA_LONG_FOV = 67;
const SNAP_DIST = 0.08; // m (at true scale) between sides to snap
const ORANGE = '#ee7200';

export interface PlacedCabinet {
  id: number;
  spec: CabinetSpec;
  obj: THREE.Group;
}

export interface CameraArEvents {
  onChange?: () => void;
}

export class CameraAr {
  readonly video: HTMLVideoElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.02, 60);
  private items: PlacedCabinet[] = [];
  private nextId = 1;
  private selectedId: number | null = null;
  private kit: ArKit | null = null;
  private look: CabinetLook | null = null;
  private mode: PlaceMode = 'wall';
  private sun = new THREE.DirectionalLight('#fff6ea', 1.7);
  private catcher: THREE.Mesh;
  private outline: THREE.LineSegments;
  private env: THREE.Texture;
  private raf = 0;
  private disposed = false;
  private ro: ResizeObserver;
  locked = false;
  /** global scale of the arrangement (pinch); 1 = true size at the assumed distance */
  private scale = 1;
  // orientation
  private devQ = new THREE.Quaternion();
  private hasOrientation = false;
  private lastOrientationAt = 0;
  private onOrientation: (e: DeviceOrientationEvent) => void;
  // gestures
  private pointers = new Map<number, { x: number; y: number; x0: number; y0: number; t0: number }>();
  private drag: { plane: THREE.Plane; offset: THREE.Vector3 } | null = null;
  private multi: {
    d0: number;
    a0: number;
    s0: number;
    pivot: THREE.Vector3;
    start: { obj: THREE.Group; pos: THREE.Vector3; yaw: number }[];
  } | null = null;

  constructor(private host: HTMLElement, private events: CameraArEvents = {}) {
    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('aria-hidden', 'true');
    this.video.muted = true;
    this.video.autoplay = true;
    Object.assign(this.video.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', background: '#2b2724' });
    host.appendChild(this.video);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const c = this.renderer.domElement;
    Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', touchAction: 'none' });
    c.setAttribute('aria-label', 'Camera view with your cabinet. Drag to move, pinch to resize, twist with two fingers to turn.');
    c.setAttribute('role', 'img');
    host.appendChild(c);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.env;
    this.scene.environmentIntensity = 0.55;
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8a8178', 0.75));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.1, far: 12 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    this.catcher = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.24 }));
    this.catcher.receiveShadow = true;
    this.scene.add(this.catcher);
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.9, depthTest: false }),
    );
    this.outline.renderOrder = 10;
    this.outline.visible = false;
    this.scene.add(this.outline);

    this.onOrientation = (e) => this.handleOrientation(e);
    window.addEventListener('deviceorientation', this.onOrientation);
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    this.video.addEventListener('loadedmetadata', () => this.resize());
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    this.raf = requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------ camera feed + projection
  setStream(stream: MediaStream | null) {
    this.video.srcObject = stream;
    if (stream) this.video.play().catch(() => {});
  }

  /** Vertical FOV of what the screen shows: the camera's FOV, cropped by object-fit: cover. */
  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const vw = this.video.videoWidth || (w > h ? 1920 : 1080);
    const vh = this.video.videoHeight || (w > h ? 1080 : 1920);
    const f = Math.max(vw, vh) / 2 / Math.tan(THREE.MathUtils.degToRad(CAMERA_LONG_FOV) / 2); // focal length, video px
    const s = Math.max(w / vw, h / vh); // cover scale
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(h / s / 2 / f));
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ 3DoF orientation
  private handleOrientation(e: DeviceOrientationEvent) {
    if (e.alpha == null && e.beta == null && e.gamma == null) return;
    const d = THREE.MathUtils.degToRad;
    const alpha = d(e.alpha ?? 0);
    const beta = d(e.beta ?? 90);
    const gamma = d(e.gamma ?? 0);
    const orient = d((screen.orientation?.angle ?? (window as any).orientation ?? 0) as number);
    // device -> world (Y up, -Z = where the back camera looks when the phone is upright)
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(beta, alpha, -gamma, 'YXZ'));
    q.multiply(new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -orient));
    if (!this.hasOrientation) this.devQ.copy(q);
    else this.devQ.slerp(q, 0.45); // low-pass: sensor jitter
    this.hasOrientation = true;
    this.lastOrientationAt = performance.now();
  }

  /** true once DeviceOrientation data is arriving */
  get tracking() {
    return this.hasOrientation && performance.now() - this.lastOrientationAt < 1500;
  }

  private updateCamera() {
    if (this.hasOrientation) this.camera.quaternion.copy(this.devQ);
    else this.camera.quaternion.setFromEuler(new THREE.Euler(this.mode === 'floor' ? -0.52 : 0, 0, 0, 'YXZ'));
    this.camera.position.set(0, 0, 0);
    this.camera.updateMatrixWorld(true);
  }

  // ------------------------------------------------------------------ cabinets
  setKit(kit: ArKit, look: CabinetLook) {
    this.kit = kit;
    this.setLook(look);
  }

  /** Door style / hardware changed: rebuild every cabinet in place (finish swaps need nothing: shared materials). */
  setLook(look: CabinetLook) {
    const prev = this.look;
    this.look = look;
    if (!this.kit) return;
    if (prev && prev.styleId === look.styleId && prev.hwStyle === look.hwStyle) return;
    for (const it of this.items) {
      const fresh = buildCabinet(it.spec, look, this.kit);
      fresh.position.copy(it.obj.position);
      fresh.quaternion.copy(it.obj.quaternion);
      fresh.scale.copy(it.obj.scale);
      this.scene.remove(it.obj);
      disposeCabinet(it.obj);
      it.obj = fresh;
      this.scene.add(fresh);
    }
    this.events.onChange?.();
  }

  get ready() {
    return Boolean(this.kit && this.look);
  }

  list(): { id: number; spec: CabinetSpec; label: string }[] {
    return this.items.map((i) => ({ id: i.id, spec: i.spec, label: specLabel(i.spec) }));
  }

  get selected(): PlacedCabinet | null {
    return this.items.find((i) => i.id === this.selectedId) ?? null;
  }

  select(id: number | null) {
    this.selectedId = id;
    this.events.onChange?.();
  }

  setMode(mode: PlaceMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.updateCamera();
    // re-place everything for the new mode, keeping the arrangement
    const specs = this.items.map((i) => i.spec);
    const sel = this.items.findIndex((i) => i.id === this.selectedId);
    this.clear();
    specs.forEach((s) => this.add(s));
    if (sel >= 0 && this.items[sel]) this.selectedId = this.items[sel].id;
    this.events.onChange?.();
  }

  getMode() {
    return this.mode;
  }

  clear() {
    for (const it of this.items) {
      this.scene.remove(it.obj);
      disposeCabinet(it.obj);
    }
    this.items = [];
    this.selectedId = null;
    this.events.onChange?.();
  }

  remove(id: number) {
    const it = this.items.find((i) => i.id === id);
    if (!it) return;
    this.scene.remove(it.obj);
    disposeCabinet(it.obj);
    this.items = this.items.filter((i) => i !== it);
    if (this.selectedId === id) this.selectedId = this.items.at(-1)?.id ?? null;
    this.events.onChange?.();
  }

  /** Replace the selected cabinet's type / size, keeping where it is. */
  replaceSelected(spec: CabinetSpec) {
    const it = this.selected;
    if (!it || !this.kit || !this.look) return this.add(spec);
    const fresh = buildCabinet(spec, this.look, this.kit);
    fresh.quaternion.copy(it.obj.quaternion);
    fresh.scale.copy(it.obj.scale);
    fresh.position.copy(it.obj.position);
    // keep the visual centre on screen in wall mode; floor-standing stays on the floor
    if (this.mode === 'wall' && isWallHung(spec.kind) === isWallHung(it.spec.kind)) {
      const dh = (spec.h - it.spec.h) * IN * this.scale;
      if (isWallHung(spec.kind)) fresh.position.y -= dh; // wall cabinets: keep the top line
    } else if (this.mode === 'floor') fresh.position.y = this.floorY(spec);
    this.scene.remove(it.obj);
    disposeCabinet(it.obj);
    it.obj = fresh;
    it.spec = spec;
    this.scene.add(fresh);
    this.events.onChange?.();
    return it.id;
  }

  private floorY(spec: CabinetSpec) {
    return -CAM_HEIGHT + (isWallHung(spec.kind) ? WALL_CABINET_BOTTOM_IN * IN * this.scale : 0);
  }

  private yawOf(o: THREE.Object3D) {
    return new THREE.Euler().setFromQuaternion(o.quaternion, 'YXZ').y;
  }

  /** Adds a cabinet: in front of the camera, or snapped beside / above / below the selected one. */
  add(spec: CabinetSpec): number | null {
    if (!this.kit || !this.look) return null;
    this.updateCamera();
    const obj = buildCabinet(spec, this.look, this.kit);
    obj.scale.setScalar(this.scale);
    const sel = this.selected;
    const s = this.scale;
    if (sel) {
      const yaw = this.yawOf(sel.obj);
      obj.rotation.set(0, yaw, 0);
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const selHung = isWallHung(sel.spec.kind);
      const newHung = isWallHung(spec.kind);
      if (selHung === newHung) {
        // side by side, backs on the same line; wall cabinets share the top line, floor cabinets the floor
        obj.position.copy(sel.obj.position).addScaledVector(right, ((sel.spec.w + spec.w) / 2) * IN * s);
        if (newHung) obj.position.y = sel.obj.position.y + (sel.spec.h - spec.h) * IN * s;
      } else if (newHung) {
        // wall cabinet above a floor cabinet: 54″ above its floor line
        obj.position.copy(sel.obj.position);
        obj.position.y = sel.obj.position.y + WALL_CABINET_BOTTOM_IN * IN * s;
      } else {
        obj.position.copy(sel.obj.position);
        obj.position.y = sel.obj.position.y - WALL_CABINET_BOTTOM_IN * IN * s;
      }
    } else this.placeFresh(obj, spec);
    const id = this.nextId++;
    this.items.push({ id, spec, obj });
    this.scene.add(obj);
    this.selectedId = id;
    this.events.onChange?.();
    return id;
  }

  /** First cabinet: centred on screen on the virtual wall, or on the floor where the view centre meets it. */
  private placeFresh(obj: THREE.Group, spec: CabinetSpec) {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const flat = new THREE.Vector3(fwd.x, 0, fwd.z);
    if (flat.lengthSq() < 1e-4) flat.set(0, 0, -1);
    flat.normalize();
    const yaw = Math.atan2(-flat.x, -flat.z); // local +Z (front) toward the phone
    obj.rotation.set(0, yaw, 0);
    const size = (obj.userData.size as THREE.Vector3).clone().multiplyScalar(this.scale);
    if (this.mode === 'wall') {
      const horiz = Math.hypot(fwd.x, fwd.z);
      const lift = horiz > 0.2 ? (fwd.y / horiz) * WALL_DIST : 0;
      obj.position.copy(flat).multiplyScalar(WALL_DIST);
      obj.position.y = THREE.MathUtils.clamp(lift, -1.2, 1.2) - size.y / 2;
    } else {
      let dist = 2;
      if (fwd.y < -0.08) dist = THREE.MathUtils.clamp(CAM_HEIGHT / -fwd.y * Math.hypot(fwd.x, fwd.z), 0.7, 4);
      // footprint centre at that floor point: the back (origin) sits half a depth further away
      obj.position.copy(flat).multiplyScalar(dist + size.z / 2);
      obj.position.y = this.floorY(spec);
    }
  }

  // ------------------------------------------------------------------ gestures
  private ndc(x: number, y: number) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  }

  private rayAt(x: number, y: number) {
    const rc = new THREE.Raycaster();
    rc.setFromCamera(this.ndc(x, y), this.camera);
    return rc;
  }

  private pick(x: number, y: number): PlacedCabinet | null {
    const rc = this.rayAt(x, y);
    const hit = rc.intersectObjects(this.items.map((i) => i.obj), true)[0];
    if (!hit) return null;
    return this.items.find((i) => i.obj === hit.object || i.obj.getObjectById(hit.object.id)) ?? null;
  }

  private dragPlane(it: PlacedCabinet): THREE.Plane {
    if (this.mode === 'floor') return new THREE.Plane(new THREE.Vector3(0, 1, 0), -it.obj.position.y);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(it.obj.quaternion);
    return new THREE.Plane().setFromNormalAndCoplanarPoint(n, it.obj.position);
  }

  private onDown = (e: PointerEvent) => {
    if (this.locked) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    if (this.pointers.size === 1) {
      const hit = this.pick(e.clientX, e.clientY);
      if (hit && hit.id !== this.selectedId) this.select(hit.id);
      const it = this.selected;
      if (it) {
        const plane = this.dragPlane(it);
        const p = this.rayAt(e.clientX, e.clientY).ray.intersectPlane(plane, new THREE.Vector3());
        this.drag = p ? { plane, offset: it.obj.position.clone().sub(p) } : null;
      }
    } else if (this.pointers.size === 2) {
      this.drag = null;
      this.startMulti();
    }
  };

  private startMulti() {
    const [a, b] = [...this.pointers.values()];
    // pivot at the selected cabinet's middle so a pinch shrinks it in place (its origin is at the bottom)
    const sel = this.selected;
    const pivot = sel ? sel.obj.position.clone().add(new THREE.Vector3(0, ((sel.obj.userData.size as THREE.Vector3).y * this.scale) / 2, 0)) : new THREE.Vector3();
    this.multi = {
      d0: Math.max(10, Math.hypot(b.x - a.x, b.y - a.y)),
      a0: Math.atan2(b.y - a.y, b.x - a.x),
      s0: this.scale,
      pivot,
      start: this.items.map((i) => ({ obj: i.obj, pos: i.obj.position.clone(), yaw: this.yawOf(i.obj) })),
    };
  }

  private onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p || this.locked) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size === 1 && this.drag && this.selected) {
      const hit = this.rayAt(e.clientX, e.clientY).ray.intersectPlane(this.drag.plane, new THREE.Vector3());
      if (hit) {
        const pos = hit.add(this.drag.offset);
        if (this.mode === 'floor') pos.y = this.selected.obj.position.y;
        this.selected.obj.position.copy(pos);
      }
    } else if (this.pointers.size === 2 && this.multi) {
      const [a, b] = [...this.pointers.values()];
      const m = this.multi;
      const k = THREE.MathUtils.clamp((m.s0 * Math.hypot(b.x - a.x, b.y - a.y)) / m.d0, 0.25, 4) / m.s0;
      const da = Math.atan2(b.y - a.y, b.x - a.x) - m.a0;
      const turn = -da; // clockwise on screen = clockwise seen from above
      this.scale = m.s0 * k;
      for (const st of m.start) {
        const rel = st.pos.clone().sub(m.pivot).multiplyScalar(k).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
        st.obj.position.copy(m.pivot).add(rel);
        st.obj.rotation.set(0, st.yaw + turn, 0);
        st.obj.scale.setScalar(this.scale);
        // floor mode: things stay on the floor (and wall cabinets at their height above it) while scaling
      }
      if (this.mode === 'floor') for (const it of this.items) if (!isWallHung(it.spec.kind)) it.obj.position.y = -CAM_HEIGHT;
    }
  };

  private onUp = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!p) return;
    if (this.pointers.size === 0) {
      if (this.drag) this.snap();
      this.drag = null;
      this.multi = null;
      this.events.onChange?.();
    } else if (this.pointers.size === 1) {
      this.multi = null; // lifting one finger of a pinch: wait for the next gesture
    }
  };

  /** Snap the selected cabinet edge-to-edge with a neighbour of the same kind (wall-hung / floor) when close. */
  private snap() {
    const sel = this.selected;
    if (!sel) return;
    const s = this.scale;
    const yaw = this.yawOf(sel.obj);
    for (const o of this.items) {
      if (o === sel || isWallHung(o.spec.kind) !== isWallHung(sel.spec.kind)) continue;
      const oyaw = this.yawOf(o.obj);
      if (Math.abs(Math.atan2(Math.sin(oyaw - yaw), Math.cos(oyaw - yaw))) > THREE.MathUtils.degToRad(12)) continue;
      // selected position in the neighbour's frame
      const inv = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -oyaw);
      const rel = sel.obj.position.clone().sub(o.obj.position).applyQuaternion(inv);
      const half = ((o.spec.w + sel.spec.w) / 2) * IN * s;
      for (const side of [1, -1]) {
        const gap = Math.abs(rel.x - side * half);
        if (gap < SNAP_DIST * s * 2 && Math.abs(rel.z) < 0.25 * s && Math.abs(rel.y) < 0.6 * s + (o.spec.h * IN * s) / 2) {
          const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), oyaw);
          sel.obj.position.copy(o.obj.position).addScaledVector(right, side * half);
          sel.obj.rotation.set(0, oyaw, 0);
          sel.obj.position.y = isWallHung(sel.spec.kind) ? o.obj.position.y + (o.spec.h - sel.spec.h) * IN * s : o.obj.position.y;
          return;
        }
      }
    }
  }

  // ------------------------------------------------------------------ render
  private frame(hideUi = false) {
    this.updateCamera();
    const sel = this.selected;
    const ref = sel?.obj ?? this.items[0]?.obj;
    if (ref) {
      const yaw = this.yawOf(ref);
      const size = (ref.userData.size as THREE.Vector3).clone().multiplyScalar(this.scale);
      const c = ref.position.clone().add(new THREE.Vector3(0, size.y / 2, size.z / 2).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
      this.sun.target.position.copy(c);
      this.sun.position.copy(c).add(new THREE.Vector3(0.6, 2.6, 2.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
      this.sun.shadow.camera.far = 12;
      if (this.mode === 'floor') {
        this.catcher.rotation.set(-Math.PI / 2, 0, 0);
        this.catcher.position.set(c.x, -CAM_HEIGHT + 0.001, c.z);
      } else {
        // the virtual wall behind the cabinet catches its shadow
        this.catcher.rotation.set(0, yaw, 0);
        this.catcher.position.copy(ref.position).add(new THREE.Vector3(0, size.y / 2, -0.002).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
      }
      this.catcher.visible = true;
    } else this.catcher.visible = false;
    if (sel && !hideUi && this.items.length > 1) {
      const size = sel.obj.userData.size as THREE.Vector3;
      this.outline.visible = true;
      this.outline.position.copy(sel.obj.position);
      this.outline.quaternion.copy(sel.obj.quaternion);
      this.outline.scale.copy(size).multiplyScalar(this.scale * 1.01);
      this.outline.position.copy(sel.obj.position).add(new THREE.Vector3(0, (size.y * this.scale) / 2, (size.z * this.scale) / 2).applyQuaternion(sel.obj.quaternion));
    } else this.outline.visible = false;
    this.renderer.render(this.scene, this.camera);
  }

  /** Camera frame + cabinets composited into one JPEG (plus a small caption). */
  async snapshot(caption: string): Promise<Blob | null> {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const k = Math.min(2, window.devicePixelRatio || 1);
    const out = document.createElement('canvas');
    out.width = Math.round(w * k);
    out.height = Math.round(h * k);
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (vw && vh) {
      const s = Math.max(out.width / vw, out.height / vh);
      const dw = vw * s;
      const dh = vh * s;
      ctx.drawImage(this.video, (out.width - dw) / 2, (out.height - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#2b2724';
      ctx.fillRect(0, 0, out.width, out.height);
    }
    this.frame(true); // drawing buffer is valid until this task yields
    ctx.drawImage(this.renderer.domElement, 0, 0, out.width, out.height);
    if (caption) {
      const pad = 14 * k;
      ctx.font = `600 ${13 * k}px "DM Sans", system-ui, sans-serif`;
      const tw = ctx.measureText(caption).width;
      ctx.fillStyle = 'rgba(20, 17, 14, 0.62)';
      const bh = 30 * k;
      const y = out.height - bh - pad;
      ctx.beginPath();
      ctx.roundRect?.(pad, y, tw + 2 * pad, bh, bh / 2);
      if (!ctx.roundRect) ctx.rect(pad, y, tw + 2 * pad, bh);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(caption, 2 * pad, y + bh / 2);
    }
    return new Promise((r) => out.toBlob((b) => r(b), 'image/jpeg', 0.9));
  }

  /**
   * True-size copy of the arrangement for WebXR (floor placement): relative layout in the selected cabinet's frame,
   * floor-standing cabinets on y = 0, wall-hung ones 54″ up when there is nothing to stack them on.
   */
  arrangement(): THREE.Group | null {
    if (!this.items.length || !this.kit || !this.look) return null;
    const ref = (this.selected ?? this.items[0]).obj;
    const inv = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.yawOf(ref));
    const g = new THREE.Group();
    g.name = 'vulpine_ar_cabinets';
    const placed = this.items.map((it) => {
      const c = buildCabinet(it.spec, this.look!, this.kit!);
      const rel = it.obj.position.clone().sub(ref.position).applyQuaternion(inv).divideScalar(this.scale);
      c.position.copy(rel);
      c.rotation.y = this.yawOf(it.obj) - this.yawOf(ref);
      g.add(c);
      return { it, c };
    });
    const floorItems = placed.filter((p) => !isWallHung(p.it.spec.kind));
    const floorY = floorItems.length ? Math.min(...floorItems.map((p) => p.c.position.y)) : Math.min(...placed.map((p) => p.c.position.y)) - WALL_CABINET_BOTTOM_IN * IN;
    for (const p of placed) p.c.position.y -= floorY;
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    const shift = new THREE.Vector3(-(box.min.x + box.max.x) / 2, 0, -(box.min.z + box.max.z) / 2);
    for (const c of g.children) c.position.add(shift);
    return g;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('deviceorientation', this.onOrientation);
    this.ro.disconnect();
    for (const it of this.items) disposeCabinet(it.obj);
    this.items = [];
    this.catcher.geometry.dispose();
    (this.catcher.material as THREE.Material).dispose();
    this.outline.geometry.dispose();
    (this.outline.material as THREE.Material).dispose();
    this.env.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.video.srcObject = null;
    this.video.remove();
  }
}
