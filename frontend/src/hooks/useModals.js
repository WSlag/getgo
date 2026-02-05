import { useState, useCallback } from 'react';

/**
 * Custom hook for managing modal states
 * Centralizes modal open/close logic
 */
export function useModals() {
  const [modals, setModals] = useState({
    post: false,
    bid: false,
    chat: false,
    contract: false,
    wallet: false,
    topUp: false,
    rating: false,
    map: false,
    photoViewer: false,
    cargoDetails: false,
    truckDetails: false,
    notifications: false,
    profile: false,
    earnings: false,
    routeOptimizer: false,
    editCargo: false,
    editTruck: false,
    myBids: false,
  });

  // Modal data (e.g., selected cargo for bid modal)
  const [modalData, setModalData] = useState({});

  const openModal = useCallback((modalName, data = null) => {
    setModals(prev => ({ ...prev, [modalName]: true }));
    if (data) {
      setModalData(prev => ({ ...prev, [modalName]: data }));
    }
  }, []);

  const closeModal = useCallback((modalName) => {
    setModals(prev => ({ ...prev, [modalName]: false }));
    // Clear modal data after a delay (for exit animations)
    setTimeout(() => {
      setModalData(prev => {
        const next = { ...prev };
        delete next[modalName];
        return next;
      });
    }, 300);
  }, []);

  const toggleModal = useCallback((modalName) => {
    setModals(prev => ({ ...prev, [modalName]: !prev[modalName] }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals({
      post: false,
      bid: false,
      chat: false,
      contract: false,
      wallet: false,
      topUp: false,
      rating: false,
      map: false,
      photoViewer: false,
      cargoDetails: false,
      truckDetails: false,
      notifications: false,
      profile: false,
      earnings: false,
      routeOptimizer: false,
      editCargo: false,
      editTruck: false,
      myBids: false,
    });
    setModalData({});
  }, []);

  const getModalData = useCallback((modalName) => {
    return modalData[modalName] || null;
  }, [modalData]);

  const isAnyModalOpen = Object.values(modals).some(Boolean);

  return {
    modals,
    modalData,
    openModal,
    closeModal,
    toggleModal,
    closeAllModals,
    getModalData,
    isAnyModalOpen,
  };
}

export default useModals;
