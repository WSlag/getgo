import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getCoordinates } from '../utils/cityCoordinates';
import { formatTimeAgo } from '../utils/dateFormatting';
import { parseTimestampSafely, sortEntitiesNewestFirst } from '../utils/activitySorting';

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
          const createdAt = parseTimestampSafely(docData.createdAt);
          const updatedAt = parseTimestampSafely(docData.updatedAt);
          const deliveredAt = parseTimestampSafely(docData.deliveredAt);

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
            createdAt: createdAt.date,
            updatedAt: updatedAt.date,
            deliveredAt: deliveredAt.date,
            currentLocation,
            originCoords,
            destCoords,
            // Format last update time
            lastUpdate: updatedAt.hasTimestamp
              ? formatTimeAgo(updatedAt.date)
              : (createdAt.hasTimestamp ? formatTimeAgo(createdAt.date) : ''),
          };
        });
        // Backfill missing contract fields for older shipments
        const enriched = await Promise.all(
          data.map(async (shipment) => {
            if (shipment.shipperName || !shipment.contractId) return shipment;
            try {
              const contractDoc = await getDoc(doc(db, 'contracts', shipment.contractId));
              if (!contractDoc.exists()) return shipment;
              const c = contractDoc.data();
              const isCargo = (shipment.listingType || c.listingType) === 'cargo';
              return {
                ...shipment,
                shipperName: isCargo ? (c.listingOwnerName || '') : (c.bidderName || ''),
                truckerName: isCargo ? (c.bidderName || '') : (c.listingOwnerName || ''),
                pickupDate: shipment.pickupDate || c.pickupDate || null,
                expectedDeliveryDate: shipment.expectedDeliveryDate || c.expectedDeliveryDate || null,
                vehiclePlateNumber: shipment.vehiclePlateNumber || c.vehiclePlateNumber || '',
                agreedPrice: shipment.agreedPrice || c.agreedPrice || 0,
              };
            } catch {
              return shipment;
            }
          })
        );
        setShipments(sortEntitiesNewestFirst(enriched, { fallbackKeys: ['deliveredAt'] }));
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


export default useShipments;
