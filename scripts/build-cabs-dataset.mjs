#!/usr/bin/env node
/**
 * Regenerates public/cabs_clean/dataset.json from the files that actually exist
 * in public/cabs_clean. Output matches the configurator's CONFIG_DATA shape:
 *
 *   doorStyles.<style>.options[] = { id, color, door, kitchen, doorAlt, finish }
 *   hardware.<style>.finishes.<finish> = { pull, withDoor, sizeImages[], altImages[] }
 *
 * Also samples each door color from its swatch (hex + a cropped texture tile in
 * public/configurator/finishes/) so the 3D view has a fallback material.
 *
 * Paths are relative to /cabs_clean/ and are raw (unencoded) file names; the UI
 * URL-encodes them. Add new doors/hardware by dropping files in the folders and
 * rerunning `npm run build:cabs-dataset`.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CABS = path.join(ROOT, 'public', 'cabs_clean');
const OUT = path.join(CABS, 'dataset.json');
const TEX_DIR = path.join(ROOT, 'public', 'configurator', 'finishes');
const IMAGE_RE = /\.(png|jpe?g|webp|avif)$/i;

// ---------------------------------------------------------------- door styles
// Folder name -> style id. Unknown folders are still picked up (id = folder name).
const DOOR_FOLDERS = {
  shaker_classic: 'shaker_classic',
  fusion_in_shaker: 'fusion_shaker',
  fusion_shaker: 'fusion_shaker',
  fusion_in_slide: 'fusion_slide',
  fusion_slide: 'fusion_slide',
  shaker_slide: 'shaker_slide',
  slab: 'slab',
};
const STYLE_NAMES = {
  shaker_classic: 'Shaker Classic',
  // display names match the DuraBuild catalog
  fusion_shaker: 'Fusion Classic',
  fusion_slide: 'Fusion Slide',
  shaker_slide: 'Shaker Slide',
  slab: 'Slab',
};
const STYLE_ORDER = ['shaker_classic', 'fusion_shaker', 'fusion_slide', 'shaker_slide', 'slab'];
const STYLE_TOKENS = new Set(['shaker', 'classic', 'claassic', 'clasic', 'slide', 'slab', 'fusion', 'in']);
const NOISE_TOKENS = new Set(['kitchen', 'door', 'edited', 'copy', 'final']);
// Color spelling fixes / canonical names.
const COLOR_FIXES = {
  platnum: 'platinum',
  platnium: 'platinum',
  expresso: 'espresso',
  graphit: 'graphite',
};
const COLOR_ALIASES = { 'snow gloss white': 'snow gloss' };
const GLOSSY = new Set(['snow_gloss']);
// Display order for colors: catalog order (solids light to dark, gloss, woodgrains, Paint Ready). Unknown colors go last, alphabetically.
const COLOR_ORDER = [
  'flour', 'oat', 'cloudstone', 'sage', 'mist', 'storm', 'graphite', 'slate', 'snow_gloss',
  'nimbus_oak', 'wheat_oak', 'sable_oak', 'cafe_walnut', 'latte_walnut', 'espresso_walnut',
  'platinum_teak', 'urban_teak', 'paint_ready',
];
const colorRank = (id) => (COLOR_ORDER.indexOf(id) + 1 || 99);

// ------------------------------------------------------------------ hardware
const HARDWARE_ORDER = ['arch', 'artisan', 'cottage', 'loft', 'square', 'bar'];
const HARDWARE_DESCRIPTIONS = {
  arch: 'Elegant curved pulls with a timeless silhouette. Perfect for transitional and contemporary kitchens.',
  artisan: 'Handcrafted-inspired pulls bring warmth and character to your cabinets. Ideal for rustic, farmhouse, or eclectic styles.',
  cottage: 'Classic cottage-style hardware with soft curves. Brings a cozy, welcoming feel to any kitchen.',
  loft: 'Sleek industrial-inspired pulls. The perfect choice for modern and urban kitchen designs.',
  square: 'Bold geometric hardware with clean lines. Makes a statement in contemporary and minimalist kitchens.',
  bar: 'Classic bar pulls with a timeless appeal. Versatile enough for any kitchen style.',
};
const HARDWARE_FINISHES = {
  rose_gold: { name: 'Rose Gold', color: '#B76E79', metalness: 0.9, roughness: 0.3 },
  satin_nickel: { name: 'Satin Nickel', color: '#9A9A9A', metalness: 0.9, roughness: 0.38 },
  matte_black: { name: 'Matte Black', color: '#1a1a1a', metalness: 0.4, roughness: 0.65 },
  chrome: { name: 'Chrome', color: '#C0C0C0', metalness: 1, roughness: 0.12 },
};
const FINISH_ORDER = ['rose_gold', 'satin_nickel', 'matte_black', 'chrome'];

// ------------------------------------------------------------------- helpers
const rel = (abs) => path.relative(CABS, abs).split(path.sep).join('/');
const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const listImages = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => IMAGE_RE.test(f) && fs.statSync(path.join(dir, f)).isFile()).sort()
    : [];
const listDirs = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory()).sort()
    : [];
const hashFile = (abs) => crypto.createHash('md5').update(fs.readFileSync(abs)).digest('hex');

/** Strip every trailing image extension ("x.png.png", "x..png") */
function stem(file) {
  let s = file;
  while (IMAGE_RE.test(s)) s = s.replace(IMAGE_RE, '');
  return s.replace(/\.+$/, '').trim();
}

