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
