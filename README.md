<p align="center">
  <img src="banner.png" width="100%" alt="GETGO PH — Cargo in · Trucks matched">
</p>

<div align="center">

# 🚚 GETGO PH

**A Philippine trucking backload marketplace — cargo in, empty trucks matched.**

[🌐 getgoph.com](https://getgoph.com) &nbsp;·&nbsp; 🟢 Live in production

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-ready-5A67D8?style=flat-square&logo=pwa&logoColor=white)
![Playwright](https://img.shields.io/badge/E2E-Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white)

</div>

---

## 📦 The Problem

Philippine logistics coordination is manual and fragmented — calls, SMS, and
chat apps. The result:

- 🚫 Low visibility of available trucks
- ↩️ Empty return trips (the "backload" problem)
- 🐢 Slow coordination
- 🤝 Limited trust between parties

## ✅ The Solution

A two-way marketplace where **shippers** post cargo and **truckers** post
available space — matched through a structured, trackable workflow instead of
WhatsApp roulette.

| 🏭 Shippers | 🚛 Truckers |
| --- | --- |
| Post cargo requirements | Post available trucks & routes |
| Review bids & negotiate | Bid on cargo loads |
| Track shipments live | Fill empty return trips |
| Sign contracts in-app | Get paid via digital wallets |

---

## 🛠 Capabilities

- **Open Bidding System** — flexible price negotiation
- **Trucker Wallet** — GCash, Maya, and bank transfer payouts
- **Contact Masking** — identities stay private until a contract is confirmed
- **Live Cargo Tracking** — real-time position updates
- **Rating System** — performance-based trucker badges
- **Membership Tiers** — discounts for frequent users
- **Referral System** — broker commissions for matching deals
- **Route Optimization** — surface backload opportunities
- **Digital Contracts** — sign & manage agreements in-app
- **Dark / Light Mode** — user preference UI

---

## 🏗 Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 18 · Vite · Tailwind CSS · Lucide · Leaflet · Agora |
| **Backend** | Firebase Cloud Functions (Node.js) |
| **Data** | Firestore · Firebase Auth · Firebase Storage |
| **Payments** | GCash · Maya · bank transfer flows |
| **Real-time** | Firestore listeners · FCM push notifications |
| **E2E Testing** | Playwright · Firebase Emulators |
| **Deploy** | Firebase Hosting (`getgoph.com`) |

---

## 📁 Repository Layout

```
getgoph/
├── frontend/    # React + Vite app (src/views, components, services)
├── functions/   # Cloud Functions (src/api/*)
├── tests/       # E2E specs & guides (tests/README.md)
├── scripts/     # Smoke tests, perf budgets, sitemap, prerender
├── marketing/   # Landing & marketing assets
├── plans/       # Product & feature plans
├── firebase.json
└── package.json # E2E / ops scripts
```

---

## 🚀 Local Development

```bash
# Terminal 1 — start Firebase emulators
npm run emulators:start

# Terminal 2 — start the frontend
cd frontend
npm install
npm run dev        # http://localhost:5173
```

### Test accounts

| Role | Phone | Password |
|------|-------|----------|
| Shipper | `09171234567` | `password123` |
| Trucker | `09271234567` | `password123` |

---

## 🧪 Testing

```bash
npm install
npx playwright install chromium

npm run test:e2e        # full suite
npm run test:e2e:ui     # visual runner
```

Coverage includes auth (phone OTP), role journeys, listing creation, contract
workflows, and GCash payment flows. See [`tests/README.md`](tests/README.md).

---

## 💰 Platform Model

- **Platform Fee:** 3% of agreed price

Production deploy & verification scripts live in `package.json`
(`deploy:hosting:prod`, `deploy:functions:prod`, `deploy:rules:prod`) with
post-deploy smoke checks against `getgoph.com`.

---

## 📊 Case Study

| | |
| --- | --- |
| **Objective** | Digitize trucking coordination in one marketplace |
| **Impact** | Fewer empty return trips · more transparency · structured transactions |
| **Proves** | Marketplace design, real business logic, production deployment |

---

<p align="center">
  GETGO PH — Connecting Filipino truckers & shippers 🇵🇭
</p>
