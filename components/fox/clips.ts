/**
 * Vulpi's animation set, built from the 22 unnamed "NlaTrack*" clips in the official model
 * (public/GLB/vulpi_fox.glb == /workspace/fox/vulpine-fox.glb). See docs/fox.md for how each was identified.
 *
 * Every source clip starts and ends in the bind (T) pose and many leave one or both arms at the bind pose,
 * so each move is a trimmed segment, and wave / point are composites: the idle body with one arm taken
 * from the gesture clip.
 */
import * as THREE from 'three';

export type FoxMove = 'idle' | 'wave' | 'talk' | 'point' | 'walk' | 'celebrate';

interface MoveSpec {
  /** index of the NlaTrack clip (NlaTrack = 0, NlaTrack.001 = 1, …) */
  clip: number;
  /** segment as fractions of the source clip duration */
  from: number;
  to: number;
  loop: 'repeat' | 'pingpong' | 'once';
  /** composite: only these bones come from `clip`, everything else from the idle segment */
  mask?: RegExp;
  /** drop horizontal root motion (walk in place) */
  inPlace?: boolean;
  /** slerp the masked bones' rotations this far toward the bind pose (bind = arms straight out) */
  towardBind?: number;
}

const L_ARM = /^L_(Clavicle|Upperarm|Forearm|Hand)/;
const R_ARM_LIMB = /^R_(Upperarm|Forearm|Hand)/;
const LEGS = /^(Root|Hip|Pelvis|[LR]_(Thigh|Calf|Foot))/;

export const FOX_MOVES: Record<FoxMove, MoveSpec> = {
  idle: { clip: 4, from: 0.3, to: 0.74, loop: 'pingpong' }, // arms relaxed, slow weight shift
  talk: { clip: 18, from: 0.46, to: 0.84, loop: 'pingpong' }, // explaining hand gestures, head tilts
  wave: { clip: 10, from: 0.37, to: 0.64, loop: 'once', mask: L_ARM }, // left-hand wave over the idle body
  // no clean point in the set: the idle with his right arm raised most of the way to the bind pose (straight out, toward the page)
  point: { clip: 4, from: 0.4, to: 0.52, loop: 'once', mask: R_ARM_LIMB, towardBind: 0.82 },
  walk: { clip: 20, from: 0.06, to: 0.94, loop: 'repeat', inPlace: true, mask: LEGS }, // legs of the walk cycle, relaxed idle upper body
  celebrate: { clip: 3, from: 0.16, to: 0.86, loop: 'once' }, // both arms up, little hop
};

const FPS = 30;

function findClip(clips: THREE.AnimationClip[], index: number): THREE.AnimationClip | undefined {
  const name = index === 0 ? 'NlaTrack' : `NlaTrack.${String(index).padStart(3, '0')}`;
  return clips.find((c) => c.name === name) ?? clips[index];
}

/** Resample every track between t0 and t1 (seconds) into a new clip that starts at 0. */
function segment(clip: THREE.AnimationClip, t0: number, t1: number, name: string, keep?: (track: THREE.KeyframeTrack) => boolean) {
  const n = Math.max(2, Math.round((t1 - t0) * FPS) + 1);
  const tracks: THREE.KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    if (keep && !keep(track)) continue;
    const size = track.getValueSize();
    const interp = track.createInterpolant();
    const times = new Float32Array(n);
    const values = new Float32Array(n * size);
    for (let i = 0; i < n; i++) {
      const t = t0 + ((t1 - t0) * i) / (n - 1);
      times[i] = t - t0;
      values.set(interp.evaluate(t) as ArrayLike<number>, i * size);
    }
    const Ctor = track.constructor as new (name: string, times: Float32Array, values: Float32Array) => THREE.KeyframeTrack;
    tracks.push(new Ctor(track.name, times, values));
  }
  return new THREE.AnimationClip(name, t1 - t0, tracks);
}

const boneOf = (track: THREE.KeyframeTrack) => track.name.split('.')[0];

/**
 * Build the six moves from the GLB's animations. Missing source clips are skipped.
 * root (the loaded scene, before any mixer has run) supplies bind rotations for `towardBind`.
 */
export function buildFoxClips(animations: THREE.AnimationClip[], root?: THREE.Object3D): Partial<Record<FoxMove, THREE.AnimationClip>> {
  const out: Partial<Record<FoxMove, THREE.AnimationClip>> = {};
  const idleSpec = FOX_MOVES.idle;
  const idleSrc = findClip(animations, idleSpec.clip);
  for (const [move, spec] of Object.entries(FOX_MOVES) as [FoxMove, MoveSpec][]) {
    const src = findClip(animations, spec.clip);
    if (!src) continue;
    const t0 = src.duration * spec.from;
    const t1 = src.duration * spec.to;
    let clip: THREE.AnimationClip;
    if (spec.mask && idleSrc) {
      const masked = segment(src, t0, t1, move, (tr) => spec.mask!.test(boneOf(tr)));
      const i0 = idleSrc.duration * idleSpec.from;
      const body = segment(idleSrc, i0, Math.min(idleSrc.duration * idleSpec.to, i0 + (t1 - t0)), `${move}_body`, (tr) => !spec.mask!.test(boneOf(tr)));
      clip = new THREE.AnimationClip(move, t1 - t0, [...body.tracks, ...masked.tracks]);
    } else clip = segment(src, t0, t1, move);
    if (spec.towardBind && spec.mask && root) {
      const q = new THREE.Quaternion();
      const b = new THREE.Quaternion();
      for (const tr of clip.tracks) {
        if (!/\.quaternion$/.test(tr.name) || !spec.mask.test(boneOf(tr))) continue;
        const bone = root.getObjectByName(boneOf(tr));
        if (!bone) continue;
        b.copy(bone.quaternion);
        for (let i = 0; i < tr.values.length; i += 4) {
          q.fromArray(tr.values, i).slerp(b, spec.towardBind).toArray(tr.values, i);
        }
      }
    }
    if (spec.inPlace) {
      for (const tr of clip.tracks) {
        if (!/\.position$/.test(tr.name) || boneOf(tr) !== 'Root') continue;
        const v = tr.values;
        for (let i = 3; i < v.length; i += 3) {
          v[i] = v[0];
          v[i + 2] = v[2];
        }
      }
    }
    out[move] = clip;
  }
  return out;
}

export function loopFor(move: FoxMove): THREE.AnimationActionLoopStyles {
  const l = FOX_MOVES[move].loop;
  return l === 'once' ? THREE.LoopOnce : l === 'pingpong' ? THREE.LoopPingPong : THREE.LoopRepeat;
}

/** The fox's forward axis in the model is +X; this yaw turns him to face +Z. */
export const FOX_FACE_PLUS_Z = -Math.PI / 2;
