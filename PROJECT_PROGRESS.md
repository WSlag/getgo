# Karga Connect - Project Progress

> **Philippine Trucking Backload Marketplace** - A two-way platform connecting shippers with cargo to truckers with available truck space.

**Last Updated:** February 9, 2026

---

## 📊 Quick Status

| Category | Status |
|----------|--------|
| Backend API | ✅ Operational |
| Frontend UI | ✅ Operational |
| Authentication | ✅ Complete |
| Real-time Features | ✅ Complete |
| Contract System | ✅ Complete (Firestore-based) |
| Rating System | ✅ Complete |
| Shipment Tracking | ✅ Complete |
| Wallet & Payments | ⚠️ Deprecated (Direct GCash) |
| GCash Direct Payment | ✅ Complete |
| Admin Dashboard | ✅ Complete |
| Payment Verification | ✅ Complete |
| Cloud Functions (API) | ✅ Complete |

---

## 🛠 Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** Firebase Firestore (primary) + SQLite + Sequelize ORM (legacy)
- **Authentication:** JWT + Firebase Admin SDK
- **Real-time:** Socket.io
- **Security:** bcryptjs, CORS
- **Cloud Functions:** Firebase Functions

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS v4
- **UI Components:** Radix UI (Dialog, Tabs, Select, Popover, Tooltip, Dropdown Menu, Switch)
- **Icons:** Lucide React
- **Maps:** Leaflet + React-Leaflet
- **Real-time:** Socket.io Client
- **Database:** Firebase Firestore (chat, payments)
- **Storage:** Firebase Storage (payment screenshots)
- **PWA:** vite-plugin-pwa

---

## ✅ Completed Features

### Authentication & Users
- [x] User registration with role selection (Shipper/Trucker)
- [x] Phone + password login
- [x] Firebase Authentication integration
- [x] JWT token management
- [x] Role switching (Shipper ↔ Trucker)
- [x] Shipper profiles (business name, membership tier)
- [x] Trucker profiles (license, rating, badge level)
- [x] Broker/Referral system
- [x] Profile image upload
- [x] Facebook URL linking
- [x] Admin role support

### Marketplace
- [x] Cargo listings (CRUD operations)
- [x] Truck listings (CRUD operations)
- [x] Dual-market toggle (Cargo/Trucks view)
- [x] Search bar with real-time filtering
- [x] Advanced filtering (price, weight, location, vehicle type, dates)
- [x] Listing cards with gradient backgrounds
- [x] CargoCard component
- [x] TruckCard component
- [x] Cargo details modal
- [x] Truck details modal
- [x] Photo upload for listings
- [x] Contact masking (revealed after contract signing)
- [x] Street address fields for pickup & delivery (optional, with city)
- [x] Full address composition (street + city)
- [x] Listing reopen functionality
- [x] Bid status validation (prevent bidding on closed listings)

### Bidding System
- [x] Place bids on listings
- [x] Accept/Reject bids
- [x] Withdraw bids
- [x] Bid history tracking
- [x] Real-time bid notifications
- [x] My Bids modal (view all user bids with status)
- [x] Open chat from bid listings
- [x] Wallet balance verification for truckers

### Payments (Direct GCash)
- [x] GCash QR code payment flow
- [x] GCash screenshot verification system
- [x] GCashPaymentModal component (replaces WalletModal + PlatformFeeModal)
- [x] Payment order creation with expiry (30 min)
- [x] Daily submission limits
- [x] Platform fee calculation (5%)
- [x] Platform fee payment via GCash screenshot (direct, no wallet)
- [x] Auto-contract creation on approved platform fee payment
- [x] PaymentUploadModal component
- [x] PaymentStatusModal component
- [x] ~~WalletModal~~ (removed - direct GCash payment)
- [x] ~~PlatformFeeModal~~ (removed - merged into GCash flow)
- [x] ~~useWallet hook~~ (removed)

