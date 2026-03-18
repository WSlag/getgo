import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizeListingStatus, toTruckUiStatus } from '../utils/listingStatus';
import { parseTimestampSafely, sortEntitiesNewestFirst } from '../utils/activitySorting';
import { isPermissionDeniedError, reportFirestoreListenerError } from '../utils/firebaseErrors';
import { sanitizeMessage, sanitizePublicName } from '../utils/messageUtils';

export function useTruckListings(options = {}) {
  const {
    status = null,
    userId = null,
    maxResults = 50,
    authUser = undefined, // pass authUser to gate subscription on authentication
    enabled = true,
  } = options;

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      return;
    }

    // If authUser is explicitly provided and is null/falsy, skip subscription
    // (undefined means caller didn't pass it, so we proceed as before)
    if (authUser === null) {
      setListings([]);
      setLoading(false);
      setError(null);
      return;
    }

    let q = collection(db, 'truckListings');
    const constraints = [];

    if (status) {
      const normalizedStatus = normalizeListingStatus(status);
      constraints.push(where('status', '==', normalizedStatus));
    }

    if (userId) {
      constraints.push(where('userId', '==', userId));
    }

    constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(limit(maxResults));

    q = query(q, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const docData = doc.data();
          const createdAt = parseTimestampSafely(docData.createdAt);
          const updatedAt = parseTimestampSafely(docData.updatedAt);

          // Prefer server-authoritative route distance, fallback to local coordinate math.
          let distance = Number.isFinite(Number(docData.routeDistanceKm))
            ? Math.max(0, Math.round(Number(docData.routeDistanceKm)))
            : null;
          const hasCoords =
            Number.isFinite(Number(docData.originLat)) &&
            Number.isFinite(Number(docData.originLng)) &&
            Number.isFinite(Number(docData.destLat)) &&
            Number.isFinite(Number(docData.destLng));
          if (distance === null && hasCoords) {
            const R = 6371; // Earth's radius in km
            const dLat = (docData.destLat - docData.originLat) * Math.PI / 180;
            const dLng = (docData.destLng - docData.originLng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(docData.originLat * Math.PI / 180) * Math.cos(docData.destLat * Math.PI / 180) *
                      Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance = Math.round(R * c);
          }

          // Estimate time based on distance (assuming 50km/h average for trucks)
          const estimatedTime = distance ? `${Math.ceil(distance / 50)} hrs` : null;

          return {
            id: doc.id,
            type: 'truck',
            ...docData,
            status: normalizeListingStatus(docData.status),
            uiStatus: toTruckUiStatus(docData.status),
            // Map Firebase field names to TruckCard expected names
            trucker: sanitizePublicName(docData.userName, 'Unknown Trucker'),
            truckerRating: docData.userRating || 0,
            truckerTransactions: docData.userTrips || 0,
            origin: sanitizeMessage(docData.origin || ''),
            destination: sanitizeMessage(docData.destination || ''),
            description: sanitizeMessage(docData.description || ''),
            postedAt: createdAt.timestamp,
            truckPhotos: docData.photos || [],
            capacity: docData.capacity ? `${docData.capacity} ${docData.capacityUnit || 'tons'}` : null,
            askingRate: docData.askingPrice,
            distance: distance ? `${distance} km` : null,
            estimatedTime: estimatedTime,
            bidCount: docData.bidCount || 0,
            // Keep original fields
            createdAt: createdAt.date,
            updatedAt: updatedAt.date,
            availableDate: (() => {
              const raw = docData.availableDate;
              if (!raw) return null;
              if (typeof raw === 'string') return raw;
              const parsed = parseTimestampSafely(raw);
              return parsed.hasTimestamp
                ? parsed.date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                : null;
            })(),
            originCoords: { lat: docData.originLat, lng: docData.originLng },
            destCoords: { lat: docData.destLat, lng: docData.destLng },
          };
        });
        setListings(sortEntitiesNewestFirst(data, { fallbackKeys: ['postedAt'] }));
        setLoading(false);
        setError(null);
      },
      (err) => {
        reportFirestoreListenerError('truck listings', err);
        setListings([]);
        setError(isPermissionDeniedError(err) ? null : err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [status, userId, maxResults, authUser, enabled]);

  return { listings, loading, error };
}

export default useTruckListings;
