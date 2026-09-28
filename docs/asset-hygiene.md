# Asset Hygiene Findings

No files were deleted or renamed during this task.

## Flagged Assets

| Path | Reason flagged | Referenced by current code | Recommended action |
| --- | --- | --- | --- |
| `public/logos/my-nigga.png` | Inappropriate filename for production brand. | No reference found in current `app`, `components`, or `lib` source scan. | Rename to professional filename or remove if unused after visual verification. |
| `public/marketing/Screenshot 2025-11-21 115011.png` | Temporary screenshot/export-style filename with spaces and future-looking timestamp. | No reference found in current source scan. | Rename with product/usage-specific name or remove if unused. |
| `public/marketing/1200 x 900.png` | Generic export dimensions as filename with spaces. | No reference found in current source scan. | Rename if needed or remove if unused. |
| `public/GLB/kitchen island.glb` | Filename contains space. | No reference found in current source scan. | Rename to `kitchen-island.glb` before production use. |
| `public/marketing/panels decor.jpeg` | Filename contains space and unclear naming. | No reference found in current source scan. | Rename to descriptive slug. |
| `public/cabs_clean/hardware.zip` | Raw ZIP in public assets may be unnecessary and large. | No reference found in current source scan. | Move out of public or remove after confirming not needed. |
| `public/sitemap.xml` and `public/sitemap-0.xml` | Generated build artifacts are committed. | Served as public static files. | Keep only if intentional; otherwise let `next-sitemap` generate during build. |
| `public/material_cards_front/*` and `public/materials/front/*` | Apparent duplicate material card asset sets. | `public/materials/front/optimized/*` is likely used via material data; verify before removal. | Consolidate after reference check and visual regression test. |
| `public/a.gif`, `public/c.gif`, `public/d.gif`, `public/gif.gif`, `public/giff.gif`, `public/hi.gif` | Ambiguous temporary names. | No reference found in current source scan. | Rename or remove after visual verification. |
| `public/cabs_clean/kitchens/Storm-Fusion-Shaker_Kitchen (1).jpg` | Duplicate-copy filename marker. | No reference found in current source scan. | Rename or deduplicate. |
| `public/cabs_clean/kitchens/Storm-Fusion-Slide_Kitchen (1).jpg` | Duplicate-copy filename marker. | No reference found in current source scan. | Rename or deduplicate. |
| `public/cabs_clean/kitchens/Storm-Shaker_Kitchen (1).jpg` | Duplicate-copy filename marker. | No reference found in current source scan. | Rename or deduplicate. |
| `public/cabs_clean/doors/shaker_classic/shaker-claassic-latte-walnut.png` | Typo in filename. | Likely dataset referenced; exact current source reference not found. | Rename only with dataset/code update. |
| `public/cabs_clean/doors/slab/slab-platnum-teak.png` | Typo in filename. | Likely dataset referenced; exact current source reference not found. | Rename only with dataset/code update. |
| `public/cabs_clean/hardware/**/*.png.png` | Double file extension appears in multiple files. | Likely visualizer/data asset set; exact current source reference not found. | Normalize names during asset catalog migration. |
| `public/cabs_clean/hardware/**/* - Edited.png` | Temporary edited-export naming. | Likely visualizer/data asset set; exact current source reference not found. | Normalize names during asset catalog migration. |

## Notes

- A full unused-asset determination requires parsing dynamic image path construction and `public/cabs_clean/dataset.json`.
- Do not bulk-delete assets before the catalog and visualizer migration because some assets may be referenced indirectly through data.

