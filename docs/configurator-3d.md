# Cabinet configurator: 3D, AR and design summary

Route: `/configurator` (component `components/configurator/CabinetConfigurator.tsx`).
Printable summary: `/configurator/summary?…` (same query string; `noindex`, excluded from the sitemap).
**No pricing anywhere**: the configurator, summary, AR and quote hand-off carry selections only.

## Data and assets

| What | Where | Regenerate |
| --- | --- | --- |
| Door styles, colors, hardware, photos (`CONFIG_DATA` shape) | `public/cabs_clean/dataset.json` | `npm run build:cabs-dataset` |
| DevGod's Blender exports | `public/models/configurator/` (`kitchen.glb`, `fronts_<style>.glb`, `hardware.glb`, `mounts.json`, `finishes.json`, `finishes/`) | `npm run sync:configurator-assets` (copies from `/workspace/vulpine-configurator/glb/`; wipes stale files, safe to re-run after every re-export) |
| Draco decoder (self-hosted) | `public/draco/` | copied from `node_modules/three/examples/jsm/libs/draco/gltf` |
| Fox for AR | `public/GLB/vulpi_fox.glb` (re-rigged, 1.0 m tall, Y-up, faces +Z, Draco + WebP; old file kept as `vulpi_fox_v1.glb`) | see `docs/fox.md` |
| DuraBuild product copy (drawer + Why DuraBuild) | `components/configurator/product-info.ts` | hand-edited, see `docs/configurator-catalog.md` |

Without `kitchen.glb` the engine builds a procedural kitchen (`scene/procedural.ts`), so the page always works.

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

## 3D view (`scene/engine.ts`)
- Lighting: RoomEnvironment PMREM environment map, sun with 2048² PCF soft shadows, hemisphere + fill;
  Khronos **Neutral** tone mapping so paint colors stay true to the door swatches; `finishes.json` PBR maps
  (`MeshPhysicalMaterial`, clearcoat for Snow Gloss).
- Camera presets (Overview, Uppers, Island, Close-up door) are computed from the loaded geometry and mounts, fly in
  with an ease-in-out tween (instant with `prefers-reduced-motion`). Any orbit input cancels a fly-to.
- Swaps (style, color, hardware, island) cross-fade: the last frame is frozen on an overlay canvas while the new
  configuration is applied underneath, then faded out.
- Loading progress: GLB byte progress (kitchen + hardware on first load, per-style fronts on demand) is shown as a
  progress bar.
- Performance: fronts are lazy-loaded per style; the current + previous style stay cached, older ones are disposed
  (re-fetch hits the HTTP cache). Finish textures are kept for the 3 most recent finishes, older ones disposed.
  Rendering is on-demand (only when the camera moves or the scene changes).

## Save / share / summary / quote
- The URL is the design: `?style=&color=&hw=&finish=[&doors=knob][&island=0][&view=3d]`.
  "Copy link to my design" copies it (Web Share sheet on phones that support it).
- "Design summary" opens `/configurator/summary` with a reference code (`VH-…`), door + hardware images,
  details table, a QR code back to the design and "Print / Save as PDF" (print stylesheet hides the toolbar).
  When opened from the 3D view a still of the current camera is handed over via `sessionStorage`.
- "Request a quote" (configurator and summary) pre-fills `/request-bid` with the selection and the summary link.

## View in your space (AR, `scene/ar.ts`, `ViewInYourSpace.tsx`)
The AR model is built from the live 3D scene (`ConfiguratorEngine.buildArModel()`): visible cabinetry, counters, sinks,
faucets, appliances and the mounted hardware with the current materials; room shell and decor are left out
(`AR_EXCLUDE_RE`). Meters, Y-up, origin on the floor under the footprint center, open side facing +Z.
Vulpi the fox stands just right of the run's front corner at his authored 1.0 m height.

| Device / browser | What happens | Notes |
| --- | --- | --- |
| **Android, Chrome** with `immersive-ar` (ARCore / Google Play Services for AR) | WebXR `immersive-ar` with `hit-test` (+ `dom-overlay`). An orange ring marks the floor; tap places the run (front edge on the ring, facing you); one-finger drag rotates; tap the floor again to move; "Reset rotation", "Exit AR". The animated fox idles beside it and waves on placement. | Floor-only hits. Needs HTTPS and `Permissions-Policy: camera=(self), xr-spatial-tracking=(self)` (set in `next.config.js`). From the photo view the first tap loads 3D, the next tap starts AR. If the session fails to start it falls back to Scene Viewer. |
| **Android without WebXR AR** (`isSessionSupported('immersive-ar')` false: Samsung Internet, Firefox, no ARCore…) | **Google Scene Viewer** intent (`mode=ar_preferred`, `resizable=false` = true scale) with a GLB of the exact design built on the server: `GET /api/ar-model/vulpine-design.glb?<config query>` (`lib/ar-model.ts`, gltf-transform: kitchen.glb minus room/decor, the style's fronts, finish colour or wood map via `KHR_texture_transform`, hardware from `mounts.json` `by_door_style`, floor origin; ~1.8–2.7 MB uncompressed, CDN-cached). | Without ARCore Scene Viewer shows its 3D viewer; without the Google app Chrome returns to the page with `?ar=noviewer` and a message. No fox here. The GLB URL must be publicly reachable (Vercel preview protection would block Google's fetch). |
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
preview into view and shows horizontally scrolling options. Camera presets move to the bottom of the 3D stage.

## Dev aids
`/configurator?…&view=3d&debug=1` exposes `window.__vulpineConfigurator = { engine, ar }`
(e.g. `engine.debugShow(engine.buildArModel())` previews the AR model; `ar().exportUsdz(...)` tests the export).
Console logs `[configurator] 3D mode: glb|procedural` and the GLB asset inventory on load.
