import { useState, useCallback } from 'react';
import api from '../services/api';

/**
 * Hook for route optimization / backload finder functionality
 */
export function useRouteOptimizer() {
  const [backloadResults, setBackloadResults] = useState(null);
  const [popularRoutes, setPopularRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizeBackloadResult = useCallback((result, params = {}) => {
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid route optimizer response');
    }

    const matches = Array.isArray(result.matches) ? result.matches : [];
    const cargoMatches = Array.isArray(result.cargoMatches) ? result.cargoMatches : matches;
    const truckMatches = Array.isArray(result.truckMatches) ? result.truckMatches : [];
    const maxDetourKm = Number(params.maxDetourKm || 50);

    const cargo = cargoMatches.map((match) => ({
      ...match,
      routeDistance: Number(match.routeDistance || 0),
      originDistance: Number(match.originDistance || 0),
      destDistance: match.destDistance === null || match.destDistance === undefined
        ? null
        : Number(match.destDistance || 0),
      matchScore: Number(match.matchScore || 0),
    }));

    const trucks = truckMatches.map((match) => ({
      ...match,
      routeDistance: Number(match.routeDistance || 0),
      originDistance: Number(match.originDistance || 0),
      destDistance: match.destDistance === null || match.destDistance === undefined
        ? null
        : Number(match.destDistance || 0),
      matchScore: Number(match.matchScore || 0),
    }));

    const recommendations = [...cargo, ...trucks]
      .slice()
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5)
      .map((item) => {
        const etaSavedMinutes = Math.max(0, Math.round(((maxDetourKm - item.originDistance) / 50) * 60));
        return {
          id: item.id,
          type: item.listingType || (trucks.includes(item) ? 'truck' : 'cargo'),
          route: `${item.origin} -> ${item.destination}`,
          price: Number(item.askingPrice || 0),
          originDistance: item.originDistance,
          destDistance: item.destDistance,
          matchScore: item.matchScore,
          etaSavedMinutes,
          reason: `${Math.round(item.matchScore)}% route match`,
        };
      });

    return {
      totalMatches: Number(result.total || (cargo.length + trucks.length)),
      maxDetourKm,
      cargo,
      trucks,
      recommendations,
    };
  }, []);

  const normalizePopularRoutesResult = useCallback((result) => {
    if (!result || typeof result !== 'object') {
      return [];
    }

    const routes = Array.isArray(result.routes)
      ? result.routes
      : (Array.isArray(result.popularRoutes) ? result.popularRoutes : []);

    return routes.map((route) => ({
      ...route,
      count: Number(route.count || 0),
      distance: Number(route.distance || route.distanceKm || 0),
    }));
  }, []);

  // Find backload opportunities based on route
  const findBackload = useCallback(async (params) => {
    setLoading(true);
    setError(null);

    try {
      const origin = String(params?.origin || '').trim();
      const destination = String(params?.destination || '').trim();
      const requestParams = {
        ...(params || {}),
        origin,
        // Backward compatibility: older backend revisions require destination.
        destination: destination || origin,
      };

      const result = await api.optimize.findBackload(requestParams);
      const normalized = normalizeBackloadResult(result, requestParams);
      setBackloadResults(normalized);
      return normalized;
    } catch (err) {
      console.error('Failed to find backload:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [normalizeBackloadResult]);

  // Get popular routes
  const fetchPopularRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.optimize.getPopularRoutes();
      const normalizedRoutes = normalizePopularRoutesResult(result);
      setPopularRoutes(normalizedRoutes);
      return normalizedRoutes;
    } catch (err) {
      console.error('Failed to fetch popular routes:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [normalizePopularRoutesResult]);

  // Clear results
  const clearResults = useCallback(() => {
    setBackloadResults(null);
    setError(null);
  }, []);

  return {
    backloadResults,
    popularRoutes,
    loading,
    error,
    findBackload,
    fetchPopularRoutes,
    clearResults,
  };
}

export default useRouteOptimizer;
