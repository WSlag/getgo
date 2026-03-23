/**
 * PushNotificationBanner
 * Soft in-app prompt asking the user to enable push notifications.
 * Only shown when:
 *   - Notification.permission === 'default' (not yet decided)
 *   - Push is not yet registered (isRegistered === false)
 *   - Not dismissed within the last 7 days
 *
 * Auto-hides once push is activated (isRegistered flips to true).
 * On dismiss, stores a timestamp in localStorage — banner won't reappear for 7 days.
 */

const DISMISS_KEY = 'karga.push.dismissedAt';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function wasDismissedRecently() {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function PushNotificationBanner({ onEnable, onDismiss }) {
  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Storage unavailable — still dismiss visually
    }
    onDismiss?.();
  }

  return (
    <div className="mx-4 mb-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 flex items-start gap-3 shadow-sm">
      <span className="text-orange-500 mt-0.5 shrink-0" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 leading-snug">
          I-aktibo ang push notifications para malaman mo agad kapag may bagong bid, mensahe, o update sa shipment mo.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={onEnable}
            className="text-xs font-semibold bg-orange-500 text-white rounded-lg px-3 py-1.5 hover:bg-orange-600 active:bg-orange-700 transition-colors"
          >
            I-aktibo
          </button>
          <button
            onClick={handleDismiss}
            className="text-xs text-gray-500 rounded-lg px-3 py-1.5 hover:bg-gray-100 transition-colors"
          >
            Mamaya na
          </button>
        </div>
      </div>
    </div>
  );
}

export { wasDismissedRecently };
