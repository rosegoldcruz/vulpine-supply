import { CONFIG_DATA, FINISH_NAMES } from './data';
import { DEFAULT_LAYOUT, isLayoutId } from './layouts';
import { HARDWARE_INFO } from './product-info';

export const SNAPSHOT_KEY = 'vulpine-configurator-snapshot';

export interface ConfigSelection {
  style: string;
  color: string;
  hw: string;
  finish: string;
  island: boolean;
  /** starting kitchen for the 3D view (see ./layouts); omitted from links when it is the default U-shape */
  layout?: string;
}

/** Catalog pull lengths for a hardware style ("4-1/2\"", "6\""); the visualizer shows pulls only. */
export function pullSizes(hwId: string, sizeImages: { size: string }[]): string[] {
  const spec = HARDWARE_INFO[hwId]?.pulls.map((p) => p.length);
  if (spec?.length) return spec;
  return sizeImages
    .map((s) => s.size)
    .filter((s) => !/knob/i.test(s))
    .map((s) => s.replace(/^pull:?\s*/i, '').trim())
    .filter(Boolean);
}

/** Canonical query string for a design (shared by the share link, the summary page and AR). */
export function configQuery(s: ConfigSelection): URLSearchParams {
  const q = new URLSearchParams({ style: s.style, color: s.color, hw: s.hw, finish: s.finish });
  if (!s.island) q.set('island', '0');
  if (s.layout && s.layout !== DEFAULT_LAYOUT) q.set('layout', s.layout);
  return q;
}

/** Parse + validate a query against the dataset; unknown values fall back to defaults. */
export function parseConfig(q: URLSearchParams): ConfigSelection {
  const styles = Object.keys(CONFIG_DATA.doorStyles);
  const style = CONFIG_DATA.doorStyles[q.get('style') || ''] ? q.get('style')! : styles.includes('shaker_classic') ? 'shaker_classic' : styles[0];
  const opts = CONFIG_DATA.doorStyles[style].options;
  const color = opts.find((o) => o.id === q.get('color'))?.id || opts[0].id;
  const hwKeys = Object.keys(CONFIG_DATA.hardware);
  const hw = CONFIG_DATA.hardware[q.get('hw') || ''] ? q.get('hw')! : hwKeys.includes('arch') ? 'arch' : hwKeys[0];
  const finishes = Object.keys(CONFIG_DATA.hardware[hw].finishes);
  const f = q.get('finish') || '';
  const finish = finishes.includes(f) && FINISH_NAMES[f] ? f : finishes.includes('matte_black') ? 'matte_black' : finishes[0];
  // old links may still carry doors= / knob=: ignored (the chosen pull goes on every front)
  const l = q.get('layout') || '';
  const layout = isLayoutId(l) && l !== DEFAULT_LAYOUT ? l : undefined;
  return { style, color, hw, finish, island: q.get('island') !== '0', ...(layout ? { layout } : {}) };
}

/** Short, stable reference for a design (shown on the summary and in the quote request). */
export function designRef(s: ConfigSelection): string {
  const str = configQuery(s).toString();
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return `VH-${(h >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(0, 7)}`;
}
