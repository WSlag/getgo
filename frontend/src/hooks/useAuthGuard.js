import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * useAuthGuard - Hook for protecting actions that require authentication
 *
 * Usage:
 * const { requireAuth, showAuthModal, setShowAuthModal, pendingActionTitle } = useAuthGuard();
 *
 * // Wrap protected actions:
 * onClick={() => requireAuth(() => openModal('post'), 'Post a listing')}
 *
 * // Render the modal:
 * <AuthModal
 *   open={showAuthModal}
 *   onClose={() => setShowAuthModal(false)}
 *   onSuccess={executePendingAction}
 *   title={pendingActionTitle}
 * />
 */
export function useAuthGuard() {
  const { isAuthenticated, authUser, userProfile } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingActionTitle, setPendingActionTitle] = useState('Sign in to continue');

  // Use ref to store the pending action to avoid stale closure issues
  const pendingActionRef = useRef(null);

  /**
   * Check if user is fully authenticated (has auth + profile)
   */
  const isFullyAuthenticated = useCallback(() => {
    return !!authUser && !!userProfile;
  }, [authUser, userProfile]);

  /**
   * Require authentication before executing an action
   * @param {Function} action - The action to execute after auth
   * @param {string} title - Optional title for the auth modal
   * @returns {void}
   */
  const requireAuth = useCallback((action, title = 'Sign in to continue') => {
    if (isFullyAuthenticated()) {
      // User is authenticated, execute action immediately
      action();
    } else {
      // User not authenticated, store action and show modal
      pendingActionRef.current = action;
      setPendingActionTitle(title);
      setShowAuthModal(true);
    }
  }, [isFullyAuthenticated]);

  /**
   * Execute the pending action after successful authentication
   * This should be called from AuthModal's onSuccess callback
   */
  const executePendingAction = useCallback(() => {
    if (pendingActionRef.current) {
      // Small delay to ensure auth state is fully updated
      setTimeout(() => {
        pendingActionRef.current?.();
        pendingActionRef.current = null;
      }, 100);
    }
  }, []);

  /**
   * Clear the pending action without executing it
   */
  const clearPendingAction = useCallback(() => {
    pendingActionRef.current = null;
    setPendingActionTitle('Sign in to continue');
  }, []);

  /**
   * Close the modal and optionally clear the pending action
   */
  const closeAuthModal = useCallback((clearAction = true) => {
    setShowAuthModal(false);
    if (clearAction) {
      clearPendingAction();
    }
  }, [clearPendingAction]);

  return {
    // State
    showAuthModal,
    setShowAuthModal,
    pendingActionTitle,

    // Methods
    requireAuth,
    executePendingAction,
    clearPendingAction,
    closeAuthModal,

    // Helpers
    isFullyAuthenticated: isFullyAuthenticated(),
    isAuthenticated: !!authUser,
  };
}

export default useAuthGuard;
