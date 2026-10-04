# Building construction states

## Current delivery: shared diagonal presentation

The four user-selected files now live directly under `public/GLB/`:
`building-stage-0.glb`, `building-stage-1.glb`, `building-stage-2.glb`, and
`building-stage-3.glb`. Each includes the same `BuildingPresentation` rotation,
`BuildingGroundAlignment` offset, and `ConstructionReferenceCamera`.

The shared setup is a **−35° model yaw**, **8° downward camera pitch**, **35°
vertical field of view**, and camera position **[0, 1.5369800413, 4.1591258887]**.
The target is **[0, 0.9524530172, 0]**. These are visually selected to match the
supplied screenshot's low three-quarter view, not recovered screenshot metadata.
The model's common ground is Y=0 and its scale is unchanged. There is no path.

Use the embedded camera for every state. Do not auto-center, auto-scale or
auto-frame each partial building. An external viewer may ignore glTF cameras;
select `ConstructionReferenceCamera` in its camera menu when available. A GLB
cannot force an external viewer to use its authored camera. Consumers should
only update camera aspect ratio for their viewport, not recompute framing from
the changing stage bounds. This setup is an endpoint pose, not an animation clip.

`public/GLB/building-presentation.json` records identical numeric settings and
binary-payload hashes. The pose edit preserves every compressed geometry and
texture byte; only scene JSON and chunk offsets change. Stage 3's whole-file hash
therefore changes, while its actual geometry/texture payload remains identical.

```sh
node tools/building-stages/pose.mjs
node tools/building-stages/verify-pose.mjs
```

`pose.mjs` is idempotent and edits only the four selected root-level GLBs and their
presentation manifest. The original pre-pose files were backed up outside Git.
The earlier source-generation layout below is historical; the user's deletions
of those source/assembly paths have not been undone by this pose task. The old
`build.mjs` / `verify.mjs` commands require those generation inputs to be restored
explicitly before reuse.

## Original generation layout

The source is `public/GLB/multifamily-building.glb`, the existing optimized building,
not an AI replacement. The prior `/public/models/` handoff path was incorrect.

## Assets

| State | Asset under `/GLB/building-stages/` | Meaning |
| --- | --- | --- |
| 0 | `building-stage-0.glb` | Ground/base only |
| 1 | `building-stage-1.glb` | Base plus lower third |
| 2 | `building-stage-2.glb` | Base plus lower and middle thirds |
| 3 | `building-stage-3.glb` | Complete original optimized building, byte-identical |
| Assembly | `building-assembly.glb` | All four bands as separately addressable mesh nodes |

Prefer loading the assembly once. Show nodes whose `userData.constructionBand <= stage`.
The named nodes are `stage_0_ground`, `stage_1_lower_third`, `stage_2_middle_third`,
and `stage_3_upper_third`. The standalone files are cumulative alternatives, **not**
four objects to stack on top of each other. All retain the same origin, scale and
orientation. Frame the camera using the full-model bounds from `manifest.json`,
not each stage's bounds, so the ground and camera do not jump between states.

```js
function setConstructionStage(scene, stage) {
  if (!Number.isInteger(stage) || stage < 0 || stage > 3) {
    throw new RangeError('Construction stage must be 0, 1, 2 or 3');
  }
  scene.traverse((node) => {
    const band = node.userData.constructionBand;
    if (Number.isInteger(band)) node.visible = band <= stage;
  });
}
```

The consumer needs Draco and WebP support, just like the optimized source. No
Three/R3F/Lenis dependencies were added to the website by this asset-only task.
There are no animation clips in the building; animate node visibility/transforms
in the future hero. The existing website has not been redesigned or replaced.

## Geometry contract and limitations

The original exterior is fused, not a BIM model with semantic stories. These are
**visual height bands**, not verified construction floors or structural components.
Stage 0 retains the bottom 2.5% of the actual mesh as a thin ground/base slice.
The remaining height is divided into equal thirds along the verified Y-up axis.
This is explicit in the manifest and is not a claimed floor-count measurement.

Triangles intersecting a cut are clipped precisely, interpolating existing UVs,
normals and tangents. Textures are unchanged. No replacement building, invented
interiors, floor plans, structural slabs, dock openings or caps were generated.
The partial stages have open section faces. If closed structural floors are
required, supply a floor-separated architectural model; do not treat these
presentation slices as engineering evidence.

The assembly reconstructs the original surface, with small Draco quantization
differences at the cut boundaries. The standalone stage 3 deliberately preserves
the source byte-for-byte. All generated GLBs remain below 3 MB.

## Reproduce and verify

The isolated asset-tool package does not change the website's dependencies:

```sh
cd tools/building-stages
npm ci --ignore-scripts
npm test
npm run build
npm run verify
```

`build` writes only `public/GLB/building-stages/`. It refuses unexpected transforms,
animation, topology or attributes. It checks that the split conserves source
surface area before compression. `verify` decodes every original optimized GLB
and every stage, checks bounds, attribute/index integrity, exact texture hashes,
the full-stage source hash and the fox's 22 animation clips.