### Contract Management
- [x] Contract creation from accepted bids
- [x] Platform fee payment via GCash (required before contract)
- [x] Contract auto-created on bid acceptance (with platformFeePaid: false)
- [x] Platform fee marked as paid when trucker's payment approved
- [x] Contracts stored in Firestore (migrated from SQLite)
- [x] Digital signature tracking (both parties)
- [x] Contract status flow (draft → signed → completed)
- [x] Contact reveal after signing
- [x] Create Contract button in listing detail modals
- [x] Full contract terms display (Philippine law compliant)
- [x] Shipment auto-creation after both signatures
- [x] Auto-generated contract numbers
- [x] IP address tracking for signatures
- [x] Liability acknowledgment
- [x] Declared cargo value tracking
- [x] ContractsView page (dedicated contracts list)
- [x] Contracts navigation in sidebar and mobile nav
- [x] Firestore Timestamp handling in ContractModal (all formats supported)
- [x] Street address display in contract pickup/delivery
- [x] Contract participant ID tracking (participantIds array)
- [x] Contract role detection using direct fields (listingType, listingOwnerId, bidderId)
- [x] Pay Platform Fee button for truckers in contract modal
- [x] Account suspension for unpaid platform fees
- [x] Auto-unsuspension when fees are paid
- [x] Outstanding platform fees tracking per user
- [x] Mobile-responsive contract modal with DialogBottomSheet
- [ ] Contract PDF export

### Rating & Review System
- [x] 5-star rating scale
- [x] Rating tags (professional, punctual, safe delivery, etc.)
- [x] User comments/feedback
- [x] Trucker badge system (STARTER → ACTIVE → VERIFIED → PRO → ELITE)
- [x] Shipper membership tiers (NEW → BRONZE → SILVER → GOLD → PLATINUM → DIAMOND)
- [x] Pending ratings tracking
- [x] Automatic badge/tier upgrades with notifications
- [x] Rating history and statistics
- [ ] Rating dispute resolution

### Shipment Tracking
- [x] Real-time location updates
- [x] Progress calculation (Haversine)
- [x] Status transitions (picked_up → in_transit → delivered)
- [x] Public tracking by tracking number (no auth required)
- [x] TrackingView with map (enhanced with fullscreen support)
- [x] Socket.io real-time updates
- [x] City coordinate lookup with fallback coordinates
- [x] Active shipments section on HomeView with status cards
- [x] Live tracking from home page (click to track)
- [x] Coordinate validation and error handling in TrackingMap
- [x] City-based coordinate fallback for missing lat/lng
- [ ] Push notifications for status changes

### Route Optimizer
- [x] Backload opportunity finder
- [x] Detour distance calculation
- [x] Popular routes display
- [x] Search filtering (cargo/trucks/both)
- [x] Compatibility scoring
- [x] Mobile-responsive UI with proper spacing
- [x] Improved listing cards with proper route display
- [x] Contact button integration for matched opportunities
- [ ] Integration with Google Maps Directions API

### Chat System
- [x] Real-time messaging (Firebase Firestore)
- [x] Chat modal UI
- [x] Auto-scroll to latest
- [x] Socket.io notifications
- [x] Chat accessible from listing detail modals
- [x] Chat accessible from My Bids modal
- [x] Message sanitization utility
- [x] Unread message count
- [x] Mark messages as read
- [ ] Read receipts
- [ ] Typing indicators

### Real-time Features
- [x] Socket.io integration
- [x] Live notifications (11+ types)
- [x] Notification bell with unread count
- [x] Real-time bid updates
- [x] Real-time shipment tracking
- [x] Real-time contract status updates
- [x] NotificationsModal component

### Maps & Location
- [x] Interactive Leaflet maps
- [x] Route display with distance calculation
- [x] 14+ Philippine cities with coordinates
- [x] Haversine distance formula
- [x] Address search/geocoding

### UI/UX
- [x] Responsive mobile design
- [x] Bottom navigation (mobile) with Contracts tab
- [x] Sidebar navigation (desktop) with My Contracts link
- [x] Dark/Light theme toggle
- [x] PWA support (offline, install prompt)
- [x] Service worker updates
- [x] ProfileDropdown component
- [x] Logo component
- [x] Custom PesoIcon (₱) component replacing DollarSign across the app
- [x] Responsive desktop/mobile spacing in admin dashboard (useMediaQuery)
- [x] Responsive dialog bottom sheet padding (mobile vs desktop)
- [x] Wallet button removed from header (direct GCash payment model)
- [x] BidsView dedicated page
- [x] ContractsView dedicated page
- [x] Improved mobile bottom nav layout (Bids, Post, Contracts, Chat)
- [x] Street address display in bid and cargo detail modals
- [x] Account suspension banner for unpaid platform fees
- [x] Mobile-optimized ContractModal with proper icon sizing
- [x] Enhanced NotificationsModal with better formatting
- [x] TruckDetailsModal improvements with better layout
- [x] React Router DOM navigation enhancements

