Material revisions used by the scroll hero

Other original material files are preserved. The hero uses optimized replacements in public/GLB/materials-v2 for models 2, 4, 5, 7, 9, 10, 11, 14 and 15. Other material models and all floor plans remain unchanged.

editMaterialModels.ts contains the browser/Three.js model editing recipe. The development-only /model-review route in /opt/vulpine-supply-hero-preview loads the original models, applies this recipe, and provides a GLTFExporter exportGLB() function for each entry in window.review. Export each binary GLB to a directory, then run:

    npm ci --prefix tools/building-stages
    node tools/material-models/optimize.mjs /path/to/exported-glbs

The optimizer uses Draco geometry compression and WebP textures up to 1024 pixels. verification.json records exported and optimized file sizes.

Model 2 has a rebuilt chrome basin and faucet with teal and copper cups. Model 4 has a teal vanity, chrome basin and fittings, preserved countertop geometry and a front presentation. Models 5 and 7 use clean panel geometry and dark levers to remove scanned lighting blemishes. Model 9 has orange chevron curtains. Models 9, 10, 14 and 15 are oriented toward the camera; models 2 and 11 tilt to show the basin interiors.

Material 3 is retired. The hero contains fifteen materials, arriving in five staggered groups of three.
