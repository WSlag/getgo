import { useEffect } from 'react';
import { getPublicRouteByPath } from '@/config/publicRouteManifest';

function upsertMeta({ selector, attribute = 'content', value }) {
  if (typeof document === 'undefined' || !value) return;
  const element = document.querySelector(selector);
  if (element) {
    element.setAttribute(attribute, value);
  }
}

function getSiteOrigin() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function toAbsoluteUrl(path) {
  const origin = getSiteOrigin();
  if (!origin) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${origin}${path}`;
}

export function usePageMeta(pathname) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const routeMeta = getPublicRouteByPath(pathname) || getPublicRouteByPath('/');
    if (!routeMeta) return;

    document.title = routeMeta.title;

    upsertMeta({ selector: 'meta[name="description"]', value: routeMeta.description });
    upsertMeta({ selector: 'meta[property="og:title"]', value: routeMeta.title });
    upsertMeta({ selector: 'meta[property="og:description"]', value: routeMeta.description });
    upsertMeta({ selector: 'meta[property="og:url"]', value: toAbsoluteUrl(routeMeta.canonicalPath) });
    upsertMeta({ selector: 'meta[property="og:image"]', value: toAbsoluteUrl(routeMeta.ogImagePath) });
    upsertMeta({ selector: 'meta[name="twitter:title"]', value: routeMeta.title });
    upsertMeta({ selector: 'meta[name="twitter:description"]', value: routeMeta.description });
    upsertMeta({ selector: 'meta[name="twitter:image"]', value: toAbsoluteUrl(routeMeta.ogImagePath) });
    upsertMeta({ selector: 'meta[name="robots"]', value: routeMeta.robots });

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', toAbsoluteUrl(routeMeta.canonicalPath));
    }
  }, [pathname]);
}

export default usePageMeta;
