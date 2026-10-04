# Cabinet configurator: 3D, AR and design summary

Route: `/configurator` (component `components/configurator/CabinetConfigurator.tsx`).
Printable summary: `/configurator/summary?…` (same query string; `noindex`, excluded from the sitemap).
**No pricing anywhere**: the configurator, summary, AR and quote hand-off carry selections only.

## Data and assets

| What | Where | Regenerate |
| --- | --- | --- |
| Door styles, colors, hardware, photos (`CONFIG_DATA` shape) | `public/cabs_clean/dataset.json` | `npm run build:cabs-dataset` |
| DevGod's Blender exports | `public/models/configurator/` (`kitchen.glb`, `fronts_<style>.glb`, `hardware.glb`, `mounts.json`, `finishes.json`, `camera_presets.json`, `finishes/`) | `npm run sync:configurator-assets` (copies from `/workspace/vulpine-configurator/glb/`; wipes stale files, safe to re-run after every re-export) |
| Draco decoder (self-hosted) | `public/draco/` | copied from `node_modules/three/examples/jsm/libs/draco/gltf` |
| Fox for AR | `public/GLB/vulpi_fox.glb` (re-rigged, 1.0 m tall, Y-up, faces +Z, Draco + WebP; old file kept as `vulpi_fox_v1.glb`) | see `docs/fox.md` |
| DuraBuild product copy (drawer + Why DuraBuild) | `components/configurator/product-info.ts` | hand-edited, see `docs/configurator-catalog.md` |

Without `kitchen.glb` the engine builds a procedural kitchen (`scene/procedural.ts`), so the page always works.

### Kitchen v2 (DevGod, 2026-10-04): U-shaped open kitchen
- `kitchen.glb` (2.12 MB, Draco) has 220 nodes: 37 doors (4 glass-front leaves), 35 drawers, 4 decorative door-style panels
  (`door_deco_*`, `island_door_deco_*`), 70 pulls and 61 `island*` nodes. 76 fronts (`FRONT_RE`) swap per style, name for name,
  from `fronts_<style>.glb`. `mounts.json` gives `by_door_style` for all 70 mounted fronts x 5 door styles x 7 hardware styles.
- The U sits at 45° in the file (walls A / B / C, the open side toward -X+Z; the overview camera looks from +Z). The previous
  delivery stays in DevGod's folder as `kitchen_v1.glb` + `v1/` (not synced).
- **Glass doors:** the leaves are ordinary `door_*` fronts (finish + style swap + hardware); the panes are separate
  `glass_<door>` room meshes with their own transparent material. The engine never finishes or swaps them (`GLASS_RE`).
- **Fusion Classic / Fusion Slide** have slab drawer and false fronts (shaker-style doors). The fronts files carry it; the
  procedural fallback does the same (`SLAB_DRAWER_STYLES`).
- `finishes.json` covers all 18 catalog colours, so the server AR model no longer falls back to `dataset.json`; the 3D
  viewer keeps its dataset fallback only for the procedural kitchen or a colour missing from `finishes.json`.

