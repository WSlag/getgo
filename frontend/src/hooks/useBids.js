import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Hook to get bids for a specific listing
export function useBidsForListing(listingId, listingType) {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!listingId || !listingType) {
      setBids([]);
      setLoading(false);
      return;
    }

    const fieldName = listingType === 'cargo' ? 'cargoListingId' : 'truckListingId';
    // Note: Not using orderBy to avoid needing a composite index
    // Sorting is done in JavaScript after fetching
    const q = query(
      collection(db, 'bids'),
      where(fieldName, '==', listingId)
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
        console.error('Error fetching bids for listing:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [listingId, listingType]);

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
