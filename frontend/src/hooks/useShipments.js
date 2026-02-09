import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getCoordinates } from '../utils/cityCoordinates';

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

          // Get fallback coordinates from city names if lat/lng are missing
          const originFallback = getCoordinates(docData.origin);
          const destFallback = getCoordinates(docData.destination);
          const currentFallback = getCoordinates(docData.currentLocation);

          // Use explicit coordinates if available, otherwise fallback to city-based coordinates
          const originCoords = {
            lat: typeof docData.originLat === 'number' ? docData.originLat : originFallback.lat,
            lng: typeof docData.originLng === 'number' ? docData.originLng : originFallback.lng
          };

          const destCoords = {
            lat: typeof docData.destLat === 'number' ? docData.destLat : destFallback.lat,
            lng: typeof docData.destLng === 'number' ? docData.destLng : destFallback.lng
          };

          const currentLocation = {
            lat: typeof docData.currentLat === 'number' ? docData.currentLat : currentFallback.lat,
            lng: typeof docData.currentLng === 'number' ? docData.currentLng : currentFallback.lng,
            name: docData.currentLocation || docData.origin || 'Unknown'
          };

          return {
            id: doc.id,
            ...docData,
            createdAt: docData.createdAt?.toDate?.() || new Date(),
            updatedAt: docData.updatedAt?.toDate?.() || new Date(),
            deliveredAt: docData.deliveredAt?.toDate?.() || null,
            currentLocation,
            originCoords,
            destCoords,
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
