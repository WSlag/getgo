import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pwaSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const faviconSizes = [16, 32];
const inputSvg = path.join(__dirname, '../public/icons/getgo-logo.svg');
const outputDir = path.join(__dirname, '../public/icons');

async function generateIcons() {
  console.log('Generating PWA icons from getgo-logo.svg...');

  for (const size of pwaSizes) {
    const outputFile = path.join(outputDir, `icon-${size}x${size}.png`);
    await sharp(inputSvg)
      .resize(size, size)
      .png()
      .toFile(outputFile);
    console.log(`Generated: icon-${size}x${size}.png`);
  }

  for (const size of faviconSizes) {
    const outputFile = path.join(outputDir, `favicon-${size}x${size}.png`);
    await sharp(inputSvg)
      .resize(size, size)
      .png()
      .toFile(outputFile);

    console.log(`Generated: favicon-${size}x${size}.png`);
  }

  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
