import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizeListingStatus } from '../utils/listingStatus';
import { parseTimestampSafely, sortEntitiesNewestFirst } from '../utils/activitySorting';
import { isPermissionDeniedError, reportFirestoreListenerError } from '../utils/firebaseErrors';
import { sanitizeMessage, sanitizePublicName } from '../utils/messageUtils';
import { formatListingPostedAge, formatListingScheduleDate } from '../utils/listingDateFormatting';

export function useCargoListings(options = {}) {
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

    let q = collection(db, 'cargoListings');
    const constraints = [];

    if (status) {
      constraints.push(where('status', '==', normalizeListingStatus(status)));
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
          const postedAtSource = createdAt.hasTimestamp ? createdAt.date : docData.postedAt;
          const postedAtDisplay = formatListingPostedAge(postedAtSource, docData.timeAgo);
          const pickupDateDisplay = formatListingScheduleDate(docData.pickupDate);

          return {
            id: doc.id,
            type: 'cargo',
            ...docData,
            status: normalizeListingStatus(docData.status),
            // Map Firebase field names to CargoCard expected names
            shipper: sanitizePublicName(docData.userName, 'Unknown Shipper'),
            company: sanitizePublicName(docData.userName, 'Unknown Shipper'),
            shipperTransactions: docData.userTransactions || 0,
            origin: sanitizeMessage(docData.origin || ''),
            destination: sanitizeMessage(docData.destination || ''),
            description: sanitizeMessage(docData.description || ''),
            postedAt: createdAt.timestamp,
            postedAtDisplay,
            timeAgo: postedAtDisplay,
            cargoPhotos: docData.photos || [],
            images: docData.photos || [],
            unit: docData.weightUnit || 'tons',
            distance: distance ? `${distance} km` : null,
            estimatedTime: estimatedTime,
            bidCount: docData.bidCount || 0,
            // Keep original fields
            createdAt: createdAt.date,
            updatedAt: updatedAt.date,
            pickupDate: docData.pickupDate,
            pickupDateRaw: docData.pickupDate,
            pickupDateDisplay,
            originCoords: { lat: docData.originLat, lng: docData.originLng },
            destCoords: { lat: docData.destLat, lng: docData.destLng },
          };
        });
        setListings(sortEntitiesNewestFirst(data, { fallbackKeys: ['postedAt'] }));
        setLoading(false);
        setError(null);
      },
      (err) => {
        reportFirestoreListenerError('cargo listings', err);
        setListings([]);
        setError(isPermissionDeniedError(err) ? null : err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [status, userId, maxResults, authUser, enabled]);

  return { listings, loading, error };
}

export default useCargoListings;
