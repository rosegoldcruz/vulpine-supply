/**
 * Small transparent WebGL stage for Vulpi in the page corner.
 * Renders at <=30 fps only while visible; with reduced motion it renders single still frames.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { buildFoxClips, loopFor, FOX_FACE_PLUS_Z, type FoxMove } from './clips';

export const FOX_MODEL_URL = '/GLB/vulpi_fox.glb';

export class FoxStage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(24, 0.8, 0.05, 20);
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Partial<Record<FoxMove, THREE.AnimationAction>> = {};
  private current: THREE.AnimationAction | null = null;
  private clock = new THREE.Clock();
  private acc = 0;
  private visible = true;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private onVis = () => this.syncLoop();
  private disposed = false;
  reducedMotion = false;
  move: FoxMove = 'idle';

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    const c = this.renderer.domElement;
    Object.assign(c.style, { width: '100%', height: '100%', display: 'block' });
    c.setAttribute('aria-hidden', 'true');
    host.appendChild(c);
    this.scene.add(new THREE.HemisphereLight('#fff8ef', '#7d6f63', 2.0));
    const key = new THREE.DirectionalLight('#fff3e3', 1.6);
    key.position.set(2, 3, 2.5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#dfe8ff', 0.8);
    rim.position.set(-2, 2, -2);
    this.scene.add(rim);
    this.io = new IntersectionObserver((e) => {
      this.visible = e[0]?.isIntersecting ?? true;
      this.syncLoop();
    });
    this.io.observe(host);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    document.addEventListener('visibilitychange', this.onVis);
    this.resize();
  }

  async load(): Promise<void> {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));
    const gltf = await loader.loadAsync(FOX_MODEL_URL);
    if (this.disposed) return;
    const fox = gltf.scene;
    fox.rotation.y = FOX_FACE_PLUS_Z - 0.5; // face the viewer, turned a little toward the page (screen left)
    this.scene.add(fox);
    const clips = buildFoxClips(gltf.animations, fox);
    this.mixer = new THREE.AnimationMixer(fox);
    for (const [move, clip] of Object.entries(clips) as [FoxMove, THREE.AnimationClip][]) {
      const a = this.mixer.clipAction(clip);
      a.setLoop(loopFor(move), Infinity);
      a.clampWhenFinished = true;
      this.actions[move] = a;
    }
    this.mixer.addEventListener('finished', () => this.play('idle'));
    // frame the full body (1 m tall)
    this.camera.position.set(0, 0.62, 3.3);
    this.camera.lookAt(0, 0.5, 0);
    this.play('idle', 0);
    this.syncLoop();
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderStill();
  }

  /** Cross-fade to a move. One-shot moves (wave, point, celebrate) return to idle on their own. */
  play(move: FoxMove, fade = 0.35) {
    const next = this.actions[move] ?? this.actions.idle;
    if (!next || !this.mixer) return;
    this.move = move;
    if (this.reducedMotion) {
      // a single representative pose, no motion
      this.mixer.stopAllAction();
      next.reset().play();
      this.mixer.setTime(move === 'idle' || move === 'talk' ? 0.5 : next.getClip().duration * 0.6);
      this.current = next;
      this.renderStill();
      return;
    }
    if (next === this.current && move === 'idle') return;
    next.reset().setEffectiveWeight(1).play();
    if (this.current && this.current !== next) this.current.crossFadeTo(next, fade, false);
    this.current = next;
    this.syncLoop();
  }

  setReducedMotion(on: boolean) {
    this.reducedMotion = on;
    this.play(this.move === 'talk' ? 'talk' : 'idle');
    this.syncLoop();
  }

  private renderStill() {
    if (this.mixer) this.mixer.update(0);
    this.renderer.render(this.scene, this.camera);
  }

  private syncLoop() {
    const run = !this.disposed && this.visible && !document.hidden && !this.reducedMotion && Boolean(this.mixer);
    if (!run) {
      this.renderer.setAnimationLoop(null);
      return;
    }
    this.clock.getDelta();
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(0.1, this.clock.getDelta());
      this.acc += dt;
      if (this.acc < 1 / 30) return;
      this.mixer!.update(this.acc);
      this.acc = 0;
      this.renderer.render(this.scene, this.camera);
    });
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.io.disconnect();
    this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => {
          Object.values(mm as any).forEach((v: any) => v?.isTexture && v.dispose());
          mm.dispose();
        });
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
