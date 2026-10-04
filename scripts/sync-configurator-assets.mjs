#!/usr/bin/env node
/**
 * Copies DevGod's configurator 3D assets into public/models/configurator/.
 *
 *   source (default): /workspace/vulpine-configurator/glb/   (override: argv[2] or CONFIGURATOR_ASSETS_SRC)
 *   copies:           kitchen.glb, fronts_<style_id>.glb, finishes.json, finishes/ (recursive)
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
  fs.cpSync(from, path.join(DEST, name), { recursive: true });
  copied.push(name);
  return true;
};

const manifest = { kitchen: null, fronts: {}, finishesJson: null, finishesDir: null };
if (copy('kitchen.glb')) manifest.kitchen = '/models/configurator/kitchen.glb';
for (const id of STYLE_IDS) {
  if (copy(`fronts_${id}.glb`)) manifest.fronts[id] = `/models/configurator/fronts_${id}.glb`;
}
// Pick up any extra fronts_<id>.glb files too, so new styles only need new files.
for (const f of fs.readdirSync(SRC)) {
  const m = f.match(/^fronts_(.+)\.glb$/);
  if (m && !manifest.fronts[m[1]] && copy(f)) manifest.fronts[m[1]] = `/models/configurator/${f}`;
}
if (copy('finishes.json')) manifest.finishesJson = '/models/configurator/finishes.json';
if (copy('finishes')) manifest.finishesDir = '/models/configurator/finishes/';

fs.writeFileSync(path.join(DEST, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Synced ${copied.length} item(s) from ${SRC} -> ${path.relative(ROOT, DEST)}`);
for (const c of copied) console.log(`  ${c}`);
const missing = [!manifest.kitchen && 'kitchen.glb', ...STYLE_IDS.filter((id) => !manifest.fronts[id]).map((id) => `fronts_${id}.glb`), !manifest.finishesJson && 'finishes.json'].filter(Boolean);
if (missing.length) console.log(`  not found (procedural fallback used for these): ${missing.join(', ')}`);
