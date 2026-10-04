/**
 * Server-side GLB of a configured cabinet run for Google Scene Viewer (Android phones without WebXR AR).
 * Mirrors the client engine's AR model: kitchen.glb minus room/decor, the door style's fronts swapped in, the finish
 * applied (flat paint, or the wood map via KHR_texture_transform), hardware placed from mounts.json
 * (by_door_style[style].by_style[hw]), floor origin at the run's footprint centre. Uncompressed output (no decoder needed).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { Document, NodeIO, type Material, type Node, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureTransform, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { mergeDocuments, prune, unpartition } from '@gltf-transform/functions';

const PUBLIC = path.join(process.cwd(), 'public');
const DIR = path.join(PUBLIC, 'models', 'configurator');
const AR_EXCLUDE_RE =
  /^(room_|walls?_|floor|baseboard|window|backsplash|sofa|pillow|rug|coffeetable|books|plant|armchair|floorlamp|art\d|fruitbowl|cuttingboard|coffeemaker|utensil|island_stool|island_fruitbowl)/i;
const FINISH_RE = /(^|_)(door|drawer|panel)(_|$)/i;
const HARDWARE_RE = /(^|_)(pull|knob|handle)(_|$)/i;

export interface ArModelQuery {
  style: string;
  color: string;
  hw: string;
  finish: string;
  doors: 'pull' | 'knob';
  island: boolean;
}

let ioPromise: Promise<NodeIO> | null = null;
function getIO() {
  if (!ioPromise) {
    ioPromise = (async () => {
      const draco3d = (await import('draco3dgltf')).default as any;
      return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
    })();
  }
  return ioPromise;
}

const readJson = async (f: string) => JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8'));
const fileExists = (abs: string) =>
  fs
    .access(abs)
    .then(() => true)
    .catch(() => false);
const exists = (f: string) => fileExists(path.join(DIR, f));
let datasetPromise: Promise<any> | null = null;
/** public/cabs_clean/dataset.json (swatch-sampled door finishes), read once. */
const readDataset = () =>
  (datasetPromise ||= fs
    .readFile(path.join(PUBLIC, 'cabs_clean', 'dataset.json'), 'utf8')
    .then((t) => JSON.parse(t))
    .catch(() => null));

function srgbToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
}

function walk(node: Node, fn: (n: Node, inherited: string | null) => void, inherited: string | null = null) {
  const name = node.getName();
  const role = FINISH_RE.test(name) ? 'finish' : HARDWARE_RE.test(name) ? 'hardware' : inherited;
  fn(node, role);
  for (const c of node.listChildren()) walk(c, fn, role);
}

function setMaterial(node: Node, mat: Material) {
  const mesh = node.getMesh();
  if (mesh) for (const p of mesh.listPrimitives()) p.setMaterial(mat);
}

