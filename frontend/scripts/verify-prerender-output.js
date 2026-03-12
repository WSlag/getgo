import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPrerenderPublicRoutes } from '../src/config/publicRouteManifest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist');
const siteUrl = (process.env.VITE_SITE_URL || 'https://karga.ph').replace(/\/$/, '');

function outputFilePath(routePath) {
  if (routePath === '/') return path.join(distDir, 'index.html');
  if (routePath === '/share') return path.join(distDir, 'share.html');
  if (routePath === '/share-v2') return path.join(distDir, 'share-v2.html');
  return path.join(distDir, routePath.replace(/^\//, ''), 'index.html');
}

function absoluteUrl(routePath) {
  if (!routePath || routePath === '/') return `${siteUrl}/`;
  return `${siteUrl}${routePath}`;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function verifyRoute(route) {
  const filePath = outputFilePath(route.path);
  assert(fs.existsSync(filePath), `Missing prerender output: ${filePath}`);

  const html = fs.readFileSync(filePath, 'utf8');
  const expectedCanonical = absoluteUrl(route.canonicalPath || route.path);

  assert(html.includes('<div id="root"></div>'), `Missing root container in ${filePath}`);
  assert(html.includes(`<title>${route.title}</title>`), `Incorrect title in ${filePath}`);
  assert(html.includes(`rel="canonical" href="${expectedCanonical}"`), `Incorrect canonical in ${filePath}`);
  assert(!/http-equiv=["']refresh["']/i.test(html), `Meta refresh still present in ${filePath}`);
  assert(!/window\.location\.replace\(/i.test(html), `Redirect script still present in ${filePath}`);

  if (route.path !== '/') {
    assert(html.includes('id="prerender-public-content"'), `Missing fallback content in ${filePath}`);
  }
}

function main() {
  const routes = getPrerenderPublicRoutes();
  routes.forEach(verifyRoute);
  console.log(`Verified prerender outputs for ${routes.length} routes.`);
}

main();
