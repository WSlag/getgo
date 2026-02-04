import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
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
    const q = query(
      collection(db, 'bids'),
      where(fieldName, '==', listingId),
      orderBy('createdAt', 'desc')
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
      where('bidderId', '==', userId),
      orderBy('createdAt', 'desc')
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
      where('listingOwnerId', '==', userId),
      orderBy('createdAt', 'desc')
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
