import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(__dirname, '../public/assets');
const outDir = path.join(__dirname, '../public/assets/hero');

const variants = [480, 768, 1200];

const sources = [
  { input: 'trucker-phone-cab.png', output: 'truckers' },
  { input: 'warehouse-worker-phone.png', output: 'cargo' },
  { input: 'highway-sunset-truck.png', output: 'network' },
  { input: 'problem-logistics-manager.png', output: 'manage' },
  { input: 'warehouse-worker-phone.png', output: 'solution' },
  { input: 'broker-booking.png', output: 'broker' },
];

async function ensureDirectory(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function buildVariant(inputPath, outputBase, width) {
  const image = sharp(inputPath);

  await image
    .clone()
    .resize({ width, withoutEnlargement: true })
    .avif({ quality: 55, effort: 5 })
    .toFile(`${outputBase}-${width}.avif`);

  await image
    .clone()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 70, effort: 6 })
    .toFile(`${outputBase}-${width}.webp`);

  await image
    .clone()
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toFile(`${outputBase}-${width}.jpg`);
}

async function generateHeroAssets() {
  await ensureDirectory(outDir);

  for (const source of sources) {
    const inputPath = path.join(sourceDir, source.input);
    const outputBase = path.join(outDir, source.output);

    if (!fs.existsSync(inputPath)) {
      throw new Error(`Missing hero source image: ${inputPath}`);
    }

    for (const width of variants) {
      await buildVariant(inputPath, outputBase, width);
    }
  }

  console.log(`Generated hero assets in ${outDir}`);
}

generateHeroAssets().catch((error) => {
  console.error('Failed to generate hero assets:', error);
  process.exit(1);
});