### Admin Dashboard
- [x] Admin authentication and role verification
- [x] Dashboard overview with platform KPIs
- [x] Real-time statistics (users, listings, revenue)

#### Payment Verification System
- [x] Pending payments queue
- [x] Payment statistics with fraud flag analysis
- [x] OCR extracted data validation
- [x] Image analysis (dimensions, hash, EXIF)
- [x] Fraud scoring and flag detection
- [x] Approve/Reject payments
- [x] Payment history with filters

#### User Management
- [x] List all users with filters
- [x] User details with profiles and stats
- [x] Suspend/Activate users
- [x] Verify users
- [x] Toggle admin privileges

#### Listings Management
- [x] View all cargo & truck listings
- [x] Deactivate listings
- [x] Listing statistics

#### Contracts Management
- [x] List all contracts with filters
- [x] Contract details view
- [x] Contract statistics

#### Shipments Management
- [x] All shipments overview
- [x] Active shipments map
- [x] Shipment tracking

#### Financial Overview
- [x] Revenue and GMV data
- [x] Take rate calculations
- [x] All wallet transactions
- [x] Financial summaries

#### Disputes Management
- [x] List disputes
- [x] Dispute details
- [x] Resolve disputes

#### Referral/Broker Management
- [x] List brokers
- [x] Update broker tiers
- [x] Referral statistics

#### Ratings Management
- [x] All ratings with filters
- [x] Delete/archive ratings
- [x] Ratings moderation

#### System Settings
- [x] Platform settings configuration
- [x] Update settings

---

## 🚀 Pre-Deployment Checklist

> **Complete these before deploying to production:**

- [ ] **Deploy Backend API** to a hosting platform (Railway, Render, Google Cloud Run, or Fly.io)
- [ ] **Update frontend environment variables** with production backend URL:
  - `VITE_API_URL=https://<your-backend-url>/api`
  - `VITE_SOCKET_URL=https://<your-backend-url>`
  - `VITE_GCASH_QR_URL=<your-gcash-qr-code-image-url>`
- [ ] **Configure backend environment variables** on hosting platform (copy from `backend/.env`)
- [ ] **Deploy frontend** to Vercel, Netlify, or Firebase Hosting
- [ ] **Deploy Firebase Cloud Functions** (`firebase deploy --only functions`) for OCR payment verification
- [ ] **Verify Firestore indexes** are built (`firebase deploy --only firestore:indexes`)
- [ ] **Set up GCash merchant account** and update `GCASH_ACCOUNT_NUMBER` / `GCASH_ACCOUNT_NAME` in backend env
- [ ] **Enable CORS** on backend for production frontend domain
- [ ] **Set up SSL** (most platforms provide this automatically)

---

## 📋 Planned Features

### High Priority
- [ ] Push notifications (Firebase Cloud Messaging)
- [ ] Email notifications (transactional)
- [ ] Contract PDF generation & download
- [ ] Document upload & verification (license, permits)
- [ ] Payment gateway integration (PayMongo, Dragonpay)

### Medium Priority
- [ ] Analytics & reporting dashboards
- [ ] Bulk listing management
- [ ] Recurring shipments
- [ ] Favorite truckers/shippers

### Low Priority
- [ ] Multi-language support (Filipino, Cebuano)
- [ ] Advanced route planning (Google Maps Directions API)
- [ ] Fleet management for truckers
- [ ] Insurance integration
- [ ] API documentation (Swagger)

---

## 🎉 Latest Improvements (Feb 9, 2026)

### Contract Signing Flow Fixes
- **Fixed contract role detection**: Now uses direct contract fields (`listingType`, `listingOwnerId`, `bidderId`) instead of nested bid/listing objects
- **Fixed signature button visibility**: Shippers and truckers now see correct "Sign Contract" button instead of "Waiting for other party"
- **Fixed timestamp display**: Supports all Firestore timestamp formats (direct, serialized, ISO strings) - no more "Invalid Date"
- **Enhanced mobile UI**: ContractModal now uses DialogBottomSheet with responsive padding and icon sizing

