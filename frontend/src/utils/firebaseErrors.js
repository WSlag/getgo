const loggedPermissionScopes = new Set();

export function getFirebaseErrorCode(error) {
  return String(error?.code || '').trim().toLowerCase();
}

export function getFirebaseErrorMessage(error) {
  return String(error?.message || '').trim().toLowerCase();
}

export function isPermissionDeniedError(error) {
  const code = getFirebaseErrorCode(error);
  const message = getFirebaseErrorMessage(error);
  return (
    code === 'permission-denied'
    || code === 'firestore/permission-denied'
    || message.includes('permission-denied')
    || message.includes('missing or insufficient permissions')
  );
}

export function reportFirestoreListenerError(scope, error) {
  if (isPermissionDeniedError(error)) {
    if (import.meta.env.DEV && !loggedPermissionScopes.has(scope)) {
      loggedPermissionScopes.add(scope);
      console.warn(`[firestore] Permission denied for ${scope}.`);
    }
    return;
  }

  console.error(`Error listening to ${scope}:`, error);
}

export function isFirestoreInternalAssertionError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('firestore') &&
    message.includes('internal assertion failed')
  );
}

export function safeFirestoreUnsubscribe(unsubscribe, scope = 'firestore listener') {
  if (typeof unsubscribe !== 'function') return;
  try {
    unsubscribe();
  } catch (error) {
    reportFirestoreListenerError(`${scope} unsubscribe`, error);
  }
}
