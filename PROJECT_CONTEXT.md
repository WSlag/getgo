# PROJECT_CONTEXT.md
## KARGA Connect - Philippine Trucking Backload Marketplace

> **Generated**: February 21, 2026
> **Purpose**: Current architecture and implementation reference for ongoing development

---

## 1. Project Status Summary

KARGA Connect is currently a **Firebase-first** marketplace platform:
- Frontend: React + Vite SPA (PWA-capable)
- Backend runtime: Firebase Cloud Functions (Node 22), no active local `backend/` folder in this workspace
- Data: Firestore, Firebase Auth, Firebase Storage
- Real-time updates: Firestore listeners (`onSnapshot`)

Recent local updates (Feb 21, 2026) include admin platform-fee monitoring refinements:
- `adminGetOutstandingFees` ordering/sorting hardening in `functions/src/api/admin.js`
- overdue display edge-case fixes in `frontend/src/views/admin/PaymentsView.jsx`
- index addition in `firestore.indexes.json` for `contracts` (`platformFeePaid`, `platformFeeDueDate`)

---

## 2. Tech Stack Overview

### Frontend (`frontend/package.json`)
| Category | Technology | Version |
|---|---|---|
| Framework | React | 18.2.0 |
| Build Tool | Vite | 5.1.4 |
| Router | React Router DOM | 7.13.0 |
| Styling | Tailwind CSS | 4.1.12 |
| UI Primitives | Radix UI | various |
| Maps | Leaflet + React Leaflet | 1.9.4 / 4.2.1 |
| Firebase SDK | firebase | 12.8.0 |
| Monitoring | Sentry React | 10.39.0 |
| PWA | vite-plugin-pwa | 0.19.0 |

### Backend / Platform (`functions/package.json`, `firebase.json`)
| Category | Technology | Version |
|---|---|---|
| Server Runtime | Cloud Functions for Firebase | Node 22 |
| Functions SDK | firebase-functions | 5.1.1 |
| Admin SDK | firebase-admin | 12.0.0 |
| OCR / Imaging | Google Vision + Sharp + imghash | 4.0.0 / 0.33.0 / 1.1.2 |
| HTTP Client | axios | 1.13.5 |
| Region | asia-southeast1 | Manila-aligned deployment |

### Testing
| Category | Technology |
|---|---|
| E2E | Playwright (`@playwright/test`) |
| Local Integration | Firebase Emulator Suite |

---

## 3. Current Repository Structure

```text
Karga/
  frontend/                 React app (primary client)
    src/
      components/           auth, admin, layout, maps, modals, ui, etc.
      contexts/             AuthContext
      hooks/                marketplace/auth/data hooks
      services/             api.js, firestoreService.js, routing/geocoding/appcheck
      views/                user and admin view modules
      styles/               Tailwind + theme tokens
      firebase.js           Firebase init + emulator/app-check wiring
  functions/                Cloud Functions codebase
    src/
      api/                  callable API modules (admin/auth/contracts/etc.)
      triggers/             Firestore event handlers
      scheduled/            cron-like jobs
      services/             OCR/fraud/contract services
      utils/                shared backend helpers
  tests/                    Playwright tests and fixtures
  firestore.rules           Firestore security rules
  firestore.indexes.json    Firestore composite indexes
  firebase.json             Hosting/functions/emulator config
```

Note: There is no `backend/` directory in the current local tree.

---

## 4. Frontend Architecture

### App Composition
- `frontend/src/main.jsx` boots React, PWA SW registration, and Sentry init.
- `frontend/src/App.jsx` wraps app with `AuthProvider`, handles new-user registration routing, and supports guest-first entry.
- `frontend/src/GetGoApp.jsx` is the active primary application shell (`USE_NEW_UI = true`).

### State and Data Flow
- Auth/profile state: `frontend/src/contexts/AuthContext.jsx`
- Firestore subscription hooks: listings, bids, notifications, contracts, shipments
- Marketplace UI state hooks: filters, tabs, modals, theme, media query
- API abstraction: `frontend/src/services/api.js`
  - Cloud Functions via `httpsCallable`
  - direct Firestore reads for some user-scoped data

### Real-Time Behavior
- `frontend/src/hooks/useSocket.js` is a compatibility layer now powered by Firestore listeners.
- Socket-like emit methods are no-op placeholders to avoid breaking existing call sites.

### Major Frontend Domains
- Marketplace listings: cargo + truck flows
- Bidding + chat + contracts lifecycle
- GCash payment submission and status views
- Broker onboarding/referrals/payouts
- Admin dashboard and admin management views

