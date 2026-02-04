import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useShipments(userId) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setShipments([]);
      setLoading(false);
      return;
    }

    // Query shipments where user is a participant
    const q = query(
      collection(db, 'shipments'),
      where('participantIds', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const docData = doc.data();
          return {
            id: doc.id,
            ...docData,
            createdAt: docData.createdAt?.toDate?.() || new Date(),
            updatedAt: docData.updatedAt?.toDate?.() || new Date(),
            deliveredAt: docData.deliveredAt?.toDate?.() || null,
            currentLocation: {
              lat: docData.currentLat,
              lng: docData.currentLng,
              name: docData.currentLocation
            },
            originCoords: {
              lat: docData.originLat || docData.currentLat,
              lng: docData.originLng || docData.currentLng
            },
            destCoords: {
              lat: docData.destLat || docData.currentLat,
              lng: docData.destLng || docData.currentLng
            },
            // Format last update time
            lastUpdate: formatTimeAgo(docData.updatedAt?.toDate?.() || new Date()),
          };
        });
        setShipments(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching shipments:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Separate active and delivered shipments
  const activeShipments = shipments.filter(s => s.status !== 'delivered');
  const deliveredShipments = shipments.filter(s => s.status === 'delivered');

  return { shipments, activeShipments, deliveredShipments, loading, error };
}

// Helper to format time ago
function formatTimeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

export default useShipments;
