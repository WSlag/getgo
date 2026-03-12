import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist');
const indexHtmlPath = path.join(distDir, 'index.html');

const BUDGETS = {
  indexJsGzipBytes: 125 * 1024,
  indexCssGzipBytes: 35 * 1024,
  heroAssetBytes: 450 * 1024,
};

function gzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  return zlib.gzipSync(content).length;
}

function fail(message) {
  console.error(`PERF_BUDGET_FAIL: ${message}`);
  process.exitCode = 1;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function checkExists(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing file: ${filePath}`);
    return false;
  }
  return true;
}

function collectByPattern(dirPath, regex) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath).filter((name) => regex.test(name));
}

function main() {
  if (!checkExists(indexHtmlPath)) return;

  const html = fs.readFileSync(indexHtmlPath, 'utf8');

  if (html.includes('maps-')) {
    fail('maps chunk appears in initial HTML preload chain.');
  }
  if (html.includes('sentry-')) {
    fail('sentry chunk appears in initial HTML preload chain.');
  }

  const assetsDir = path.join(distDir, 'assets');
  const indexJs = collectByPattern(assetsDir, /^index-.*\.js$/);
  const indexCss = collectByPattern(assetsDir, /^index-.*\.css$/);

  if (indexJs.length !== 1) {
    fail(`Expected one index JS bundle, found ${indexJs.length}.`);
  } else {
    const filePath = path.join(assetsDir, indexJs[0]);
    const size = gzipSize(filePath);
    if (size > BUDGETS.indexJsGzipBytes) {
      fail(`Index JS gzip ${formatKb(size)} exceeds ${formatKb(BUDGETS.indexJsGzipBytes)}.`);
    }
  }

  if (indexCss.length !== 1) {
    fail(`Expected one index CSS bundle, found ${indexCss.length}.`);
  } else {
    const filePath = path.join(assetsDir, indexCss[0]);
    const size = gzipSize(filePath);
    if (size > BUDGETS.indexCssGzipBytes) {
      fail(`Index CSS gzip ${formatKb(size)} exceeds ${formatKb(BUDGETS.indexCssGzipBytes)}.`);
    }
  }

  const heroDir = path.join(assetsDir, 'hero');
  const hero1200 = collectByPattern(heroDir, /-1200\.(avif|webp|jpg)$/);
  if (hero1200.length === 0) {
    fail('No generated 1200px hero assets found in dist/assets/hero.');
  } else {
    for (const fileName of hero1200) {
      const fullPath = path.join(heroDir, fileName);
      const size = fs.statSync(fullPath).size;
      if (size > BUDGETS.heroAssetBytes) {
        fail(`Hero asset ${fileName} (${formatKb(size)}) exceeds ${formatKb(BUDGETS.heroAssetBytes)}.`);
      }
    }
  }

  if (!process.exitCode) {
    console.log('Performance budgets passed.');
  }
}

main();