---

## 5. Cloud Functions Architecture

### Entry Point
- `functions/index.js` wires all callable functions, HTTP handlers, triggers, and scheduled tasks.

### Callable/API Domains (`functions/src/api`)
- `admin.js`: dashboard, user controls, disputes, listings moderation, contracts/fees reports, broker admin ops
- `auth.js`: role switching
- `recovery.js`: account recovery codes and recovery sign-in
- `contracts.js`: contract lifecycle
- `wallet.js`: GCash orders, pending orders, config
- `shipments.js`: shipment updates
- `ratings.js`: rating submission + pending ratings
- `referrals.js`: broker registration/referral/payout operations
- `listings.js`: backload discovery + listing chat request

### Trigger Domains (`functions/src/triggers`)
- Bids: creation/status/acceptance events
- Shipments: location/status events
- Ratings: post-rating side effects
- Referrals: platform-fee completion referral effects

### Scheduled Jobs (`functions/src/scheduled`)
- Platform fee reminder scheduler
- Security audit scheduler in `functions/index.js`

### HTTP Functions
- `getRoute`: proxy to OpenRouteService for routing
- `geocode`: proxy for search/autocomplete/reverse geocoding

---

## 6. Data Model and Security

### Core Firestore Collections
- `users` (+ `shipperProfile`, `truckerProfile`, `brokerProfile`, `wallet`, `notifications`)
- `cargoListings`, `truckListings`
- `bids` (+ `messages`)
- `contracts`
- `shipments`
- `ratings`
- `orders`, `paymentSubmissions`, `platformFees`
- broker/referral/payout collections

### Security Posture (`firestore.rules`)
- Default model is authenticated access for marketplace operations.
- Listing reads (`cargoListings`, `truckListings`) require authentication.
- Admin actions are server-authoritative and validated via role/custom-claim checks.
- Payment submission security includes screenshot URL trust checks and ownership validation.
- Debt/suspension controls are enforced in rules for bid acceptance and fee exposure.

### Indexing
- Composite indexes managed in `firestore.indexes.json`.
- Recent relevant index: `contracts(platformFeePaid ASC, platformFeeDueDate ASC)`.

---

## 7. Styling and Design Tokens

### Tailwind Setup
- Tailwind v4 entry: `frontend/src/styles/tailwind.css`
- Theme tokens + custom utilities: `frontend/src/styles/theme.css`
- Global imports and resets: `frontend/src/index.css`
- Brand font import: `frontend/src/styles/fonts.css` (`Outfit`)

### Current Visual Direction
- Orange-forward primary brand palette
- Gradient utility classes for role/status emphasis
- Light/dark tokenized theme support
- Glassmorphism utility variants in shared token layer

---

## 8. Build, Run, and Test Workflow

### Root (`package.json`)
- `npm run test:e2e`
- `npm run test:e2e:ui`
- `npm run test:e2e:headed`
- `npm run test:e2e:debug`
- `npm run test:e2e:report`
- `npm run test:verify`

### Frontend (`frontend/package.json`)
- `npm run dev`
- `npm run build`
- `npm run lint`

### Functions (`functions/package.json`)
- `npm run serve`
- `npm run deploy`
- `npm run logs`
- `npm run test`

### Emulator Ports (`firebase.json`)
- Auth: `9099`
- Firestore: `8080`
- Functions: `5001`
- Storage: `9199`
- Emulator UI: `4000`

---

## 9. Known Context Risks / Follow-ups

- Some legacy docs still reference a `backend/` service and Socket.io runtime; treat those as historical unless explicitly revived.
- `frontend/src/GetGoApp.jsx` still uses socket-oriented naming in some comments/variables, but implementation is Firestore-based.
- `frontend/src/firebase.js` still includes fallback Firebase config values; environment-based config remains recommended for all deployments.
- E2E docs may still include legacy backend startup references and should be aligned with current Firebase-first architecture.

---

## 10. Quick Reference Files

- `frontend/src/App.jsx`
- `frontend/src/GetGoApp.jsx`
- `frontend/src/contexts/AuthContext.jsx`
- `frontend/src/services/api.js`
- `frontend/src/services/firestoreService.js`
- `frontend/src/hooks/useSocket.js`
- `frontend/src/views/admin/PaymentsView.jsx`
- `functions/index.js`
- `functions/src/api/admin.js`
- `functions/src/api/recovery.js`
- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`
