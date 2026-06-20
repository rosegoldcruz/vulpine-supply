import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const srcSvg = resolve(root, 'public', 'logos', 'gold-logo.svg');
const publicDir = resolve(root, 'public');

if (!existsSync(srcSvg)) {
  console.error(`Source SVG not found: ${srcSvg}`);
  process.exit(1);
}

const sizes = [
  { file: 'public/favicon-16x16.png', width: 16, height: 16 },
  { file: 'public/favicon-32x32.png', width: 32, height: 32 },
  { file: 'public/apple-touch-icon.png', width: 180, height: 180 },
  { file: 'public/android-chrome-192x192.png', width: 192, height: 192 },
  { file: 'public/android-chrome-512x512.png', width: 512, height: 512 },
];

async function generate() {
  const svgBuffer = readFileSync(srcSvg);

  // Copy SVG favicon and icon
  writeFileSync(resolve(root, 'public', 'favicon.svg'), svgBuffer);
  console.log('✓ public/favicon.svg');
  writeFileSync(resolve(root, 'public', 'icon.svg'), svgBuffer);
  console.log('✓ public/icon.svg');

  for (const size of sizes) {
    const outPath = resolve(root, size.file);
    await sharp(svgBuffer)
      .resize(size.width, size.height, { fit: 'contain', background: { r: 245, g: 239, b: 231, alpha: 0 } })
      .png()
      .toFile(outPath);
    console.log(`✓ ${size.file} (${size.width}x${size.height})`);
  }

  console.log('\nAll icons generated successfully.');
}

generate().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
