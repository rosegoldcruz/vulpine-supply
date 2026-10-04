/**
 * Vulpi's animation set. The re-rigged model (public/GLB/vulpi_fox.glb, DevGod's vulpi_fox_rerig.glb)
 * ships six named clips on a Mixamo-style skeleton, so moves are looked up by name.
 * three.js strips the ":" from node names, so bones load as mixamorigHips, mixamorigLeftHand, …
 * See docs/fox.md.
 */
import * as THREE from 'three';

export type FoxMove = 'idle' | 'wave' | 'talk' | 'point' | 'walk' | 'celebrate';

export const FOX_MOVE_NAMES: FoxMove[] = ['idle', 'wave', 'talk', 'point', 'celebrate', 'walk'];

/** idle / talk / walk loop; wave / point / celebrate play once (they start and end at the rest pose). */
const LOOPING = new Set<FoxMove>(['idle', 'talk', 'walk']);

/** Find each move's clip by its glTF animation name. Missing clips are skipped. */
export function buildFoxClips(animations: THREE.AnimationClip[]): Partial<Record<FoxMove, THREE.AnimationClip>> {
  const out: Partial<Record<FoxMove, THREE.AnimationClip>> = {};
  for (const move of FOX_MOVE_NAMES) {
    const clip = THREE.AnimationClip.findByName(animations, move);
    if (clip) out[move] = clip;
  }
  return out;
}

export function loopFor(move: FoxMove): THREE.AnimationActionLoopStyles {
  return LOOPING.has(move) ? THREE.LoopRepeat : THREE.LoopOnce;
}

/** Crossfade length into a move: 0.3 s between clips, 0.2 s into the walk. */
export function fadeFor(move: FoxMove): number {
  return move === 'walk' ? 0.2 : 0.3;
}

/** The model is Y-up and already faces +Z. */
export const FOX_FACE_PLUS_Z = 0;
