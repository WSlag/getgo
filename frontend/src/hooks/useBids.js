import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

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
          .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
          }))
          .filter((bid) => bid[fieldName] === listingId);
        // Sort by createdAt descending (newest first)
        data.sort((a, b) => b.createdAt - a.createdAt);
        setBids(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching bids for listing:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [listingId, listingType, listingOwnerId]);

  return { bids, loading, error };
}

// Hook to get bids placed by a specific user
export function useMyBids(userId) {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setBids([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'bids'),
      where('bidderId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const bidsData = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate?.() || new Date(),
          updatedAt: docSnap.data().updatedAt?.toDate?.() || new Date(),
        }));

        // Fetch associated listing data to fill in missing fields
        const enrichedBids = await Promise.all(
          bidsData.map(async (bid) => {
            // Determine which listing to fetch
            const listingId = bid.cargoListingId || bid.truckListingId;
            const listingCollection = bid.cargoListingId ? 'cargoListings' : 'truckListings';

            if (!listingId) return bid;

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
                };
              }
            } catch (err) {
              console.warn('Error fetching listing for bid:', bid.id, err);
            }

            return bid;
          })
        );

        // Sort by createdAt descending (newest first)
        enrichedBids.sort((a, b) => b.createdAt - a.createdAt);
        setBids(enrichedBids);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching my bids:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

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
      return;
    }

    const q = query(
      collection(db, 'bids'),
      where('listingOwnerId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
        }));
        // Sort by createdAt descending (newest first)
        data.sort((a, b) => b.createdAt - a.createdAt);
        setBids(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching bids on my listings:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { bids, loading, error };
}

export default useBidsForListing;
