import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signInWithCustomToken,
  signOut
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import api from '../services/api';

const AuthContext = createContext();
const RECAPTCHA_CONTAINER_ID = 'firebase-auth-recaptcha-container';

function ensureRecaptchaContainer() {
  if (typeof document === 'undefined') return null;
  let container = document.getElementById(RECAPTCHA_CONTAINER_ID);
  if (container) return container;

  container = document.createElement('div');
  container.id = RECAPTCHA_CONTAINER_ID;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.bottom = '0';
  container.style.width = '1px';
  container.style.height = '1px';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);
  return container;
}

function formatFirebaseAuthError(error) {
  const code = error?.code || '';
  const rawMessage = typeof error?.message === 'string' ? error.message : 'Authentication failed.';
  const rawMessageLower = rawMessage.toLowerCase();
  const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
  const isLocalHost = currentHost === 'localhost' || currentHost === '127.0.0.1';

  if (rawMessageLower.includes('invalid site key or not loaded')) {
    if (isLocalHost) {
      return 'reCAPTCHA failed on localhost. Use a Firebase-hosted/custom authorized domain for phone auth, or use Auth Emulator/test phone numbers for local testing.';
    }
    return `reCAPTCHA site key is invalid for ${currentHost}. Check Firebase Authentication authorized domains and reCAPTCHA key restrictions.`;
  }

  const firebaseCodeMessages = {
    'auth/invalid-api-key': 'Firebase API key is invalid. Check VITE_FIREBASE_API_KEY.',
    'auth/app-not-authorized': 'This web domain is not authorized in Firebase Authentication.',
    'auth/invalid-app-credential':
      'App verification failed. Check reCAPTCHA/App Check site key and key restrictions.',
    'auth/firebase-app-check-token-is-invalid':
      'Security token validation failed. Retry in a new tab or disable App Check for this environment.',
    'auth/firebase-app-check-token-is-invalid.':
      'Security token validation failed. Retry in a new tab or disable App Check for this environment.',
    'auth/captcha-check-failed':
      'reCAPTCHA validation failed. Reload the page and try again.',
    'auth/network-request-failed':
      'Network request failed while contacting Firebase Authentication. Check internet and CSP/network restrictions.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/invalid-phone-number': 'Invalid phone number format.',
    'auth/invalid-verification-code': 'Incorrect code. Please try again.',
    'auth/code-expired': 'Code expired. Request a new code.',
    'auth/session-expired': 'Session expired. Request a new code.',
    'permission-denied': 'Invalid recovery credentials.',
    'functions/permission-denied': 'Invalid recovery credentials.',
    'resource-exhausted': 'Too many attempts. Please wait and try again.',
    'functions/resource-exhausted': 'Too many attempts. Please wait and try again.',
  };

  const normalizedMessage = firebaseCodeMessages[code]
    || (isDev ? rawMessage : 'Authentication failed. Please try again.');
  return isDev && code ? `${normalizedMessage} (${code})` : normalizedMessage;
}

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [shipperProfile, setShipperProfile] = useState(null);
  const [truckerProfile, setTruckerProfile] = useState(null);
  const [brokerProfile, setBrokerProfile] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [authError, setAuthError] = useState(null);
  const recaptchaVerifierRef = useRef(null);

  const clearRecaptchaVerifier = useCallback(() => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // Ignore teardown errors
      }
      recaptchaVerifierRef.current = null;
    }
  }, []);

  const getRecaptchaVerifier = useCallback(() => {
    if (typeof window === 'undefined') {
      throw new Error('reCAPTCHA verifier requires a browser environment.');
    }

    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    const container = ensureRecaptchaContainer();
    if (!container) {
      throw new Error('Failed to initialize reCAPTCHA container.');
    }

    const verifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, {
      size: 'invisible',
      callback: () => {},
      'expired-callback': () => {
        clearRecaptchaVerifier();
      },
    });

    recaptchaVerifierRef.current = verifier;
    return verifier;
  }, [clearRecaptchaVerifier]);

  useEffect(() => {
    return () => {
      clearRecaptchaVerifier();
      if (typeof document !== 'undefined') {
        const container = document.getElementById(RECAPTCHA_CONTAINER_ID);
        if (container?.parentNode) {
          container.parentNode.removeChild(container);
        }
      }
    };
  }, [clearRecaptchaVerifier]);

  // Listen to auth state changes
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (!user) {
        setUserProfile(null);
        setShipperProfile(null);
        setTruckerProfile(null);
        setBrokerProfile(null);
        setWallet(null);
        setIsNewUser(false);
        setLoading(false);
      } else {
        // Keep app in loading state until profile listener resolves new/existing user.
        // This avoids guest-shell flicker right after OTP verification.
        setLoading(true);
        setUserProfile(null);
        setShipperProfile(null);
        setTruckerProfile(null);
        setBrokerProfile(null);
        setWallet(null);
        setIsNewUser(false);
      }
    });
    return unsubAuth;
  }, []);

  // Listen to user profile changes
  useEffect(() => {
    if (!authUser) return;

    const userRef = doc(db, 'users', authUser.uid);
    const unsubProfile = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setUserProfile({ id: snap.id, ...snap.data() });
        setIsNewUser(false);
      } else {
        // User authenticated but no profile yet - new user
        setUserProfile(null);
        setIsNewUser(true);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error listening to user profile:', error);
      setLoading(false);
    });

    return unsubProfile;
  }, [authUser]);

  // Listen to shipper profile
  useEffect(() => {
    if (!authUser || !userProfile) return;

    const shipperRef = doc(db, 'users', authUser.uid, 'shipperProfile', 'profile');
    const unsubShipper = onSnapshot(shipperRef, (snap) => {
      setShipperProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });

    return unsubShipper;
  }, [authUser, userProfile]);

  // Listen to trucker profile
  useEffect(() => {
    if (!authUser || !userProfile) return;

    const truckerRef = doc(db, 'users', authUser.uid, 'truckerProfile', 'profile');
    const unsubTrucker = onSnapshot(truckerRef, (snap) => {
      setTruckerProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });

    return unsubTrucker;
  }, [authUser, userProfile]);

  // Listen to broker profile
  useEffect(() => {
    if (!authUser || !userProfile) return;

    const brokerRef = doc(db, 'users', authUser.uid, 'brokerProfile', 'profile');
    const unsubBroker = onSnapshot(brokerRef, (snap) => {
      setBrokerProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });

    return unsubBroker;
  }, [authUser, userProfile]);

  // Listen to wallet
  useEffect(() => {
    if (!authUser || !userProfile) return;

    const walletRef = doc(db, 'users', authUser.uid, 'wallet', 'main');
    const unsubWallet = onSnapshot(walletRef, (snap) => {
      setWallet(snap.exists() ? { id: snap.id, ...snap.data() } : { balance: 0 });
    });

    return unsubWallet;
  }, [authUser, userProfile]);

  // Send OTP to phone number
  // reCAPTCHA Enterprise verification is handled automatically by Firebase Auth
  // when enabled in Firebase Console > Authentication > Settings.
  const sendOtp = async (phoneNumber) => {
    try {
      setAuthError(null);
      // Format phone number to E.164 format (+63XXXXXXXXXX)
      let formattedPhone = phoneNumber.trim();
      if (formattedPhone.startsWith('+')) {
        // Already has country code, use as-is
      } else if (formattedPhone.startsWith('63')) {
        // Has 63 prefix but no +, add +
        formattedPhone = '+' + formattedPhone;
      } else if (formattedPhone.startsWith('0')) {
        // Local format starting with 0, replace with +63
        formattedPhone = '+63' + formattedPhone.slice(1);
      } else {
        // Just the number without prefix, add +63
        formattedPhone = '+63' + formattedPhone;
      }

      const verifier = getRecaptchaVerifier();
      const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);

      setConfirmationResult(result);
      return { success: true, formattedPhone };
    } catch (error) {
      const recaptchaFailure =
        error?.code === 'auth/invalid-app-credential'
        || error?.code === 'auth/captcha-check-failed'
        || String(error?.message || '').toLowerCase().includes('invalid site key');
      if (recaptchaFailure) {
        clearRecaptchaVerifier();
      }

      const formattedError = formatFirebaseAuthError(error);
      console.error('Send OTP error:', {
        code: error?.code,
        message: error?.message,
        name: error?.name,
      });
      setAuthError(formattedError);
      return { success: false, error: formattedError, code: error?.code || null };
    }
  };

  // Verify OTP code
  const verifyOtp = async (code) => {
    try {
      setAuthError(null);
      if (!confirmationResult) {
        throw new Error('No confirmation result. Please request OTP first.');
      }

      const result = await confirmationResult.confirm(code);
      // Ensure token/session is fully initialized before UI transitions.
      await result.user.getIdToken();

      setConfirmationResult(null);
      return { success: true, user: result.user };
    } catch (error) {
      const formattedError = formatFirebaseAuthError(error);
      setAuthError(formattedError);
      return { success: false, error: formattedError, code: error?.code || null };
    }
  };

  // Sign in with backup recovery code
  const signInWithRecoveryCode = async (phoneNumber, recoveryCode) => {
    try {
      setAuthError(null);
      const response = await api.auth.recoverySignIn({ phoneNumber, recoveryCode });

      if (!response?.customToken) {
        throw new Error('Recovery sign-in failed');
      }

      const credential = await signInWithCustomToken(auth, response.customToken);
      return { success: true, user: credential.user };
    } catch (error) {
      const formattedError = formatFirebaseAuthError(error);
      setAuthError(formattedError);
      return { success: false, error: formattedError, code: error?.code || null };
    }
  };

  // Get backup recovery code status
  const getRecoveryStatus = async () => {
    try {
      if (!authUser) throw new Error('Not authenticated');
      const status = await api.auth.getRecoveryStatus();
      return { success: true, ...status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Generate new backup recovery codes (rotates old set)
  const generateRecoveryCodes = async () => {
    try {
      if (!authUser) throw new Error('Not authenticated');
      const result = await api.auth.generateRecoveryCodes();
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Create user profile after registration
  const createUserProfile = async (profileData) => {
    try {
      if (!authUser) throw new Error('Not authenticated');

      const userRef = doc(db, 'users', authUser.uid);
      const userData = {
        phone: authUser.phoneNumber,
        email: profileData.email || null,
        name: profileData.name,
        role: profileData.role || 'shipper',
        profileImage: null,
        facebookUrl: null,
        isVerified: false,
        isActive: true,
        onboardingComplete: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(userRef, userData);

      // Create role-specific profile
      if (profileData.role === 'shipper') {
        const shipperRef = doc(db, 'users', authUser.uid, 'shipperProfile', 'profile');
        await setDoc(shipperRef, {
          businessName: profileData.businessName || profileData.name,
          businessAddress: null,
          businessType: null,
          totalTransactions: 0,
          membershipTier: 'NEW',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else if (profileData.role === 'trucker') {
        const truckerRef = doc(db, 'users', authUser.uid, 'truckerProfile', 'profile');
        await setDoc(truckerRef, {
          businessName: profileData.businessName || profileData.name,
          licenseNumber: null,
          licenseExpiry: null,
          rating: 0,
          totalTrips: 0,
          badge: 'STARTER',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // Create wallet
      const walletRef = doc(db, 'users', authUser.uid, 'wallet', 'main');
      await setDoc(walletRef, {
        balance: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Optional one-time referral attribution (broker code).
      if (profileData.referralCode && profileData.referralCode.trim()) {
        try {
          await api.broker.applyReferralCode(profileData.referralCode.trim().toUpperCase());
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('karga_referral_code');
          }
        } catch (referralError) {
          // Do not block account creation if referral attribution fails.
          console.warn('Referral attribution skipped:', referralError?.message || referralError);
        }
      }

      setIsNewUser(false);
      return { success: true };
    } catch (error) {
      console.error('Create profile error:', error);
      return { success: false, error: error.message };
    }
  };

  // Switch user role (server-authoritative via Cloud Function)
  const switchRole = async (newRole) => {
    try {
      if (!authUser || !userProfile) throw new Error('Not authenticated');

      await api.auth.switchRole(newRole);

      return { success: true };
    } catch (error) {
      console.error('Switch role error:', error);
      return { success: false, error: error.message };
    }
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      if (!authUser || !userProfile) throw new Error('Not authenticated');

      // Update main user profile
      const userRef = doc(db, 'users', authUser.uid);
      const userUpdates = {
        updatedAt: serverTimestamp()
      };

      if (profileData.name) userUpdates.name = profileData.name;
      if (profileData.email !== undefined) userUpdates.email = profileData.email;
      if (profileData.facebookUrl !== undefined) userUpdates.facebookUrl = profileData.facebookUrl;

      await setDoc(userRef, userUpdates, { merge: true });

      // Update role-specific profile
      const currentRole = userProfile?.role || 'shipper';

      if (currentRole === 'shipper' && shipperProfile) {
        const shipperRef = doc(db, 'users', authUser.uid, 'shipperProfile', 'profile');
        const shipperUpdates = { updatedAt: serverTimestamp() };

        if (profileData.businessName !== undefined) shipperUpdates.businessName = profileData.businessName;
        if (profileData.businessAddress !== undefined) shipperUpdates.businessAddress = profileData.businessAddress;
        if (profileData.businessType !== undefined) shipperUpdates.businessType = profileData.businessType;

        await setDoc(shipperRef, shipperUpdates, { merge: true });
      } else if (currentRole === 'trucker' && truckerProfile) {
        const truckerRef = doc(db, 'users', authUser.uid, 'truckerProfile', 'profile');
        const truckerUpdates = { updatedAt: serverTimestamp() };

        if (profileData.businessName !== undefined) truckerUpdates.businessName = profileData.businessName;

        await setDoc(truckerRef, truckerUpdates, { merge: true });
      }

      return { success: true };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  // Get Firebase ID token for API calls
  // This token can be sent to the backend for verification
  const getIdToken = async (forceRefresh = false) => {
    try {
      if (!authUser) {
        return null;
      }
      const token = await authUser.getIdToken(forceRefresh);
      return token;
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  };

  const value = {
    authUser,
    userProfile,
    shipperProfile,
    truckerProfile,
    brokerProfile,
    wallet,
    loading,
    isNewUser,
    authError,
    sendOtp,
    verifyOtp,
    signInWithRecoveryCode,
    createUserProfile,
    updateProfile,
    switchRole,
    logout,
    getIdToken,
    getRecoveryStatus,
    generateRecoveryCodes,
    // Computed values
    isAuthenticated: !!authUser && !!userProfile,
    currentRole: userProfile?.role || 'shipper',
    isBroker: !!brokerProfile,
    isAdmin: !!userProfile?.isAdmin || userProfile?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
