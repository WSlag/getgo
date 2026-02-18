import { Router } from 'express';
import admin from 'firebase-admin';
import { db } from '../config/firestore.js';
import { authenticateToken } from '../middleware/auth.js';
import { cityCoordinates, toDate, calculateDistance, maskContactInfo } from '../utils/helpers.js';

const router = Router();

const lower = (v) => (v || '').toString().toLowerCase().trim();

const getCoordinates = (cityName) => {
  if (!cityName) return { lat: 7.5, lng: 124.5 };
  const key = Object.keys(cityCoordinates).find(
    (k) => k.toLowerCase().includes(cityName.toLowerCase()) || cityName.toLowerCase().includes(k.toLowerCase().split(' ')[0])
  );
  return cityCoordinates[key] || { lat: 7.5, lng: 124.5 };
};


const signedCache = new Map();
const hasSignedContract = async (userA, userB) => {
  if (!userA || !userB) return false;
  const key = [userA, userB].sort().join(':');
  if (signedCache.has(key)) return signedCache.get(key);

  const snapshot = await db.collection('contracts').where('participantIds', 'array-contains', userA).limit(200).get();
  const ok = snapshot.docs.some((d) => {
    const c = d.data();
    return ['signed', 'completed'].includes(c.status) && (c.participantIds || []).includes(userB);
  });

  signedCache.set(key, ok);
  return ok;
};

const fetchUsers = async (ids) => {
  const docs = await Promise.all([...new Set(ids.filter(Boolean))].map((id) => db.collection('users').doc(id).get()));
  const map = new Map();
  docs.forEach((doc) => {
    if (doc.exists) map.set(doc.id, { id: doc.id, ...doc.data() });
  });
  return map;
};

const pageSlice = (rows, limit, offset) => {
  const l = Number.isFinite(limit) ? Math.max(1, limit) : 50;
  const o = Number.isFinite(offset) ? Math.max(0, offset) : 0;
  return { total: rows.length, limit: l, offset: o, rows: rows.slice(o, o + l) };
};

const commonFilterSort = (rows, { status, origin, destination, minPrice, maxPrice, sortBy, sortOrder }, type) => {
  let out = rows.filter((r) => (status ? r.status === status : r.status === 'open'));
  if (origin) out = out.filter((r) => lower(r.origin).includes(lower(origin)));
  if (destination) out = out.filter((r) => lower(r.destination).includes(lower(destination)));

  const min = minPrice !== undefined ? Number(minPrice) : null;
  if (Number.isFinite(min)) out = out.filter((r) => Number(r.askingPrice || 0) >= min);
  const max = maxPrice !== undefined ? Number(maxPrice) : null;
  if (Number.isFinite(max)) out = out.filter((r) => Number(r.askingPrice || 0) <= max);

  const valid = type === 'cargo'
    ? ['createdAt', 'askingPrice', 'weight', 'pickupDate']
    : ['createdAt', 'askingPrice', 'capacity', 'availableDate'];
  const field = valid.includes(sortBy) ? sortBy : 'createdAt';
  const dir = lower(sortOrder) === 'asc' ? 1 : -1;

  out.sort((a, b) => {
    const av = field.includes('Date') || field === 'createdAt' ? (toDate(a[field])?.getTime() || 0) : Number(a[field] || 0);
    const bv = field.includes('Date') || field === 'createdAt' ? (toDate(b[field])?.getTime() || 0) : Number(b[field] || 0);
    return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
  });

  return out;
};

const withOwner = async (rows, userId, ownerKind) => {
  const users = await fetchUsers(rows.map((r) => r.userId));
  return Promise.all(rows.map(async (row) => {
    const owner = users.get(row.userId);
    const canSee = !!userId && (userId === row.userId || await hasSignedContract(userId, row.userId));
    const ownerPayload = owner ? maskContactInfo({
      id: owner.id,
      name: owner.name,
      phone: owner.phone,
      email: owner.email,
      facebookUrl: owner.facebookUrl,
      shipperProfile: owner.shipperProfile || null,
      truckerProfile: owner.truckerProfile || null,
    }, canSee) : null;

    let routeDistance = null;
    if ([row.originLat, row.originLng, row.destLat, row.destLng].every(Number.isFinite)) {
      routeDistance = Math.round(calculateDistance(row.originLat, row.originLng, row.destLat, row.destLng));
    }

    return {
      ...row,
      [ownerKind]: ownerPayload,
      routeDistance,
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt),
    };
  }));
};

