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
- Firebase Cloud Functions (Node.js)
- Firestore
- Firebase Auth
- Firebase Storage

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
├── functions/             # Firebase Cloud Functions backend
├── frontend/              # React frontend
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

2. **Install Frontend Dependencies**
```bash
cd frontend
npm install
```

### Running the Application

**Option 1: Run Frontend + Emulators (Recommended)**

Open two terminal windows:

**Terminal 1 - Firebase Emulators:**
```bash
cd C:\Users\Administrator\Karga
npm run emulators:start
```

**Terminal 2 - Frontend (Vite):**
```bash
cd C:\Users\Administrator\Karga\frontend
npm run dev
```
App runs on http://localhost:5173

**Option 2: Run smoke tests (optional)**
```bash
cd C:\Users\Administrator\Karga
npm run test:smoke:gcash
```

### Test Accounts

| Role | Phone | Password |
|------|-------|----------|
| Shipper | 09171234567 | password123 |
| Trucker | 09271234567 | password123 |

## API Surface

Backend operations are handled by Firebase Cloud Functions callable endpoints in `functions/src/api/*`.

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

Environment settings are managed via Firebase function env files (`functions/.env*`) and frontend env files (`frontend/.env*`).

## Security Rollout Gates

Use the staged security rollout runbook when deploying auth/CSP/security hardening updates:

- [SECURITY_ROLLOUT_RUNBOOK.md](SECURITY_ROLLOUT_RUNBOOK.md)
- Baseline gate command: `npm run security:gate:baseline`

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