### Payment Processing Improvements
- **New flow**: Contract created immediately on bid acceptance (platformFeePaid: false)
- **Trucker pays first**: Trucker must pay platform fee before signing
- **Account suspension**: Users suspended if fees unpaid, auto-unsuspended when paid
- **Outstanding fees tracking**: System tracks unpaid fees per user with contract ID array
- **Fixed CORS issues**: Cloud Functions properly exported (`createPlatformFeeOrder`)
- **Fixed admin API**: Admin dashboard now receives correct payment submission format

### UI/UX Enhancements
- **Account suspension banner**: Users see warning banner if account suspended for unpaid fees
- **Pay Platform Fee button**: Added to contract modal for truckers to easily pay outstanding fees
- **Route Optimizer mobile**: Better responsive layout with proper spacing and card design
- **TruckDetailsModal improvements**: Enhanced layout and mobile responsiveness
- **NotificationsModal**: Better formatting and timestamp display
- **React Router DOM**: Added for enhanced navigation (v7.13.0)

### Cloud Functions Updates
- **Payment approval flow**: Now updates existing contract instead of creating new one
- **Unsuspension logic**: Automatically reactivates accounts when all fees paid
- **Improved notifications**: Better messaging for payment verification and fee reminders
- **Contract creation triggers**: Bid acceptance now creates contract with pending fee status

### Bug Fixes
- ✅ Fixed shipper unable to sign contracts
- ✅ Fixed "Invalid Date" in signature timestamps
- ✅ Fixed payment submissions not showing in admin dashboard
- ✅ Fixed CORS errors on Cloud Function endpoints
- ✅ Fixed contract list signature status display
- ✅ Fixed role detection inconsistencies

---

## 📝 Recent Updates (Changelog)

### Commit History
| Commit | Description | Date |
|--------|-------------|------|
| `pending` | Fix contract signing flow, payment processing, mobile UI improvements, and route optimizer enhancements | Feb 9, 2026 |
| `0a44225` | Migrate to direct GCash payment, Firestore contracts, and enhanced tracking | Feb 9, 2026 |
| `90ceac6` | Add PesoIcon, wallet return flow, responsive admin spacing | Feb 6, 2026 |
| `f20c88d` | Add admin dashboard, payment verification, wallet enhancements | Feb 6, 2026 |
| `d6c358b` | Add My Bids modal with chat integration and profile enhancements | Feb 5, 2026 |
| `fc43c07` | Add contracts, ratings, shipments features with chat and route optimization | Feb 5, 2026 |
| `148e1ea` | Add authentication system with user profiles and Firebase configuration | Recent |
| `8f660fb` | Add search bar to home view and update login screen styling | Recent |
| `587ad38` | Add PWA enhancements and mobile UI improvements | Recent |
| `fd63ad8` | Add real-time notifications, interactive maps, and listing detail modals | Recent |

---

## 📁 Key Files Reference

### Backend Structure
```
backend/src/
├── app.js                    # Main server, Socket.io setup
├── models/index.js           # All 17+ Sequelize models
├── routes/
│   ├── auth.js               # Authentication endpoints
│   ├── listings.js           # Cargo & truck listings
│   ├── bids.js               # Bidding system
│   ├── wallet.js             # Wallet (deprecated) & GCash order mgmt
│   ├── contracts.js          # Contract management
│   ├── shipments.js          # Shipment tracking
│   ├── ratings.js            # Rating system
│   ├── chat.js               # Chat messages
│   ├── notifications.js      # Notifications
│   └── admin.js              # Admin dashboard endpoints ✨
├── middleware/auth.js        # JWT verification
├── config/firebase-admin.js  # Firebase Admin SDK
└── seed.js                   # Database seeding
```

