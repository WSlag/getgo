import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizeListingStatus } from '../utils/listingStatus';

export function useCargoListings(options = {}) {
  const {
    status = null,
    userId = null,
    maxResults = 50,
    authUser = undefined, // pass authUser to gate subscription on authentication
  } = options;

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
          const createdAt = docData.createdAt?.toDate?.() || new Date();

          // Calculate distance if coordinates exist
          let distance = null;
          if (docData.originLat && docData.originLng && docData.destLat && docData.destLng) {
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
            type: 'cargo',
            ...docData,
            status: normalizeListingStatus(docData.status),
            // Map Firebase field names to CargoCard expected names
            shipper: docData.userName || 'Unknown Shipper',
            company: docData.userName || 'Unknown Shipper',
            shipperTransactions: docData.userTransactions || 0,
            postedAt: createdAt.getTime(),
            cargoPhotos: docData.photos || [],
            images: docData.photos || [],
            unit: docData.weightUnit || 'tons',
            distance: distance ? `${distance} km` : null,
            estimatedTime: estimatedTime,
            bidCount: docData.bidCount || 0,
            // Keep original fields
            createdAt: createdAt,
            updatedAt: docData.updatedAt?.toDate?.() || new Date(),
            pickupDate: docData.pickupDate,
            originCoords: { lat: docData.originLat, lng: docData.originLng },
            destCoords: { lat: docData.destLat, lng: docData.destLng },
          };
        });
        setListings(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching cargo listings:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [status, userId, maxResults, authUser]);

  return { listings, loading, error };
}

export default useCargoListings;
