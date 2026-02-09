import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../firebase';

/**
 * Hook to watch a payment submission's status in real-time
 * @param {string} submissionId - Submission ID to watch
 * @returns {Object} - { submission, loading, error }
 */
export function usePaymentSubmission(submissionId) {
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!submissionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const docRef = doc(db, 'paymentSubmissions', submissionId);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setSubmission({
            id: docSnap.id,
            ...docSnap.data(),
            createdAt: docSnap.data().createdAt?.toDate?.() || docSnap.data().createdAt,
            uploadedAt: docSnap.data().uploadedAt?.toDate?.() || docSnap.data().uploadedAt,
            resolvedAt: docSnap.data().resolvedAt?.toDate?.() || docSnap.data().resolvedAt
          });
        } else {
          setSubmission(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error watching submission:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [submissionId]);

  return { submission, loading, error };
}

/**
 * Hook to watch the latest submission for an order
 * @param {string} orderId - Order ID to watch
 * @returns {Object} - { submission, loading, error }
 */
export function useOrderSubmission(orderId) {
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!orderId || !userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'paymentSubmissions'),
      where('orderId', '==', orderId),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          setSubmission({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
            uploadedAt: doc.data().uploadedAt?.toDate?.() || doc.data().uploadedAt,
            resolvedAt: doc.data().resolvedAt?.toDate?.() || doc.data().resolvedAt
          });
        } else {
          setSubmission(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error watching order submission:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orderId]);

  return { submission, loading, error };
}

/**
 * Hook to watch a payment order's status
 * @param {string} orderId - Order ID to watch
 * @returns {Object} - { order, loading, error }
 */
export function usePaymentOrder(orderId) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const docRef = doc(db, 'orders', orderId);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setOrder({
            id: docSnap.id,
            ...docSnap.data(),
            createdAt: docSnap.data().createdAt?.toDate?.() || docSnap.data().createdAt,
            expiresAt: docSnap.data().expiresAt?.toDate?.() || docSnap.data().expiresAt,
            updatedAt: docSnap.data().updatedAt?.toDate?.() || docSnap.data().updatedAt
          });
        } else {
          setOrder(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error watching order:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orderId]);

  return { order, loading, error };
}

/**
 * Hook to get user's pending payment orders
 * @param {string} userId - User ID
 * @returns {Object} - { orders, loading, error }
 */
export function usePendingOrders(userId) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', userId),
      where('status', 'in', ['awaiting_upload', 'processing']),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ordersList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          expiresAt: doc.data().expiresAt?.toDate?.() || doc.data().expiresAt
        }));
        setOrders(ordersList);
        setLoading(false);
      },
      (err) => {
        console.error('Error watching pending orders:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { orders, loading, error };
}

/**
 * Get status display information
 * @param {string} status - Submission status
 * @returns {Object} - { label, color, description }
 */
export function getStatusDisplay(status) {
  const statusMap = {
    pending: {
      label: 'Pending',
      color: 'gray',
      description: 'Waiting to be processed...'
    },
    processing: {
      label: 'Processing',
      color: 'blue',
      description: 'Analyzing your screenshot...'
    },
    approved: {
      label: 'Verified',
      color: 'green',
      description: 'Payment verified! Funds added to wallet.'
    },
    rejected: {
      label: 'Failed',
      color: 'red',
      description: 'Verification failed. Please try again.'
    },
    manual_review: {
      label: 'Under Review',
      color: 'yellow',
      description: 'Being reviewed by our team (5-10 min).'
    }
  };

  return statusMap[status] || statusMap.pending;
}

export default usePaymentSubmission;
