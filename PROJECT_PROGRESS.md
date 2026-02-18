# Karga Connect - Project Progress

Last Updated: February 18, 2026

## Scope of This Update
This update captures the latest local working-tree changes after the February 16, 2026 baseline commit, including architecture cleanup, authentication recovery hardening, and E2E test infrastructure.

## Working Tree Snapshot (Current)

| Metric | Value |
|---|---:|
| Branch | `master` |
| Files included in this update | 92 |
| Change breakdown | 55 modified / 34 added / 3 deleted |
| Diff size | 6,376 insertions / 4,517 deletions |
| Large local artifacts detected (excluded) | `google-cloud-sdk/`, `google-cloud-cli.zip`, `backend-source-20260212-005758.tar.gz` |

## Major Changes Since Last Update

### 1. Backend Simplification and Firestore-First Cleanup
- Removed legacy Sequelize/socket stack from active backend runtime:
  - Deleted `backend/src/models/index.js`
  - Deleted `backend/src/seed.js`
  - Removed `sequelize`, `sqlite3`, and `socket.io` from `backend/package.json`
- Simplified `backend/src/app.js`:
  - Removed Socket.io server bootstrapping
  - Added CORS origin list from `CORS_ORIGINS`
  - Added OpenRouteService proxy endpoint: `POST /api/route`
  - Kept route compatibility via noop `app.set('io', ...)`
- Added shared backend helpers in `backend/src/utils/helpers.js` and reused them in listings/bids/shipments routes.

### 2. Auth/Access Tightening and Route Behavior Updates
- `requireRole` in `backend/src/middleware/auth.js` now resolves role from Firestore via `getUserDoc`.
- `backend/src/routes/listings.js` now requires authentication for listing reads.
- Firestore rules updated to require authentication for cargo/truck listing read access.
- `backend/src/routes/bids.js` adds role-based bid constraints per listing type and shared contact-masking utility reuse.
- `backend/src/routes/chat.js` reordered unread endpoint to avoid path collision with `/:bidId`.

### 3. Wallet/Payments and Contracts Flow Adjustments
- Wallet route scope reduced to GCash order and status endpoints in `backend/src/routes/wallet.js`.
- Added callable wallet reads in Cloud Functions:
  - `getOrder`
  - `getPendingOrders`
- Exported these callables from `functions/index.js` and wired frontend usage.
- Contract platform fee default in backend contracts route set to `0.03` (`backend/src/routes/contracts.js`).

### 4. Frontend Shift Away From Backend REST/Socket Dependence
- Removed legacy Socket.io client service:
  - Deleted `frontend/src/services/socketService.js`
  - Removed `socket.io-client` dependency from `frontend/package.json`
- Reworked `frontend/src/hooks/useSocket.js` to Firestore `onSnapshot` listeners.
- Refactored `frontend/src/services/api.js` into Firebase callable + Firestore-backed API surface.
- Updated hooks (`useContracts`, `useRatings`, `useShipmentsApi`, etc.) to use new API service patterns.
- Removed Vite `/api` dev proxy (`frontend/vite.config.js`) and shifted route calls to function proxy strategy.
- `frontend/src/firebase.js` now consumes Firebase config from environment variables instead of hardcoded values.

### 5. Account Recovery (New Security Feature)
- Added account recovery callable module: `functions/src/api/recovery.js`.
- Recovery includes:
  - Code generation/rotation
  - One-time code consumption
  - Phone normalization + SHA-256 code hashing
  - Rate limiting and audit event logging
  - Custom-token recovery sign-in flow
- Exported recovery functions in `functions/index.js`:
  - `authGetRecoveryStatus`
  - `authGenerateRecoveryCodes`
  - `authRecoverySignIn`
- Integrated recovery into frontend:
  - `frontend/src/contexts/AuthContext.jsx`
  - `frontend/src/components/auth/AuthModal.jsx`
  - `frontend/src/components/auth/LoginScreen.jsx`
  - `frontend/src/components/profile/ProfilePage.jsx`

### 6. Routing/Maps Proxy Hardening
- Added HTTPS route proxy function `getRoute` in `functions/index.js`.
- Updated `frontend/src/services/routingService.js` to call function proxy URL (prod/emulator aware) with in-flight request dedupe and fallback caching.

### 7. E2E Testing Infrastructure and Documentation
- Added root Playwright project scaffolding:
  - `package.json`, `package-lock.json`, `playwright.config.js`
  - `tests/` suite (auth, broker, bids, chat, contracts, marketplace, notifications, profile, tracking, mobile UI)
  - `tests/verify-setup.js`
- Added CI workflow for E2E runs: `.github/workflows/e2e-tests.yml`.
- Added testing/user docs:
  - `E2E_TESTING_IMPLEMENTATION.md`
  - `TESTING_QUICKSTART.md`
  - `USER_GUIDE.md`
  - `UI_UNIFORMITY_AUDIT.md`
  - `BROKER_REFERRAL_SCHEMA.md`

## Operational Notes
- Cloud Functions runtime target in `functions/package.json` updated to Node `22`.
- Large downloaded local artifacts are present in working tree and should remain excluded from source control unless explicitly needed.
