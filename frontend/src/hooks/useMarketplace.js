import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'karga.marketplace.preferences.v1';

function loadPreferences(initialTab, initialMarket) {
  if (typeof window === 'undefined') {
    return {
      activeTab: initialTab,
      activeMarket: initialMarket,
      filterStatus: 'all',
      searchQuery: '',
      sortBy: 'newest',
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        activeTab: initialTab,
        activeMarket: initialMarket,
        filterStatus: 'all',
        searchQuery: '',
        sortBy: 'newest',
      };
    }

    const parsed = JSON.parse(raw);
    return {
      activeTab: parsed.activeTab || initialTab,
      activeMarket: parsed.activeMarket || initialMarket,
      filterStatus: parsed.filterStatus || 'all',
      searchQuery: parsed.searchQuery || '',
      sortBy: parsed.sortBy || 'newest',
    };
  } catch (error) {
    console.warn('Failed to load marketplace preferences:', error);
    return {
      activeTab: initialTab,
      activeMarket: initialMarket,
      filterStatus: 'all',
      searchQuery: '',
      sortBy: 'newest',
    };
  }
}

/**
 * Custom hook for managing marketplace state
 * Handles tab navigation, market selection, filters, etc.
 */
export function useMarketplace(initialTab = 'home', initialMarket = 'cargo') {
  const [initialPreferences] = useState(() => loadPreferences(initialTab, initialMarket));
  const [activeTab, setActiveTab] = useState(initialPreferences.activeTab);
  const [activeMarket, setActiveMarket] = useState(initialPreferences.activeMarket);
  const [filterStatus, setFilterStatus] = useState(initialPreferences.filterStatus);
  const [searchQuery, setSearchQuery] = useState(initialPreferences.searchQuery);
  const [sortBy, setSortBy] = useState(initialPreferences.sortBy);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const payload = {
      activeTab,
      activeMarket,
      filterStatus,
      searchQuery,
      sortBy,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to persist marketplace preferences:', error);
    }
  }, [activeTab, activeMarket, filterStatus, searchQuery, sortBy]);

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