router.get('/cargo', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('cargoListings').limit(500).get();
    let rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    rows = commonFilterSort(rows, req.query, 'cargo');

    const minWeight = req.query.minWeight !== undefined ? Number(req.query.minWeight) : null;
    if (Number.isFinite(minWeight)) rows = rows.filter((r) => Number(r.weight || 0) >= minWeight);
    const maxWeight = req.query.maxWeight !== undefined ? Number(req.query.maxWeight) : null;
    if (Number.isFinite(maxWeight)) rows = rows.filter((r) => Number(r.weight || 0) <= maxWeight);

    if (req.query.vehicleType) rows = rows.filter((r) => lower(r.vehicleNeeded).includes(lower(req.query.vehicleType)));
    if (req.query.cargoType) rows = rows.filter((r) => lower(r.cargoType).includes(lower(req.query.cargoType)));

    const from = toDate(req.query.pickupDateFrom);
    if (from) rows = rows.filter((r) => { const d = toDate(r.pickupDate); return d ? d >= from : false; });
    const to = toDate(req.query.pickupDateTo);
    if (to) rows = rows.filter((r) => { const d = toDate(r.pickupDate); return d ? d <= to : false; });

    const page = pageSlice(rows, Number(req.query.limit || 50), Number(req.query.offset || 0));
    const listings = await withOwner(page.rows, req.user?.uid, 'shipper');

    res.json({ listings, total: page.total, limit: page.limit, offset: page.offset, filters: req.query });
  } catch (error) {
    console.error('Get cargo listings error:', error);
    res.status(500).json({ error: 'Failed to get cargo listings' });
  }
});

router.get('/cargo/:id', authenticateToken, async (req, res) => {
  try {
    const listingDoc = await db.collection('cargoListings').doc(req.params.id).get();
    if (!listingDoc.exists) return res.status(404).json({ error: 'Cargo listing not found' });

    const listing = { id: listingDoc.id, ...listingDoc.data() };
    const [enriched] = await withOwner([listing], req.user?.uid, 'shipper');

    const bidsSnapshot = await db.collection('bids').where('cargoListingId', '==', req.params.id).get();
    const bidsRaw = bidsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    const bidders = await fetchUsers(bidsRaw.map((b) => b.bidderId));

    const bids = await Promise.all(bidsRaw.map(async (bid) => {
      const bidder = bidders.get(bid.bidderId);
      const canSee = !!req.user?.uid && (
        req.user.uid === bid.bidderId ||
        req.user.uid === listing.userId ||
        await hasSignedContract(req.user.uid, bid.bidderId)
      );
      return {
        ...bid,
        bidder: bidder ? maskContactInfo({
          id: bidder.id,
          name: bidder.name,
          phone: bidder.phone,
          email: bidder.email,
          facebookUrl: bidder.facebookUrl,
          truckerProfile: bidder.truckerProfile || null,
          shipperProfile: bidder.shipperProfile || null,
        }, canSee) : null,
        createdAt: toDate(bid.createdAt),
        updatedAt: toDate(bid.updatedAt),
      };
    }));

    bids.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    res.json({ listing: { ...enriched, bids } });
  } catch (error) {
    console.error('Get cargo listing error:', error);
    res.status(500).json({ error: 'Failed to get cargo listing' });
  }
});

