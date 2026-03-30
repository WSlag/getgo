export const APP_ROUTE_MANIFEST = [
  { tab: 'home', path: '/app/home' },
  { tab: 'tracking', path: '/app/tracking' },
  { tab: 'activity', path: '/app/activity' },
  { tab: 'messages', path: '/app/messages' },
  { tab: 'notifications', path: '/app/notifications' },
  { tab: 'profile', path: '/app/profile' },
  { tab: 'broker', path: '/app/broker' },
  { tab: 'bids', path: '/app/bids' },
  { tab: 'contracts', path: '/app/contracts' },
  { tab: 'help', path: '/app/help' },
  { tab: 'admin', path: '/app/admin' },
  { tab: 'adminPayments', path: '/app/admin-payments' },
  { tab: 'contractVerification', path: '/app/contract-verification' },
];

const APP_ROUTE_BY_TAB = new Map(
  APP_ROUTE_MANIFEST.map((route) => [route.tab, route]),
);

const APP_ROUTE_BY_PATH = new Map(
  APP_ROUTE_MANIFEST.map((route) => [route.path, route]),
);

export function normalizeAppPath(pathname = '/') {
  if (!pathname) return '/';
  const parsed = pathname.split('?')[0].split('#')[0].trim().toLowerCase();
  if (!parsed) return '/';
  if (parsed === '/') return '/';
  return parsed.endsWith('/') ? parsed.slice(0, -1) : parsed;
}

export function isAppShellPath(pathname = '/') {
  const normalized = normalizeAppPath(pathname);
  return normalized === '/app' || normalized.startsWith('/app/');
}

export function getAppRouteByTab(tab = 'home') {
  return APP_ROUTE_BY_TAB.get(String(tab || '').trim()) || null;
}

export function getAppPathByTab(tab = 'home', fallbackPath = '/app/home') {
  const route = getAppRouteByTab(tab);
  return route?.path || fallbackPath;
}

export function getAppRouteByPath(pathname = '/') {
  const normalized = normalizeAppPath(pathname);
  if (normalized === '/app') {
    return getAppRouteByTab('home');
  }
  return APP_ROUTE_BY_PATH.get(normalized) || null;
}

export function getAppTabByPath(pathname = '/', fallbackTab = 'home') {
  const route = getAppRouteByPath(pathname);
  if (route) return route.tab;
  if (isAppShellPath(pathname)) return null;
  return fallbackTab;
}
