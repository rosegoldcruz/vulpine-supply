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
- **Pulls only:** the visualizer no longer offers knobs or a doors-vs-drawers choice; every door and drawer gets the
  chosen pull (`engine.ts` always resolves `'pull'`). The `knob_*` resolution above stays in `hardware.ts` for the catalog
  GLB but is not reachable from the UI. Old links with `doors=knob` / `knob=t` still open; those parameters are ignored.
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
- Zoom range: every preset starts pulled back along its view direction (×1.3 on desktop, ×1.5 in portrait/phones) so the
  whole kitchen fits with margin; OrbitControls `maxDistance` is 3× the fitted overview distance (at least 30 m; camera
  far plane 220 m) so pinch-out / wheel-out always has room. `minDistance` is unchanged.
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

## Starting kitchens (layout picker: `layouts.ts`, `scripts/sync-configurator-assets.mjs`)
DevGod exports one folder per starting kitchen: `glb/kitchens/<id>/` (same schema as the flat U v2 files:
`kitchen.glb`, `fronts_*.glb`, `mounts.json`, `camera_presets.json`, optional `hardware.glb` / `finishes/`, a 512 px
`thumb.png`) plus `glb/kitchens/index.json` listing them. Ids / homeowner names: `u_v2` (U-shape with island), `l_living` (L-shape with living room),
`one_wall_island` (One wall with island), `big_l_island` (Big L with island), `one_wall` (One wall).

- `npm run sync:configurator-assets` reads `index.json` and copies **only the kitchens whose folder exists**
  to `public/models/configurator/kitchens/<id>/`, with a per-kitchen `manifest.json`. A kitchen without its own
  `hardware.glb` uses the shared one; finishes stay shared (`/models/configurator/finishes`) unless the folder has its own.
  `u_v2` is byte-identical to the flat files, so it maps to the flat base `/models/configurator/` and only its thumbnail is
  copied: **the flat U v2 files stay the default**. `has_island` (or a node scan of `kitchen.glb`) hides the Island toggle
  for kitchens without one. The homeowner names in `layouts.ts` win over the export's names. Output:
  `public/models/configurator/kitchens/index.json` `{ default: 'u_v2', kitchens: [{ id, name, base, thumb, hasIsland }] }`.
- `fetchLayouts()` loads the index; the "Start with a kitchen" cards (thumbnail + name) show only when there are 2+
  kitchens. Picking one sets `?layout=`, switches to 3D and remounts the scene with that base
  (`new Engine(container, { base })`). Camera presets come only from the kitchen's own `camera_presets.json`.
- The summary page, PDF and quote text show "Starting kitchen" when a non-default layout is chosen.

## Save / share / summary / quote
- The URL is the design: `?style=&color=&hw=&finish=[&layout=<kitchen id>][&island=0][&view=3d]` (`layout` is only
  written when it is not the default `u_v2`).
  "Copy link to my design" copies it (Web Share sheet on phones that support it).
- "Design summary" opens `/visualizer/summary` with a reference code (`VH-…`), door + hardware images,
  details table, a QR code back to the design and "Print / Save as PDF" (print stylesheet hides the toolbar).
  When opened from the 3D view a still of the current camera is handed over via `sessionStorage`.
- "Request a quote" (configurator and summary) pre-fills `/request-bid` with the selection and the summary link.

## View in your space (in-page camera AR: `ArStudio.tsx`, `scene/ar-camera.ts`, `scene/ar-cabinets.ts`)
The customer never leaves the page. AR Quick Look (USDZ) and Google Scene Viewer are no longer used: the button, the
`?ar=noviewer` path and the Quick Look link are gone (`exportUsdz` stays in `scene/ar.ts` for QA; `/api/ar-model` is still
deployed but nothing links to it).

**Flow.** "View in your space" on a phone/tablet: inside the tap it asks for the rear camera (`getUserMedia`,
`facingMode: environment`) and, on iOS, `DeviceOrientationEvent.requestPermission()` (`scene/ar-detect.ts`
`requestArPermissions`; iOS only shows that prompt inside a user gesture), switches the configurator to 3D in the
background (`ensure3d`, to load the fronts/hardware GLBs) and opens the full-screen **AR studio** (portal on `body`,
z-index 2000, page scroll locked, Esc / × closes and stops the camera). The fox stays out of it.

**Layers.** The camera stream is a full-screen `<video>` (`object-fit: cover`) with a transparent three.js canvas on top
(alpha renderer, same Neutral tone mapping + RoomEnvironment as the 3D view, a soft key light and a `ShadowMaterial`
catcher: the virtual wall behind the cabinet in wall mode, the floor in floor mode). The canvas vertical FOV is derived
from an assumed ~67° long-side phone camera FOV, corrected for the cover crop.

