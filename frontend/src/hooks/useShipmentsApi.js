import { useState, useCallback, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import api from '../services/api';

/**
 * Hook for shipment operations using Firebase (Firestore + Cloud Functions).
 */
export function useShipmentsApi(userId) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const normalizeShipment = useCallback((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || null,
      updatedAt: data.updatedAt?.toDate?.() || null,
      deliveredAt: data.deliveredAt?.toDate?.() || null,
    };
  }, []);

  // Fetch all shipments for the current user
  const fetchShipments = useCallback(async (params = {}) => {
    if (!userId) {
      setShipments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let shipmentsQuery = query(
        collection(db, 'shipments'),
        where('participantIds', 'array-contains', userId),
        orderBy('createdAt', 'desc')
      );

      if (params?.status) {
        shipmentsQuery = query(
          collection(db, 'shipments'),
          where('participantIds', 'array-contains', userId),
          where('status', '==', params.status),
          orderBy('createdAt', 'desc')
        );
      }

      const snapshot = await getDocs(shipmentsQuery);
      const rows = snapshot.docs.map(normalizeShipment);
      setShipments(rows);
      return rows;
    } catch (err) {
      console.error('Failed to fetch shipments:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId, normalizeShipment]);

  // Get single shipment by ID
  const getShipment = useCallback(async (shipmentId) => {
    try {
      const shipmentRef = doc(db, 'shipments', shipmentId);
      const shipmentSnap = await getDoc(shipmentRef);
      if (!shipmentSnap.exists()) return null;

      const shipment = normalizeShipment(shipmentSnap);
      if (Array.isArray(shipment.participantIds) && !shipment.participantIds.includes(userId)) {
        throw new Error('Access denied');
      }

      return shipment;
    } catch (err) {
      console.error('Failed to get shipment:', err);
      throw err;
    }
  }, [normalizeShipment, userId]);

  // Public tracking lookup by tracking number
  const trackShipment = useCallback(async (trackingNumber) => {
    try {
      const trackingQuery = query(
        collection(db, 'shipments'),
        where('trackingNumber', '==', trackingNumber),
        limit(1)
      );
      const snapshot = await getDocs(trackingQuery);
      if (snapshot.empty) return null;
      return normalizeShipment(snapshot.docs[0]);
    } catch (err) {
      console.error('Failed to track shipment:', err);
      throw err;
    }
  }, [normalizeShipment]);

  // Update shipment location (trucker only)
  const updateLocation = useCallback(async (shipmentId, locationData) => {
    try {
      const result = await api.shipments.updateLocation(shipmentId, locationData);

      // Update local state
      setShipments((prev) =>
        prev.map((s) =>
          s.id === shipmentId
            ? {
                ...s,
                currentLocation: result.shipment.currentLocation,
                currentLat: result.shipment.currentLat,
                currentLng: result.shipment.currentLng,
                progress: result.shipment.progress,
                status: result.shipment.status,
                updatedAt: result.shipment.updatedAt,
              }
            : s
        )
      );

      return result.shipment;
    } catch (err) {
      console.error('Failed to update location:', err);
      throw err;
    }
  }, []);

  // Update shipment status
  const updateStatus = useCallback(async (shipmentId, status) => {
    try {
      const result = await api.shipments.updateStatus(shipmentId, status);

      // Update local state
      setShipments((prev) =>
        prev.map((s) =>
          s.id === shipmentId
            ? {
                ...s,
                status: result.shipment.status,
                progress: result.shipment.progress,
                currentLocation: result.shipment.currentLocation,
                deliveredAt: result.shipment.deliveredAt,
              }
            : s
        )
      );

      return result.shipment;
    } catch (err) {
      console.error('Failed to update status:', err);
      throw err;
    }
  }, []);

  // Fetch shipments on mount
  useEffect(() => {
    if (userId) {
      fetchShipments();
    }
  }, [userId, fetchShipments]);

  // Derived data
  const activeShipments = shipments.filter((s) => s.status !== 'delivered');
  const deliveredShipments = shipments.filter((s) => s.status === 'delivered');

  return {
    shipments,
    activeShipments,
    deliveredShipments,
    loading,
    error,
    fetchShipments,
    getShipment,
    trackShipment,
    updateLocation,
    updateStatus,
    // Refresh helper
    refresh: () => fetchShipments(),
  };
}

export default useShipmentsApi;
