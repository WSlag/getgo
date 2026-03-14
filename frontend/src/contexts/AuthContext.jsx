import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signInWithCustomToken,
  signOut,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  EmailAuthProvider,
  linkWithCredential,
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, getDocFromServer, serverTimestamp } from 'firebase/firestore';
import { auth, db, waitForAppCheckInitialization } from '../firebase';
import api from '../services/api';
import { isPermissionDeniedError, reportFirestoreListenerError } from '../utils/firebaseErrors';

const AuthContext = createContext();
const RECAPTCHA_CONTAINER_ID = 'firebase-auth-recaptcha-container';
const EMAIL_MAGIC_LINK_FEATURE_ENABLED =
  import.meta.env.VITE_ENABLE_EMAIL_MAGIC_LINK === 'true'
  || Boolean(import.meta.env.DEV);
const EMAIL_MAGIC_LINK_V2_ENABLED = import.meta.env.VITE_EMAIL_MAGIC_LINK_V2_ENABLED === 'true';
const EMAIL_LINK_STORAGE_KEY = 'karga_email_link_state_v1';
const REFERRAL_CODE_STORAGE_KEY = 'karga_referral_code';
const REFERRAL_ERROR_STORAGE_KEY = 'karga_referral_attribution_last_error';
const EMAIL_LINK_GENERIC_MESSAGE = 'If an eligible account exists, a sign-in link will be sent.';
const PROFILE_LISTENER_MAX_RETRIES = 4;
const PROFILE_LISTENER_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const loggedTerminalProfileFailures = new Set();

function classifyProfileLoadError(error) {
  if (isPermissionDeniedError(error)) return 'permission-denied';
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  if (
    code.includes('unauthenticated')
    || code.includes('requires-recent-login')
    || message.includes('unauthenticated')
    || message.includes('auth')
    || message.includes('token')
  ) {
    return 'unauthenticated';
  }
  if (
    code.includes('unavailable')
    || code.includes('deadline-exceeded')
    || code.includes('resource-exhausted')
    || message.includes('network')
    || message.includes('timeout')
    || message.includes('offline')
  ) {
    return 'network';
  }
  return 'unknown';
}

function toProfileLoadError(error) {
  const code = String(error?.code || 'unknown');
  const message = String(error?.message || 'Failed to load profile.');
  const classification = classifyProfileLoadError(error);
  return {
    code,
    message,
    classification,
    retryable: true,
  };
}

function getProfileLoadUserMessage(profileError) {
  const classification = profileError?.classification || 'unknown';
  if (classification === 'permission-denied') {
    return 'We could not load your profile due to permissions. Please retry or sign in again.';
  }
  if (classification === 'unauthenticated') {
    return 'Your session needs to be refreshed. Please retry. If it keeps failing, sign in again.';
  }
  if (classification === 'network') {
    return 'Temporary network issue while loading your profile. Retrying now.';
  }
  return 'We could not load your profile right now. Please retry.';
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return null;
  return email;
}

function normalizeReferralCodeForStorage(value) {
  return String(value || '').trim().toUpperCase();
}

function redactReferralCode(value) {
  const code = normalizeReferralCodeForStorage(value);
  if (!code) return '';
  if (code.length <= 4) return '*'.repeat(code.length);
  return `${code.slice(0, 2)}${'*'.repeat(Math.max(1, code.length - 4))}${code.slice(-2)}`;
}