/** Penalty for messy duplicates, lower is better. */
function messScore(file) {
  let score = 0;
  if (/\(\d+\)/.test(file)) score += 4;
  if (/-\d{2,4}x\d{2,4}/.test(file)) score += 2;
  if (/\.(png|jpe?g)\.(png|jpe?g)$/i.test(file) || /\.\.[a-z]+$/i.test(file)) score += 3;
  if (/_\d\b/.test(stem(file))) score += 2;
  if (/[_\s-]$/.test(stem(file))) score += 2;
  if (/\s{2,}/.test(file)) score += 1;
  if (/ - edited/i.test(file)) score -= 1; // the edited crops are the cleaned-up ones
  return score;
}
const byMess = (a, b) => messScore(a) - messScore(b) || a.length - b.length || a.localeCompare(b);

/** Parse a door/kitchen filename into { colorKey, colorName, styleTokens, styleFirst } */
function parseDoorName(file) {
  const raw = stem(file)
    .replace(/\(\d+\)/g, ' ')
    .replace(/-\d{2,4}x\d{2,4}\b/g, ' ')
    .toLowerCase();
  const tokens = raw.split(/[-_\s]+/).filter(Boolean);
  const styleFirst = tokens.length > 0 && STYLE_TOKENS.has(tokens[0]);
  const styleTokens = tokens.filter((t) => STYLE_TOKENS.has(t));
  let color = tokens
    .filter((t) => !STYLE_TOKENS.has(t) && !NOISE_TOKENS.has(t) && !/^\d+$/.test(t))
    .map((t) => COLOR_FIXES[t] || t)
    .join(' ');
  color = COLOR_ALIASES[color] || color;
  return {
    colorKey: color.replace(/\s+/g, '_'),
    colorName: titleCase(color),
    styleTokens,
    styleFirst,
  };
}

function styleFromTokens(tokens) {
  const t = new Set(tokens);
  if (t.has('fusion') && t.has('slide')) return 'fusion_slide';
  if (t.has('fusion')) return 'fusion_shaker';
  if (t.has('slide')) return 'shaker_slide';
  if (t.has('slab')) return 'slab';
  if (t.has('shaker')) return 'shaker_classic';
  return null;
}

// ------------------------------------------------------------- hardware parse
function detectFinish(file) {
  const s = file.toLowerCase().replace(/[^a-z]/g, '');
  if (s.includes('rosegold')) return 'rose_gold';
  if (s.includes('satinnickel') || s.includes('satinnickle')) return 'satin_nickel';
  if (s.includes('chrome')) return 'chrome';
  if (s.includes('matteblack') || s.includes('blackmatte') || s.includes('black')) return 'matte_black';
  return null;
}

