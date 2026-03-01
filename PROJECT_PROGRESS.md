# Karga Connect - Project Progress

Last Updated: March 1, 2026

## Scope of This Update
This report captures progress from commit `cc40109` (2026-02-21) through current `HEAD` (`5e49e98`, 2026-03-01), covering backend admin/payment hardening, broker referral and onboarding delivery, auth/App Check resilience, major mobile UI/UX refinements, and the phone-primary auth + email magic-link fallback rollout.

## Repository Snapshot (Current)

| Metric | Value |
|---|---:|
| Branch | `master` |
| Working tree status | Modified (`PROJECT_PROGRESS.md` only) |
| Commits in this update window | 80 |
| Files changed in window | 168 |
| Change breakdown | 122 modified / 44 added / 1 deleted / 1 renamed |
| Diff size | 15,309 insertions / 3,034 deletions |
| Latest local commit | `5e49e98` on 2026-03-01 (`Implement phone-primary auth with email magic-link fallback`) |

## Major Changes Since Last Update

### 1. Admin and Platform-Fee Backend Hardening
- Expanded `functions/src/api/admin.js`:
  - Added robust timestamp normalization helper logic for consistent due-date and created-at comparisons.
  - Added outstanding-fee filtering safeguards (ignore waived/cancelled/non-payable contracts).
  - Added `adminReconcileOutstandingFees` callable to recalculate outstanding balances and auto-unsuspend users when balances clear.
  - Added `adminGetShipments` callable with `orderBy(createdAt)` path and fallback query behavior when indexes are unavailable.
  - Updated dashboard in-transit shipment counting to include `pending_pickup`, `picked_up`, and `in_transit`.
- Improved overdue handling in unpaid-fee responses so contracts flagged as overdue remain correctly marked even without a due date.

### 2. Broker Referral and Activity Feature Delivery
- Shipped broker referral flow across frontend and functions:
  - Added broker referral APIs/triggers/services (`functions/src/api/bids.js`, `functions/src/services/brokerListingReferralService.js`, `functions/src/triggers/listingReferralTriggers.js`, `functions/src/scheduled/brokerListingReferralExpiry.js`).
  - Added broker referral UI (`frontend/src/views/BrokerActivityView.jsx`, `frontend/src/views/ReferredListingsView.jsx`, `frontend/src/components/broker/ReferListingModal.jsx`).
- Added onboarding guidance experiences:
  - `frontend/src/components/modals/OnboardingGuideModal.jsx`
  - `frontend/src/components/broker/BrokerOnboardingGuideModal.jsx`

### 3. Auth, App Check, and Legal/Support Improvements
- Hardened OTP/App Check behavior and recaptcha initialization flow (frontend + hosting/CSP updates).
- Added reusable App Check and callable rate-limit utilities in functions (`functions/src/utils/appCheck.js`, `functions/src/utils/callableRateLimit.js`).
- Added legal/help content and views:
  - `frontend/src/components/legal/LegalModal.jsx`
  - `frontend/src/components/legal/LegalPageContent.jsx`
  - `frontend/src/views/HelpSupportView.jsx`
  - `frontend/src/data/privacyPolicyContent.js`
  - `frontend/src/data/termsOfServiceContent.js`

### 4. Mobile UI/UX and In-App Browser/PWA Polishing
- Delivered iterative mobile fixes for header collapse behavior, modal spacing, tracking map height/layout, tab/button spacing consistency, and profile dropdown alignment.
- Added and refined in-app browser and PWA install UX:
  - `frontend/src/components/shared/InAppBrowserOverlay.jsx`
  - `frontend/src/components/shared/PWAInstallPrompt.jsx`
  - `frontend/src/hooks/usePWAInstall.js`

### 5. Branding and SEO Readiness
- Updated app branding assets and logo usage (GetGo icon set and shared logo components).
- Added crawler/indexing essentials:
  - `frontend/public/robots.txt`
  - `frontend/public/sitemap.xml`
- Updated manifest and icon files for consistent install and home-screen presentation.

### 6. CI and Test Coverage Enhancements
- Updated GitHub E2E workflow (`.github/workflows/e2e-tests.yml`):
  - Node runtime upgraded from 18 to 22.
  - Job timeout increased from 20 to 30 minutes.
  - Added production dependency audit for functions.
  - Added GCash smoke test step plus log artifact upload.
- Added targeted UI E2E coverage (`tests/e2e/ui/in-app-browser-overlay.spec.js`) and updated mobile/tracking/notifications test suites.

### 7. Phone-Primary Auth + Email Magic-Link Fallback Rollout
- Added new auth callables in `functions/src/api/auth.js` and exported them in `functions/index.js`:
  - `authPrepareEmailMagicLinkSignIn`
  - `authFinalizeEmailLinking`
  - `authDisableEmailMagicLink`
- Implemented generic prepare responses to prevent account enumeration and added Firestore-backed rate limiting for email-link requests.
- Updated frontend auth and profile flows:
  - `frontend/src/contexts/AuthContext.jsx`
  - `frontend/src/components/auth/AuthModal.jsx`
  - `frontend/src/components/profile/ProfilePage.jsx`
  - `frontend/src/services/api.js`
- Hardened client write protections in `firestore.rules` for server-owned email auth state fields.
- Added one-time migration utility:
  - `functions/scripts/reset-test-user-email-auth.cjs`
  - `functions/package.json` scripts:
    - `migrate:email-auth:dry`
    - `migrate:email-auth:apply`
- Added rollout runbook:
  - `EMAIL_MAGIC_LINK_ROLLOUT.md`
- Updated E2E auth coverage and fixtures for phone-primary + email fallback behavior:
  - `tests/e2e/auth/login-register-logout.spec.js`
  - `tests/e2e/fixtures/auth.fixture.js`
  - `tests/e2e/utils/test-data.js`

### 8. Rollout Execution Status (Production)
- Firebase Auth configuration completed:
  - Email link provider enabled.
  - Authorized domains verified (`localhost`, `127.0.0.1`, `karga-ph.firebaseapp.com`, `karga-ph.web.app`, `karga.ph`, `www.karga.ph`).
- Backend and rules were deployed with email feature flag OFF first.
- Non-admin cleanup migration executed successfully:
  - Scanned users: 7
  - Skipped admin users: 1
  - Reset non-admin users: 6
- Frontend deployed with feature OFF for safe staging.
- After verification, both flags were enabled and redeployed:
  - Backend: `EMAIL_MAGIC_LINK_ENABLED=true`
  - Frontend: `VITE_ENABLE_EMAIL_MAGIC_LINK=true`
- Latest commit pushed to `origin/master`: `5e49e98`.

## Operational Notes
- This update window includes broad product and platform work across `frontend` (113 files) and `functions` (29 files), with supporting config, docs, and test updates.
- Prior admin overdue-fee stabilization work remains in place and has been extended with reconciliation and shipment admin APIs.
