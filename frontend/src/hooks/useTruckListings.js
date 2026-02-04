import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

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
      constraints.push(where('status', '==', status));
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
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          type: 'truck',
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
          availableDate: doc.data().availableDate,
          originCoords: { lat: doc.data().originLat, lng: doc.data().originLng },
          destCoords: { lat: doc.data().destLat, lng: doc.data().destLng },
          rating: doc.data().userRating || 0,
          trips: doc.data().userTrips || 0,
        }));
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
