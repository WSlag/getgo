import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAppPathByTab, getAppTabByPath, normalizeAppPath } from '@/config/appRouteManifest';

const STORAGE_KEY = 'karga.marketplace.preferences.v1';
const LEGACY_WORKSPACE_QUERY_KEY = 'workspace';
const NOT_FOUND_TAB = '__not_found__';
const HOME_PATH = getAppPathByTab('home');

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

function loadPreferences(initialMarket, initialWorkspace) {
  if (typeof window === 'undefined') {
    return {
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
        activeMarket: initialMarket,
        workspaceRole: initialWorkspace,
        filterStatus: 'all',
        searchQuery: '',
        sortBy: 'newest',
      };
    }

    const parsed = JSON.parse(raw);
    return {
      activeMarket: parsed.activeMarket || initialMarket,
      workspaceRole: initialWorkspace,
      filterStatus: parsed.filterStatus || 'all',
      searchQuery: parsed.searchQuery || '',
      sortBy: parsed.sortBy || 'newest',
    };
  } catch (error) {
    console.warn('Failed to load marketplace preferences:', error);
    return {
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
  const location = useLocation();
  const navigate = useNavigate();
  const [initialPreferences] = useState(() => loadPreferences(initialMarket, initialWorkspace));
  const resolvedTabFromPath = useMemo(() => {
    const routeTab = getAppTabByPath(location.pathname, initialTab);
    if (routeTab) return routeTab;
    if (normalizeAppPath(location.pathname).startsWith('/app/')) {
      return NOT_FOUND_TAB;
    }
    return initialTab;
  }, [location.pathname, initialTab]);
  const [activeTab, setActiveTabState] = useState(resolvedTabFromPath);
  const [activeMarket, setActiveMarket] = useState(initialPreferences.activeMarket);
  const [workspaceRole, setWorkspaceRole] = useState(initialPreferences.workspaceRole);
  const [filterStatus, setFilterStatus] = useState(initialPreferences.filterStatus);
  const [searchQuery, setSearchQuery] = useState(initialPreferences.searchQuery);
  const [sortBy, setSortBy] = useState(initialPreferences.sortBy);

  // Canonicalize /app to /app/home without adding a history entry.
  useEffect(() => {
    if (normalizeAppPath(location.pathname) !== '/app') return;
    navigate(HOME_PATH, { replace: true });
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (activeTab === resolvedTabFromPath) return;
    setActiveTabState(resolvedTabFromPath);
  }, [activeTab, resolvedTabFromPath]);

  // Remove stale legacy workspace query params from old versions.
  useEffect(() => {
    clearLegacyWorkspaceFromUrl();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const payload = {
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
  }, [activeMarket, filterStatus, searchQuery, sortBy]);

  const setActiveTab = useCallback((tab, options = {}) => {
    if (tab === NOT_FOUND_TAB) {
      setActiveTabState(NOT_FOUND_TAB);
      return;
    }

    const targetPath = getAppPathByTab(tab, null);
    if (!targetPath) {
      setActiveTabState(tab);
      return;
    }

    const currentPath = normalizeAppPath(location.pathname);
    if (currentPath === targetPath) {
      if (activeTab !== tab) {
        setActiveTabState(tab);
      }
      return;
    }

    navigate(targetPath, { replace: Boolean(options.replace) });
  }, [navigate, location.pathname, activeTab]);

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
