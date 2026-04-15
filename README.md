# 🚚 GETGO PH

## 🚀 Production App
This is a live, production-ready logistics marketplace platform currently deployed at:

👉 https://getgoph.com

Designed for real-world use with scalable architecture for the Philippine logistics market.

---

## 🌐 Live
👉 https://getgoph.com

---

## 📌 Overview
GETGO PH is a Philippine trucking backload marketplace that connects shippers with cargo to truckers with available space.

It is designed as a two-way digital marketplace where:
- Shippers can post cargo requirements
- Truckers can post available trucks and routes
- Both sides can connect through a structured, platform-based workflow

---

## 🏢 Business Context
GETGO PH is designed for the Philippine market, where logistics coordination is often manual, fragmented, and inefficient.

The platform focuses on:
- Connecting cargo owners with truckers
- Improving truck utilization through backload matching
- Digitizing traditional logistics workflows
- Creating a more transparent marketplace

This project reflects real-world business logic and production-ready system design.

---

## 💡 Problem Solved
Traditional trucking coordination relies on:
- Calls, SMS, and chat apps
- Manual negotiation
- No centralized system

This leads to:
- Low visibility of trucks
- Empty return trips
- Slow coordination
- Limited trust

👉 GETGO PH solves this through a centralized marketplace with structured workflows.

---

## 🚀 Key Features

- **Two-Way Marketplace** – Shippers and truckers connect in one platform  
- **Open Bidding System** – Flexible price negotiation  
- **Trucker Wallet System** – Supports GCash, Maya, bank transfer  
- **Contact Masking** – Privacy until contract is confirmed  
- **Live Cargo Tracking** – Real-time updates  
- **Rating System** – Performance-based trucker badges  
- **Membership Tiers** – Discounts for frequent users  
- **Referral System** – Earn via broker commissions  
- **Route Optimization** – Identify backload opportunities  
- **Dark/Light Mode** – User preference UI  

---

## 🛠 Tech Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- Lucide Icons

### Backend / Services
- Firebase Cloud Functions (Node.js)
- Firestore
- Firebase Auth
- Firebase Storage

---

## 📱 Screenshots

### Homepage
![Homepage](./screenshots/home.png)

### Dashboard
![Dashboard](./screenshots/dashboard.png)

### Mobile View
![Mobile](./screenshots/mobile.png)

---

## 📁 Project Structure

```text
Karga/
├── frontend/
│   ├── src/
│   │   ├── KargaMarketplace.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
├── functions/
└── README.md
```
# Installation
cd C:\Users\Administrator\Karga
cd frontend
npm install

### Running the Application

**Terminal 1 
```bash
cd C:\Users\Administrator\Karga
npm run emulators:start
```

**Terminal 2
```bash
cd C:\Users\Administrator\Karga\frontend
npm run dev
```
App runs on http://localhost:5173

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

## Environment Variables

Environment settings are managed via Firebase function env files (`functions/.env*`) and frontend env files (`frontend/.env*`).

## Platform Fee Structure

- **Platform Fee**: 3% of agreed price

## License

MIT License

## Support

For issues and questions, please open an issue on GitHub.

---

**GETGO PH** - Connecting Filipino Truckers and Shippers
