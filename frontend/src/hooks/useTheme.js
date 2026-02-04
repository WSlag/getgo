import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing theme (dark mode) state
 * Persists preference to localStorage
 */
export function useTheme() {
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage first
    const saved = localStorage.getItem('getgo-dark-mode');
    if (saved !== null) {
      return saved === 'true';
    }
    // Fall back to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('getgo-dark-mode', String(darkMode));
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev);
  }, []);

  const setTheme = useCallback((isDark) => {
    setDarkMode(isDark);
  }, []);

  return {
    darkMode,
    toggleDarkMode,
    setTheme,
  };
}

export default useTheme;
