import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';

/**
 * Hook for shipment tracking API operations
 * Provides methods to fetch, update, and track shipments via the backend API
 */
export function useShipmentsApi(userId) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      const result = await api.shipments.getAll(params);
      setShipments(result.shipments || []);
      return result.shipments;
    } catch (err) {
      console.error('Failed to fetch shipments:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Get single shipment by ID
  const getShipment = useCallback(async (shipmentId) => {
    try {
      const result = await api.shipments.getById(shipmentId);
      return result.shipment;
    } catch (err) {
      console.error('Failed to get shipment:', err);
      throw err;
    }
  }, []);

  // Public tracking lookup by tracking number
  const trackShipment = useCallback(async (trackingNumber) => {
    try {
      const result = await api.shipments.track(trackingNumber);
      return result;
    } catch (err) {
      console.error('Failed to track shipment:', err);
      throw err;
    }
  }, []);

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
