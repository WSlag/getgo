import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPrerenderPublicRoutes } from '../src/config/publicRouteManifest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist');
const indexFile = path.join(distDir, 'index.html');
const siteUrl = (process.env.VITE_SITE_URL || 'https://getgoph.com').replace(/\/$/, '');

function ensureExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

function absoluteUrl(routePath) {
  if (!routePath) return siteUrl;
  if (routePath.startsWith('http://') || routePath.startsWith('https://')) return routePath;
  return `${siteUrl}${routePath}`;
}

function setTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
}

function setMetaByName(html, name, content) {
  const pattern = new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["'][^"']*["']\\s*\\/?\s*>`, 'i');
  const replacement = `<meta name="${name}" content="${content}" />`;
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html.replace('</head>', `    ${replacement}\n  </head>`);
}

function setMetaByProperty(html, property, content) {
  const pattern = new RegExp(`<meta\\s+property=["']${property}["']\\s+content=["'][^"']*["']\\s*\\/?\s*>`, 'i');
  const replacement = `<meta property="${property}" content="${content}" />`;
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html.replace('</head>', `    ${replacement}\n  </head>`);
}

function setCanonical(html, canonical) {
  const replacement = `<link rel="canonical" href="${canonical}" />`;
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    return html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, replacement);
  }
  return html.replace('</head>', `    ${replacement}\n  </head>`);
}

function buildFallbackContent(route) {
  if (route.path === '/') {
    return '';
  }

  const highlights = Array.isArray(route.highlights) ? route.highlights : [];
  const highlightMarkup = highlights.map((highlight) => `<li>${highlight}</li>`).join('');

  return `
    <main id="prerender-public-content" style="max-width:960px;margin:0 auto;padding:48px 24px;font-family:Inter,system-ui,sans-serif;line-height:1.5;">
      <h1 style="margin:0 0 12px;font-size:clamp(1.9rem,3vw,2.8rem);font-weight:800;color:#111827;">${route.heading || route.title}</h1>
      <p style="margin:0 0 20px;color:#374151;font-size:1.05rem;">${route.subheading || route.description}</p>
      <ul style="margin:0 0 24px;padding-left:20px;color:#4b5563;display:grid;gap:8px;">${highlightMarkup}</ul>
      <a href="/" style="display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:999px;background:#f97316;color:#fff;text-decoration:none;font-weight:700;">Open GetGo App</a>
    </main>
  `.trim();
}

function outputFilePath(routePath) {
  if (routePath === '/') return path.join(distDir, 'index.html');
  if (routePath === '/share') return path.join(distDir, 'share.html');
  if (routePath === '/share-v2') return path.join(distDir, 'share-v2.html');

  const normalized = routePath.replace(/^\//, '');
  return path.join(distDir, normalized, 'index.html');
}

function prerenderRoute(template, route) {
  const canonicalUrl = absoluteUrl(route.canonicalPath || route.path);
  const ogImage = absoluteUrl(route.ogImagePath || '/social/og-getgo-1200x630-v2.jpg');
  const ogUrl = absoluteUrl(route.path);

  let html = template;
  html = setTitle(html, route.title);
  html = setMetaByName(html, 'description', route.description);
  html = setMetaByName(html, 'robots', route.robots || 'index,follow');
  html = setMetaByName(html, 'twitter:title', route.title);
  html = setMetaByName(html, 'twitter:description', route.description);
  html = setMetaByName(html, 'twitter:image', ogImage);
  html = setMetaByProperty(html, 'og:title', route.title);
  html = setMetaByProperty(html, 'og:description', route.description);
  html = setMetaByProperty(html, 'og:image', ogImage);
  html = setMetaByProperty(html, 'og:url', ogUrl);
  html = setCanonical(html, canonicalUrl);

  html = html.replace(/<meta\s+http-equiv=["']refresh["'][^>]*>\s*/gi, '');
  html = html.replace(/<script>[\s\S]*?window\.location\.replace\([\s\S]*?<\/script>\s*/gi, '');

  const fallbackContent = buildFallbackContent(route);
  if (fallbackContent) {
    html = html.replace('<div id="root"></div>', `${fallbackContent}\n    <div id="root"></div>`);
  }

  return html;
}

function writeRouteHtml(route, html) {
  const filePath = outputFilePath(route.path);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html, 'utf8');
}

function main() {
  ensureExists(indexFile);
  const template = fs.readFileSync(indexFile, 'utf8');
  const routes = getPrerenderPublicRoutes();

  routes.forEach((route) => {
    const html = prerenderRoute(template, route);
    writeRouteHtml(route, html);
  });

  console.log(`Prerendered ${routes.length} public routes into ${distDir}`);
}

main();
