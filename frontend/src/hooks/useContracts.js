import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import api from '../services/api';

// Hook to get all contracts for the current user
export function useContracts(userId) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setContracts([]);
      setLoading(false);
      return;
    }

    // Query contracts where user is a participant
    const q = query(
      collection(db, 'contracts'),
      where('participantIds', 'array-contains', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
          signedAt: doc.data().signedAt?.toDate?.() || null,
        }));
        setContracts(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching contracts:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { contracts, loading, error };
}

// Hook to get a single contract by ID
export function useContract(contractId) {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!contractId) {
      setContract(null);
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'contracts', contractId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setContract({
            id: snapshot.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
            signedAt: data.signedAt?.toDate?.() || null,
          });
        } else {
          setContract(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching contract:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [contractId]);

  return { contract, loading, error };
}

// Hook to get contract by bid ID
export function useContractByBid(bidId) {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!bidId) {
      setContract(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'contracts'),
      where('bidId', '==', bidId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          const data = doc.data();
          setContract({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
            signedAt: data.signedAt?.toDate?.() || null,
          });
        } else {
          setContract(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching contract by bid:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [bidId]);

  return { contract, loading, error };
}

// Hook for contract actions (create, sign, complete)
export function useContractActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createContract = useCallback(async (bidId, terms) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.contracts.create({ bidId, terms });
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);

  const signContract = useCallback(async (contractId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.contracts.sign(contractId);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);

  const completeContract = useCallback(async (contractId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.contracts.complete(contractId);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);

  const fetchContracts = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.contracts.getAll(params);
      setLoading(false);
      return result;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);

  const fetchContract = useCallback(async (contractId) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.contracts.getById(contractId);
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
    createContract,
    signContract,
    completeContract,
    fetchContracts,
    fetchContract,
  };
}

export default useContracts;
