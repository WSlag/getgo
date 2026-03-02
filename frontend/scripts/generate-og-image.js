import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputSvg = path.join(__dirname, '../public/social/og-getgo-1200x630.svg');
const outputJpg = path.join(__dirname, '../public/social/og-getgo-1200x630.jpg');

const WIDTH = 1200;
const HEIGHT = 630;
const QUALITY = 90;

async function generateOgImage() {
  await sharp(inputSvg, { density: 300 })
    .resize(WIDTH, HEIGHT, { fit: 'cover' })
    .jpeg({
      quality: QUALITY,
      mozjpeg: true,
      chromaSubsampling: '4:4:4',
    })
    .toFile(outputJpg);

  console.log(`Generated OG image: ${outputJpg}`);
}

generateOgImage().catch((error) => {
  console.error('Failed to generate OG image:', error);
  process.exit(1);
});
