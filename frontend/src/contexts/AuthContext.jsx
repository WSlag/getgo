import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

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

  // Setup recaptcha verifier
  const setupRecaptcha = (buttonId) => {
    try {
      // Clear existing verifier if it exists to avoid stale state
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          // Ignore clear errors
        }
        window.recaptchaVerifier = null;
      }

      window.recaptchaVerifier = new RecaptchaVerifier(auth, buttonId, {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          // Reset reCAPTCHA
          window.recaptchaVerifier = null;
        }
      });

      return window.recaptchaVerifier;
    } catch (error) {
      console.error('Recaptcha setup error:', error);
      throw error;
    }
  };

  // Send OTP to phone number
  const sendOtp = async (phoneNumber, buttonId = 'send-otp-button') => {
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

      const recaptchaVerifier = setupRecaptcha(buttonId);

      // Render the reCAPTCHA widget before signing in
      await recaptchaVerifier.render();

      const result = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);

      // Clear reCAPTCHA after successful OTP send to prevent it from intercepting future clicks
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          // Ignore clear errors
        }
        window.recaptchaVerifier = null;
      }

      setConfirmationResult(result);
      return { success: true, formattedPhone };
    } catch (error) {
      setAuthError(error.message);
      // Reset recaptcha on error
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          // Ignore clear errors
        }
        window.recaptchaVerifier = null;
      }
      return { success: false, error: error.message };
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

      setConfirmationResult(null);
      return { success: true, user: result.user };
    } catch (error) {
      setAuthError(error.message);
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
        updatedAt: serverTimestamp()
      });

      setIsNewUser(false);
      return { success: true };
    } catch (error) {
      console.error('Create profile error:', error);
      return { success: false, error: error.message };
    }
  };

  // Switch user role
  const switchRole = async (newRole) => {
    try {
      if (!authUser || !userProfile) throw new Error('Not authenticated');

      const userRef = doc(db, 'users', authUser.uid);
      await setDoc(userRef, { role: newRole, updatedAt: serverTimestamp() }, { merge: true });

      // Create role profile if it doesn't exist
      if (newRole === 'shipper') {
        const shipperRef = doc(db, 'users', authUser.uid, 'shipperProfile', 'profile');
        const shipperSnap = await getDoc(shipperRef);
        if (!shipperSnap.exists()) {
          await setDoc(shipperRef, {
            businessName: userProfile.name,
            businessAddress: null,
            businessType: null,
            totalTransactions: 0,
            membershipTier: 'NEW',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      } else if (newRole === 'trucker') {
        const truckerRef = doc(db, 'users', authUser.uid, 'truckerProfile', 'profile');
        const truckerSnap = await getDoc(truckerRef);
        if (!truckerSnap.exists()) {
          await setDoc(truckerRef, {
            businessName: userProfile.name,
            licenseNumber: null,
            licenseExpiry: null,
            rating: 0,
            totalTrips: 0,
            badge: 'STARTER',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

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
      // Clear recaptcha
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
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
    createUserProfile,
    updateProfile,
    switchRole,
    logout,
    getIdToken,
    // Computed values
    isAuthenticated: !!authUser && !!userProfile,
    currentRole: userProfile?.role || 'shipper',
    isBroker: !!brokerProfile,
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
