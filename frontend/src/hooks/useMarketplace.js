import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'karga.marketplace.preferences.v1';
const LEGACY_WORKSPACE_QUERY_KEY = 'workspace';

const HASH_TABS = ['home', 'tracking', 'contracts', 'messages', 'notifications', 'profile', 'bids', 'broker', 'activity', 'help', 'admin'];

function getTabFromHash() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace('#', '');
  return HASH_TABS.includes(hash) ? hash : null;
}

function clearLegacyWorkspaceFromUrl() {
  if (typeof window === 'undefined') return null;
  try {
    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.has(LEGACY_WORKSPACE_QUERY_KEY)) return null;
    currentUrl.searchParams.delete(LEGACY_WORKSPACE_QUERY_KEY);
    window.history.replaceState(null, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    return true;
  } catch {
    return null;
  }
}

function loadPreferences(initialTab, initialMarket, initialWorkspace) {
  const hashTab = getTabFromHash();

  if (typeof window === 'undefined') {
    return {
      activeTab: initialTab,
      activeMarket: initialMarket,
      workspaceRole: initialWorkspace,
      filterStatus: 'all',
      searchQuery: '',
      sortBy: 'newest',
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        activeTab: hashTab || initialTab,
        activeMarket: initialMarket,
        workspaceRole: initialWorkspace,
        filterStatus: 'all',
        searchQuery: '',
        sortBy: 'newest',
      };
    }

    const parsed = JSON.parse(raw);
    return {
      activeTab: hashTab || parsed.activeTab || initialTab,
      activeMarket: parsed.activeMarket || initialMarket,
      workspaceRole: initialWorkspace,
      filterStatus: parsed.filterStatus || 'all',
      searchQuery: parsed.searchQuery || '',
      sortBy: parsed.sortBy || 'newest',
    };
  } catch (error) {
    console.warn('Failed to load marketplace preferences:', error);
    return {
      activeTab: hashTab || initialTab,
      activeMarket: initialMarket,
      workspaceRole: initialWorkspace,
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
export function useMarketplace(initialTab = 'home', initialMarket = 'cargo', initialWorkspace = 'shipper') {
  const [initialPreferences] = useState(() => loadPreferences(initialTab, initialMarket, initialWorkspace));
  const [activeTab, setActiveTab] = useState(initialPreferences.activeTab);
  const [activeMarket, setActiveMarket] = useState(initialPreferences.activeMarket);
  const [workspaceRole, setWorkspaceRole] = useState(initialPreferences.workspaceRole);
  const [filterStatus, setFilterStatus] = useState(initialPreferences.filterStatus);
  const [searchQuery, setSearchQuery] = useState(initialPreferences.searchQuery);
  const [sortBy, setSortBy] = useState(initialPreferences.sortBy);

  // Sync URL hash with active tab
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentUrl = new URL(window.location.href);
    const targetHash = activeTab === 'home' ? '' : `#${activeTab}`;
    if (currentUrl.hash === targetHash) return;

    currentUrl.hash = targetHash;
    window.history.replaceState(null, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  }, [activeTab]);

  // Remove stale legacy workspace query params from old versions.
  useEffect(() => {
    clearLegacyWorkspaceFromUrl();
  }, []);

  // Listen for browser back/forward hash changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHashChange = () => {
      const tab = getTabFromHash();
      if (tab && tab !== activeTab) {
        setActiveTab(tab);
      } else if (!window.location.hash) {
        setActiveTab('home');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeTab]);

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

  const updateWorkspaceRole = useCallback((role) => {
    setWorkspaceRole(role);
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
    workspaceRole,
    filterStatus,
    searchQuery,
    sortBy,
    // Actions
    navigateTo,
    setActiveTab,
    switchMarket,
    setActiveMarket,
    updateWorkspaceRole,
    setWorkspaceRole,
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