function hashTelemetryValue(value) {
  const raw = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function isSelfReferralError(error) {
  const reason = String(error?.details?.reason || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return reason === 'self-referral-not-allowed' || message.includes('self-referral');
}

function resolveEmailLinkCallbackUrl() {
  if (typeof window === 'undefined') {
    throw new Error('Email link sign-in requires a browser environment.');
  }

  const configuredUrl = String(
    import.meta.env.VITE_MAGIC_LINK_CALLBACK_URL
    || import.meta.env.VITE_SITE_URL
    || ''
  ).trim();

  if (!configuredUrl) {
    return window.location.origin;
  }

  try {
    return new URL(configuredUrl).toString();
  } catch {
    try {
      return new URL(configuredUrl, window.location.origin).toString();
    } catch {
      if (import.meta.env.DEV) {
        console.warn(
          `[auth] Invalid email-link callback URL "${configuredUrl}". Falling back to ${window.location.origin}.`
        );
      }
      return window.location.origin;
    }
  }
}

function buildEmailLinkActionSettings(mode = 'signin') {
  if (typeof window === 'undefined') {
    throw new Error('Email link sign-in requires a browser environment.');
  }

  const callbackUrl = new URL(resolveEmailLinkCallbackUrl());
  if (import.meta.env.DEV && callbackUrl.origin !== window.location.origin) {
    console.info(
      `[auth] Using canonical email-link callback origin ${callbackUrl.origin} (current origin: ${window.location.origin}).`
    );
  }
  callbackUrl.searchParams.set('emailLinkMode', mode);
  return {
    url: callbackUrl.toString(),
    handleCodeInApp: true,
  };
}

function cleanupEmailLinkUrl() {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const queryKeysToRemove = [
    'apiKey',
    'mode',
    'oobCode',
    'continueUrl',
    'lang',
    'tenantId',
    'emailLinkMode',
  ];

  queryKeysToRemove.forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function resolveEmailLinkModeFromUrl(rawUrl) {
  try {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.searchParams.get('emailLinkMode')) {
      return parsedUrl.searchParams.get('emailLinkMode');
    }

    const continueUrl = parsedUrl.searchParams.get('continueUrl');
    if (!continueUrl) return null;
    const parsedContinueUrl = new URL(continueUrl);
    return parsedContinueUrl.searchParams.get('emailLinkMode');
  } catch {
    return null;
  }
}

function shouldFallbackToLegacyMagicLinkRequest(error) {
  const code = String(error?.code || '').toLowerCase();
  return (
    code.includes('not-found')
    || code.includes('unimplemented')
    || code.includes('failed-precondition')
  );
}

function readPendingEmailLinkState() {
  if (typeof window === 'undefined') return null;
  try {
    const rawValue = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object') return null;

    const email = normalizeEmail(parsed.email);
    const mode = parsed.mode === 'link' ? 'link' : 'signin';
    const uid = typeof parsed.uid === 'string' ? parsed.uid : null;

    return email ? { email, mode, uid } : null;
  } catch {
    return null;
  }
}

function writePendingEmailLinkState(payload) {
  if (typeof window === 'undefined') return;
  const email = normalizeEmail(payload?.email);
  if (!email) return;
  const mode = payload?.mode === 'link' ? 'link' : 'signin';
  const uid = typeof payload?.uid === 'string' ? payload.uid : null;
  window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, JSON.stringify({
    email,
    mode,
    uid,
    createdAtMs: Date.now(),
  }));
}

function clearPendingEmailLinkState() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
}

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
    'auth/invalid-email': 'Invalid email format.',
    'auth/missing-email': 'Email is required.',
    'auth/invalid-action-code': 'This email link is invalid or expired. Request a new one.',
    'auth/email-already-in-use': 'This email is already linked to another account.',
    'auth/provider-already-linked': 'This email is already linked to your account.',
    'auth/credential-already-in-use': 'This email is already linked to another account.',
    'auth/user-disabled': 'This account is disabled.',
    'auth/operation-not-allowed': 'Email link authentication is not enabled.',
    'permission-denied': 'Invalid recovery credentials.',
    'functions/permission-denied': 'Invalid recovery credentials.',
    'functions/failed-precondition': 'This account is not eligible for email backup login.',
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
  const [truckerCompliance, setTruckerCompliance] = useState(null);
  const [brokerProfile, setBrokerProfile] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [profileLoadStatus, setProfileLoadStatus] = useState('idle');
  const [profileLoadError, setProfileLoadError] = useState(null);
  const [profileRetryNonce, setProfileRetryNonce] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [referralAttributionEvent, setReferralAttributionEvent] = useState(null);
  const recaptchaVerifierRef = useRef(null);
  const profileRetryAttemptRef = useRef(0);
  const profileRetryTimerRef = useRef(null);
  const lastKnownGoodProfileRef = useRef(new Map());

  const clearProfileRetryTimer = useCallback(() => {
    if (profileRetryTimerRef.current) {
      clearTimeout(profileRetryTimerRef.current);
      profileRetryTimerRef.current = null;
    }
  }, []);

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

  useEffect(() => {
    return () => {
      clearProfileRetryTimer();
    };
  }, [clearProfileRetryTimer]);

  const retryProfileLoad = useCallback(async () => {
    if (!authUser?.uid) return;
    clearProfileRetryTimer();
    profileRetryAttemptRef.current = 0;
    setProfileLoadError(null);
    setProfileLoadStatus('loading');
    setLoading(true);
    setProfileRetryNonce((prev) => prev + 1);
  }, [authUser?.uid, clearProfileRetryTimer]);

  // Listen to auth state changes
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (!user) {
        clearProfileRetryTimer();
        profileRetryAttemptRef.current = 0;
        lastKnownGoodProfileRef.current.clear();
        setUserProfile(null);
        setShipperProfile(null);
        setTruckerProfile(null);
        setTruckerCompliance(null);
        setBrokerProfile(null);
        setWallet(null);
        setIsNewUser(false);
        setProfileLoadStatus('idle');
        setProfileLoadError(null);
        setReferralAttributionEvent(null);
        setAuthError(null);
        setLoading(false);
      } else {
        // Keep app in loading state until profile listener resolves new/existing user.
        // This avoids guest-shell flicker right after OTP verification.
        clearProfileRetryTimer();
        profileRetryAttemptRef.current = 0;
        const lastKnownProfile = lastKnownGoodProfileRef.current.get(user.uid) || null;
        setLoading(true);
        setUserProfile(lastKnownProfile);
        setShipperProfile(null);
        setTruckerProfile(null);
        setTruckerCompliance(null);
        setBrokerProfile(null);
        setWallet(null);
        setIsNewUser(false);
        setProfileLoadStatus('loading');
        setProfileLoadError(null);
        setAuthError(null);
      }
    });
    return unsubAuth;
  }, [clearProfileRetryTimer]);

  // Listen to user profile changes
  useEffect(() => {
    if (!authUser) return;

    let disposed = false;
    const userRef = doc(db, 'users', authUser.uid);
    const applyProfileResolution = ({ exists, profile }) => {
      clearProfileRetryTimer();
      profileRetryAttemptRef.current = 0;
      setProfileLoadError(null);
      setAuthError(null);

      if (exists && profile) {
        const nextProfile = profile.id ? profile : { id: authUser.uid, ...profile };
        lastKnownGoodProfileRef.current.set(authUser.uid, nextProfile);
        setUserProfile(nextProfile);
        setIsNewUser(false);
      } else {
        // User authenticated but no profile yet - new user
        lastKnownGoodProfileRef.current.delete(authUser.uid);
        setUserProfile(null);
        setIsNewUser(true);
      }

      setProfileLoadStatus('ready');
      setLoading(false);
    };

    const applyProfileSnapshot = (snap) => {
      applyProfileResolution(
        snap.exists()
          ? { exists: true, profile: { id: snap.id, ...snap.data() } }
          : { exists: false, profile: null }
      );
    };

    const logTerminalProfileFailure = (profileError, attempts) => {
      const fingerprint = `${authUser.uid}:${profileError.code}:${profileError.classification}`;
      if (loggedTerminalProfileFailures.has(fingerprint)) return;
      loggedTerminalProfileFailures.add(fingerprint);
      console.error('[auth-profile] terminal_profile_load_failure', {
        uid: authUser.uid,
        code: profileError.code,
        classification: profileError.classification,
        attempts,
      });
    };

    const failProfileLoad = (profileError, attempts) => {
      const userMessage = getProfileLoadUserMessage(profileError);
      setProfileLoadError({
        ...profileError,
        attempts,
        userMessage,
      });
      setProfileLoadStatus('failed');
      setLoading(false);

      if (profileError.classification === 'permission-denied') {
        setAuthError('Unable to load your profile due to insufficient permissions. Please sign in again.');
      } else if (profileError.classification === 'unauthenticated') {
        setAuthError('Your session expired while loading profile data. Please sign in again if retry fails.');
      }

      logTerminalProfileFailure(profileError, attempts);
    };

    const recoverProfileWithFallback = async () => {
      try {
        await waitForAppCheckInitialization();
        await authUser.getIdToken(true);
      } catch {
        // Continue to server read attempt.
      }

      try {
        const serverSnap = await getDocFromServer(userRef);
        if (disposed) {
          return { recovered: false, source: null };
        }
        applyProfileSnapshot(serverSnap);
        return { recovered: true, source: 'server' };
      } catch (recoveryError) {
        reportFirestoreListenerError('user profile recovery', recoveryError);
      }

      try {
        const fallbackResult = await api.auth.getCurrentUserProfile();
        if (disposed) {
          return { recovered: false, source: null };
        }
        const exists = fallbackResult?.exists === true;
        const profile = exists ? (fallbackResult.profile || null) : null;
        applyProfileResolution({ exists, profile });
        console.warn('[auth-profile] recovered_profile_via_callable_fallback', {
          uid: authUser.uid,
          source: 'authGetCurrentUserProfile',
        });
        return { recovered: true, source: 'callable' };
      } catch (callableError) {
        console.error('[auth-profile] callable profile fallback failed:', callableError);
      }

      return { recovered: false, source: null };
    };

    const scheduleRetry = (profileError) => {
      clearProfileRetryTimer();
      const nextAttempt = profileRetryAttemptRef.current + 1;
      profileRetryAttemptRef.current = nextAttempt;

      if (nextAttempt > PROFILE_LISTENER_MAX_RETRIES) {
        failProfileLoad(profileError, nextAttempt - 1);
        return;
      }

      const retryDelayMs =
        PROFILE_LISTENER_RETRY_DELAYS_MS[Math.min(nextAttempt - 1, PROFILE_LISTENER_RETRY_DELAYS_MS.length - 1)];

      setProfileLoadError({
        ...profileError,
        attempts: nextAttempt,
        retryInMs: retryDelayMs,
        userMessage: getProfileLoadUserMessage(profileError),
      });
      setProfileLoadStatus('retrying');
      setLoading(true);

      profileRetryTimerRef.current = setTimeout(() => {
        if (disposed) return;
        setProfileRetryNonce((prev) => prev + 1);
      }, retryDelayMs);
    };

    const unsubProfile = onSnapshot(
      userRef,
      (snap) => {
        applyProfileSnapshot(snap);
      },
      async (error) => {
        reportFirestoreListenerError('user profile', error);
        const profileError = toProfileLoadError(error);

        const recoveryResult = await recoverProfileWithFallback();
        if (disposed) return;
        if (recoveryResult.recovered && recoveryResult.source === 'server') {
          // Restore a realtime listener after one-shot recovery.
          setProfileRetryNonce((prev) => prev + 1);
          return;
        }
        if (recoveryResult.recovered) return;

        scheduleRetry(profileError);
      }
    );

    return () => {
      disposed = true;
      clearProfileRetryTimer();
      unsubProfile();
    };
  }, [authUser, clearProfileRetryTimer, profileRetryNonce]);

  // Listen to shipper profile
  useEffect(() => {
    if (!authUser || !userProfile) return;

    const shipperRef = doc(db, 'users', authUser.uid, 'shipperProfile', 'profile');
    const unsubShipper = onSnapshot(shipperRef, (snap) => {
      setShipperProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    }, (error) => {
      reportFirestoreListenerError('shipper profile', error);
      setShipperProfile(null);
    });

    return unsubShipper;
  }, [authUser, userProfile]);

  // Best-effort retry path: if a referral code is still stored after login/profile creation
  // and the account has no broker attribution yet, attempt exactly once per uid+code.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!authUser?.uid || !userProfile || isNewUser) return;
    if (userProfile.referredByBrokerId) return;

    const storedCode = normalizeReferralCodeForStorage(window.localStorage.getItem(REFERRAL_CODE_STORAGE_KEY));
    if (!storedCode) return;

    const retryKey = `karga_referral_retry_attempted_${authUser.uid}:${storedCode}`;
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(retryKey)) return;
    if (typeof window !== 'undefined') window.sessionStorage.setItem(retryKey, '1');

    let cancelled = false;

    const attemptRetry = async () => {
      try {
        await api.broker.applyReferralCode(storedCode);
        if (cancelled) return;
        window.localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
        window.localStorage.removeItem(REFERRAL_ERROR_STORAGE_KEY);
        console.info('[referral-attribution]', {
          phase: 'post_login_retry',
          status: 'success',
          uid: authUser.uid,
          referralCodeHash: hashTelemetryValue(storedCode),
          referralCodeRedacted: redactReferralCode(storedCode),
        });
        setReferralAttributionEvent({
          id: `${Date.now()}-${Math.random()}`,
          status: 'success',
          phase: 'post_login_retry',
          message: 'Referral code linked successfully.',
        });
      } catch (retryError) {
        if (cancelled) return;
        const terminalSelfReferral = isSelfReferralError(retryError);
        const eventPayload = {
          phase: 'post_login_retry',
          status: 'failed',
          uid: authUser.uid,
          referralCodeHash: hashTelemetryValue(storedCode),
          referralCodeRedacted: redactReferralCode(storedCode),
          errorCode: retryError?.code || null,
          errorMessage: retryError?.message || 'referral_apply_failed',
        };
        console.warn('[referral-attribution]', eventPayload);
        if (terminalSelfReferral) {
          window.localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
          window.localStorage.removeItem(REFERRAL_ERROR_STORAGE_KEY);
        } else {
          window.localStorage.setItem(REFERRAL_ERROR_STORAGE_KEY, JSON.stringify({
            ...eventPayload,
            capturedAtMs: Date.now(),
          }));
        }
        setReferralAttributionEvent({
          id: `${Date.now()}-${Math.random()}`,
          status: 'failed',
          phase: 'post_login_retry',
          message: terminalSelfReferral
            ? 'Referral code cannot be applied because self-referral is not allowed.'
            : 'Referral code could not be linked yet. We will keep trying automatically.',
          telemetry: eventPayload,
        });
      }
    };

    void attemptRetry();

    return () => {
      cancelled = true;
    };
  }, [authUser?.uid, isNewUser, userProfile]);

  // Listen to trucker profile
  useEffect(() => {
    if (!authUser || !userProfile) return;

    const truckerRef = doc(db, 'users', authUser.uid, 'truckerProfile', 'profile');
    const unsubTrucker = onSnapshot(truckerRef, (snap) => {
      setTruckerProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    }, (error) => {
      reportFirestoreListenerError('trucker profile', error);
      setTruckerProfile(null);
    });

    return unsubTrucker;
  }, [authUser, userProfile]);

  // Listen to trucker compliance (server-managed)
  useEffect(() => {
    if (!authUser || !userProfile) return;

    const complianceRef = doc(db, 'users', authUser.uid, 'truckerCompliance', 'profile');
    const unsubCompliance = onSnapshot(complianceRef, (snap) => {
      setTruckerCompliance(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    }, (error) => {
      reportFirestoreListenerError('trucker compliance', error);
      setTruckerCompliance(null);
    });

    return unsubCompliance;
  }, [authUser, userProfile]);

  // Listen to broker profile
  useEffect(() => {
    if (!authUser || !userProfile) return;

    const brokerRef = doc(db, 'users', authUser.uid, 'brokerProfile', 'profile');
    const unsubBroker = onSnapshot(brokerRef, (snap) => {
      setBrokerProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    }, (error) => {
      reportFirestoreListenerError('broker profile', error);
      setBrokerProfile(null);
    });

    return unsubBroker;
  }, [authUser, userProfile]);

  // Listen to wallet
  useEffect(() => {
    if (!authUser || !userProfile) return;

    const walletRef = doc(db, 'users', authUser.uid, 'wallet', 'main');
    const unsubWallet = onSnapshot(walletRef, (snap) => {
      setWallet(snap.exists() ? { id: snap.id, ...snap.data() } : { balance: 0 });
    }, (error) => {
      reportFirestoreListenerError('wallet', error);
      setWallet({ balance: 0 });
    });

    return unsubWallet;
  }, [authUser, userProfile]);

  const requestEmailMagicLink = useCallback(async (email) => {
    if (!EMAIL_MAGIC_LINK_FEATURE_ENABLED) {
      return { success: false, error: 'Email backup login is currently unavailable.' };
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    try {
      setAuthError(null);
      await waitForAppCheckInitialization();

      if (EMAIL_MAGIC_LINK_V2_ENABLED) {
        writePendingEmailLinkState({ email: normalizedEmail, mode: 'signin' });
        try {
          const v2Response = await api.auth.requestEmailMagicLinkSignInV2({ email: normalizedEmail });
          if (v2Response?.retryAfterSeconds) {
            clearPendingEmailLinkState();
            return {
              success: false,
              error: `Too many attempts. Please wait ${v2Response.retryAfterSeconds}s and try again.`,
            };
          }

          return {
            success: true,
            message: v2Response?.message || EMAIL_LINK_GENERIC_MESSAGE,
          };
        } catch (error) {
          if (!shouldFallbackToLegacyMagicLinkRequest(error)) {
            throw error;
          }
          if (import.meta.env.DEV) {
            console.warn('[auth] Falling back to legacy magic-link request endpoint:', error?.code || error?.message);
          }
        }
      }

      const response = await api.auth.prepareEmailMagicLinkSignIn({ email: normalizedEmail });

      if (response?.retryAfterSeconds) {
        return {
          success: false,
          error: `Too many attempts. Please wait ${response.retryAfterSeconds}s and try again.`,
        };
      }

      if (response?.shouldSend) {
        writePendingEmailLinkState({ email: normalizedEmail, mode: 'signin' });
        await sendSignInLinkToEmail(auth, normalizedEmail, buildEmailLinkActionSettings('signin'));
      } else {
        clearPendingEmailLinkState();
      }

      return {
        success: true,
        message: response?.message || EMAIL_LINK_GENERIC_MESSAGE,
      };
    } catch (error) {
      const formattedError = formatFirebaseAuthError(error);
      setAuthError(formattedError);
      clearPendingEmailLinkState();
      return { success: false, error: formattedError, code: error?.code || null };
    }
  }, []);

  const startEmailLinking = useCallback(async (email) => {
    if (!EMAIL_MAGIC_LINK_FEATURE_ENABLED) {
      return { success: false, error: 'Email backup login is currently unavailable.' };
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    try {
      setAuthError(null);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }
      if (!currentUser.phoneNumber) {
        throw new Error('Phone authentication is required before linking email login.');
      }

      writePendingEmailLinkState({
        email: normalizedEmail,
        mode: 'link',
        uid: currentUser.uid,
      });

      await waitForAppCheckInitialization();
      await sendSignInLinkToEmail(auth, normalizedEmail, buildEmailLinkActionSettings('link'));

      return {
        success: true,
        message: 'Check your email and open the link to enable backup email login.',
      };
    } catch (error) {
      const formattedError = formatFirebaseAuthError(error);
      setAuthError(formattedError);
      clearPendingEmailLinkState();
      return { success: false, error: formattedError, code: error?.code || null };
    }
  }, []);

  const completeEmailLinkFromUrl = useCallback(async (rawUrl = '') => {
    if (!EMAIL_MAGIC_LINK_FEATURE_ENABLED) {
      return { success: false, error: 'Email backup login is currently unavailable.' };
    }

    const targetUrl = rawUrl || (typeof window !== 'undefined' ? window.location.href : '');
    if (!targetUrl || !isSignInWithEmailLink(auth, targetUrl)) {
      return { success: false, error: 'Invalid email sign-in link.' };
    }

    const pendingState = readPendingEmailLinkState();
    const resolvedMode =
      pendingState?.mode
      || resolveEmailLinkModeFromUrl(targetUrl)
      || 'signin';
    const normalizedEmail = normalizeEmail(pendingState?.email);

    if (!normalizedEmail) {
      clearPendingEmailLinkState();
      cleanupEmailLinkUrl();
      return { success: false, error: 'Missing email context. Request a new link and try again.' };
    }

    try {
      setAuthError(null);

      if (resolvedMode === 'link') {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('Sign in with phone first, then open the email link again.');
        }
        if (!currentUser.phoneNumber) {
          throw new Error('Phone authentication is required before linking email login.');
        }
        if (pendingState?.uid && pendingState.uid !== currentUser.uid) {
          throw new Error('This link was requested for a different account.');
        }

        const emailCredential = EmailAuthProvider.credentialWithLink(normalizedEmail, targetUrl);
        try {
          await linkWithCredential(currentUser, emailCredential);
        } catch (error) {
          const errorCode = String(error?.code || '');
          const currentEmail = normalizeEmail(auth.currentUser?.email);
          if (!(errorCode === 'auth/provider-already-linked' && currentEmail === normalizedEmail)) {
            throw error;
          }
        }
        await currentUser.reload();

        const refreshedUser = auth.currentUser;
        const refreshedEmail = normalizeEmail(refreshedUser?.email);
        if (!refreshedUser?.emailVerified || refreshedEmail !== normalizedEmail) {
          throw new Error('Email verification did not complete. Request a new link.');
        }

        await api.auth.finalizeEmailLinking({ email: normalizedEmail });
        clearPendingEmailLinkState();
        cleanupEmailLinkUrl();
        return { success: true, mode: 'link' };
      }

      const credential = await signInWithEmailLink(auth, normalizedEmail, targetUrl);
      await credential.user.getIdToken(true);

      if (!credential.user.phoneNumber) {
        await signOut(auth);
        throw new Error('Phone-linked account is required for email fallback sign-in.');
      }

      const userSnap = await getDoc(doc(db, 'users', credential.user.uid));
      const userData = userSnap.exists() ? (userSnap.data() || {}) : null;
      const isEligible = Boolean(
        userData
        && userData.emailAuthEnabled === true
        && userData.emailAuthVerified === true
        && userData.isActive !== false
        && String(userData.accountStatus || '').toLowerCase() !== 'suspended'
      );

      if (!isEligible) {
        await signOut(auth);
        throw new Error('Email fallback is not enabled for this account.');
      }

      clearPendingEmailLinkState();
      cleanupEmailLinkUrl();
      return { success: true, mode: 'signin' };
    } catch (error) {
      const formattedError = formatFirebaseAuthError(error);
      setAuthError(formattedError);
      clearPendingEmailLinkState();
      cleanupEmailLinkUrl();
      return { success: false, error: formattedError, code: error?.code || null };
    }
  }, []);

  const disableEmailFallback = useCallback(async () => {
    try {
      if (!auth.currentUser) throw new Error('Not authenticated');
      await api.auth.disableEmailMagicLink();
      return { success: true };
    } catch (error) {
      const formattedError = formatFirebaseAuthError(error);
      setAuthError(formattedError);
      return { success: false, error: formattedError, code: error?.code || null };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const maybeCompleteEmailLink = async () => {
      if (typeof window === 'undefined' || !EMAIL_MAGIC_LINK_FEATURE_ENABLED) return;
      const currentUrl = window.location.href;
      if (!isSignInWithEmailLink(auth, currentUrl)) return;

      setLoading(true);
      const result = await completeEmailLinkFromUrl(currentUrl);

      if (cancelled) return;
      if (!result.success) {
        setAuthError(result.error || 'Email sign-in failed. Request a new link.');
      }

      if (!(result.success && result.mode === 'signin')) {
        setLoading(false);
      }
    };

    void maybeCompleteEmailLink();

    return () => {
      cancelled = true;
    };
  }, [completeEmailLinkFromUrl]);

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

      await waitForAppCheckInitialization();
      // NOTE: Do NOT preload the reCAPTCHA Enterprise script here.
      // App Check already initialises grecaptcha.enterprise with its own site key.
      // Pre-loading a second Enterprise script with the Identity Platform key
      // conflicts with the singleton grecaptcha.enterprise instance, causing
      // INVALID_APP_CREDENTIAL errors on sendVerificationCode.
      // Firebase Auth SDK (v11+) handles its own reCAPTCHA flow internally.
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
        emailAuthEnabled: false,
        emailAuthVerified: false,
        emailLinkedAt: null,
        emailAuthUpdatedAt: null,
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
      let referralAttribution = null;
      if (profileData.referralCode && profileData.referralCode.trim()) {
        const normalizedReferralCode = normalizeReferralCodeForStorage(profileData.referralCode);
        try {
          await api.broker.applyReferralCode(normalizedReferralCode);
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
            window.localStorage.removeItem(REFERRAL_ERROR_STORAGE_KEY);
          }
          referralAttribution = {
            status: 'success',
            message: 'Referral code linked successfully.',
          };
          console.info('[referral-attribution]', {
            phase: 'registration',
            status: 'success',
            uid: authUser.uid,
            referralCodeHash: hashTelemetryValue(normalizedReferralCode),
            referralCodeRedacted: redactReferralCode(normalizedReferralCode),
          });
        } catch (referralError) {
          const terminalSelfReferral = isSelfReferralError(referralError);
          // Do not block account creation if referral attribution fails.
          referralAttribution = {
            status: 'failed',
            message: terminalSelfReferral
              ? 'Profile created, but self-referral is not allowed. Please use another broker referral code.'
              : 'Profile created, but referral code could not be linked yet.',
            telemetry: {
              uid: authUser.uid,
              errorCode: referralError?.code || null,
              errorMessage: referralError?.message || 'referral_apply_failed',
              referralCodeHash: hashTelemetryValue(normalizedReferralCode),
              referralCodeRedacted: redactReferralCode(normalizedReferralCode),
            },
          };
          if (typeof window !== 'undefined') {
            if (terminalSelfReferral) {
              window.localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
              window.localStorage.removeItem(REFERRAL_ERROR_STORAGE_KEY);
            } else {
              window.localStorage.setItem(REFERRAL_ERROR_STORAGE_KEY, JSON.stringify({
                ...referralAttribution.telemetry,
                phase: 'registration',
                capturedAtMs: Date.now(),
              }));
            }
          }
          console.warn('[referral-attribution]', {
            phase: 'registration',
            status: 'failed',
            ...referralAttribution.telemetry,
          });
        }
      }

      setIsNewUser(false);
      return { success: true, referralAttribution };
    } catch (error) {
      console.error('Create profile error:', error);
      return { success: false, error: error.message };
    }
  };

  const clearReferralAttributionEvent = useCallback(() => {
    setReferralAttributionEvent(null);
  }, []);

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
    truckerCompliance,
    brokerProfile,
    wallet,
    loading,
    isNewUser,
    profileLoadStatus,
    profileLoadError,
    authError,
    sendOtp,
    verifyOtp,
    requestEmailMagicLink,
    startEmailLinking,
    completeEmailLinkFromUrl,
    disableEmailFallback,
    signInWithRecoveryCode,
    createUserProfile,
    updateProfile,
    switchRole,
    logout,
    getIdToken,
    getRecoveryStatus,
    generateRecoveryCodes,
    retryProfileLoad,
    referralAttributionEvent,
    clearReferralAttributionEvent,
    // Computed values
    isAuthenticated: !!authUser && !!userProfile,
    currentRole: userProfile?.role || 'shipper',
    isBroker: !!brokerProfile || userProfile?.isBroker === true,
    isAdmin: !!userProfile?.isAdmin || userProfile?.role === 'admin',
    emailMagicLinkEnabled: EMAIL_MAGIC_LINK_FEATURE_ENABLED,
    emailAuthStatus: {
      email: userProfile?.email || null,
      enabled: userProfile?.emailAuthEnabled === true,
      verified: userProfile?.emailAuthVerified === true,
      linked: Boolean(userProfile?.emailLinkedAt),
    },
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
