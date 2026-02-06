# Karga Connect - Project Progress

> **Philippine Trucking Backload Marketplace** - A two-way platform connecting shippers with cargo to truckers with available truck space.

**Last Updated:** February 6, 2026

---

## 📊 Quick Status

| Category | Status |
|----------|--------|
| Backend API | ✅ Operational |
| Frontend UI | ✅ Operational |
| Authentication | ✅ Complete |
| Real-time Features | ✅ Complete |
| Contract System | ✅ Complete |
| Rating System | ✅ Complete |
| Shipment Tracking | ✅ Complete |
| Wallet & Payments | ✅ Complete |
| Admin Dashboard | ✅ Complete |
| Payment Verification | ✅ Complete |

---

## 🛠 Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** SQLite + Sequelize ORM
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

### Bidding System
- [x] Place bids on listings
- [x] Accept/Reject bids
- [x] Withdraw bids
- [x] Bid history tracking
- [x] Real-time bid notifications
- [x] My Bids modal (view all user bids with status)
- [x] Open chat from bid listings
- [x] Wallet balance verification for truckers

### Wallet & Payments
- [x] Wallet balance management
- [x] Top-up functionality (6 methods: GCash, Maya, GrabPay, Bank Transfer, 7-Eleven, Cebuana)
- [x] GCash QR code payment flow
- [x] GCash screenshot verification system
- [x] Payment order creation with expiry (30 min)
- [x] Daily submission limits
- [x] Processing fees per method
- [x] Payout requests
- [x] Transaction history with pagination
- [x] Platform fee calculation (5%)
- [x] Platform fee payment before contract generation
- [x] Minimum balance enforcement (₱500 for truckers)
- [x] WalletModal component
- [x] PaymentUploadModal component
- [x] PaymentStatusModal component
- [x] PlatformFeeModal component

### Contract Management
- [x] Contract creation from accepted bids
- [x] Platform fee payment modal (required before contract)
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
- [x] TrackingView with map
- [x] Socket.io real-time updates
- [x] City coordinate lookup
- [ ] Push notifications for status changes

### Route Optimizer
- [x] Backload opportunity finder
- [x] Detour distance calculation
- [x] Popular routes display
- [x] Search filtering (cargo/trucks/both)
- [x] Compatibility scoring
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
- [x] Bottom navigation (mobile)
- [x] Sidebar navigation (desktop)
- [x] Dark/Light theme toggle
- [x] PWA support (offline, install prompt)
- [x] Service worker updates
- [x] ProfileDropdown component
- [x] Logo component

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

## 📝 Recent Updates (Changelog)

### Commit History
| Commit | Description | Date |
|--------|-------------|------|
| `pending` | Add admin dashboard, payment verification, wallet enhancements | Feb 6, 2026 |
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
│   ├── wallet.js             # Wallet & payments (GCash verification)
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
│   ├── HomeView.jsx          # Marketplace home
│   ├── TrackingView.jsx      # Shipment tracking
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
│   │   ├── WalletModal.jsx         ✨
│   │   ├── PaymentUploadModal.jsx  ✨
│   │   ├── PaymentStatusModal.jsx  ✨
│   │   ├── PlatformFeeModal.jsx    ✨
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
│       └── switch                    ✨
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
│   ├── useWallet.js
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
│   └── messageUtils.js       # Chat message sanitization
├── assets/                   # Static assets ✨
└── contexts/AuthContext.jsx  # Auth state management
```

### Cloud Functions
```
functions/                    # Firebase Cloud Functions ✨
├── index.js                  # Function exports
└── package.json
```

---

## 🗄 Database Models

| Model | Description |
|-------|-------------|
| `User` | Main user account (phone, password, roles, admin flag) |
| `ShipperProfile` | Business name, membership tier, transaction count |
| `TruckerProfile` | License, rating, badge level, trip count |
| `BrokerProfile` | Referral code, commission rate |
| `Wallet` | User balance management |
| `WalletTransaction` | Top-ups, fees, payouts, refunds |
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
- **Platform Fee:** 5% of agreed freight price, paid before contract generation
- **Payment Model:** Direct payment from Shipper to Trucker (no escrow)
- **Payment Verification:** GCash screenshot upload with OCR and fraud detection
- **Minimum Balance:** ₱500 required for truckers to bid
- **Badge Levels:** STARTER → ACTIVE → VERIFIED → PRO → ELITE
- **Membership Tiers:** NEW → BRONZE → SILVER → GOLD → PLATINUM → DIAMOND

## 🔄 Transaction Flow

```
1. OPEN - Listing posted
2. BID PLACED - Counter-party submits bid
3. BID ACCEPTED - Listing owner accepts (status: NEGOTIATING)
4. PAY PLATFORM FEE - 5% fee from wallet before contract
5. CONTRACT CREATED - Contract generated for signing
6. SIGNED - Both parties sign, shipment tracking begins
7. IN_TRANSIT - Trucker updates location, shipper pays directly
8. DELIVERED - Shipper confirms delivery
9. COMPLETED - Both parties rate each other
```

## 💰 Payment Verification Flow (GCash)

```
1. User selects GCash top-up amount
2. System creates PaymentOrder (30 min expiry)
3. User shown GCash QR code
4. User pays and takes screenshot
5. User uploads screenshot via PaymentUploadModal
6. System extracts OCR data and analyzes image
7. Admin reviews in PaymentsView
8. Admin approves/rejects with fraud scoring
9. Wallet credited on approval
```

---

*This document is the single source of truth for Karga Connect development progress.*
