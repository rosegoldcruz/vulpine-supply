import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, 'public', 'materials', 'front');
const outputDir = path.join(sourceDir, 'optimized');

const bytesToKb = (bytes) => (bytes / 1024).toFixed(1);

async function ensureSourceDir() {
  try {
    const stats = await fs.stat(sourceDir);
    if (!stats.isDirectory()) {
      throw new Error('Source path exists but is not a directory.');
    }
  } catch {
    throw new Error(`Missing source folder: ${sourceDir}`);
  }
}

async function optimizeImage(fileName) {
  const sourcePath = path.join(sourceDir, fileName);
  const targetName = fileName.replace(/\.png$/i, '.webp');
  const targetPath = path.join(outputDir, targetName);

  const sourceBuffer = await fs.readFile(sourcePath);
  const sourceSize = sourceBuffer.length;

  const pipeline = sharp(sourceBuffer, { failOn: 'none' }).rotate();
  const metadata = await pipeline.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read dimensions for ${fileName}`);
  }

  const resized = pipeline.resize({
    width: metadata.width > 1600 ? 1600 : metadata.width,
    withoutEnlargement: true,
  });

  const optimizedBuffer = await resized
    .webp({
      quality: 82,
      effort: 5,
      smartSubsample: true,
    })
    .toBuffer();

  await fs.writeFile(targetPath, optimizedBuffer);

  const reductionPct = ((1 - optimizedBuffer.length / sourceSize) * 100).toFixed(1);

  return {
    fileName,
    targetName,
    sourceSize,
    optimizedSize: optimizedBuffer.length,
    reductionPct,
    width: metadata.width,
    height: metadata.height,
  };
}

async function main() {
  await ensureSourceDir();
  await fs.mkdir(outputDir, { recursive: true });

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const pngFiles = entries
    .filter((entry) => entry.isFile() && /\.png$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (pngFiles.length === 0) {
    console.log(`No PNG files found in ${sourceDir}`);
    return;
  }

  console.log(`Optimizing ${pngFiles.length} material images...`);

  let totalSource = 0;
  let totalOptimized = 0;

  for (const fileName of pngFiles) {
    const result = await optimizeImage(fileName);
    totalSource += result.sourceSize;
    totalOptimized += result.optimizedSize;

    console.log(
      [
        `${result.fileName} -> ${result.targetName}`,
        `${result.width}x${result.height}`,
        `${bytesToKb(result.sourceSize)}KB -> ${bytesToKb(result.optimizedSize)}KB`,
        `(${result.reductionPct}% smaller)`,
      ].join(' | ')
    );
  }

  const totalReduction = ((1 - totalOptimized / totalSource) * 100).toFixed(1);
  console.log('');
  console.log(
    `Total: ${bytesToKb(totalSource)}KB -> ${bytesToKb(totalOptimized)}KB (${totalReduction}% smaller)`
  );
  console.log(`Output folder: ${outputDir}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
