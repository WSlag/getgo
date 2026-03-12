export const PUBLIC_ROUTE_MANIFEST = [
  {
    key: 'home',
    path: '/',
    indexable: true,
    prerender: true,
    title: 'GetGo - Cargo Marketplace in the Philippines',
    description: 'Connect with trusted truckers across the Philippines. Post cargo, receive bids, and ship with confidence.',
    canonicalPath: '/',
    ogImagePath: '/social/og-getgo-1200x630-v2.jpg',
    robots: 'index,follow',
    heading: 'Move Cargo Faster Across the Philippines',
    subheading: 'GetGo connects shippers, truckers, and brokers in one marketplace with transparent bidding and reliable delivery tracking.',
    highlights: ['Verified carriers', 'Transparent pricing', 'Live shipment updates'],
  },
  {
    key: 'shippers',
    path: '/shippers',
    indexable: true,
    prerender: true,
    title: 'GetGo for Shippers - Post Cargo and Get Competitive Bids',
    description: 'Post loads in minutes, receive trucker bids quickly, and manage bookings with confidence on GetGo.',
    canonicalPath: '/shippers',
    ogImagePath: '/social/og-getgo-1200x630-v2.jpg',
    robots: 'index,follow',
    heading: 'For Shippers: Book Trucks in Minutes',
    subheading: 'Reduce manual coordination with a unified cargo posting and bid-management workflow.',
    highlights: ['Fast bid turnaround', 'Trusted trucker profiles', 'Centralized contract records'],
  },
  {
    key: 'truckers',
    path: '/truckers',
    indexable: true,
    prerender: true,
    title: 'GetGo for Truckers - Find Cargo Loads and Maximize Trips',
    description: 'Browse active cargo listings, place bids, and keep your truck moving with smarter route opportunities.',
    canonicalPath: '/truckers',
    ogImagePath: '/social/og-getgo-1200x630-v2.jpg',
    robots: 'index,follow',
    heading: 'For Truckers: Keep Your Fleet Earning',
    subheading: 'Discover open cargo loads, negotiate quickly, and reduce empty return trips.',
    highlights: ['High-intent cargo demand', 'Clear payout flow', 'Route optimization support'],
  },
  {
    key: 'brokers',
    path: '/brokers',
    indexable: true,
    prerender: true,
    title: 'GetGo for Brokers - Refer Deals and Earn Commission',
    description: 'Activate broker workflows, refer cargo or truck listings, and track your commission earnings.',
    canonicalPath: '/brokers',
    ogImagePath: '/social/og-getgo-1200x630-v2.jpg',
    robots: 'index,follow',
    heading: 'For Brokers: Earn from Every Qualified Match',
    subheading: 'Refer listings, monitor conversions, and build recurring commission income with no upfront capital.',
    highlights: ['Referral attribution', 'Commission tracking', 'Low-friction onboarding'],
  },
  {
    key: 'share',
    path: '/share',
    indexable: false,
    prerender: true,
    title: 'GetGo - Your Cargo Marketplace',
    description: 'Connect with trusted truckers across the Philippines. Post cargo, get bids, and ship with confidence.',
    canonicalPath: '/share',
    ogImagePath: '/social/og-getgo-1200x630-v2.jpg',
    robots: 'index,follow',
    heading: 'GetGo Marketplace',
    subheading: 'Open GetGo to post cargo, receive bids, and manage shipments with trusted transport partners.',
    highlights: ['Post cargo quickly', 'Compare bids', 'Track deliveries'],
  },
  {
    key: 'share-v2',
    path: '/share-v2',
    indexable: false,
    prerender: true,
    title: 'GetGo - Your Cargo Marketplace',
    description: 'Connect with trusted truckers across the Philippines. Post cargo, get bids, and ship with confidence.',
    canonicalPath: '/share-v2',
    ogImagePath: '/social/og-getgo-1200x630-v2.jpg',
    robots: 'index,follow',
    heading: 'GetGo Marketplace',
    subheading: 'Open GetGo to post cargo, receive bids, and manage shipments with trusted transport partners.',
    highlights: ['Post cargo quickly', 'Compare bids', 'Track deliveries'],
  },
];

const PUBLIC_ROUTE_MAP = new Map(
  PUBLIC_ROUTE_MANIFEST.map((route) => [route.path.toLowerCase(), route]),
);

export function normalizePublicPath(pathname = '/') {
  if (!pathname) return '/';
  const parsed = pathname.split('?')[0].split('#')[0].trim();
  if (!parsed) return '/';
  if (parsed === '/') return '/';
  return parsed.endsWith('/') ? parsed.slice(0, -1).toLowerCase() : parsed.toLowerCase();
}

export function getPublicRouteByPath(pathname = '/') {
  const normalizedPath = normalizePublicPath(pathname);
  return PUBLIC_ROUTE_MAP.get(normalizedPath) || null;
}

export function getPrerenderPublicRoutes() {
  return PUBLIC_ROUTE_MANIFEST.filter((route) => route.prerender);
}

export function getIndexablePublicRoutes() {
  return PUBLIC_ROUTE_MANIFEST.filter((route) => route.indexable);
}
