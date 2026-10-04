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
| Fox for AR | `public/GLB/vulpi_fox.glb` (1.0 m tall, Draco + WebP) | — |

Without `kitchen.glb` the engine builds a procedural kitchen (`scene/procedural.ts`), so the page always works.

### Hardware resolution (GLB mode, `scene/hardware.ts`)
`mounts.json` can be flat (`{ mounts: { <front>: {...} } }`) or keyed per door style
(`mounts[<styleId>]`, `mounts.styles[<styleId>]`, or `<styleId>` at the root); the set for the current door style is
used and hardware is re-placed on every style change. Per mount:
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
| **Android, Chrome** (ARCore / Google Play Services for AR) | WebXR `immersive-ar` with `hit-test` (+ `dom-overlay`). An orange ring marks the floor; tap places the run (front edge on the ring, facing you); one-finger drag rotates; tap the floor again to move; "Reset rotation", "Exit AR". | Floor-only hits (surface normal pointing up). Needs HTTPS. Samsung Internet / Firefox Android: no WebXR AR → QR/fallback message. |
| **iPhone / iPad**, Safari and every iOS browser (all WebKit) | The configuration is exported to USDZ in the browser (`USDZExporter`, textures ≤1024 px, ~10–15 MB) and opened in **AR Quick Look** via `<a rel="ar">` with `allowsContentScaling=0` (true scale, no pinch-scaling). Plane anchoring: horizontal. | First tap may say "Preparing your AR model…" (≈1 s on a recent iPhone); the USDZ is cached per configuration. The fox is exported in its rest pose (no animation). |
| **Desktop** (or any browser without AR) | A dialog with a QR code for the same configured URL plus `view=3d&ar=1`. Opening that on a phone pre-loads the 3D scene and the button pulses "Tap to view in your space" (AR must start from a tap). | Copy-link button in the dialog. |
| Android without ARCore, AR blocked by permissions | Error message with a "Show QR code" link. | |

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