**Cabinet picker** (`CABINET_TYPES` in `scene/ar-cabinets.ts`; real sizes, inches, no prices):
| Group | Type | Widths | Heights | Depth |
| --- | --- | --- | --- | --- |
| Wall | Wall cabinet `W` (1 door under 24″, 2 doors from 24″) | 12 15 18 24 30 36 | 30 36 42 | 12 |
| Base | Sink base `SB` (false drawer + 2 doors) | 30 33 36 | 34.5 | 24 |
| Base | Drawer + door base `B` (2 drawers at 36″) | 12 15 18 24 30 36 | 34.5 | 24 |
| Base | 3-drawer base `DB` | 12 15 18 24 30 36 | 34.5 | 24 |
| Tall | Pantry `P` (lower doors to ~42″, upper doors above) | 18 24 30 | 84 90 96 | 24 |
| Vanity | Vanity `V` (false front + doors) | 24 30 36 | 34.5 | 21 |
`buildCabinet(spec, look, engine.arKit())` builds the box procedurally: finished sides/top in the current finish
material, 4.5″ toe kick on floor units, the real fronts from `buildFront` in the current door style (Fusion styles get
slab drawer fronts, as in the kitchen), and the catalog hardware piece (`engine.arKit().hardware(style, kind, …)`, cloned
from the engine's hardware GLB library with the shared finish material; procedural fallback): pulls centred on the stile
(2″ in on slab); every front gets a pull. Origin = bottom-centre of the
back face, front = +Z. SKU and size are shown in a tag (`W3030 · 30″ W × 30″ H × 12″ D`).

**Placement.** *On wall* (default): the cabinet hangs upright on a virtual wall plane 1.6 m in front of the phone, facing
the camera, centred where the phone points. *On floor*: floor units stand on a ground plane 1.35 m below the phone
(wall cabinets at 54″ to their bottom), tilted with the phone's pitch. Switching modes re-places the arrangement.

**Tracking (3DoF).** `deviceorientation` (alpha/beta/gamma + screen angle → quaternion, low-pass slerp) rotates the
virtual camera, so the cabinet stays roughly where it was put while the phone turns. Rotation only: walking sideways or
toward the wall is not tracked. Without sensor data (motion denied, desktop) the view is fixed (pitch 0 on wall, −30° on
floor) and a hint says so.

**Gestures** (pointer events on the canvas, `touch-action: none`): tap selects, one-finger drag moves the selected
cabinet in its wall/floor plane, pinch scales the whole arrangement around the selected cabinet's middle (0.25–4×; the
camera mode has no metric depth, so this is how the customer matches the size to the room), two-finger twist turns it
about the vertical. **Lock** turns gestures off. On release, a cabinet within ~6″ (side to side) of a neighbour of the same kind
(wall-hung / floor) snaps edge-to-edge (wall cabinets align their tops). An orange outline marks the selection when there
are 2+ cabinets.

**Bottom bar.** The configurator's own chips in compact form (Style · Color with swatch images · Hardware ·
Finish) change the configurator state, and the AR cabinets rebuild live. Actions: **＋ Add
another** (picker, then placed beside the selected one: same kind → side by side, base under a wall cabinet → 54″
below), **Change** (swap the selected cabinet's type/size), **Remove** (2+ cabinets), **Snapshot** and **Get a quote
with this** (full width, orange).

**Snapshot** composites the current video frame (same cover crop) + the three.js render (outline hidden) + a small
caption (`Vulpine · style · color · hardware`) into a JPEG. The preview has Back, **Save / Share** (`navigator.share`
with the file where supported, else a download) and **Get a quote with this**: closes AR and calls
`FoxGuide.openQuote({ photos: [snapshot], note })`, so the snapshot is already attached in the quote chat's photo step
and the cabinet list goes into the message (if the fox was dismissed he is restored first).

**True-scale (Android, optional).** When `navigator.xr.isSessionSupported('immersive-ar')` is true, a "True-scale AR
(move around it)" button appears. It releases the camera and starts WebXR `immersive-ar` + `hit-test` + `dom-overlay` in
the same page (`startWebXR` in `scene/ar.ts` with the arranged cabinets as the model, no fox): 6DoF, real metres, tap a
floor spot to place. Ending the session returns to the camera studio. If the session fails, a notice says so and the
camera view continues.

| Device | What happens |
| --- | --- |
| iPhone / iPad Safari, Chrome on iOS | Camera studio, 3DoF after the motion prompt (“Allow” is needed once per visit). |
| Android Chrome | Camera studio, 3DoF (no prompt), plus the optional WebXR true-scale button with ARCore. |
| Desktop | A dialog with a QR code for the same design (`view=3d&ar=1`; the phone shows "Tap to view in your space"), plus "Use this computer's camera" which opens the same studio with the webcam (no motion sensor). |
| Camera blocked / no `getUserMedia` (some in-app browsers) | The studio shows a message on a dark background and the cabinet can still be previewed and snapshotted. |

`?debug=1` exposes the studio as `window.__vulpineAr` for tests.
Headless check: Chrome `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream
--use-file-for-fake-video-capture=<kitchen photo>.y4m` with mobile emulation (see `/workspace/shots-tool/ar-v2.mjs`).

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
