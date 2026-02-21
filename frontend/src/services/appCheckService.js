import { getToken } from 'firebase/app-check';
import { appCheck } from '../firebase';

const APP_CHECK_THROTTLE_BACKOFF_MS = 24 * 60 * 60 * 1000;
let appCheckBlockedUntil = 0;
let hasLoggedThrottleWarning = false;

function isAppCheckThrottleError(error) {
  const code = error?.code;
  return code === 'appCheck/initial-throttle' || code === 'appCheck/throttled';
}

export async function getAppCheckHeaders() {
  if (!appCheck || Date.now() < appCheckBlockedUntil) {
    return {};
  }

  try {
    const tokenResult = await getToken(appCheck, false);
    if (tokenResult?.token) {
      return { 'X-Firebase-AppCheck': tokenResult.token };
    }
  } catch (error) {
    if (isAppCheckThrottleError(error)) {
      appCheckBlockedUntil = Date.now() + APP_CHECK_THROTTLE_BACKOFF_MS;
      if (!hasLoggedThrottleWarning) {
        const httpStatus = error?.customData?.httpStatus ?? 'unknown';
        console.warn(
          `[app-check] Token exchange throttled (HTTP ${httpStatus}). ` +
          'Skipping App Check headers in this tab for 24 hours.'
        );
        hasLoggedThrottleWarning = true;
      }
    }

    // App Check is optional during monitoring mode.
  }

  return {};
}
