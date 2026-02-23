import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import api from '../services/api';

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeRating = (docSnap) => {
  const data = docSnap.data() || {};
  const canonicalRateeId = data.rateeId || data.ratedUserId || null;
  return {
    id: docSnap.id,
    ...data,
    rateeId: canonicalRateeId,
    ratedUserId: data.ratedUserId || canonicalRateeId,
    createdAt: data.createdAt?.toDate?.() || new Date(),
  };
};

const mergeRatings = (canonicalDocs = [], legacyDocs = []) => {
  const merged = new Map();
  [...canonicalDocs, ...legacyDocs].forEach((item) => {
    if (!merged.has(item.id)) {
      merged.set(item.id, item);
    }
  });

  return Array.from(merged.values()).sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
};

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

    const canonicalQuery = query(
      collection(db, 'ratings'),
      where('rateeId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const legacyQuery = query(
      collection(db, 'ratings'),
      where('ratedUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    let canonicalRatings = [];
    let legacyRatings = [];
    let canonicalReady = false;
    let legacyReady = false;

    const pushState = () => {
      const merged = mergeRatings(canonicalRatings, legacyRatings);
      setRatings(merged);

      if (merged.length > 0) {
        const avg = merged.reduce((sum, rating) => sum + Number(rating.score || 0), 0) / merged.length;
        setAverageRating(avg.toFixed(1));
      } else {
        setAverageRating(null);
      }

      if (canonicalReady && legacyReady) {
        setLoading(false);
      }
      setError(null);
    };

    const unsubscribeCanonical = onSnapshot(
      canonicalQuery,
      (snapshot) => {
        canonicalRatings = snapshot.docs.map(normalizeRating);
        canonicalReady = true;
        pushState();
      },
      (err) => {
        console.error('Error fetching user ratings:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    const unsubscribeLegacy = onSnapshot(
      legacyQuery,
      (snapshot) => {
        legacyRatings = snapshot.docs.map(normalizeRating);
        legacyReady = true;
        pushState();
      },
      (err) => {
        console.error('Error fetching user ratings (legacy field):', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeCanonical();
      unsubscribeLegacy();
    };
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
      const result = await api.ratings.getPending();
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
      const result = await api.ratings.submit(ratingData);
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
      const result = await api.ratings.getForUser(userId, params);
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
      const result = await api.ratings.getForContract(contractId);
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