const FRACTION_DENOMS = new Set([2, 4, 8, 16, 32, 64]);
function fixFraction(n, d, d2) {
  let num = Number(n);
  let den = Number(d2 || d);
  // "1-6" in these filenames means 1/16 ("Size6 1-6 Inches" = 6 1/16")
  if (!FRACTION_DENOMS.has(den)) {
    const guess = Number(`1${d}`);
    if (FRACTION_DENOMS.has(guess)) den = guess;
  }
  return { num, den };
}
const fmtInches = (whole, frac) =>
  `${whole ? whole : ''}${whole && frac ? ' ' : ''}${frac ? `${frac.num}/${frac.den}` : ''}"`;

/** Returns { label, sortValue } or null when the file is not a size shot. */
function parseSize(file) {
  const s = stem(file).toLowerCase();
  const isKnob = /knob|__k$|_k$/.test(s);
  let inches = null;
  let label = null;

  let m = s.match(/(\d+)(?:\s*in\s*|\s+)(\d+)-(\d+)(?:-(\d+))?/);
  if (m) {
    const frac = fixFraction(m[2], m[3], m[4]);
    inches = Number(m[1]) + frac.num / frac.den;
    label = fmtInches(Number(m[1]), frac);
  } else if ((m = s.match(/_(\d{2,3})(?:-\d)?\s*$/)) && Number(m[1]) >= 64) {
    return { label: `Pull: ${m[1]}mm`, sortValue: 100 + Number(m[1]) / 25.4 };
  } else if ((m = s.match(/(?:^|[\s_-])(\d+)-(\d+)(?=\s|_|$|in)/))) {
    const frac = fixFraction(m[1], m[2]);
    inches = frac.num / frac.den;
    label = fmtInches(0, frac);
  } else if ((m = s.match(/(?:size\s*|_)(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/)) || (m = s.match(/pull-(\d+(?:\.\d+)?)/))) {
    inches = Number(m[1]);
    label = `${Number.isInteger(inches) ? inches : inches}"`;
  } else if (/round-knob|__k$|_k$/.test(s)) {
    return { label: /round/.test(s) ? 'Knob: Round' : 'Knob', sortValue: 0 };
  } else if (/_scale$/.test(s)) {
    return { label: 'Pull', sortValue: 50 };
  } else {
    return null;
  }
  const kind = isKnob || inches < 2 ? 'Knob' : 'Pull';
  const shape = kind === 'Knob' && /t-?knob/.test(s) ? ' T-knob' : '';
  return { label: `${kind}: ${label}${shape}`, sortValue: (kind === 'Knob' ? 0 : 10) + inches };
}

function classifyHardware(file) {
  const s = stem(file).toLowerCase();
  const tokens = s.split(/[-_\s]+/).filter(Boolean);
  if (tokens.includes('with') || tokens.includes('tpull')) return { type: 'withDoor' };
  const size = parseSize(file);
  if (size) return { type: 'size', ...size };
  return { type: 'pull' };
}

// ------------------------------------------------------------------ sampling
let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('sharp not available: door finish colors/textures will not be sampled.');
}

