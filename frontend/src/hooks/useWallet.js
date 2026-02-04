import { useState, useEffect } from 'react';
import { doc, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useWallet(userId) {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen to wallet balance
  useEffect(() => {
    if (!userId) {
      setBalance(0);
      setLoading(false);
      return;
    }

    const walletRef = doc(db, 'users', userId, 'wallet', 'main');

    const unsubscribe = onSnapshot(
      walletRef,
      (snap) => {
        if (snap.exists()) {
          setBalance(snap.data().balance || 0);
        } else {
          setBalance(0);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching wallet:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Listen to wallet transactions
  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      return;
    }

    const q = query(
      collection(db, 'users', userId, 'walletTransactions'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          date: doc.data().createdAt?.toDate?.().toLocaleDateString() || new Date().toLocaleDateString(),
        }));
        setTransactions(data);
      },
      (err) => {
        console.error('Error fetching transactions:', err);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { balance, transactions, loading, error };
}

export default useWallet;
