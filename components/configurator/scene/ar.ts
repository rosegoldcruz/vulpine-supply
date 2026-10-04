/**
 * "View in your space".
 *   Android / Chrome (ARCore):  WebXR immersive-ar + hit-test. Tap places the run on the floor at true scale,
 *                               one-finger drag rotates it, tapping elsewhere on the floor moves it.
 *   iOS / iPadOS (Safari, and every iOS browser since they all use WebKit): the current configuration is
 *                               exported to USDZ in the browser (three USDZExporter) and opened in AR Quick Look.
 *   Anything else:              the UI shows a QR code for the same configured URL (see ArDialog).
 * Models are meters, Y-up; the cabinet run comes from ConfiguratorEngine.buildArModel().
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { buildFoxClips, fadeFor, loopFor, FOX_FACE_PLUS_Z, type FoxMove } from '../../fox/clips';

// Device detection lives in ./ar-detect (three-free, synchronous at hydration).

/** Vulpi the fox (re-rigged model, see docs/fox.md), stands next to the run in AR. Y-up, 1.0 m tall, faces +Z, feet at y=0. */
export const FOX_URL = '/GLB/vulpi_fox.glb';
const FOX_GAP_M = 0.35;

let foxPromise: Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] } | null> | null = null;

export interface FoxRig {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  play: (move: FoxMove) => void;
}

/** Loads (once) and returns a fresh, posed (idle) clone of the fox with its animation mixer, or null. */
export async function loadFoxRig(): Promise<FoxRig | null> {
  if (!foxPromise) {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));
    foxPromise = loader
      .loadAsync(FOX_URL)
      .then((g) => ({ scene: g.scene, animations: g.animations }))
      .catch((e) => {
        console.warn('[configurator] fox model unavailable for AR', e);
        return null;
      });
  }
  const src = await foxPromise;
  if (!src) return null;
  const root = cloneSkinned(src.scene);
  const clips = buildFoxClips(src.animations);
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<FoxMove, THREE.AnimationAction>();
  for (const [move, clip] of Object.entries(clips) as [FoxMove, THREE.AnimationClip][]) {
    const a = mixer.clipAction(clip);
    a.setLoop(loopFor(move), Infinity);
    a.clampWhenFinished = false; // one-shots end at the rest pose
    actions.set(move, a);
  }
  let current: THREE.AnimationAction | null = null;
  const play = (move: FoxMove) => {
    const next = actions.get(move) ?? actions.get('idle');
    if (!next) return;
    next.reset().play();
    if (current && current !== next) current.crossFadeTo(next, fadeFor(move), false);
    current = next;
  };
  mixer.addEventListener('finished', () => play('idle'));
  play('idle');
  mixer.update(0.8); // a frame into the idle loop (between breaths); this is the pose the USDZ bake freezes
  return { root, mixer, play };
}

/** Static fox (idle pose) for exports. */
export async function loadFox(): Promise<THREE.Object3D | null> {
  return (await loadFoxRig())?.root ?? null;
}

/** Stand the fox on the floor just right of the run's front corner, turned slightly toward it. */
export function placeFox(fox: THREE.Object3D, run: THREE.Object3D) {
  run.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(run);
  fox.position.set(0, 0, 0);
  fox.rotation.set(0, FOX_FACE_PLUS_Z - 0.45, 0); // face the viewer, turned a little toward the run
  fox.updateMatrixWorld(true);
  fox.traverse((o) => {
    const sk = o as THREE.SkinnedMesh;
    if (sk.isSkinnedMesh) {
      sk.skeleton.update();
      sk.computeBoundingBox(); // posed (idle) bounds, not the rest pose
    }
  });
  // posed + turned bounds at the origin (feet are at y=0, hips over the origin)
  const fb = new THREE.Box3().setFromObject(fox);
  const c = fb.getCenter(new THREE.Vector3());
  const half = fb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  fox.position.set(box.max.x + FOX_GAP_M - fb.min.x, -fb.min.y, box.max.z - Math.max(0.4, half.z) - c.z);
  fox.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
}