export async function buildArGlb(q: ArModelQuery): Promise<Uint8Array> {
  const io = await getIO();
  const [doc, mounts, finishes] = await Promise.all([io.readBinary(await fs.readFile(path.join(DIR, 'kitchen.glb'))), readJson('mounts.json'), readJson('finishes.json')]);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];

  // 1. drop the room/decor (and the island when hidden)
  const drop = (n: Node) => AR_EXCLUDE_RE.test(n.getName()) || (!q.island && /^island/.test(n.getName()));
  for (const n of [...root.listNodes()]) if (drop(n)) n.dispose();

  // 2. swap in the door style's fronts (same node names + transforms as kitchen.glb)
  const frontsFile = `fronts_${q.style}.glb`;
  if (q.style !== 'shaker_classic' && (await exists(frontsFile))) {
    const fronts = await io.readBinary(await fs.readFile(path.join(DIR, frontsFile)));
    mergeDocuments(doc, fronts);
    const frontsScene = root.listScenes().find((s) => s !== scene)!;
    const sceneNodes = new Map<string, Node>();
    const collect = (n: Node) => {
      sceneNodes.set(n.getName(), n);
      n.listChildren().forEach(collect);
    };
    scene.listChildren().forEach(collect);
    const frontNodes: Node[] = [];
    const collectFronts = (n: Node) => {
      frontNodes.push(n);
      n.listChildren().forEach(collectFronts);
    };
    frontsScene.listChildren().forEach(collectFronts);
    for (const src of frontNodes) {
      const target = sceneNodes.get(src.getName());
      if (target && src.getMesh()) target.setMesh(src.getMesh());
    }
    for (const n of frontNodes) n.dispose();
    frontsScene.dispose();
  }

  // 3. finish + hardware materials
  // DevGod's calibrated finishes.json first; colors it doesn't have yet (Oat, Sage, Cafe Walnut, …) fall back to the
  // swatch-sampled finish in cabs_clean/dataset.json, like the client engine does.
  let fin = finishes?.finishes?.[q.color];
  if (!fin) {
    const df = (await readDataset())?.doorFinishes?.[q.color];
    if (df) fin = { color: df.color, roughness: df.roughness, ...(df.textured && df.texture ? { publicMap: df.texture } : {}) };
  }
  const finishMat = doc.createMaterial('finish').setMetallicFactor(0).setRoughnessFactor(fin?.roughness ?? 0.45);
  const mapPath = fin?.map ? path.join(DIR, fin.map) : fin?.publicMap ? path.join(PUBLIC, fin.publicMap.replace(/^\/+/, '')) : null;
  if (mapPath && (await fileExists(mapPath))) {
    const tex = doc
      .createTexture(q.color)
      .setImage(new Uint8Array(await fs.readFile(mapPath)))
      .setMimeType('image/jpeg');
    finishMat.setBaseColorFactor([1, 1, 1, 1]).setBaseColorTexture(tex);
    if (Array.isArray(fin.repeat)) {
      const tt = doc.createExtension(KHRTextureTransform);
      finishMat.getBaseColorTextureInfo()!.setExtension('KHR_texture_transform', tt.createTransform().setScale(fin.repeat));
    }
  } else {
    finishMat.setBaseColorFactor([...srgbToLinear(fin?.baseColor || fin?.color || '#e1e2de'), 1]);
  }
  const hf = finishes?.hardwareFinishes?.[q.finish] ?? mounts?.hardware?.[q.finish] ?? { color: '#141414', metalness: 0, roughness: 0.62 };
  const hwMat = doc
    .createMaterial('hardware')
    .setBaseColorFactor([...srgbToLinear(hf.color), 1])
    .setMetallicFactor(hf.metalness ?? 1)
    .setRoughnessFactor(hf.roughness ?? 0.4);

  const present = new Map<string, Node>();
  const baked: Node[] = [];
  for (const top of scene.listChildren())
    walk(top, (n, role) => {
      present.set(n.getName(), n);
      if (role === 'finish') setMaterial(n, finishMat);
      if (role === 'hardware') baked.push(n);
    });

  // 4. hardware from mounts.json (the baked pulls are only right for Shaker Classic)
  const hwDoc = await io.readBinary(await fs.readFile(path.join(DIR, 'hardware.glb')));
  mergeDocuments(doc, hwDoc);
  const hwScene = root.listScenes().find((s) => s !== scene)!;
  const templates = new Map<string, Node>(hwScene.listChildren().map((n) => [n.getName(), n]));
  const placed: Node[] = [];
  const recs = mounts?.mounts && typeof mounts.mounts === 'object' ? Object.entries(mounts.mounts as Record<string, any>) : [];
  for (const [key, rec] of recs) {
    const front = String(rec.front ?? key);
    if (!present.has(front)) continue;
    const ds = rec.by_door_style?.[q.style] ?? rec;
    const s = ds.by_style?.[q.hw] ?? rec.by_style?.[q.hw];
    if (!s) continue;
    const knob = q.doors === 'knob' && rec.mount_type === 'door_vertical';
    const tpl = templates.get(knob ? s.knob : s.pull);
    const pos = knob ? s.knob_position : s.position;
    if (!tpl?.getMesh() || !Array.isArray(pos)) continue;
    const n = doc.createNode(`${knob ? 'knob' : 'pull'}_${front}`).setMesh(tpl.getMesh()).setTranslation(pos as [number, number, number]).setRotation(rec.quaternion);
    placed.push(n);
  }
  if (placed.length) {
    for (const b of baked) b.dispose();
    for (const n of placed) {
      setMaterial(n, hwMat);
      scene.addChild(n);
    }
  } else for (const b of baked) setMaterial(b, hwMat);
  for (const n of hwScene.listChildren()) n.dispose();
  hwScene.dispose();

  // 5. floor origin at the footprint centre (the open side of the run faces +Z)
  const wrapper = doc.createNode('vulpine_cabinet_run');
  for (const c of scene.listChildren()) wrapper.addChild(c);
  scene.addChild(wrapper);
  const b = getBounds(scene);
  wrapper.setTranslation([-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2]);

  // 6. clean up + write uncompressed
  for (const ext of root.listExtensionsUsed()) if (ext.extensionName === KHRDracoMeshCompression.EXTENSION_NAME) ext.dispose();
  await doc.transform(prune(), unpartition());
  return io.writeBinary(doc as Document);
}

/** Validates a query against the dataset-shaped ids (anything unknown -> 400 upstream). */
export function parseArQuery(sp: URLSearchParams): ArModelQuery | null {
  const id = (k: string, d: string) => {
    const v = sp.get(k) || d;
    return /^[a-z0-9_]{1,40}$/.test(v) ? v : null;
  };
  const style = id('style', 'shaker_classic');
  const color = id('color', 'flour');
  const hw = id('hw', 'arch');
  const finish = id('finish', 'matte_black');
  if (!style || !color || !hw || !finish) return null;
  return { style, color, hw, finish, doors: sp.get('doors') === 'knob' ? 'knob' : 'pull', island: sp.get('island') !== '0' };
}
