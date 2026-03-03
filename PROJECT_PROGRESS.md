# Karga Connect - Project Progress

Last Updated: March 3, 2026

## Scope of This Update
This report captures progress from commit `cc40109` (2026-02-21) through current `HEAD` (`2fe0ccf`, 2026-03-03), covering backend admin/payment hardening, broker referral and onboarding delivery, auth/App Check resilience, major mobile UI/UX refinements, the phone-primary auth + email magic-link fallback rollout, suspended-banner CTA refinements, GCash QR/number correctness fixes, and the latest mobile stability, share-preview, deploy-guardrail, and icon-asset updates.

## Repository Snapshot (Current)

| Metric | Value |
|---|---:|
| Branch | `master` |
| Working tree status | Modified (multiple local files; see `git status`) |
| Commits in this update window | 111 |
| Files changed in window | 182 |
| Change breakdown | 126 modified / 54 added / 1 deleted / 1 renamed |
| Diff size | 16,173 insertions / 3,077 deletions |
| Latest local commit | `2fe0ccf` on 2026-03-03 (`Fix favicon rounding and regenerate icon assets`) |

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
- At the end of this rollout phase, latest commit pushed to `origin/master` was `e48415a`.

### 9. Backend and Hosting Environment Mapping + Latest Hotfix
- Production environment mapping (authoritative):
  - Backend (Firestore, Functions, rules): `karga-ph`
  - Frontend Hosting: project `getgoph-a09bb`, site `getgoph`, URL `https://getgoph.web.app`
- Fixed suspended-account banner CTA layout/theme in `frontend/src/views/HomeView.jsx`:
  - Updated responsive banner container spacing to prevent right-edge clipping on narrow mobile widths.
  - Updated `Pay Fees` CTA to app-aligned gradient styling and improved responsive sizing behavior.
- Commit and release:
  - Commit: `e48415a` (`Fix suspended banner CTA layout and theme styling`)
  - Pushed to `origin/master` on 2026-03-02.
  - Frontend redeployed successfully to Firebase Hosting site `getgoph` (`https://getgoph.web.app`) under project `getgoph-a09bb`.
- Deployment target notes:
  - Backend deploys should use `--project karga-ph`.
  - Hosting deploys should use `--project getgoph-a09bb` with target `hosting:main` (mapped to `getgoph`).

### 10. GCash QR + Account Number Correctness Fixes (March 2, 2026)
- Root issue observed in production modal:
  - QR image was previously susceptible to broken/invalid configured URLs.
  - Displayed GCash number was masked (`0927***557`) instead of full required number.
- Implemented fixes:
  - Added resilient QR fallback handling in frontend modal to use `/assets/gcash_qrcode.png` when configured URL is missing/broken.
  - Standardized default GCash number to `09272241557` in frontend fallback and backend defaults.
  - Updated backend order response shaping to return full `gcashAccountNumber` (no masking) for payment/order flows.
  - Updated modal display logic to prefer full backend number and fallback to explicit full default if masked data is encountered.
- Config and runtime verification:
  - Verified `karga-ph` functions env carries:
    - `GCASH_ACCOUNT_NUMBER=09272241557`
    - `GCASH_QR_URL=https://karga-ph.web.app/assets/gcash_qrcode.png`
  - Verified `getgoph-a09bb` functions env carries:
    - `GCASH_ACCOUNT_NUMBER=09272241557`
    - `GCASH_QR_URL=https://getgoph.web.app/assets/gcash_qrcode.png`
  - Verified hosted QR file at `https://getgoph.web.app/assets/gcash_qrcode.png` is reachable and byte/hash-matched against local `frontend/public/assets/gcash_qrcode.png`.
  - Verified `getgoph-a09bb` Firestore has no `settings/platform` document yet, so that environment uses function env vars as source of truth.
- Release commits:
  - `3fd0586` (`Update GCash QR fallback and account defaults`)
  - `c53d6bb` (`Show full GCash account number in payment modal`)
- Deployment status:
  - Backend redeployed to `karga-ph` (functions).
  - Frontend redeployed to `getgoph` site under `getgoph-a09bb` (hosting URL: `https://getgoph.web.app`).

### 11. Post-Rollout Frontend Stabilization, Share Routing, and Asset Refresh (March 2-3, 2026)
- Delivered a rapid mobile UX stabilization cycle in `frontend/src/views/HomeView.jsx` and `frontend/src/GetGoApp.jsx`:
  - Fixed repeated scroll-jump and overlap issues tied to sticky header/filter controls.
  - Iterated mobile control behavior to remove conflicting filter-pill/listing-summary states and preserve stable tab/search interaction.
  - Added/expanded E2E coverage for responsive behavior in `tests/e2e/ui/mobile-responsive.spec.js`.
- Improved truck details modal action presentation in `frontend/src/components/modals/TruckDetailsModal.jsx` to align footer controls with app theme and improve CTA consistency.
- Strengthened share preview delivery and OG assets:
  - Added/updated `frontend/public/share.html`, `frontend/public/share-v2.html`, and social images under `frontend/public/social/`.
  - Updated generation tooling in `frontend/scripts/generate-og-image.js`.
  - Aligned hosting rewrites/headers in `firebase.json` for share route behavior.
- Added deploy safety guardrails:
  - Introduced `scripts/guard-firebase-project.cjs`.
  - Wired guard checks through root `package.json` scripts and updated `firebase.json` usage patterns to reduce accidental project-target mismatches.
- Refreshed branding/icon outputs:
  - Regenerated favicon and installable icon assets in `frontend/public/icons/`.
  - Updated icon generation script (`frontend/scripts/generate-icons.js`) and head references in `frontend/index.html`.
- Notable commits in this phase:
  - `0031c8d` (`Add Firebase deploy guardrails for project-target safety`)
  - `fd35632` (`Fix share preview layout alignment and publish v2 OG share routes`)
  - `2fe0ccf` (`Fix favicon rounding and regenerate icon assets`)

## Operational Notes
- This update window includes broad product and platform work across `frontend` (125 files) and `functions` (30 files), with supporting config, docs, and test updates.
- Prior admin overdue-fee stabilization work remains in place and has been extended with reconciliation and shipment admin APIs.
- Environment split in use:
  - Backend data/functions project: `karga-ph`
  - Frontend hosting project/site: `getgoph-a09bb` / `getgoph` (`https://getgoph.web.app`)