/** Skinned meshes don't survive USDZ export reliably; bake the current pose into plain meshes. */
function bakeSkinned(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  root.traverse((o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.SkinnedMesh).skeleton.update());
  const out = new THREE.Group();
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    let geom = m.geometry;
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) {
      const sk = m as THREE.SkinnedMesh;
      geom = m.geometry.clone();
      const pos = geom.getAttribute('position');
      const baked = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        sk.getVertexPosition(i, v);
        baked.set([v.x, v.y, v.z], i * 3);
      }
      geom.setAttribute('position', new THREE.BufferAttribute(baked, 3));
      geom.deleteAttribute('skinIndex');
      geom.deleteAttribute('skinWeight');
      geom.computeVertexNormals();
    }
    const c = new THREE.Mesh(geom, m.material);
    c.name = m.name;
    m.matrixWorld.decompose(c.position, c.quaternion, c.scale);
    out.add(c);
  });
  return out;
}

// ---------------------------------------------------------------- iOS: USDZ + AR Quick Look

let lastUsdzUrl: string | null = null;

export async function exportUsdz(run: THREE.Group, withFox = true): Promise<Blob> {
  const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
  const scene = new THREE.Scene();
  scene.add(run);
  if (withFox) {
    const fox = await loadFox();
    if (fox) {
      placeFox(fox, run);
      scene.add(fox);
      scene.updateMatrixWorld(true);
      scene.remove(fox);
      scene.add(bakeSkinned(fox));
    }
  }
  scene.updateMatrixWorld(true);
  const data = await new USDZExporter().parseAsync(scene, {
    quickLookCompatible: true,
    maxTextureSize: 1024,
    ar: { anchoring: { type: 'plane' }, planeAnchoring: { alignment: 'horizontal' } },
  } as any);
  return new Blob([data as unknown as ArrayBuffer], { type: 'model/vnd.usdz+zip' });
}

/** Opens AR Quick Look; allowsContentScaling=0 keeps it at true scale. */
export function openQuickLook(blob: Blob, title?: string) {
  if (lastUsdzUrl) URL.revokeObjectURL(lastUsdzUrl);
  lastUsdzUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.rel = 'ar';
  const params = new URLSearchParams({ allowsContentScaling: '0' });
  if (title) params.set('checkoutTitle', title);
  a.href = `${lastUsdzUrl}#${params.toString()}`;
  a.appendChild(document.createElement('img')); // Quick Look requires an <img> child
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => a.remove(), 2000);
}

// ---------------------------------------------------------------- Android: WebXR immersive-ar

export type XrPhase = 'starting' | 'scanning' | 'aim' | 'placed' | 'ended';

export interface XrSessionHandle {
  end: () => void;
  resetRotation: () => void;
}

/**
 * Must be called from a user gesture (requestSession needs transient activation).
 * overlay: full-screen element shown over the camera feed (dom-overlay); it receives the drag gestures.
 */
