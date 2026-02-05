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

  // Find backload opportunities based on route
  const findBackload = useCallback(async (params) => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.optimize.findBackload(params);
      setBackloadResults(result);
      return result;
    } catch (err) {
      console.error('Failed to find backload:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get popular routes
  const fetchPopularRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.optimize.getPopularRoutes();
      setPopularRoutes(result.popularRoutes || []);
      return result.popularRoutes;
    } catch (err) {
      console.error('Failed to fetch popular routes:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

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