### Hardware resolution (GLB mode, `scene/hardware.ts`)
`mounts.json` can be flat (`{ mounts: { <front>: {...} } }`) or keyed per door style
(`mounts[<styleId>]`, `mounts.styles[<styleId>]`, or `<styleId>` at the root). DevGod's current contract (11:13 export) is
flat mounts in which each record carries `by_door_style[<door style>]` (`anchor`, `position`, `knob_position`, `by_style`).
Pull positions move with the door style: on the four framed styles the pull is centred on the latch stile and ends at the
inside rail edge; on Slab it sits 2-1/2" in; drawers are centred. `normalizeMountSets` resolves one mount list per door
style from those overrides. Hardware is re-placed from the current door style's list on every style swap, including in GLB
mode, and the pulls baked into `kitchen.glb` (correct only for Shaker Classic) are hidden. Per mount:
1. `by_style[<hardware style>]` exact node (`pull_arch_6in`, `knob_arch`, …) at its `position` / `knob_position`;
2. `hardware_catalog[<style>].small|large` by the mount's `size_class`;
3. nearest size of `pull_<style>_<size>` / `knob_<style>`;
4. `pull_generic_*` / `knob_generic`, then legacy `pull_bar` / `knob_round`;
5. procedural shape.
Door placement without exact positions follows `anchor` + `anchor_dir` (pull end at the anchor); drawers are centered.
- **Bar T-knob:** `knob_bar_t` (2" T-knob) is outside the `knob_<style>` rule, so it is requested by name: when the shopper
  picks "T-knobs" (Bar only, `?doors=knob&knob=t`) each door uses `by_style.bar.knob_t` (fallback: `hardware_catalog.bar.knobs.t`)
  at the round knob's `knob_position`. Other styles show "Knobs on doors" only.
- **Cottage** pulls are `pull_cottage_4_5in` / `pull_cottage_5_875in` (4-1/2", 5-7/8"); the old `_4_75in` / `_6_0625in`
  names still resolve to them (`LEGACY_NAMES` in `hardware.ts`). Each placed instance records its source node in
  `userData.hardwareNode` (handy with `?debug=1`).

## 3D view (`scene/engine.ts`)
- Lighting: RoomEnvironment PMREM environment map, sun with 2048² PCF soft shadows, hemisphere + fill;
  Khronos **Neutral** tone mapping so paint colors stay true to the door swatches; `finishes.json` PBR maps
  (`MeshPhysicalMaterial`, clearcoat for Snow Gloss).
- Camera presets (Overview, Uppers, Island, Sink wall, Close-up door) come from DevGod's `camera_presets.json` (engine
  metres; `fov` is three's vertical FOV at 16:9). The FOV is fitted to the stage: wider than 16:9 keeps the vertical FOV;
  narrower keeps the horizontal coverage (portrait keeps 90% of it); past 60° vertical the camera dollies back along the
  view direction instead of going fisheye. The FOV tweens with the fly-in (ease-in-out; instant with
  `prefers-reduced-motion`); any orbit input cancels a fly-to. Without the JSON (procedural kitchen) the old computed
  presets apply and "Sink wall" is hidden. On phones the buttons read "Sink" / "Close-up" so all five fit.
- Decor that blocks a preset (≥12% of a 9x9 ray grid, by fixture: the island pendants in the close-up door view) is hidden
  for that view and comes back once the user orbits more than 0.75 m away or picks another preset.
- The sun's shadow frustum covers the ~7 m room (±6 m).
- Swaps (style, color, hardware, island) cross-fade: the last frame is frozen on an overlay canvas while the new
  configuration is applied underneath, then faded out.
- Loading progress: GLB byte progress (kitchen + hardware on first load, per-style fronts on demand) is shown as a
  progress bar.
- Performance: fronts are lazy-loaded per style; the current + previous style stay cached, older ones are disposed
  (re-fetch hits the HTTP cache). Finish textures are kept for the 3 most recent finishes, older ones disposed.
  Rendering is on-demand (only when the camera moves or the scene changes).

## Save / share / summary / quote
- The URL is the design: `?style=&color=&hw=&finish=[&doors=knob[&knob=t]][&island=0][&view=3d]`.
  "Copy link to my design" copies it (Web Share sheet on phones that support it).
- "Design summary" opens `/configurator/summary` with a reference code (`VH-…`), door + hardware images,
  details table, a QR code back to the design and "Print / Save as PDF" (print stylesheet hides the toolbar).
  When opened from the 3D view a still of the current camera is handed over via `sessionStorage`.
- "Request a quote" (configurator and summary) pre-fills `/request-bid` with the selection and the summary link.

## View in your space (AR, `scene/ar.ts`, `ViewInYourSpace.tsx`)
The AR model is built from the live 3D scene (`ConfiguratorEngine.buildArModel()`): visible cabinetry, counters, sinks,
faucets, appliances and the mounted hardware with the current materials; room shell and decor are left out
(`AR_EXCLUDE_RE`: also the island pendants, flowers, stools, floating shelves and canisters). Meters, Y-up, origin on the
floor under the footprint center. The model is turned so the open side faces +Z: the yaw is the sum of the distinct wall
normals of the non-island fronts (straight run: its normal; U: the back wall's), i.e. +45° for the v2 U, so you look into
the U when you place it. Same rule on the server GLB. Bounds are vertex-precise (`setFromObject(…, true)`).
Vulpi the fox stands just right of the right arm's front end at his authored 1.0 m height (straight run: right of its front
corner); if cabinetry is under his footprint he steps forward until it is clear.
Kitchen v2 with island and fox: 4.72 m wide x 5.33 m deep x 2.74 m (pantry / hood to the ceiling); USDZ ~20.8 MB (under the
~25 MB budget, so the island stays in and nothing is decimated); server GLB 2.5–5.2 MB; the `/api/ar-model` function traces
~8 MB (keep only literal paths under `public/models/configurator/` in `lib/ar-model.ts`: a dynamic join under `public/`
makes the tracer bundle all of `public/`, 520 MB).

| Device / browser | What happens | Notes |
| --- | --- | --- |
| **Android, Chrome** with `immersive-ar` (ARCore / Google Play Services for AR) | WebXR `immersive-ar` with `hit-test` (+ `dom-overlay`). An orange ring marks the floor; tap places the run (front edge on the ring, facing you); one-finger drag rotates; tap the floor again to move; "Reset rotation", "Exit AR". The animated fox idles beside it and waves on placement. | Floor-only hits. Needs HTTPS and `Permissions-Policy: camera=(self), xr-spatial-tracking=(self)` (set in `next.config.js`). From the photo view the first tap loads 3D, the next tap starts AR. If the session fails to start it falls back to Scene Viewer. |
| **Android without WebXR AR** (`isSessionSupported('immersive-ar')` false: Samsung Internet, Firefox, no ARCore…) | **Google Scene Viewer** intent (`mode=ar_preferred`, `resizable=false` = true scale) with a GLB of the exact design built on the server: `GET /api/ar-model/vulpine-design.glb?<config query>` (`lib/ar-model.ts`, gltf-transform: kitchen.glb minus room/decor, the style's fronts, finish colour or wood map via `KHR_texture_transform`, hardware from `mounts.json` `by_door_style`, floor origin, open side turned to +Z; ~2.5–5.2 MB uncompressed for kitchen v2, CDN-cached). | Without ARCore Scene Viewer shows its 3D viewer; without the Google app Chrome returns to the page with `?ar=noviewer` and a message. No fox here. The GLB URL must be publicly reachable (Vercel preview protection would block Google's fetch). |
| **iPhone / iPad** (iPadOS Safari/Chrome report a Mac UA: detected via `maxTouchPoints`) — Safari (`a.relList.supports('ar')`) and Chrome/Edge/Firefox/Google app on iOS | The configuration is exported to USDZ in the browser (`USDZExporter`, textures ≤1024 px) and opened in **AR Quick Look** via `<a rel="ar">` with `allowsContentScaling=0` (true scale). Plane anchoring: horizontal. | The USDZ is **pre-generated** as soon as the 3D scene is up (and again ~1 s after each change), so a single tap opens Quick Look inside the gesture. From the photo view the first tap loads 3D and prepares the model ("Preparing AR…"), then the button says "Tap to view in your space". The fox is baked in his idle pose. |
| **Desktop** (no touch, or a fine pointer and no mobile UA) | A dialog with a QR code for the same configured URL plus `view=3d&ar=1`. | The QR is **only** shown on desktops. |
| Phones/tablets with no AR path (e.g. iOS in-app browsers like Instagram) | A clear message ("open this page in Safari / use Chrome with Google Play Services for AR") with Copy link. Never the QR. | Camera-overlay fallback: later. |

AR starts from the 3D scene: tapping the button in photo mode switches to 3D first, then a second tap starts AR
(browsers require a fresh tap to open an AR session). Live finish/hardware changes made before entering AR are always
reflected because the model is built at tap time.

## Accessibility
- All pickers are `role="radiogroup"` with roving tabindex: Tab into a group, arrow keys / Home / End move and select.
- A polite live region announces the current selection; the 3D canvas has `role="img"` with a description of the
  configuration and is focusable (arrow keys pan, Shift + arrows orbit). Camera presets are plain buttons.
- Images carry alt text (decorative swatch thumbnails inside labeled buttons use empty alt).
- Visible `:focus-visible` outlines; reduced-motion users get instant camera moves and no pulsing.

## Mobile
At ≤700 px a bottom sheet (Style · Color · Hardware · Finish · Quote) gives one-thumb access; opening a tab scrolls the
preview into view and shows horizontally scrolling options. Camera presets move to the bottom of the 3D stage (short
labels "Sink" / "Close-up"; the FOV is fitted to the stage, see 3D view).

## Dev aids
`/configurator?…&view=3d&debug=1` exposes `window.__vulpineConfigurator = { engine, ar }`
(e.g. `engine.debugShow(engine.buildArModel())` previews the AR model; `ar().exportUsdz(...)` tests the export).
Console logs `[configurator] 3D mode: glb|procedural` and the GLB asset inventory on load.