router.post('/cargo', authenticateToken, async (req, res) => {
  try {
    const { origin, destination, cargoType, weight, weightUnit = 'tons', vehicleNeeded, askingPrice, declaredValue, description, pickupDate, photos = [], originStreetAddress = '', destinationStreetAddress = '' } = req.body;
    if (!origin || !destination || !askingPrice) return res.status(400).json({ error: 'Origin, destination, and asking price are required' });

    const userId = req.user.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const o = getCoordinates(origin);
    const d = getCoordinates(destination);

    const payload = {
      userId,
      userName: userData.name || null,
      userTransactions: userData.shipperProfile?.totalTransactions || 0,
      origin,
      destination,
      originLat: o.lat,
      originLng: o.lng,
      destLat: d.lat,
      destLng: d.lng,
      originStreetAddress,
      destinationStreetAddress,
      cargoType: cargoType || null,
      weight: weight !== undefined ? Number(weight) : null,
      weightUnit,
      vehicleNeeded: vehicleNeeded || null,
      askingPrice: Number(askingPrice),
      declaredValue: declaredValue ? Number(declaredValue) : null,
      description: description || '',
      pickupDate: pickupDate || null,
      photos,
      status: 'open',
      bidCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = db.collection('cargoListings').doc();
    await ref.set(payload);
    res.status(201).json({ message: 'Cargo listing created successfully', listing: { id: ref.id, ...payload, createdAt: new Date(), updatedAt: new Date() } });
  } catch (error) {
    console.error('Create cargo listing error:', error);
    res.status(500).json({ error: 'Failed to create cargo listing' });
  }
});

router.put('/cargo/:id', authenticateToken, async (req, res) => {
  try {
    const ref = db.collection('cargoListings').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Cargo listing not found' });
    if (doc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Not authorized to update this listing' });

    const updates = { ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (updates.origin) { const c = getCoordinates(updates.origin); updates.originLat = c.lat; updates.originLng = c.lng; }
    if (updates.destination) { const c = getCoordinates(updates.destination); updates.destLat = c.lat; updates.destLng = c.lng; }

    await ref.update(updates);
    const updated = await ref.get();
    res.json({ message: 'Cargo listing updated successfully', listing: { id: updated.id, ...updated.data() } });
  } catch (error) {
    console.error('Update cargo listing error:', error);
    res.status(500).json({ error: 'Failed to update cargo listing' });
  }
});

router.delete('/cargo/:id', authenticateToken, async (req, res) => {
  try {
    const ref = db.collection('cargoListings').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Cargo listing not found' });
    if (doc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Not authorized to delete this listing' });
    await ref.delete();
    res.json({ message: 'Cargo listing deleted successfully' });
  } catch (error) {
    console.error('Delete cargo listing error:', error);
    res.status(500).json({ error: 'Failed to delete cargo listing' });
  }
});
router.get('/trucks', authenticateToken, async (req, res) => {
  try {
    const snapshot = await db.collection('truckListings').limit(500).get();
    let rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    rows = commonFilterSort(rows, req.query, 'truck');

    if (req.query.vehicleType) rows = rows.filter((r) => lower(r.vehicleType).includes(lower(req.query.vehicleType)));

    const minCapacity = req.query.minCapacity !== undefined ? Number(req.query.minCapacity) : null;
    if (Number.isFinite(minCapacity)) rows = rows.filter((r) => Number(r.capacity || 0) >= minCapacity);
    const maxCapacity = req.query.maxCapacity !== undefined ? Number(req.query.maxCapacity) : null;
    if (Number.isFinite(maxCapacity)) rows = rows.filter((r) => Number(r.capacity || 0) <= maxCapacity);

    const from = toDate(req.query.availableDateFrom);
    if (from) rows = rows.filter((r) => { const d = toDate(r.availableDate); return d ? d >= from : false; });
    const to = toDate(req.query.availableDateTo);
    if (to) rows = rows.filter((r) => { const d = toDate(r.availableDate); return d ? d <= to : false; });

    const page = pageSlice(rows, Number(req.query.limit || 50), Number(req.query.offset || 0));
    const listings = await withOwner(page.rows, req.user?.uid, 'trucker');

    res.json({ listings, total: page.total, limit: page.limit, offset: page.offset, filters: req.query });
  } catch (error) {
    console.error('Get truck listings error:', error);
    res.status(500).json({ error: 'Failed to get truck listings' });
  }
});

router.get('/trucks/:id', authenticateToken, async (req, res) => {
  try {
    const listingDoc = await db.collection('truckListings').doc(req.params.id).get();
    if (!listingDoc.exists) return res.status(404).json({ error: 'Truck listing not found' });

    const listing = { id: listingDoc.id, ...listingDoc.data() };
    const [enriched] = await withOwner([listing], req.user?.uid, 'trucker');

    const bidsSnapshot = await db.collection('bids').where('truckListingId', '==', req.params.id).get();
    const bidsRaw = bidsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    const bidders = await fetchUsers(bidsRaw.map((b) => b.bidderId));

    const bids = await Promise.all(bidsRaw.map(async (bid) => {
      const bidder = bidders.get(bid.bidderId);
      const canSee = !!req.user?.uid && (
        req.user.uid === bid.bidderId ||
        req.user.uid === listing.userId ||
        await hasSignedContract(req.user.uid, bid.bidderId)
      );
      return {
        ...bid,
        bidder: bidder ? maskContactInfo({
          id: bidder.id,
          name: bidder.name,
          phone: bidder.phone,
          email: bidder.email,
          facebookUrl: bidder.facebookUrl,
          truckerProfile: bidder.truckerProfile || null,
          shipperProfile: bidder.shipperProfile || null,
        }, canSee) : null,
        createdAt: toDate(bid.createdAt),
        updatedAt: toDate(bid.updatedAt),
      };
    }));

    bids.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    res.json({ listing: { ...enriched, bids } });
  } catch (error) {
    console.error('Get truck listing error:', error);
    res.status(500).json({ error: 'Failed to get truck listing' });
  }
});

router.post('/trucks', authenticateToken, async (req, res) => {
  try {
    const { origin, destination, vehicleType, capacity, capacityUnit = 'tons', plateNumber, askingPrice, description, availableDate, departureTime, photos = [], originStreetAddress = '', destinationStreetAddress = '' } = req.body;
    if (!origin || !destination || !askingPrice) return res.status(400).json({ error: 'Origin, destination, and asking price are required' });

    const userId = req.user.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const o = getCoordinates(origin);
    const d = getCoordinates(destination);

    const payload = {
      userId,
      userName: userData.name || null,
      userRating: userData.truckerProfile?.rating || 0,
      userTrips: userData.truckerProfile?.totalTrips || 0,
      origin,
      destination,
      originLat: o.lat,
      originLng: o.lng,
      destLat: d.lat,
      destLng: d.lng,
      originStreetAddress,
      destinationStreetAddress,
      vehicleType: vehicleType || null,
      capacity: capacity !== undefined ? Number(capacity) : null,
      capacityUnit,
      plateNumber: plateNumber || '',
      askingPrice: Number(askingPrice),
      description: description || '',
      availableDate: availableDate || null,
      departureTime: departureTime || '',
      photos,
      status: 'open',
      bidCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = db.collection('truckListings').doc();
    await ref.set(payload);
    res.status(201).json({ message: 'Truck listing created successfully', listing: { id: ref.id, ...payload, createdAt: new Date(), updatedAt: new Date() } });
  } catch (error) {
    console.error('Create truck listing error:', error);
    res.status(500).json({ error: 'Failed to create truck listing' });
  }
});

router.put('/trucks/:id', authenticateToken, async (req, res) => {
  try {
    const ref = db.collection('truckListings').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Truck listing not found' });
    if (doc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Not authorized to update this listing' });

    const updates = { ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (updates.origin) { const c = getCoordinates(updates.origin); updates.originLat = c.lat; updates.originLng = c.lng; }
    if (updates.destination) { const c = getCoordinates(updates.destination); updates.destLat = c.lat; updates.destLng = c.lng; }

    await ref.update(updates);
    const updated = await ref.get();
    res.json({ message: 'Truck listing updated successfully', listing: { id: updated.id, ...updated.data() } });
  } catch (error) {
    console.error('Update truck listing error:', error);
    res.status(500).json({ error: 'Failed to update truck listing' });
  }
});

router.delete('/trucks/:id', authenticateToken, async (req, res) => {
  try {
    const ref = db.collection('truckListings').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Truck listing not found' });
    if (doc.data().userId !== req.user.uid) return res.status(403).json({ error: 'Not authorized to delete this listing' });
    await ref.delete();
    res.json({ message: 'Truck listing deleted successfully' });
  } catch (error) {
    console.error('Delete truck listing error:', error);
    res.status(500).json({ error: 'Failed to delete truck listing' });
  }
});

router.get('/optimize/backload', authenticateToken, async (req, res) => {
  try {
    const { origin, destination, originLat, originLng, destLat, destLng, maxDetourKm = 50, type = 'both', limit = 20 } = req.query;
    if (!origin && !originLat) return res.status(400).json({ error: 'Origin location is required' });

    let originCoords = { lat: Number(originLat), lng: Number(originLng) };
    if (!Number.isFinite(originCoords.lat) || !Number.isFinite(originCoords.lng)) originCoords = getCoordinates(origin);

    let destinationCoords = destLat ? { lat: Number(destLat), lng: Number(destLng) } : null;
    if ((!destinationCoords || !Number.isFinite(destinationCoords.lat) || !Number.isFinite(destinationCoords.lng)) && destination) {
      destinationCoords = getCoordinates(destination);
    }

    const maxDetour = Number(maxDetourKm);
    const maxRows = Number(limit);
    const result = { cargo: [], trucks: [], recommendations: [] };

    const mapCompatibility = (rows) => rows.map((row) => {
      const originDistance = Number.isFinite(row.originLat) ? calculateDistance(originCoords.lat, originCoords.lng, row.originLat, row.originLng) : Number.POSITIVE_INFINITY;
      const destDistance = destinationCoords && Number.isFinite(row.destLat) ? calculateDistance(destinationCoords.lat, destinationCoords.lng, row.destLat, row.destLng) : null;
      const routeDistance = Number.isFinite(row.originLat) && Number.isFinite(row.destLat) ? calculateDistance(row.originLat, row.originLng, row.destLat, row.destLng) : 0;
      const compatibilityScore = destDistance === null ? originDistance : (originDistance + destDistance) / 2;
      return {
        ...row,
        originDistance: Math.round(originDistance),
        destDistance: destDistance === null ? null : Math.round(destDistance),
        routeDistance: Math.round(routeDistance),
        compatibilityScore: Math.round(compatibilityScore),
        isBackloadMatch: originDistance <= maxDetour,
      };
    }).filter((r) => r.isBackloadMatch).sort((a, b) => a.compatibilityScore - b.compatibilityScore).slice(0, maxRows);

    if (type === 'both' || type === 'cargo') {
      const snap = await db.collection('cargoListings').where('status', '==', 'open').limit(300).get();
      result.cargo = mapCompatibility(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    if (type === 'both' || type === 'truck') {
      const snap = await db.collection('truckListings').where('status', '==', 'open').limit(300).get();
      result.trucks = mapCompatibility(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }

    const all = [...result.cargo.map((x) => ({ ...x, listingType: 'cargo' })), ...result.trucks.map((x) => ({ ...x, listingType: 'truck' }))]
      .sort((a, b) => a.compatibilityScore - b.compatibilityScore);

    result.recommendations = all.slice(0, 5).map((row) => ({
      id: row.id,
      type: row.listingType,
      route: `${row.origin} -> ${row.destination}`,
      price: row.askingPrice,
      originDistance: row.originDistance,
      destDistance: row.destDistance,
      reason: row.originDistance <= 10 ? 'Perfect match - same origin area' : row.originDistance <= 30 ? 'Good match - nearby origin' : 'Reasonable detour',
    }));

    res.json({ origin: origin || `${originCoords.lat}, ${originCoords.lng}`, destination: destination || (destinationCoords ? `${destinationCoords.lat}, ${destinationCoords.lng}` : null), maxDetourKm: maxDetour, totalMatches: result.cargo.length + result.trucks.length, ...result });
  } catch (error) {
    console.error('Route optimization error:', error);
    res.status(500).json({ error: 'Failed to find backload opportunities' });
  }
});

router.get('/optimize/popular-routes', async (req, res) => {
  try {
    const snapshot = await db.collection('cargoListings').limit(500).get();
    const counts = {};
    snapshot.docs.forEach((doc) => {
      const row = doc.data();
      if (!row.origin || !row.destination) return;
      const key = `${row.origin}|${row.destination}`;
      counts[key] = (counts[key] || 0) + 1;
    });

    const popularRoutes = Object.entries(counts)
      .map(([route, count]) => {
        const [origin, destination] = route.split('|');
        const o = getCoordinates(origin);
        const d = getCoordinates(destination);
        return { origin, destination, count, distance: Math.round(calculateDistance(o.lat, o.lng, d.lat, d.lng)) };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({ popularRoutes });
  } catch (error) {
    console.error('Popular routes error:', error);
    res.status(500).json({ error: 'Failed to get popular routes' });
  }
});

export default router;