### Frontend Structure
```
frontend/src/
├── App.jsx                   # Main routing
├── GetGoApp.jsx              # Main UI container
├── views/
│   ├── HomeView.jsx          # Marketplace home (+ shipment tracking)
│   ├── BidsView.jsx          # Dedicated bids page ✨
│   ├── ContractsView.jsx     # Dedicated contracts page ✨
│   ├── TrackingView.jsx      # Shipment tracking (enhanced)
│   ├── AdminPaymentsView.jsx # Payment verification
│   └── admin/                # Admin dashboard views ✨
│       ├── AdminDashboard.jsx
│       ├── DashboardOverview.jsx
│       ├── PaymentsView.jsx
│       ├── UserManagement.jsx
│       ├── ListingsManagement.jsx
│       ├── ContractsView.jsx
│       ├── ShipmentsView.jsx
│       ├── FinancialOverview.jsx
│       ├── DisputesManagement.jsx
│       ├── ReferralManagement.jsx
│       ├── RatingsManagement.jsx
│       └── SystemSettings.jsx
├── components/
│   ├── modals/
│   │   ├── PostModal.jsx
│   │   ├── CargoDetailsModal.jsx
│   │   ├── TruckDetailsModal.jsx
│   │   ├── BidModal.jsx
│   │   ├── ContractModal.jsx
│   │   ├── RatingModal.jsx
│   │   ├── ChatModal.jsx
│   │   ├── MyBidsModal.jsx
│   │   ├── RouteOptimizerModal.jsx
│   │   ├── GCashPaymentModal.jsx   ✨ (replaces WalletModal + PlatformFeeModal)
│   │   ├── PaymentUploadModal.jsx  ✨
│   │   ├── PaymentStatusModal.jsx  ✨
│   │   └── NotificationsModal.jsx  ✨
│   ├── admin/                      ✨
│   │   ├── AdminDashboard.jsx
│   │   ├── AdminSidebar.jsx
│   │   ├── AdminHeader.jsx
│   │   ├── DataTable.jsx
│   │   └── StatCard.jsx
│   ├── shared/
│   │   ├── ContactInfo.jsx
│   │   ├── FilterPanel.jsx
│   │   ├── ProfileDropdown.jsx     ✨
│   │   ├── PWAUpdateNotification.jsx
│   │   └── Logo.jsx
│   └── ui/                   # Base UI components
│       ├── button, badge, card, input, tabs
│       ├── tooltip, textarea, select, separator
│       ├── dialog, label, scroll-area
│       ├── dropdown-menu             ✨
│       ├── switch                    ✨
│       └── PesoIcon.jsx             ✨
├── hooks/
│   ├── useAuth.js
│   ├── useCargoListings.js
│   ├── useTruckListings.js
│   ├── useBids.js
│   ├── useContracts.js
│   ├── useRatings.js
│   ├── useShipmentsApi.js
│   ├── useShipments.js
│   ├── useRouteOptimizer.js
│   ├── useChat.js
│   ├── useNotifications.js
│   ├── useSocket.js
│   ├── useModals.js
│   ├── useTheme.js
│   ├── useMarketplace.js
│   ├── useMediaQuery.js
│   ├── useAuthGuard.js
│   └── usePaymentSubmission.js     ✨
├── services/
│   ├── api.js                # API client (including admin endpoints)
│   ├── firestoreService.js   # Firebase Firestore (chat, payments)
│   ├── geocodingService.js   # Address lookup
│   ├── routingService.js     # Route calculations
│   └── socketService.js      # Socket.io client
├── utils/
│   ├── messageUtils.js       # Chat message sanitization
│   └── addressHelpers.js     # Address composition utilities ✨
├── assets/                   # Static assets ✨
└── contexts/AuthContext.jsx  # Auth state management
```

### Cloud Functions
```
functions/                    # Firebase Cloud Functions ✨
├── index.js                  # Function exports (payment processing)
├── package.json
└── src/
    ├── api/                  # Cloud Function API endpoints ✨
    │   ├── admin.js
    │   ├── contracts.js
    │   ├── listings.js
    │   ├── ratings.js
    │   ├── shipments.js
    │   └── wallet.js
    ├── services/
    │   └── contractCreation.js  # Auto-contract from approved fees ✨
    └── triggers/             # Firestore triggers ✨
        ├── bidTriggers.js
        ├── ratingTriggers.js
        └── shipmentTriggers.js
```

---

## 🗄 Database Models

