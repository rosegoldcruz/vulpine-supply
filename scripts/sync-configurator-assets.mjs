#!/usr/bin/env node
/**
 * Copies DevGod's configurator 3D assets into public/models/configurator/.
 *
 *   source (default): /workspace/vulpine-configurator/glb/   (override: argv[2] or CONFIGURATOR_ASSETS_SRC)
 *   copies:           kitchen.glb, fronts_<style_id>.glb, hardware.glb, mounts.json, finishes.json, camera_presets.json,
 *                     finishes/ (recursive)
 *                     (README_glb.md, renders, kitchen_v1.glb, v1/, _build/ and no_decoder/ are not copied)
 *
 * Writes public/models/configurator/manifest.json describing what is present so the
 * 3D viewer knows which files it can load. When the source is missing this is a no-op
 * and the configurator keeps using its procedural kitchen.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(process.argv[2] || process.env.CONFIGURATOR_ASSETS_SRC || '/workspace/vulpine-configurator/glb');
const DEST = path.join(ROOT, 'public', 'models', 'configurator');
const STYLE_IDS = ['shaker_classic', 'shaker_slide', 'slab', 'fusion_shaker', 'fusion_slide'];

if (!fs.existsSync(SRC)) {
  console.log(`No configurator assets at ${SRC}; nothing to sync (procedural 3D kitchen stays in use).`);
  process.exit(0);
}

fs.mkdirSync(DEST, { recursive: true });
const copied = [];
const copy = (name) => {
  const from = path.join(SRC, name);
  if (!fs.existsSync(from)) return false;
  const to = path.join(DEST, name);
  if (fs.statSync(from).isDirectory()) fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  copied.push(name);
  return true;
};

const manifest = { kitchen: null, fronts: {}, hardware: null, mounts: null, finishesJson: null, finishesDir: null, cameraPresets: null };
if (copy('kitchen.glb')) manifest.kitchen = '/models/configurator/kitchen.glb';
for (const id of STYLE_IDS) {
  if (copy(`fronts_${id}.glb`)) manifest.fronts[id] = `/models/configurator/fronts_${id}.glb`;
}
// Pick up any extra fronts_<id>.glb files too, so new styles only need new files.
for (const f of fs.readdirSync(SRC)) {
  const m = f.match(/^fronts_(.+)\.glb$/);
  if (m && !manifest.fronts[m[1]] && copy(f)) manifest.fronts[m[1]] = `/models/configurator/${f}`;
}
if (copy('hardware.glb')) manifest.hardware = '/models/configurator/hardware.glb';
if (copy('mounts.json')) manifest.mounts = '/models/configurator/mounts.json';
if (copy('finishes.json')) manifest.finishesJson = '/models/configurator/finishes.json';
if (copy('camera_presets.json')) manifest.cameraPresets = '/models/configurator/camera_presets.json';
if (copy('finishes')) manifest.finishesDir = '/models/configurator/finishes/';

// DevGod's spec notes name the hardware supplier; the site never shows that name (public files are fetchable),
// so scrub it from the copied JSON files and the GLB JSON chunks (node extras). Built from char codes so the name
// is not in this source either.
const SUPPLIER = String.fromCharCode(81, 119, 105, 107, 107, 105, 116);
const scrubText = (t) =>
  t
    .replace(new RegExp(`\\b${SUPPLIER} published`, 'g'), 'Manufacturer published')
    .replace(new RegExp(`${SUPPLIER} (\\d)`, 'gi'), '$1')
    .replace(new RegExp(`${SUPPLIER}'s`, 'gi'), "the manufacturer's")
    .replace(new RegExp(SUPPLIER, 'gi'), 'manufacturer');
const scrubbed = [];
const scrubGlb = (file) => {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) return false; // 'glTF'
  const jsonLen = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) return false; // 'JSON'
  const json = buf.subarray(20, 20 + jsonLen).toString('utf8');
  const clean = scrubText(json);
  if (clean === json) return false;
  let jsonBuf = Buffer.from(clean.trimEnd(), 'utf8');
  const pad = (4 - (jsonBuf.length % 4)) % 4;
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad, 0x20)]);
  const rest = buf.subarray(20 + jsonLen);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(buf.readUInt32LE(4), 4);
  header.writeUInt32LE(20 + jsonBuf.length + rest.length, 8);
  header.writeUInt32LE(jsonBuf.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  fs.writeFileSync(file, Buffer.concat([header, jsonBuf, rest]));
  return true;
};
for (const f of fs.readdirSync(DEST)) {
  const file = path.join(DEST, f);
  if (f.endsWith('.json')) {
    const t = fs.readFileSync(file, 'utf8');
    const clean = scrubText(t);
    if (clean !== t) { fs.writeFileSync(file, clean); scrubbed.push(f); }
  } else if (f.endsWith('.glb') && scrubGlb(file)) scrubbed.push(f);
}

fs.writeFileSync(path.join(DEST, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Synced ${copied.length} item(s) from ${SRC} -> ${path.relative(ROOT, DEST)}`);
for (const c of copied) console.log(`  ${c}`);
if (scrubbed.length) console.log(`  supplier name scrubbed from: ${scrubbed.join(', ')}`);
const missing = [!manifest.kitchen && 'kitchen.glb', ...STYLE_IDS.filter((id) => !manifest.fronts[id]).map((id) => `fronts_${id}.glb`), !manifest.hardware && 'hardware.glb', !manifest.mounts && 'mounts.json', !manifest.finishesJson && 'finishes.json'].filter(Boolean);
if (missing.length) console.log(`  not found (procedural fallback used for these): ${missing.join(', ')}`);

// ---------------------------------------------------------------- starting kitchens (layout picker)
// DevGod: <src>/kitchens/<id>/ (same schema as the U v2 flat files: kitchen.glb, fronts_<style>.glb, hardware.glb,
// mounts.json, camera_presets.json, a 512 px thumbnail) + <src>/kitchens/index.json. Each layout whose folder exists is
// copied to public/models/configurator/kitchens/<id>/ with its own manifest.json; kitchens/index.json lists them for the
// picker. Only existing folders are listed, so no placeholder cards. Until a kitchens/u_v2 folder lands, the U-shape
// is the flat files above. Stopgap: without kitchens/l_living, DevGod's v1 export (<src>/v1/) is the L + living room.
// Finishes (finishes.json + textures) stay shared unless a layout folder brings its own finishes/ directory.
const LAYOUT_IDS = ['u_v2', 'l_living', 'one_wall_island', 'big_l_island', 'one_wall'];
const LAYOUT_NAMES = {
  u_v2: 'U-shape with island',
  l_living: 'L-shape with living room',
  one_wall_island: 'One wall + island',
  big_l_island: 'Big L + island',
  one_wall: 'One wall',
};
const KSRC = path.join(SRC, 'kitchens');
const KDEST = path.join(DEST, 'kitchens');
const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};
const idxJson = readJson(path.join(KSRC, 'index.json'));
const idxEntries = Array.isArray(idxJson) ? idxJson : Array.isArray(idxJson?.kitchens) ? idxJson.kitchens : Array.isArray(idxJson?.layouts) ? idxJson.layouts : [];
const idxById = Object.fromEntries(idxEntries.filter((e) => e && typeof e.id === 'string').map((e) => [e.id, e]));

/** source folder (+ kitchen file name) for a layout, or null when its files have not landed */
function layoutSource(id) {
  const dir = path.join(KSRC, id);
  if (fs.existsSync(dir)) {
    const kitchen = ['kitchen.glb', `kitchen_${id}.glb`, ...fs.readdirSync(dir).filter((f) => /^kitchen.*\.glb$/.test(f))].find((f) => fs.existsSync(path.join(dir, f)));
    if (kitchen) return { dir, kitchen };
  }
  if (id === 'l_living' && fs.existsSync(path.join(SRC, 'v1', 'kitchen_v1.glb'))) return { dir: path.join(SRC, 'v1'), kitchen: 'kitchen_v1.glb', stopgap: true };
  return null;
}

