import { useState, useCallback } from 'react';

/**
 * Custom hook for managing marketplace state
 * Handles tab navigation, market selection, filters, etc.
 */
export function useMarketplace(initialTab = 'home', initialMarket = 'cargo') {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeMarket, setActiveMarket] = useState(initialMarket);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const navigateTo = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  const switchMarket = useCallback((market) => {
    setActiveMarket(market);
  }, []);

  const updateFilter = useCallback((status) => {
    setFilterStatus(status);
  }, []);

  const updateSearch = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  const updateSort = useCallback((sort) => {
    setSortBy(sort);
  }, []);

  const resetFilters = useCallback(() => {
    setFilterStatus('all');
    setSearchQuery('');
    setSortBy('newest');
  }, []);

  return {
    // State
    activeTab,
    activeMarket,
    filterStatus,
    searchQuery,
    sortBy,
    // Actions
    navigateTo,
    setActiveTab,
    switchMarket,
    setActiveMarket,
    updateFilter,
    setFilterStatus,
    updateSearch,
    setSearchQuery,
    updateSort,
    setSortBy,
    resetFilters,
  };
}

export default useMarketplace;
