import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { parseTimestampSafely, sortEntitiesNewestFirst } from '../utils/activitySorting';
import { isPermissionDeniedError, reportFirestoreListenerError } from '../utils/firebaseErrors';

// Hook to get bids for a specific listing
export function useBidsForListing(listingId, listingType, listingOwnerId = null) {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const viewerId = listingOwnerId || auth.currentUser?.uid || null;

    if (!listingId || !listingType || !viewerId) {
      setBids([]);
      setLoading(false);
      setError(null);
      return;
    }

    const fieldName = listingType === 'cargo' ? 'cargoListingId' : 'truckListingId';
    // Query is constrained by listing owner for Firestore rule compatibility,
    // then narrowed to the target listing in-memory.
    const q = query(
      collection(db, 'bids'),
      where('listingOwnerId', '==', viewerId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs
          .map((docSnap) => {
            const bidData = docSnap.data();
            return {
              id: docSnap.id,
              ...bidData,
              createdAt: parseTimestampSafely(bidData.createdAt).date,
              updatedAt: parseTimestampSafely(bidData.updatedAt).date,
            };
          })
          .filter((bid) => bid[fieldName] === listingId);
        setBids(sortEntitiesNewestFirst(data));
        setLoading(false);
        setError(null);
      },
      (err) => {
        reportFirestoreListenerError('bids for listing', err);
        setBids([]);
        setError(isPermissionDeniedError(err) ? null : err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [listingId, listingType, listingOwnerId]);

  return { bids, loading, error };
}

// Hook to get bids placed by a specific user
export function useMyBids(userId, enabled = true) {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const deniedListingReadsRef = useRef(new Set());

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      return;
    }

    if (!userId) {
      setBids([]);
      setLoading(false);
      setError(null);
      return;
    }
    deniedListingReadsRef.current.clear();

    const q = query(
      collection(db, 'bids'),
      where('bidderId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const bidsData = snapshot.docs.map((docSnap) => {
          const bidData = docSnap.data();
          return {
            id: docSnap.id,
            ...bidData,
            createdAt: parseTimestampSafely(bidData.createdAt).date,
            updatedAt: parseTimestampSafely(bidData.updatedAt).date,
          };
        });

        // Fetch associated listing data to fill in missing fields
        const enrichedBids = await Promise.all(
          bidsData.map(async (bid) => {
            // Determine which listing to fetch
            const listingId = bid.cargoListingId || bid.truckListingId;
            const listingCollection = bid.cargoListingId ? 'cargoListings' : 'truckListings';
            const listingKey = `${listingCollection}:${listingId}`;

            if (!listingId) return bid;
            // Most display fields are copied into bid at write time.
            // Skip extra reads unless core fields are missing.
            const needsListingRead = !bid.origin || !bid.destination || !bid.listingOwnerName || !bid.listingOwnerId;
            if (!needsListingRead) return bid;
            if (deniedListingReadsRef.current.has(listingKey)) return bid;

            try {
              const listingRef = doc(db, listingCollection, listingId);
              const listingSnap = await getDoc(listingRef);

              if (listingSnap.exists()) {
                const listingData = listingSnap.data();
                return {
                  ...bid,
                  // Use listing data as source of truth, fallback to bid data
                  origin: listingData.origin || bid.origin,
                  destination: listingData.destination || bid.destination,
                  listingOwnerName: listingData.userName || bid.listingOwnerName,
                  listingOwnerId: listingData.userId || bid.listingOwnerId,
                  // Cargo listing details
                  weight: listingData.weight || bid.weight,
                  unit: listingData.unit || bid.unit,
                  cargoType: listingData.cargoType || bid.cargoType,
                  vehicleNeeded: listingData.vehicleNeeded || bid.vehicleNeeded,
                  pickupDate: listingData.pickupDate || bid.pickupDate,
                  askingPrice: listingData.askingPrice || bid.askingPrice,
                  listingStatus: listingData.status || bid.listingStatus,
                  // Truck listing details
                  vehicleType: listingData.vehicleType || bid.vehicleType,
                  plateNumber: listingData.plateNumber || bid.plateNumber,
                  capacity: listingData.capacity || bid.capacity,
                  availableDate: listingData.availableDate || bid.availableDate,
                  askingRate: listingData.askingRate || bid.askingRate,
                };
              }
            } catch (err) {
              if (err?.code === 'permission-denied') {
                // Avoid retrying/logging the same denied listing on every snapshot update.
                deniedListingReadsRef.current.add(listingKey);
                if (import.meta.env.DEV) {
                  console.warn('Skipping denied listing read for bid:', bid.id, listingKey);
                }
              } else {
                console.warn('Error fetching listing for bid:', bid.id, err);
              }
            }

            return bid;
          })
        );

        setBids(sortEntitiesNewestFirst(enrichedBids));
        setLoading(false);
        setError(null);
      },
      (err) => {
        reportFirestoreListenerError('my bids', err);
        setBids([]);
        setError(isPermissionDeniedError(err) ? null : err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, enabled]);

  return { bids, loading, error };
}

// Hook to get bids on my listings (as listing owner)
export function useBidsOnMyListings(userId) {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setBids([]);
      setLoading(false);
      setError(null);
      return;
    }

    const q = query(
      collection(db, 'bids'),
      where('listingOwnerId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => {
          const bidData = docSnap.data();
          return {
            id: docSnap.id,
            ...bidData,
            createdAt: parseTimestampSafely(bidData.createdAt).date,
            updatedAt: parseTimestampSafely(bidData.updatedAt).date,
          };
        });
        setBids(sortEntitiesNewestFirst(data));
        setLoading(false);
        setError(null);
      },
      (err) => {
        reportFirestoreListenerError('bids on my listings', err);
        setBids([]);
        setError(isPermissionDeniedError(err) ? null : err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { bids, loading, error };
}

export default useBidsForListing;
