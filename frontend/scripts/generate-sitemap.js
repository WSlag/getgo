import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getIndexablePublicRoutes } from '../src/config/publicRouteManifest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const distDir = path.join(__dirname, '../dist');
const siteUrl = (process.env.VITE_SITE_URL || 'https://karga.ph').replace(/\/$/, '');

function absoluteUrl(routePath) {
  if (!routePath || routePath === '/') return `${siteUrl}/`;
  return `${siteUrl}${routePath}`;
}

function buildSitemapXml(routes) {
  const entries = routes
    .map((route) => {
      const loc = absoluteUrl(route.canonicalPath || route.path);
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.9</priority>',
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</urlset>',
    '',
  ].join('\n');
}

function writeFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
}

function main() {
  const routes = getIndexablePublicRoutes();
  const xml = buildSitemapXml(routes);

  writeFile(path.join(publicDir, 'sitemap.xml'), xml);

  if (fs.existsSync(distDir)) {
    writeFile(path.join(distDir, 'sitemap.xml'), xml);
  }

  console.log(`Generated sitemap for ${routes.length} indexable routes.`);
}

main();