/** true when the GLB's JSON chunk has a node with that exact name */
function glbHasNode(file, name) {
  try {
    const buf = fs.readFileSync(file);
    const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
    return (json.nodes || []).some((n) => n.name === name);
  } catch {
    return true;
  }
}
/** the folder's kitchen / fronts / mounts / presets are byte-identical to the flat files */
function sameAsFlat(src) {
  const same = (a, b) => fs.existsSync(a) && fs.existsSync(b) && fs.readFileSync(a).equals(fs.readFileSync(b));
  const files = fs.readdirSync(src.dir).filter((f) => /\.glb$/.test(f) || f === 'mounts.json' || f === 'camera_presets.json');
  return same(path.join(src.dir, src.kitchen), path.join(SRC, 'kitchen.glb')) && files.every((f) => f === src.kitchen || same(path.join(src.dir, f), path.join(SRC, f)));
}

const THUMB_RE = /^(thumb|thumbnail)(_512)?\.(png|jpe?g|webp)$/i;
const kitchens = [];
fs.mkdirSync(KDEST, { recursive: true });
for (const id of LAYOUT_IDS) {
  const entry = idxById[id] || {};
  const name = LAYOUT_NAMES[id] || entry.name || entry.label; // our homeowner-facing names first
  const out = path.join(KDEST, id);
  const src = layoutSource(id);
  const base = `/models/configurator/kitchens/${id}/`;
  // thumbnail: DevGod's (index entry or file in the folder) wins; else keep one already in public/ (rendered by us)
  const pickThumb = () => {
    const fromIndex = typeof (entry.thumbnail || entry.thumb) === 'string' ? path.join(KSRC, entry.thumbnail || entry.thumb) : null;
    const candidates = [fromIndex, ...(src ? fs.readdirSync(src.dir).filter((f) => THUMB_RE.test(f)).map((f) => path.join(src.dir, f)) : [])].filter(Boolean);
    const from = candidates.find((f) => fs.existsSync(f));
    if (from) {
      const to = path.join(out, `thumb${path.extname(from).toLowerCase()}`);
      fs.mkdirSync(out, { recursive: true });
      fs.copyFileSync(from, to);
      return `${base}${path.basename(to)}`;
    }
    const kept = fs.existsSync(out) ? fs.readdirSync(out).find((f) => /^thumb\.(png|jpe?g|webp)$/i.test(f)) : null;
    return kept ? `${base}${kept}` : null;
  };
  const hasIsland = (file) => (typeof entry.has_island === 'boolean' ? entry.has_island : glbHasNode(file, 'island'));
  // the default U-shape is the flat files synced above; a kitchens/u_v2 folder that is byte-identical to them is not
  // copied a second time (DevGod's u_v2 is "copied as-is")
  if (id === 'u_v2' && (!src || sameAsFlat(src))) {
    if (manifest.kitchen) kitchens.push({ id, name, base: '/models/configurator/', thumb: pickThumb(), hasIsland: hasIsland(path.join(DEST, 'kitchen.glb')) });
    continue;
  }
  if (!src) {
    if (fs.existsSync(out)) fs.rmSync(out, { recursive: true, force: true }); // files gone upstream: no card
    continue;
  }
  // fresh copy (keeps a rendered thumbnail if DevGod has none)
  const keptThumb = fs.existsSync(out) ? fs.readdirSync(out).find((f) => /^thumb\.(png|jpe?g|webp)$/i.test(f)) : null;
  const keptBuf = keptThumb ? fs.readFileSync(path.join(out, keptThumb)) : null;
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  if (keptBuf) fs.writeFileSync(path.join(out, keptThumb), keptBuf);
  const m = { kitchen: null, fronts: {}, hardware: null, mounts: null, finishesJson: null, finishesDir: null, cameraPresets: null };
  const cp = (from, to = from) => {
    const f = path.join(src.dir, from);
    if (!fs.existsSync(f)) return false;
    fs.cpSync(f, path.join(out, to), { recursive: true });
    return true;
  };
  if (cp(src.kitchen, 'kitchen.glb')) m.kitchen = `${base}kitchen.glb`;
  for (const f of fs.readdirSync(src.dir)) {
    const fm = f.match(/^fronts_(.+)\.glb$/);
    if (fm && cp(f)) m.fronts[fm[1]] = `${base}${f}`;
  }
  if (cp('hardware.glb')) m.hardware = `${base}hardware.glb`;
  else if (manifest.hardware) m.hardware = manifest.hardware; // shared hardware.glb (index.json "shared")
  if (cp('mounts.json')) m.mounts = `${base}mounts.json`;
  if (cp('camera_presets.json')) m.cameraPresets = `${base}camera_presets.json`;
  if (fs.existsSync(path.join(src.dir, 'finishes')) && cp('finishes.json') && cp('finishes')) {
    m.finishesJson = `${base}finishes.json`;
    m.finishesDir = `${base}finishes/`;
  }
  // scrub the supplier name here too
  for (const f of fs.readdirSync(out)) {
    const file = path.join(out, f);
    if (f.endsWith('.json')) {
      const t = fs.readFileSync(file, 'utf8');
      const clean = scrubText(t);
      if (clean !== t) fs.writeFileSync(file, clean);
    } else if (f.endsWith('.glb')) scrubGlb(file);
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(m, null, 2)}\n`);
  kitchens.push({ id, name, base, thumb: pickThumb(), hasIsland: hasIsland(path.join(out, 'kitchen.glb')) });
  console.log(`  layout ${id}: ${path.relative(SRC, src.dir) || '.'}${src.stopgap ? ' (stopgap: v1 export)' : ''}, ${Object.keys(m.fronts).length} fronts${m.cameraPresets ? ', camera presets' : ''}`);
}
fs.writeFileSync(path.join(KDEST, 'index.json'), `${JSON.stringify({ default: 'u_v2', kitchens }, null, 2)}\n`);
console.log(`  kitchens/index.json: ${kitchens.map((k) => k.id).join(', ') || 'none'}`);
