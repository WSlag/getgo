# KARGA CONNECT

Philippine Trucking Backload Marketplace - A two-way marketplace connecting shippers with cargo to truckers with available space.

## Features

- **Two-Way Marketplace**: Shippers post cargo, Truckers post available trucks
- **Open Bidding System**: Bid higher or lower than asking price
- **Trucker Wallet System**: Top-up via GCash, Maya, Bank Transfer
- **Contact Masking**: Phone/FB hidden until contract signed
- **Live Cargo Tracking**: Real-time shipment updates
- **Rating System**: Trucker badges (Starter → Elite)
- **Shipper Membership Tiers**: New → Diamond (with discounts)
- **Broker/Referral Commission System**: Earn by referring users
- **Route Optimization**: Find backload opportunities
- **Dark/Light Theme**: User preference toggle

## Tech Stack

### Frontend
- React 18 + Vite
- Tailwind CSS
- Lucide Icons

### Backend
- Node.js + Express.js
- SQLite + Sequelize ORM
- Socket.io (real-time)
- JWT Authentication

## Project Structure

```
Karga/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── KargaMarketplace.jsx  # Main UI component
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
│
├── backend/               # Express backend
│   ├── src/
│   │   ├── app.js         # Main server
│   │   ├── models/        # Database models
│   │   ├── routes/        # API routes
│   │   └── middleware/    # Auth middleware
│   ├── package.json
│   └── .env
│
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Installation

1. **Clone/Navigate to the project**
```bash
cd C:\Users\Administrator\Karga
```

2. **Install Backend Dependencies**
```bash
cd backend
npm install
```

3. **Install Frontend Dependencies**
```bash
cd ../frontend
npm install
```

### Running the Application

**Option 1: Run Both (Recommended)**

Open two terminal windows:

**Terminal 1 - Backend:**
```bash
cd C:\Users\Administrator\Karga\backend
npm run dev
```
Server runs on http://localhost:3001

**Terminal 2 - Frontend:**
```bash
cd C:\Users\Administrator\Karga\frontend
npm run dev
```
App runs on http://localhost:5173

**Option 2: Seed Sample Data (Optional)**
```bash
cd C:\Users\Administrator\Karga\backend
npm run seed
```

This creates sample data:
- 3 Shippers
- 4 Truckers
- Cargo/Truck listings
- Sample bids
- Test accounts

### Test Accounts

| Role | Phone | Password |
|------|-------|----------|
| Shipper | 09171234567 | password123 |
| Trucker | 09271234567 | password123 |

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update profile
- `POST /api/auth/switch-role` - Switch shipper/trucker

### Listings
- `GET /api/listings/cargo` - Get cargo listings
- `POST /api/listings/cargo` - Create cargo listing
- `GET /api/listings/trucks` - Get truck listings
- `POST /api/listings/trucks` - Create truck listing

### Bids
- `GET /api/bids/listing/:type/:id` - Get bids for listing
- `POST /api/bids` - Place a bid
- `PUT /api/bids/:id/accept` - Accept bid
- `PUT /api/bids/:id/reject` - Reject bid

### Wallet
- `GET /api/wallet` - Get wallet balance
- `POST /api/wallet/topup` - Top up wallet
- `POST /api/wallet/payout` - Request payout

### Chat
- `GET /api/chat/:bidId` - Get chat messages
- `POST /api/chat/:bidId` - Send message

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read

## Testing

### E2E Testing with Playwright

The project includes comprehensive end-to-end tests using Playwright and Firebase Emulators.

**Quick Start:**
```bash
# Install dependencies
npm install
npx playwright install chromium

# Run tests
npm run test:e2e

# Visual test runner
npm run test:e2e:ui
```

**📚 Full testing documentation:** [tests/README.md](tests/README.md)

Tests cover:
- Authentication flow (phone OTP, registration, logout)
- User journeys across different roles
- Cargo/truck listing creation
- Contract workflows

All tests run against Firebase Emulators (zero production impact).

## Environment Variables

Create `.env` in backend folder:

```env
PORT=3001
JWT_SECRET=your-secret-key-here
NODE_ENV=development
DB_PATH=./database.sqlite
PLATFORM_FEE_RATE=0.03
MINIMUM_WALLET_BALANCE=500
```

## Platform Fee Structure

- **Platform Fee**: 3% of agreed price
- **Fee Collection**: Deducted from trucker's wallet when bidding on cargo
- **Minimum Wallet Balance**: ₱500 required to accept jobs

## Membership Tiers

### Shipper Tiers
| Tier | Transactions | Fee Discount |
|------|--------------|--------------|
| New | 0+ | 0% |
| Bronze | 3+ | 2% |
| Silver | 10+ | 5% |
| Gold | 25+ | 8% |
| Platinum | 50+ | 10% |
| Diamond | 100+ | 15% |

### Trucker Badges
| Badge | Requirements |
|-------|--------------|
| Starter | New trucker |
| Active | 5+ trips |
| Verified | 4.0+ rating, 20+ trips |
| Pro | 4.5+ rating, 50+ trips |
| Elite | 4.8+ rating, 100+ trips |

## Payment Methods (Mock)

- GCash - Free
- Maya - Free
- GrabPay - Free
- Bank Transfer - Free
- 7-Eleven - ₱15 fee
- Cebuana - ₱25 fee

## License

MIT License

## Support

For issues and questions, please open an issue on GitHub.

---

**KARGA CONNECT** - Connecting Filipino Truckers and Shippers
