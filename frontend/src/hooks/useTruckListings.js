import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizeListingStatus, toTruckUiStatus } from '../utils/listingStatus';

export function useTruckListings(options = {}) {
  const {
    status = null,
    userId = null,
    maxResults = 50
  } = options;

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
            type: 'truck',
            ...docData,
            status: normalizeListingStatus(docData.status),
            uiStatus: toTruckUiStatus(docData.status),
            // Map Firebase field names to TruckCard expected names
            trucker: docData.userName || 'Unknown Trucker',
            truckerRating: docData.userRating || 0,
            truckerTransactions: docData.userTrips || 0,
            postedAt: createdAt.getTime(),
            truckPhotos: docData.photos || [],
            capacity: docData.capacity ? `${docData.capacity} ${docData.capacityUnit || 'tons'}` : null,
            askingRate: docData.askingPrice,
            distance: distance ? `${distance} km` : null,
            estimatedTime: estimatedTime,
            bidCount: docData.bidCount || 0,
            // Keep original fields
            createdAt: createdAt,
            updatedAt: docData.updatedAt?.toDate?.() || new Date(),
            availableDate: docData.availableDate,
            originCoords: { lat: docData.originLat, lng: docData.originLng },
            destCoords: { lat: docData.destLat, lng: docData.destLng },
          };
        });
        setListings(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching truck listings:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [status, userId, maxResults]);

  return { listings, loading, error };
}

export default useTruckListings;
