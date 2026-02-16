import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

const HOME_CARD_COOLDOWN_DAYS = 7; // Reappear after 7 days if dismissed

export function useBrokerOnboarding(userId, isBroker) {
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen to onboarding tracking document
  useEffect(() => {
    if (!userId || isBroker) {
      setTracking(null);
      setLoading(false);
      return;
    }

    const trackingRef = doc(db, 'users', userId, 'brokerOnboarding', 'tracking');
    const unsubscribe = onSnapshot(
      trackingRef,
      (snap) => {
        if (snap.exists()) {
          setTracking({ id: snap.id, ...snap.data() });
        } else {
          // Initialize tracking document for new users
          const initialData = {
            userId,
            onboardingShown: false,
            onboardingDeclined: false,
            onboardingCompletedAt: null,
            homeCardShown: false,
            homeCardDismissCount: 0,
            homeCardLastDismissedAt: null,
            homeCardNextShowAt: null,
            triggersActivated: [],
            lastTriggerAt: null,
            passiveReminderCount: 0,
            lastPassiveReminderAt: null,
            nextPassiveReminderAt: null,
            convertedToBroker: false,
            convertedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          setDoc(trackingRef, initialData)
            .then(() => setTracking({ id: 'tracking', ...initialData }))
            .catch(console.error);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to broker onboarding tracking:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userId, isBroker]);

  // Mark onboarding shown
  const markOnboardingShown = useCallback(async () => {
    if (!userId) return;
    const trackingRef = doc(db, 'users', userId, 'brokerOnboarding', 'tracking');
    await setDoc(trackingRef, {
      onboardingShown: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [userId]);

  // Mark onboarding declined
  const markOnboardingDeclined = useCallback(async () => {
    if (!userId) return;
    const trackingRef = doc(db, 'users', userId, 'brokerOnboarding', 'tracking');

    // Calculate next show date (7 days from now for home card)
    const nextShowDate = new Date();
    nextShowDate.setDate(nextShowDate.getDate() + HOME_CARD_COOLDOWN_DAYS);

    await setDoc(trackingRef, {
      onboardingDeclined: true,
      homeCardNextShowAt: Timestamp.fromDate(nextShowDate),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [userId]);

  // Dismiss home card
  const dismissHomeCard = useCallback(async () => {
    if (!userId) return;
    const trackingRef = doc(db, 'users', userId, 'brokerOnboarding', 'tracking');

    const now = new Date();
    const nextShowDate = new Date(now);
    nextShowDate.setDate(nextShowDate.getDate() + HOME_CARD_COOLDOWN_DAYS);

    await setDoc(trackingRef, {
      homeCardDismissCount: (tracking?.homeCardDismissCount || 0) + 1,
      homeCardLastDismissedAt: Timestamp.fromDate(now),
      homeCardNextShowAt: Timestamp.fromDate(nextShowDate),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [userId, tracking]);

  // Activate trigger
  const activateTrigger = useCallback(async (triggerName) => {
    if (!userId || !tracking) return;
    const trackingRef = doc(db, 'users', userId, 'brokerOnboarding', 'tracking');

    const currentTriggers = tracking?.triggersActivated || [];
    if (currentTriggers.includes(triggerName)) {
      return; // Already activated
    }

    const now = new Date();
    const nextShowDate = new Date(now);
    nextShowDate.setDate(nextShowDate.getDate() + HOME_CARD_COOLDOWN_DAYS);

    // Use setDoc with merge to handle both create and update
    await setDoc(trackingRef, {
      triggersActivated: [...currentTriggers, triggerName],
      lastTriggerAt: Timestamp.fromDate(now),
      homeCardNextShowAt: Timestamp.fromDate(nextShowDate), // Reset cooldown
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [userId, tracking]);

  // Check if should show home card
  const shouldShowHomeCard = useMemo(() => {
    if (!tracking || isBroker) return false;

    const now = new Date();
    const nextShowAt = tracking.homeCardNextShowAt?.toDate?.() || null;

    // Don't show if dismissed recently and cooldown not expired
    if (nextShowAt && now < nextShowAt) {
      return false;
    }

    // Show if onboarding was declined (Tier 2 re-engagement)
    if (tracking.onboardingDeclined) {
      return true;
    }

    // Show if any trigger was activated
    if (tracking.triggersActivated && tracking.triggersActivated.length > 0) {
      return true;
    }

    return false;
  }, [tracking, isBroker]);

  // Mark converted to broker
  const markConverted = useCallback(async () => {
    if (!userId) return;
    const trackingRef = doc(db, 'users', userId, 'brokerOnboarding', 'tracking');
    await setDoc(trackingRef, {
      convertedToBroker: true,
      convertedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, [userId]);

  return {
    tracking,
    loading,
    shouldShowHomeCard,
    markOnboardingShown,
    markOnboardingDeclined,
    dismissHomeCard,
    activateTrigger,
    markConverted,
  };
}