async function sampleSwatch(absPath, id) {
  if (!sharp) return {};
  const img = sharp(absPath);
  const { width, height } = await img.metadata();
  // center of the door panel, away from the frame and the pull
  const left = Math.round(width * 0.32);
  const top = Math.round(height * 0.3);
  const w = Math.round(width * 0.4);
  const h = Math.round(height * 0.4);
  const region = sharp(absPath).extract({ left, top, width: w, height: h }).removeAlpha();
  const { data } = await region.clone().resize(1, 1, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const color = `#${[...data.subarray(0, 3)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  fs.mkdirSync(TEX_DIR, { recursive: true });
  const texFile = path.join(TEX_DIR, `${id}.jpg`);
  await region.clone().resize(512, 512, { fit: 'cover' }).jpeg({ quality: 82 }).toFile(texFile);
  return { color, texture: `/configurator/finishes/${id}.jpg` };
}

// ---------------------------------------------------------------------- main
async function main() {
  const warnings = [];

  // Kitchen renders (kitchens/ folder) keyed by style + color
  const kitchenRenders = {};
  for (const f of listImages(path.join(CABS, 'kitchens')).sort(byMess)) {
    const p = parseDoorName(f);
    const style = styleFromTokens(p.styleTokens);
    if (!style || !p.colorKey) {
      warnings.push(`kitchens/${f}: could not detect style/color`);
      continue;
    }
    const key = `${style}:${p.colorKey}`;
    if (!kitchenRenders[key]) kitchenRenders[key] = `kitchens/${f}`;
  }

  const doorStyles = {};
  const swatchForColor = {}; // colorKey -> { abs, style }
  const colorNames = {};
  const usedKitchens = new Set();
  const missing = [];

  const folders = listDirs(path.join(CABS, 'doors'));
  const styleIds = [...new Set(folders.map((f) => DOOR_FOLDERS[f] || f))].sort(
    (a, b) => (STYLE_ORDER.indexOf(a) + 1 || 99) - (STYLE_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b),
  );

  for (const styleId of styleIds) {
    const options = {};
    for (const folder of folders.filter((f) => (DOOR_FOLDERS[f] || f) === styleId)) {
      const dir = path.join(CABS, 'doors', folder);
      for (const f of listImages(dir).sort(byMess)) {
        const p = parseDoorName(f);
        if (!p.colorKey) {
          warnings.push(`doors/${folder}/${f}: no color in filename`);
          continue;
        }
        colorNames[p.colorKey] = colorNames[p.colorKey] || p.colorName;
        const opt = (options[p.colorKey] ||= { id: p.colorKey, color: p.colorName, door: null, kitchen: null, doorAlt: null });
        const relPath = `doors/${folder}/${f}`;
        // Style-first names ("shaker-classic-storm.png") are the door swatches;
        // color-first ones ("Storm-Shaker_Kitchen.jpg") are alternate door shots.
        if (p.styleFirst) opt.door ||= relPath;
        else opt.doorAlt ||= relPath;
      }
    }
    const list = [];
    for (const opt of Object.values(options).sort((a, b) => colorRank(a.id) - colorRank(b.id) || a.id.localeCompare(b.id))) {
      opt.door ||= opt.doorAlt;
      if (opt.doorAlt === opt.door) opt.doorAlt = null;
      const k = kitchenRenders[`${styleId}:${opt.id}`];
      if (k) {
        opt.kitchen = k;
        usedKitchens.add(k);
      } else {
        missing.push(`${styleId}/${opt.id}: no kitchen render`);
      }
      opt.finish = opt.id;
      const prev = swatchForColor[opt.id];
      // slab swatches are flat, so they give the cleanest color sample
      if (!prev || (styleId === 'slab' && prev.style !== 'slab')) {
        swatchForColor[opt.id] = { abs: path.join(CABS, opt.door), style: styleId };
      }
      list.push(opt);
    }
    if (!list.length) continue;
    doorStyles[styleId] = { name: STYLE_NAMES[styleId] || titleCase(styleId.replace(/_/g, ' ')), options: list };
  }

  for (const [key, k] of Object.entries(kitchenRenders)) {
    if (!usedKitchens.has(k)) missing.push(`${key.replace(':', '/')}: kitchen render has no door swatch (${k})`);
  }

  // Door finishes (unique colors), sampled from the swatches
  const doorFinishes = {};
  for (const [id, { abs }] of Object.entries(swatchForColor).sort(([a], [b]) => a.localeCompare(b))) {
    const sampled = await sampleSwatch(abs, id).catch((e) => {
      warnings.push(`sample ${id}: ${e.message}`);
      return {};
    });
    doorFinishes[id] = {
      name: colorNames[id],
      ...sampled,
      roughness: GLOSSY.has(id) ? 0.18 : /walnut|oak|teak/.test(id) ? 0.62 : 0.55,
      textured: /walnut|oak|teak/.test(id),
    };
  }

  // Hardware
  const hardware = {};
  const hwDirs = listDirs(path.join(CABS, 'hardware')).sort(
    (a, b) => (HARDWARE_ORDER.indexOf(a) + 1 || 99) - (HARDWARE_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b),
  );
  for (const hw of hwDirs) {
    const dir = path.join(CABS, 'hardware', hw);
    const buckets = {};
    const seenHashes = new Set();
    for (const f of listImages(dir).sort(byMess)) {
      const h = hashFile(path.join(dir, f));
      if (seenHashes.has(h)) continue; // byte-identical duplicate
      seenHashes.add(h);
      const finish = detectFinish(f);
      if (!finish) {
        warnings.push(`hardware/${hw}/${f}: unknown finish`);
        continue;
      }
      const b = (buckets[finish] ||= { pulls: [], withDoor: [], sizes: new Map() });
      const c = classifyHardware(f);
      const relPath = `hardware/${hw}/${f}`;
      if (c.type === 'withDoor') b.withDoor.push(relPath);
      else if (c.type === 'pull') b.pulls.push(relPath);
      else if (!b.sizes.has(c.label)) b.sizes.set(c.label, { size: c.label, image: relPath, sort: c.sortValue });
      else b.pulls.push(relPath); // duplicate size shot -> keep as alt
    }
    const finishes = {};
    const finishKeys = Object.keys(buckets).sort(
      (a, b) => FINISH_ORDER.indexOf(a) - FINISH_ORDER.indexOf(b),
    );
    for (const fk of finishKeys) {
      const b = buckets[fk];
      const sizeImages = [...b.sizes.values()].sort((x, y) => x.sort - y.sort).map(({ size, image }) => ({ size, image }));
      const pull = b.pulls[0] || sizeImages[0]?.image || b.withDoor[0];
      if (!pull) continue;
      finishes[fk] = {
        pull,
        withDoor: b.withDoor[0] || null,
        sizeImages,
        altImages: [...b.pulls.slice(1), ...b.withDoor.slice(1)],
      };
      if (!b.withDoor[0]) missing.push(`hardware ${hw}/${fk}: no on-door shot`);
    }
    hardware[hw] = {
      name: titleCase(hw.replace(/_/g, ' ')),
      description: HARDWARE_DESCRIPTIONS[hw] || `${titleCase(hw)} hardware in curated finishes.`,
      finishes,
    };
  }

  const dataset = {
    $comment: 'Generated by scripts/build-cabs-dataset.mjs from the files in public/cabs_clean. Do not edit by hand; rerun `npm run build:cabs-dataset`.',
    basePath: '/cabs_clean/',
    doorStyles,
    doorFinishes,
    hardware,
    hardwareFinishes: HARDWARE_FINISHES,
    missing,
  };

  // Every referenced path must exist on disk
  const refs = [];
  for (const s of Object.values(doorStyles)) for (const o of s.options) refs.push(o.door, o.kitchen, o.doorAlt);
  for (const h of Object.values(hardware))
    for (const f of Object.values(h.finishes)) refs.push(f.pull, f.withDoor, ...f.sizeImages.map((x) => x.image), ...f.altImages);
  const bad = refs.filter(Boolean).filter((r) => !fs.existsSync(path.join(CABS, r)));
  if (bad.length) {
    console.error('Missing files referenced:', bad);
    process.exit(1);
  }

  fs.writeFileSync(OUT, `${JSON.stringify(dataset, null, 2)}\n`);

  const optCount = Object.values(doorStyles).reduce((n, s) => n + s.options.length, 0);
  console.log(`Wrote ${rel(OUT)}`);
  console.log(`  door styles: ${Object.keys(doorStyles).length}, options: ${optCount}, unique colors: ${Object.keys(doorFinishes).length}`);
  for (const [id, s] of Object.entries(doorStyles)) console.log(`    ${id}: ${s.options.map((o) => o.id).join(', ')}`);
  console.log(`  hardware styles: ${Object.keys(hardware).length}`);
  for (const [id, h] of Object.entries(hardware))
    console.log(`    ${id}: ${Object.entries(h.finishes).map(([k, f]) => `${k}(${f.sizeImages.length} sizes${f.withDoor ? ', on-door' : ''})`).join(', ')}`);
  console.log(`  referenced files verified: ${refs.filter(Boolean).length}`);
  if (missing.length) console.log(`  gaps:\n    ${missing.join('\n    ')}`);
  if (warnings.length) console.log(`  warnings:\n    ${warnings.join('\n    ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
