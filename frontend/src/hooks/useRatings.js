import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import * as api from '../services/api';

// Hook to get ratings for a user
export function useUserRatings(userId) {
  const [ratings, setRatings] = useState([]);
  const [averageRating, setAverageRating] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setRatings([]);
      setAverageRating(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'ratings'),
      where('ratedUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        }));
        setRatings(data);

        // Calculate average rating
        if (data.length > 0) {
          const avg = data.reduce((sum, r) => sum + r.score, 0) / data.length;
          setAverageRating(avg.toFixed(1));
        } else {
          setAverageRating(null);
        }

        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching user ratings:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { ratings, averageRating, loading, error };
}

// Hook to get ratings for a contract
export function useContractRatings(contractId) {
  const [ratings, setRatings] = useState([]);
  const [myRating, setMyRating] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!contractId) {
      setRatings([]);
      setMyRating(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'ratings'),
      where('contractId', '==', contractId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        }));
        setRatings(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching contract ratings:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [contractId]);

  return { ratings, myRating, hasRated: !!myRating, loading, error };
}

// Hook for pending ratings (contracts that need to be rated)
export function usePendingRatings(userId) {
  const [pendingRatings, setPendingRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPendingRatings = useCallback(async () => {
    if (!userId) {
      setPendingRatings([]);
      setLoading(false);
      return;
    }

    try {
      const result = await api.get('/ratings/pending');
      setPendingRatings(result.pendingRatings || []);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching pending ratings:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPendingRatings();
  }, [fetchPendingRatings]);

  return { pendingRatings, loading, error, refetch: fetchPendingRatings };
}

// Hook for rating actions
export function useRatingActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submitRating = useCallback(async (ratingData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post('/ratings', ratingData);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);

  const fetchUserRatings = useCallback(async (userId, params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const queryString = new URLSearchParams(params).toString();
      const result = await api.get(`/ratings/user/${userId}${queryString ? `?${queryString}` : ''}`);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);

  const fetchContractRatings = useCallback(async (contractId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get(`/ratings/contract/${contractId}`);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);

  return {
    loading,
    error,
    submitRating,
    fetchUserRatings,
    fetchContractRatings,
  };
}

export default useUserRatings;