| Model | Description |
|-------|-------------|
| `User` | Main user account (phone, password, roles, admin flag) |
| `ShipperProfile` | Business name, membership tier, transaction count |
| `TruckerProfile` | License, rating, badge level, trip count |
| `BrokerProfile` | Referral code, commission rate |
| `Wallet` | User balance management (deprecated) |
| `WalletTransaction` | Top-ups, fees, payouts, refunds (deprecated) |
| `PlatformFee` | GCash platform fee payments (Firestore) ✨ |
| `PaymentOrder` | GCash payment orders with expiry ✨ |
| `PaymentSubmission` | Screenshot submissions for verification ✨ |
| `Vehicle` | Trucker's vehicles (plate, capacity) |
| `CargoListing` | Cargo shipments from shippers |
| `TruckListing` | Truck availability from truckers |
| `Bid` | Offers on listings |
| `Contract` | Finalized agreements with signatures |
| `Shipment` | Live tracking data |
| `ChatMessage` | Real-time messages |
| `Notification` | 11+ notification types |
| `Rating` | 5-star reviews with tags |
| `Referral` | Broker referral tracking |
| `CommissionTransaction` | Broker earnings |
| `Dispute` | User disputes ✨ |
| `PlatformSettings` | System configuration ✨ |

---

## 🧪 Testing

### Development Servers
```bash
# Backend (port 5000)
cd backend && npm run dev

# Frontend (port 5173)
cd frontend && npm run dev
```

### Test Credentials
| Role | Phone | Password |
|------|-------|----------|
| Shipper | `09171234567` | `password123` |
| Trucker | `09271234567` | `password123` |

### Sample Data
Run `npm run seed` in backend to populate:
- 3 Shippers, 4 Truckers
- Sample cargo & truck listings
- Test bids and transactions

---

## 📌 Notes

- **Contact Masking:** Phone/email hidden until contract is signed
- **Platform Fee:** 5% of agreed freight price, paid by trucker via GCash screenshot
- **Payment Model:** Direct GCash payment (wallet system deprecated)
- **Payment Verification:** GCash screenshot upload with OCR and fraud detection
- **Contract Flow:** Contract created on bid acceptance, marked as paid when fee approved
- **Account Suspension:** Users suspended if platform fees unpaid, auto-unsuspended when paid
- **Outstanding Fees:** Tracked per user with array of contract IDs requiring payment
- **Badge Levels:** STARTER → ACTIVE → VERIFIED → PRO → ELITE
- **Membership Tiers:** NEW → BRONZE → SILVER → GOLD → PLATINUM → DIAMOND
- **Street Addresses:** Optional pickup/delivery street addresses complement city-level routing
- **Timestamp Handling:** Supports Firestore Timestamps (direct and serialized), ISO strings, and JS timestamps

## 🔄 Transaction Flow

```
1. OPEN - Listing posted
2. BID PLACED - Counter-party submits bid
3. BID ACCEPTED - Listing owner accepts (status: NEGOTIATING)
   ↓ Contract auto-created (platformFeePaid: false)
4. PAY PLATFORM FEE - Trucker pays 5% fee via GCash screenshot upload
5. FEE VERIFIED - Admin approves screenshot → Contract marked as paid
   ↓ Account unsuspended if applicable
6. SIGNING - Both parties sign contract (trucker first, then shipper)
7. SIGNED - Both signatures collected, shipment tracking begins
8. IN_TRANSIT - Trucker updates location, shipper pays directly
9. DELIVERED - Shipper confirms delivery
10. COMPLETED - Both parties rate each other
```

## 💰 Platform Fee Payment Flow (GCash Direct) - UPDATED

```
1. Bid is accepted by listing owner
2. Contract auto-created immediately (platformFeePaid: false)
3. Trucker notified to pay platform fee
4. Trucker opens contract → clicks "Pay Platform Fee" button
5. System creates PaymentOrder with type='platform_fee' (30 min expiry)
6. Trucker shown GCash QR code with exact fee amount
7. Trucker pays and takes screenshot
8. Trucker uploads screenshot via PaymentUploadModal
9. Cloud Function extracts OCR data and analyzes image
10. Auto-approved or flagged for manual admin review
11. On approval → Contract.platformFeePaid = true, status updated
12. User's outstanding fees reduced, account unsuspended if applicable
13. Both parties notified, contract ready for signing
14. Trucker signs first, then shipper signs
15. After both signatures → Shipment created, tracking begins
```

---

*This document is the single source of truth for Karga Connect development progress.*