export async function startWebXR(opts: {
  buildRun: () => THREE.Group | null;
  overlay: HTMLElement;
  onPhase: (p: XrPhase) => void;
  withFox?: boolean;
}): Promise<XrSessionHandle> {
  const xr = (navigator as any).xr;
  const session: any = await xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'light-estimation'],
    domOverlay: { root: opts.overlay },
  });
  opts.onPhase('starting');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  Object.assign(renderer.domElement.style, { position: 'fixed', inset: '0', opacity: '0', pointerEvents: 'none' });
  document.body.appendChild(renderer.domElement);
  await renderer.xr.setSession(session);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.6;
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a8178', 0.6));
  const sun = new THREE.DirectionalLight('#fff6ea', 1.6);
  sun.position.set(1.5, 4, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.1, far: 10 });
  sun.shadow.bias = -0.0005;

  // anchor = floor point the user tapped; run is offset so its front edge sits on that point
  const anchor = new THREE.Group();
  anchor.visible = false;
  scene.add(anchor);
  anchor.add(sun, sun.target);
  const run = opts.buildRun();
  const content = new THREE.Group();
  anchor.add(content);
  if (run) {
    content.add(run);
    const box = new THREE.Box3().setFromObject(run);
    content.position.z = -box.max.z;
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.28 }));
    const size = box.getSize(new THREE.Vector3());
    catcher.scale.set(size.x + 2, 1, size.z + 2);
    catcher.position.set((box.min.x + box.max.x) / 2, 0.001, (box.min.z + box.max.z) / 2);
    catcher.receiveShadow = true;
    content.add(catcher);
  }
  // animated Vulpi: idles beside the run, waves when it's placed
  let fox: FoxRig | null = null;
  if (opts.withFox !== false && run) {
    loadFoxRig().then((rig) => {
      if (!rig) return;
      placeFox(rig.root, run);
      content.add(rig.root);
      fox = rig;
      if (placed) rig.play('wave');
    });
  }
  const clock = new THREE.Clock();

  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.11, 0.14, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#ee7200', transparent: true, opacity: 0.95 }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const viewerSpace = await session.requestReferenceSpace('viewer');
  const hitSource = await session.requestHitTestSource({ space: viewerSpace });

  let placed = false;
  let userYaw = 0;
  let suppressSelect = false;
  let phase: XrPhase = 'scanning';
  const setPhase = (p: XrPhase) => {
    if (p !== phase) {
      phase = p;
      opts.onPhase(p);
    }
  };
  opts.onPhase('scanning');

  const camPos = new THREE.Vector3();
  const hitMatrix = new THREE.Matrix4();
  session.addEventListener('select', () => {
    if (suppressSelect) {
      suppressSelect = false;
      return;
    }
    if (!reticle.visible) return;
    anchor.position.setFromMatrixPosition(reticle.matrix);
    camPos.setFromMatrixPosition(renderer.xr.getCamera().matrixWorld);
    // face the run's open side (+Z) toward the user
    anchor.rotation.set(0, Math.atan2(camPos.x - anchor.position.x, camPos.z - anchor.position.z) + userYaw, 0);
    const first = !placed;
    anchor.visible = true;
    placed = true;
    setPhase('placed');
    if (first) fox?.play('wave');
  });

  // one-finger drag on the overlay rotates the placed run
  let dragX: number | null = null;
  let moved = 0;
  const down = (e: PointerEvent) => {
    dragX = e.clientX;
    moved = 0;
    suppressSelect = false;
  };
  const move = (e: PointerEvent) => {
    if (dragX == null || !placed) return;
    const dx = e.clientX - dragX;
    dragX = e.clientX;
    moved += Math.abs(dx);
    if (moved > 12) suppressSelect = true;
    const d = dx * 0.012;
    userYaw += d;
    anchor.rotation.y += d;
  };
  const up = () => (dragX = null);
  opts.overlay.addEventListener('pointerdown', down);
  opts.overlay.addEventListener('pointermove', move);
  opts.overlay.addEventListener('pointerup', up);
  opts.overlay.addEventListener('pointercancel', up);

  renderer.setAnimationLoop((_t: number, frame: any) => {
    const dt = Math.min(0.1, clock.getDelta());
    if (fox && anchor.visible) fox.mixer.update(dt);
    if (frame) {
      const ref = renderer.xr.getReferenceSpace();
      const hits = frame.getHitTestResults(hitSource);
      const pose = hits.length && ref ? hits[0].getPose(ref) : null;
      if (pose) {
        hitMatrix.fromArray(pose.transform.matrix);
        // floor-like surfaces only: the hit's +Y must point up
        const upY = hitMatrix.elements[5];
        reticle.visible = upY > 0.85;
        if (reticle.visible) reticle.matrix.copy(hitMatrix);
      } else reticle.visible = false;
      if (!placed) setPhase(reticle.visible ? 'aim' : 'scanning');
    }
    renderer.render(scene, renderer.xr.getCamera());
  });

  const cleanup = () => {
    renderer.setAnimationLoop(null);
    try {
      hitSource?.cancel?.();
    } catch {
      /* already gone */
    }
    opts.overlay.removeEventListener('pointerdown', down);
    opts.overlay.removeEventListener('pointermove', move);
    opts.overlay.removeEventListener('pointerup', up);
    opts.overlay.removeEventListener('pointercancel', up);
    // geometry/materials of the run belong to the configurator engine; only dispose AR-local objects
    reticle.geometry.dispose();
    (reticle.material as THREE.Material).dispose();
    env.dispose();
    content.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).type === 'ShadowMaterial') {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    fox?.mixer.stopAllAction();
    renderer.dispose();
    renderer.domElement.remove();
    opts.onPhase('ended');
  };
  session.addEventListener('end', cleanup);

  return {
    end: () => session.end().catch(() => cleanup()),
    resetRotation: () => {
      anchor.rotation.y -= userYaw;
      userYaw = 0;
    },
  };
}
