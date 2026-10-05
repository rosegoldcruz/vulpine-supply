/**
 * Starting kitchens for the 3D view. DevGod's layouts share the U v2 schema (node names, fronts_<style>.glb,
 * hardware.glb, mounts.json, camera_presets.json); scripts/sync-configurator-assets.mjs copies each one that exists
 * into public/models/configurator/kitchens/<id>/ and lists it in public/models/configurator/kitchens/index.json.
 * The picker shows only the layouts in that index, so a layout appears once its files land: no placeholder cards.
 *
 * The default U-shape (u_v2) is the flat files in public/models/configurator/ and is never written to links.
 */
export const DEFAULT_LAYOUT = 'u_v2';

/** Known ids, in picker order, with homeowner-facing names (the index may override the name). */
export const LAYOUTS: { id: string; name: string }[] = [
  { id: 'u_v2', name: 'U-shape with island' },
  { id: 'l_living', name: 'L-shape with living room' },
  { id: 'one_wall_island', name: 'One wall + island' },
  { id: 'big_l_island', name: 'Big L + island' },
  { id: 'one_wall', name: 'One wall' },
];

export const isLayoutId = (id: string) => LAYOUTS.some((l) => l.id === id);
export const layoutName = (id?: string) => LAYOUTS.find((l) => l.id === (id || DEFAULT_LAYOUT))?.name ?? 'Kitchen';

export interface KitchenLayout {
  id: string;
  name: string;
  /** folder with that layout's manifest.json (+ its GLBs) */
  base: string;
  /** 512 px card image */
  thumb: string | null;
  /** has an island (the Island toggle is hidden otherwise) */
  hasIsland: boolean;
}

export const LAYOUT_INDEX_URL = '/models/configurator/kitchens/index.json';
export const FLAT_BASE = '/models/configurator/';

/** Layouts whose files exist (from the synced index). Without an index only the default U-shape is available. */
export async function fetchLayouts(): Promise<KitchenLayout[]> {
  const fallback: KitchenLayout[] = [{ id: DEFAULT_LAYOUT, name: layoutName(DEFAULT_LAYOUT), base: FLAT_BASE, thumb: null, hasIsland: true }];
  try {
    const r = await fetch(LAYOUT_INDEX_URL, { cache: 'no-cache' });
    if (!r.ok) return fallback;
    const j = (await r.json()) as { kitchens?: Partial<KitchenLayout>[] };
    const list = (j.kitchens ?? [])
      .filter((k): k is KitchenLayout => typeof k?.id === 'string' && isLayoutId(k.id) && typeof k.base === 'string')
      .map((k) => ({ id: k.id, name: k.name || layoutName(k.id), base: k.base, thumb: k.thumb ?? null, hasIsland: k.hasIsland !== false }));
    if (!list.some((k) => k.id === DEFAULT_LAYOUT)) list.unshift(fallback[0]);
    const order = (id: string) => LAYOUTS.findIndex((l) => l.id === id);
    return list.sort((a, b) => order(a.id) - order(b.id));
  } catch {
    return fallback;
  }
}
