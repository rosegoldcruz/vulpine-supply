# Configurator catalog (DuraBuild)

The configurator shows the full DuraBuild catalog: **5 door styles, 18 colors, 75 style × color combinations** and
6 hardware families. Availability matches the manufacturer's live color picker (Oct 2026):

| style (id → name) | colors | not offered |
|---|---|---|
| `shaker_classic` → Shaker Classic | 15 | Snow Gloss, Platinum Teak, Urban Teak |
| `shaker_slide` → Shaker Slide | 15 | Snow Gloss, Platinum Teak, Urban Teak |
| `slab` → Slab | 17 | Sable Oak |
| `fusion_shaker` → Fusion Classic | 14 | Snow Gloss, Platinum Teak, Urban Teak, Sable Oak |
| `fusion_slide` → Fusion Slide | 14 | Snow Gloss, Platinum Teak, Urban Teak, Sable Oak |

Display names and color order come from `scripts/build-cabs-dataset.mjs` (`STYLE_NAMES`, `COLOR_ORDER`). The ids stay the
same, so shared links, the Fox lines (by id) and the 3D assets keep working.

## Images

- Door swatches: `public/cabs_clean/doors/<folder>/<style>-<color>.png` (style-first names). Kitchen photos:
  `public/cabs_clean/kitchens/<Color>-<Style>_Kitchen.jpg`. Run `npm run build:cabs-dataset` after adding files.
- The 40 combinations added in Oct 2026 (including Oat, Cloudstone, Sage, Cafe Walnut and Paint Ready) use the
  manufacturer's color-chooser renders. Images under 1000 px were upscaled with the same pipeline as the rest of
  `cabs_clean` (Real-ESRGAN realesr-general-x4v3, denoise 0.5; doors capped at 1600 px, kitchens at 2400 px). Woodgrain
  doors used Lanczos + unsharp instead, because the model smeared the grain.
- Paint Ready door renders carried a paintbrush badge. It was removed by filling that area from the matching Flour render
  (the two renders are otherwise pixel-identical).
- Hardware: Cottage now has Matte Black (pull cut out from the manufacturer's family photo, upscaled). The Bar T-knob
  photos were already in the set and are now labelled `Knob: 2" T-knob`. The round Bar knob is labelled 1-1/4", and the
  Cottage pulls are 4-1/2" and 5-7/8" (the old labels were copied from Artisan).
- Colors that DevGod's `finishes.json` doesn't calibrate yet fall back to the swatch-sampled color/texture in
  `dataset.json` (`doorFinishes`), in the 3D view and in the Scene Viewer GLB (`lib/ar-model.ts`).

## Product copy

`components/configurator/product-info.ts` holds the style, color and hardware details and the *Why DuraBuild* content
(construction, kit contents, ship time, 3-Way Guarantee, FAQ). It is shown by `ProductInfo.tsx`: a **Product details**
drawer for the current pick (opened from the door sample or *Hardware specs*) and the *Why DuraBuild* section under the
final CTA.

Rules for this copy: keep the **DuraBuild** name, never name the manufacturer, and never show prices, fees or
"free"/"no cost" wording.
