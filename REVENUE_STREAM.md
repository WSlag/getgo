# Karga Connect - Revenue Stream Strategy

> **Comprehensive monetization strategy for the Philippine Trucking Backload Marketplace**

**Document Version:** 1.0
**Last Updated:** February 5, 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Implementation Status](#current-implementation-status)
3. [Revenue Streams Overview](#revenue-streams-overview)
4. [Referral Program (User Acquisition Engine)](#referral-program-user-acquisition-engine)
5. [Transaction-Based Revenue](#1-transaction-based-revenue)
6. [Subscription Plans](#2-subscription-plans)
7. [Premium Features](#3-premium-features)
8. [Financial Services](#4-financial-services)
9. [Partnerships & Advertising](#5-partnerships--advertising)
10. [Data & Analytics](#6-data--analytics)
11. [Fee Structure & Calculations](#fee-structure--calculations)
12. [Implementation Phases](#implementation-phases)
13. [Revenue Projections](#revenue-projections)
14. [Technical Implementation](#technical-implementation)
15. [Risk Mitigation](#risk-mitigation)

---

## Executive Summary

Karga Connect employs a multi-layered monetization strategy designed to grow sustainably while providing value to both shippers and truckers. The revenue model is built on **six primary pillars**:

| Priority | Revenue Stream | Current Status | Expected Revenue Share |
|----------|---------------|----------------|----------------------|
| 🥇 | Transaction Fees | ✅ Implemented (3%) | 60-70% |
| 🥈 | Booking Fees | 🚧 Planned | 10-15% |
| 🥉 | Subscriptions | 🚧 Planned | 10-15% |
| 4 | Financial Services | 🚧 Planned | 5-10% |
| 5 | Premium Features | 🚧 Planned | 3-5% |
| 6 | Partnerships | 🚧 Planned | 2-5% |

---

## Current Implementation Status

### ✅ Already Implemented

| Feature | Details | Code Reference |
|---------|---------|----------------|
| Platform Fee | 3% of agreed price | `PLATFORM_FEE_RATE=0.03` in `.env` |
| Referral/Broker System | Tiered commission structure | `BrokerProfile`, `Referral`, `CommissionTransaction` models |
| Minimum Wallet Balance | ₱500 for truckers | `MINIMUM_WALLET_BALANCE=500` |
| Wallet System | Top-up, payout, fee deduction | `functions/src/api/wallet.js` |
| Payment Methods | 6 methods (4 free, 2 with fees) | GCash, Maya, GrabPay, Bank, 7-Eleven, Cebuana |
| Membership Tiers | NEW → DIAMOND (shippers) | Firestore user/profile documents + admin settings |
| Badge Levels | STARTER → ELITE (truckers) | Firestore user/profile documents + contract/rating aggregates |
| Broker Commissions | Referral tracking | `CommissionTransaction` model |

### 🚧 Not Yet Implemented

- Shipper booking fees
- Subscription tiers
- Premium features (Bid Boost, Featured Profile)
- Escrow system
- Early payment option
- Insurance integration
- Advertising platform
- Data analytics products

---

## Revenue Streams Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     KARGA REVENUE ECOSYSTEM                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   TRANSACTION LAYER                                                     │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│   │ Platform Fee    │  │ Booking Fee     │  │ Payment Method  │        │
│   │ (5% of freight) │  │ (₱50-100)       │  │ Fees (₱15-25)   │        │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                         │
│   SUBSCRIPTION LAYER                                                    │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│   │ Trucker Plans   │  │ Shipper Plans   │  │ Fleet Plans     │        │
│   │ Free/Pro/Biz    │  │ Free/Biz/Ent    │  │ ₱2,999+/mo      │        │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                         │
│   PREMIUM FEATURES LAYER                                                │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│   │ Bid Boost       │  │ Featured        │  │ Urgent Listing  │        │
│   │ (₱20/bid)       │  │ Profile (₱299)  │  │ (₱50/listing)   │        │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                         │
│   FINANCIAL SERVICES LAYER                                              │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│   │ Escrow Service  │  │ Instant Payment │  │ Financing       │        │
│   │ (1% fee)        │  │ (2% fee)        │  │ (Partner rev)   │        │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                         │
│   PARTNERSHIP & DATA LAYER                                              │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│   │ In-App Ads      │  │ Insurance       │  │ Analytics       │        │
│   │ (₱5K-10K/mo)    │  │ (10-20% comm)   │  │ (₱9,999/mo)     │        │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Referral Program (User Acquisition Engine)

> **The referral/broker system is Karga's primary growth engine for user acquisition in the Philippine market.**

The referral program transforms existing users into brand ambassadors, creating a viral loop that reduces customer acquisition cost (CAC) while building trust through personal recommendations—a critical factor in the Philippine trucking industry.

### Current Implementation Status

| Component | Status | Code Reference |
|-----------|--------|----------------|
| Broker Registration | ✅ Implemented | `POST /api/auth/register-broker` |
| Referral Code Generation | ✅ Implemented | `SHP{5chars}` / `TRK{5chars}` format |
| Broker Profile | ✅ Implemented | `BrokerProfile` model |
| Referral Tracking | ✅ Implemented | `Referral` model |
| Commission Transactions | ✅ Implemented | `CommissionTransaction` model |
| Broker Tiers | ✅ Implemented | STARTER → SILVER → GOLD → PLATINUM |

### Broker Tier Structure

| Tier | Deals Required | Commission Rate | Tier Bonus | Benefits |
|------|----------------|-----------------|------------|----------|
| **STARTER** | 0-10 | 3% of platform fee | ₱0 | Basic referral tracking |
| **SILVER** | 11-30 | 4% of platform fee | ₱500 | Priority support |
| **GOLD** | 31-50 | 5% of platform fee | ₱1,500 | Featured broker badge |
| **PLATINUM** | 51+ | 6% of platform fee | ₱3,000 | Dedicated account manager |

### Referral Revenue Model

**How Commissions Work:**
```
REFERRAL COMMISSION FLOW
────────────────────────

1. Broker (Maria) shares referral code: TRKA5B2C
2. New Trucker (Juan) signs up with code
3. Juan completes his first transaction (₱10,000 freight)
4. Platform fee: ₱500 (5% of ₱10,000)
5. Maria's commission: ₱25 (5% of ₱500 - Gold tier)
6. Karga net revenue: ₱475

LIFETIME VALUE ATTRIBUTION:
- Maria earns commission on ALL of Juan's transactions
- Commission continues for 12 months from signup
- After 12 months: Optional renewal or conversion to direct user
```

### Referral Program Enhancement Strategy

#### Phase 1: Launch Incentives (Month 1-6)

**Double-Sided Rewards:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  REFERRAL BONUS STRUCTURE                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  REFERRER (Existing User) GETS:                                     │
│  ├─ Sign-up bonus              ₱50 wallet credit                    │
│  ├─ First transaction bonus    ₱100 when referee completes 1st job  │
│  └─ Ongoing commission         3-6% of platform fees                │
│                                                                     │
│  REFEREE (New User) GETS:                                           │
│  ├─ Welcome bonus              ₱50 wallet credit                    │
│  ├─ First transaction discount 50% off platform fee (first job)     │
│  └─ Pro trial                  7 days free Pro subscription         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Estimated Cost per Acquisition:**
- Referrer bonus: ₱150 (₱50 + ₱100)
- Referee bonus: ₱75 (₱50 credit + ₱25 fee waiver)
- **Total CAC: ₱225** (compared to ₱500-1,000 for paid ads)

#### Phase 2: Gamification (Month 6-12)

**Referral Leaderboard:**
| Rank | Monthly Prizes | Criteria |
|------|---------------|----------|
| 🥇 Top 1 | ₱5,000 + Featured Profile | Most successful referrals |
| 🥈 Top 2-5 | ₱2,000 each | High conversion rate |
| 🥉 Top 6-10 | ₱1,000 each | Consistent referrers |
| 🎯 Milestone | ₱500 | Every 10 referrals |

**Referral Challenges:**
```
Weekly Challenge: "Haul More Heroes"
- Refer 3 truckers this week
- Bonus: ₱300 + exclusive badge

Monthly Challenge: "Network Builder"
- Refer 10 users (any type)
- Bonus: ₱1,000 + 1 month Pro free
```

#### Phase 3: Professional Broker Program (Month 12+)

**Broker-as-a-Business Model:**

Transform high-performing referrers into professional brokers:

| Broker Level | Requirements | Monthly Income Potential |
|--------------|--------------|-------------------------|
| Casual | 1-10 referrals | ₱500 - ₱2,000 |
| Active | 11-30 referrals | ₱2,000 - ₱8,000 |
| Professional | 31-50 referrals | ₱8,000 - ₱20,000 |
| Enterprise | 51+ referrals | ₱20,000+ |

**Professional Broker Benefits:**
- Custom referral landing page
- Marketing materials (flyers, banners)
- Dedicated broker dashboard
- Weekly commission payouts
- Training and certification
- Insurance coverage for transactions

### Referral Attribution & Tracking

**Multi-Touch Attribution Model:**
```javascript
// Referral attribution logic
const ATTRIBUTION_RULES = {
  // First touch gets credit for sign-up
  signupAttribution: 'first_touch',

  // Last touch within 12 months gets transaction commission
  transactionAttribution: 'last_touch_12mo',

  // Referral link expiry
  linkExpiry: '30_days',

  // Cookie/device tracking
  trackingMethods: ['referral_code', 'device_fingerprint', 'phone_number'],

  // Commission duration
  commissionDuration: '12_months'
};
```

**Fraud Prevention:**
| Risk | Prevention Measure |
|------|-------------------|
| Self-referral | Phone number verification, device fingerprinting |
| Fake accounts | OTP verification, KYC for payouts > ₱1,000 |
| Commission farming | Transaction velocity limits, manual review |
| Code sharing abuse | Unique device binding, IP tracking |

### Referral Program KPIs

| Metric | Target | Current |
|--------|--------|---------|
| Viral Coefficient (K-factor) | > 1.0 | 0.3 |
| Referral Conversion Rate | 30% | 15% |
| Cost per Acquisition (CAC) | < ₱300 | ₱225 |
| Referral Revenue % | 20% of signups | 10% |
| Broker Retention (90 day) | > 60% | TBD |
| Average Referrals per Broker | 5/month | 2/month |

### Referral Program Revenue Impact

**Projected Growth from Referrals:**

| Month | New Users (Organic) | New Users (Referral) | Referral % | CAC Savings |
|-------|---------------------|---------------------|------------|-------------|
| 1 | 100 | 20 | 17% | ₱5,500 |
| 6 | 300 | 150 | 33% | ₱41,250 |
| 12 | 500 | 400 | 44% | ₱110,000 |
| 24 | 800 | 1,200 | 60% | ₱330,000 |

**Commission Payout Projection:**

| Month | Active Brokers | Avg Commission | Total Payouts | Net Benefit |
|-------|---------------|----------------|---------------|-------------|
| 6 | 50 | ₱500 | ₱25,000 | ₱16,250 |
| 12 | 200 | ₱800 | ₱160,000 | ₱(50,000) |
| 24 | 500 | ₱1,200 | ₱600,000 | ₱(270,000) |

> **Note:** Early months show net benefit due to high CAC savings. Later months show investment as commission payouts grow, but this is offset by higher LTV from referred users (typically 2x organic users).

### Integration with Revenue Streams

**How Referrals Boost Other Revenue:**

1. **Transaction Fees**: Referred users have 40% higher transaction frequency
2. **Subscriptions**: 25% higher Pro conversion from referred truckers
3. **Premium Features**: Brokers promote premium features to referees
4. **Network Effects**: Each new user brings average 0.3 additional users

### Referral Program Technical Implementation

**Database Schema (Already Implemented):**
```sql
-- BrokerProfile (existing)
- userId (FK)
- referralCode (unique)
- tier: ENUM('STARTER', 'SILVER', 'GOLD', 'PLATINUM')
- totalEarnings, pendingEarnings, availableBalance
- totalReferrals, totalTransactions

-- Referral (existing)
- brokerProfileId (FK)
- referredUserId (FK)
- referralCode
- status: ENUM('pending', 'active', 'inactive')
- totalTransactions, totalEarnings

-- CommissionTransaction (existing)
- brokerProfileId (FK)
- contractId (FK)
- type: ENUM('commission', 'bonus', 'payout')
- amount, description, status
```

**API Endpoints to Enhance:**
```javascript
// Referral management
POST   /api/referrals/apply-code      // Apply referral code during signup
GET    /api/referrals/my-referrals    // Get all my referrals
GET    /api/referrals/leaderboard     // Weekly/monthly leaderboard
POST   /api/referrals/claim-bonus     // Claim milestone bonuses

// Broker dashboard
GET    /api/broker/dashboard          // Earnings, referrals, analytics
GET    /api/broker/commission-history // Detailed commission breakdown
POST   /api/broker/request-payout     // Cash out commissions
GET    /api/broker/marketing-kit      // Download promotional materials
```

### Referral Marketing Strategy

**Channel-Specific Tactics:**

| Channel | Strategy | Target CAC |
|---------|----------|------------|
| **WhatsApp/Viber** | Share referral link in trucker groups | ₱150 |
| **Facebook Groups** | "Trucking Philippines" community posts | ₱200 |
| **Text Blast** | SMS to existing trucker networks | ₱100 |
| **Word of Mouth** | Driver-to-driver at truck stops | ₱50 |
| **Physical Flyers** | QR codes at gas stations, terminals | ₱250 |

**Localized Approach:**
- Target: Provincial trucking hubs (Pampanga, Bulacan, Batangas, Cebu)
- Language: Tagalog/Bisaya referral materials
- Timing: Payday periods for bonus distribution

---

## 1. Transaction-Based Revenue

### 1.1 Platform Service Fee (Primary Revenue)

The core monetization mechanism - a percentage charged on every completed transaction.

#### Current Implementation (Phase 1)
```
Platform Fee: 3% of agreed freight price
- Deducted from trucker's wallet
- Collected when bid is accepted
```

#### Target Implementation (Phase 2-3)

| Tier | Fee Rate | Conditions |
|------|----------|------------|
| Standard | 5% | Default rate |
| Minimum | ₱50 | Floor for low-value shipments |
| Maximum | ₱2,000 | Cap for high-value shipments |

**Fee Calculation Logic:**
```javascript
const calculatePlatformFee = (freightPrice, shipperTier) => {
  const baseRate = 0.05; // 5%
  const tierDiscount = TIER_DISCOUNTS[shipperTier] || 0;
  const effectiveRate = baseRate * (1 - tierDiscount);

  let fee = freightPrice * effectiveRate;
  fee = Math.max(fee, 50);   // Minimum ₱50
  fee = Math.min(fee, 2000); // Maximum ₱2,000

  return Math.round(fee);
};
```

#### Fee Discounts by Shipper Tier

| Tier | Transactions | Fee Discount | Effective Fee |
|------|--------------|--------------|---------------|
| NEW | 0-2 | 0% | 5.0% |
| BRONZE | 3-9 | 4% | 4.8% |
| SILVER | 10-24 | 10% | 4.5% |
| GOLD | 25-49 | 16% | 4.2% |
| PLATINUM | 50-99 | 20% | 4.0% |
| DIAMOND | 100+ | 30% | 3.5% |

### 1.2 Booking Fee (Shipper Convenience Fee)

A flat fee charged to shippers for using the platform.

| Listing Type | Fee | Rationale |
|--------------|-----|-----------|
| Standard | ₱50 | Basic listing |
| Urgent | ₱100 | Priority matching |
| Extended Reach | ₱150 | 3x trucker notifications |

**Total Payment Flow:**
```
┌─────────────────────────────────────────────────────────────────┐
│  SHIPPER PAYS                                                   │
│  ─────────────────────────────────────────────────────────────  │
│  Agreed freight rate         ₱5,000.00                          │
│  Booking fee                 ₱   50.00                          │
│  ───────────────────────────────────────                        │
│  Total                       ₱5,050.00                          │
│                                                                 │
│  DISTRIBUTION                                                   │
│  ─────────────────────────────────────────────────────────────  │
│  Trucker receives            ₱4,750.00  (freight - 5% fee)      │
│  Karga platform fee          ₱  250.00  (5% of ₱5,000)          │
│  Karga booking fee           ₱   50.00                          │
│  ───────────────────────────────────────                        │
│  Karga total revenue         ₱  300.00                          │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Payment Method Fees

Fees passed through from payment providers.

| Method | User Fee | Karga Margin | Notes |
|--------|----------|--------------|-------|
| GCash | Free | 0% | High volume, strategic |
| Maya | Free | 0% | High volume, strategic |
| GrabPay | Free | 0% | User convenience |
| Bank Transfer | Free | 0% | Preferred for large amounts |
| 7-Eleven | ₱15 | ₱5 | Over-the-counter convenience |
| Cebuana | ₱25 | ₱10 | Rural accessibility |

---

## 2. Subscription Plans

### 2.1 Trucker Subscription Tiers

| Feature | Free | Pro (₱499/mo) | Business (₱1,499/mo) |
|---------|------|---------------|----------------------|
| Monthly bids | 5 | Unlimited | Unlimited |
| Search visibility | Standard | Priority | Top priority |
| Verified badge | ❌ | ✅ | ✅ |
| Profile analytics | Basic | Advanced | Advanced |
| Fleet management | ❌ | ❌ | ✅ (up to 10 trucks) |
| Bid success rate | ❌ | ✅ | ✅ |
| Route suggestions | ❌ | ✅ | ✅ |
| Dedicated support | ❌ | ❌ | ✅ |
| Fee discount | 0% | 0.5% | 1% |

**Value Proposition:**
- **Free**: Try the platform, limited engagement
- **Pro**: Serious truckers wanting competitive edge
- **Business**: Fleet operators with multiple vehicles

### 2.2 Shipper Subscription Tiers

| Feature | Free | Business (₱999/mo) | Enterprise (₱4,999/mo) |
|---------|------|--------------------|-----------------------|
| Monthly listings | 3 | Unlimited | Unlimited |
| Bulk upload | ❌ | ✅ | ✅ |
| API access | ❌ | ❌ | ✅ |
| Analytics dashboard | Basic | Advanced | Premium |
| Account manager | ❌ | ❌ | ✅ |
| Custom integrations | ❌ | ❌ | ✅ |
| Volume discounts | ❌ | 5% | 15% |
| Priority support | ❌ | ✅ | ✅ |

### 2.3 Fleet Management Add-on

For truckers with multiple vehicles:

| Plan | Trucks | Price | Per Truck |
|------|--------|-------|-----------|
| Starter Fleet | 2-5 | ₱1,999/mo | ₱400-1,000 |
| Growth Fleet | 6-15 | ₱3,999/mo | ₱267-667 |
| Enterprise Fleet | 16-50 | ₱7,999/mo | ₱160-500 |
| Custom | 50+ | Contact Sales | Negotiated |

**Fleet Features:**
- Centralized dashboard for all trucks
- Driver assignment system
- Route optimization across fleet
- Consolidated billing
- Performance analytics per driver

---

## 3. Premium Features

### 3.1 For Truckers

| Feature | Price | Duration | Description |
|---------|-------|----------|-------------|
| **Bid Boost** | ₱20 | Per bid | Bid appears at top of shipper's list |
| **Featured Profile** | ₱299 | Monthly | Highlighted in search results with special badge |
| **Instant Notification** | ₱99 | Monthly | Get notified first for matching listings |
| **Verified Badge** | ₱199 | Yearly | Trust badge (requires document verification) |
| **Priority Matching** | ₱149 | Monthly | First access to new listings in your routes |
| **Performance Report** | ₱50 | One-time | Detailed analytics of your bidding patterns |

### 3.2 For Shippers

| Feature | Price | Duration | Description |
|---------|-------|----------|-------------|
| **Urgent Listing** | ₱50 | Per listing | Marked as urgent, sent to 2x truckers |
| **Extended Reach** | ₱100 | Per listing | Sent to 3x more truckers |
| **Featured Listing** | ₱150 | Per listing | Pinned at top of marketplace |
| **Cargo Insurance** | 1% of value | Per shipment | Optional coverage via insurance partner |
| **Repeat Booking** | ₱30 | Per booking | Quick rebook same trucker |
| **Bulk Discount** | ₱500 | Monthly | 10% off all premium features |

### 3.3 Premium Feature Revenue Projection

Assuming 1,000 active users per month:

| Feature | Adoption Rate | Monthly Revenue |
|---------|---------------|-----------------|
| Bid Boost | 15% (300 uses) | ₱6,000 |
| Featured Profile | 5% (50 users) | ₱14,950 |
| Instant Notification | 8% (80 users) | ₱7,920 |
| Urgent Listing | 10% (100 uses) | ₱5,000 |
| Extended Reach | 8% (80 uses) | ₱8,000 |
| **Total** | - | **₱41,870** |

---

## 4. Financial Services

### 4.1 Escrow Service

Secure payment holding to protect both parties.

```
PAYMENT FLOW WITH ESCROW
────────────────────────

1. Shipper posts listing            → No payment yet
2. Trucker bids                     → No payment yet
3. Shipper accepts bid              → Shipper pays to ESCROW
4. Contract signed                  → Funds held in escrow
5. Shipment picked up               → Partial release (optional)
6. Delivery confirmed               → Funds released to trucker
7. Rating completed                 → Transaction complete
```

**Escrow Fee Structure:**

| Transaction Value | Fee | Minimum |
|-------------------|-----|---------|
| Under ₱10,000 | Free | - |
| ₱10,000 - ₱50,000 | 1% | ₱100 |
| ₱50,000 - ₱200,000 | 0.75% | ₱500 |
| Over ₱200,000 | 0.5% | ₱1,500 |

### 4.2 Instant Payment (Early Release)

Allow truckers to receive payment immediately instead of waiting for standard processing.

```
STANDARD vs INSTANT PAYMENT
───────────────────────────

Standard:
  Delivery confirmed → 24-48 hours → Payment released

Instant (2% fee):
  Delivery confirmed → Immediate → Payment released

Example:
  Freight: ₱10,000
  Instant fee: ₱200 (2%)
  Trucker receives: ₱9,800 immediately
```

**Projected Adoption:**
- 30% of truckers likely to use instant payment
- Average transaction: ₱5,000
- Monthly transactions: 1,000
- Instant payment revenue: ₱30,000/month

### 4.3 Financing & Credit Products

Partnership with fintech/lending companies:

#### Ship Now, Pay Later (For Shippers)
- 30-day payment terms for qualified shippers
- Karga earns 2-5% referral fee from lending partner
- Risk carried by lending partner

#### Fuel Advance (For Truckers)
- Advance for fuel costs before trip
- Repaid from completed delivery payment
- Interest: 5% flat (shared with lending partner)

**Revenue Model:**
```
Lending Partner provides:     ₱50,000 fuel advance
Interest charged to trucker:  ₱2,500 (5%)
Karga's share:                ₱1,000 (40% of interest)
Lending partner's share:      ₱1,500 (60% of interest)
```

### 4.4 Insurance Products

Partnership with insurance providers for:

| Product | Premium | Karga Commission |
|---------|---------|------------------|
| Cargo Insurance | 0.5-2% of cargo value | 15-20% |
| Vehicle Insurance | Market rate | 10% |
| Liability Insurance | Market rate | 10% |
| Accident Coverage | ₱500/trip | 20% |

---

## 5. Partnerships & Advertising

### 5.1 Strategic Partnerships

| Partner Type | Revenue Model | Potential Partners |
|--------------|---------------|-------------------|
| Fuel Companies | 1-2% on fuel purchases via app | Shell, Petron, Caltex |
| Tire & Parts | 5% referral commission | Goodyear, Bridgestone |
| Vehicle Financing | 2% loan referral fee | BDO, BPI, UnionBank |
| Maintenance Shops | Listing fee + commission | AutoHub, Petron Autocare |
| Insurance | 10-20% policy commission | Pioneer, MAPFRE |

### 5.2 In-App Advertising

| Placement | Price | Impressions | CPM |
|-----------|-------|-------------|-----|
| Home banner | ₱5,000/month | ~50,000 | ₱100 |
| Search results | ₱3,000/month | ~30,000 | ₱100 |
| Push notification | ₱2/notification | Direct | - |
| Featured partner | ₱10,000/month | Premium | - |

**Advertising Guidelines:**
- Only trucking-related ads
- Non-intrusive placements
- No competitor ads
- User can opt-out (Pro subscribers)

### 5.3 API & Integration Revenue

For enterprise clients and logistics companies:

| Tier | API Calls/Month | Price |
|------|-----------------|-------|
| Basic | 1,000 | ₱2,999/mo |
| Growth | 10,000 | ₱9,999/mo |
| Enterprise | Unlimited | ₱29,999/mo |

---

## 6. Data & Analytics

### 6.1 Karga Insights (B2B Product)

Market intelligence for logistics companies:

| Package | Price | Features |
|---------|-------|----------|
| Basic | ₱4,999/mo | Rate benchmarking, demand trends |
| Pro | ₱9,999/mo | + Route analysis, seasonal patterns |
| Enterprise | ₱24,999/mo | + Custom reports, API access, raw data |

**Data Products:**
- Market rate benchmarking by route
- Demand forecasting by region
- Carrier performance analytics
- Seasonal trend analysis
- Route optimization insights

### 6.2 Government & Research Data

Anonymized, aggregated data for:
- Traffic planning departments
- Economic research institutions
- Trade associations

Pricing: Custom contracts, typically ₱50,000-500,000 annually.

---

## Fee Structure & Calculations

### Complete Fee Breakdown Example

**Scenario:** ₱10,000 cargo shipment, Manila to Cebu

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TRANSACTION: MANILA → CEBU SHIPMENT                                    │
│  Agreed Price: ₱10,000                                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SHIPPER PAYS:                                                          │
│  ├─ Freight rate                    ₱10,000.00                          │
│  ├─ Booking fee                     ₱    50.00                          │
│  ├─ Cargo insurance (opt, 1%)       ₱   100.00                          │
│  └─ Extended reach (opt)            ₱   100.00                          │
│  ────────────────────────────────────────────                           │
│  TOTAL SHIPPER COST                 ₱10,250.00                          │
│                                                                         │
│  TRUCKER RECEIVES:                                                      │
│  ├─ Freight rate                    ₱10,000.00                          │
│  ├─ Platform fee (5%)               ₱  -500.00                          │
│  ├─ Instant payment (opt, 2%)       ₱  -190.00                          │
│  └─ Bid boost used (opt)            ₱   -20.00                          │
│  ────────────────────────────────────────────                           │
│  TRUCKER NET                        ₱ 9,290.00                          │
│                                                                         │
│  KARGA REVENUE BREAKDOWN:                                               │
│  ├─ Platform fee                    ₱   500.00                          │
│  ├─ Booking fee                     ₱    50.00                          │
│  ├─ Instant payment fee             ₱   190.00                          │
│  ├─ Bid boost                       ₱    20.00                          │
│  ├─ Insurance commission (15%)      ₱    15.00                          │
│  └─ Extended reach                  ₱   100.00                          │
│  ────────────────────────────────────────────                           │
│  TOTAL KARGA REVENUE                ₱   875.00  (8.5% of GMV)           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Fee Caps and Minimums

| Fee Type | Minimum | Maximum | Notes |
|----------|---------|---------|-------|
| Platform fee | ₱50 | ₱2,000 | Per transaction |
| Booking fee | ₱50 | ₱150 | Per listing |
| Escrow fee | ₱0 | ₱1,500 | Free under ₱10K |
| Instant payment | ₱50 | ₱500 | 2% of payout |

---

## Implementation Phases

### Phase 1: Foundation (Current - Month 6)
**Focus:** User acquisition via referral program with minimal friction

| Stream | Status | Revenue Target |
|--------|--------|----------------|
| Platform fee | ✅ Live at 3% | ₱125,000/mo |
| Payment method fees | ✅ Live | ₱5,000/mo |
| Booking fee | 🚧 Implement | ₱25,000/mo |
| Referral System | ✅ Live | Growth driver |

**Referral Goals (Phase 1):**
- 🎯 500 new users via referrals
- 🎯 100 active brokers
- 🎯 Viral coefficient > 0.5
- 🎯 CAC < ₱250

**Actions:**
- [ ] Increase platform fee to 5% with min/max caps
- [ ] Implement shipper booking fee (₱50)
- [ ] Add fee transparency in contract flow
- [ ] Build subscription model database schema
- [x] Implement broker registration
- [x] Generate unique referral codes
- [ ] Add referral code input during signup
- [ ] Build broker dashboard with earnings tracking
- [ ] Implement double-sided referral bonuses
- [ ] Launch "First 100 Brokers" promotion

### Phase 2: Growth (Month 6-18)
**Focus:** Monetize engaged users, scale referral network

| Stream | Target Launch | Revenue Target |
|--------|---------------|----------------|
| Trucker subscriptions | Month 8 | ₱150,000/mo |
| Premium features | Month 10 | ₱75,000/mo |
| Escrow service | Month 12 | ₱50,000/mo |
| Insurance partnerships | Month 14 | ₱30,000/mo |

**Referral Goals (Phase 2):**
- 🎯 2,000 new users via referrals (40% of signups)
- 🎯 300 active brokers
- 🎯 Viral coefficient > 0.8
- 🎯 Professional broker program with 50 certified brokers

**Actions:**
- [ ] Launch Pro subscription for truckers
- [ ] Implement Bid Boost feature
- [ ] Build escrow payment flow
- [ ] Integrate insurance API
- [ ] Launch shipper Business tier
- [ ] Implement referral leaderboard and gamification
- [ ] Launch weekly/monthly referral challenges
- [ ] Create broker marketing kit (flyers, social media assets)
- [ ] Partner with trucking associations for bulk referrals
- [ ] Implement tiered commission payouts

### Phase 3: Scale (Month 18+)
**Focus:** Full monetization, enterprise features, professional broker network

| Stream | Target Launch | Revenue Target |
|--------|---------------|----------------|
| Enterprise subscriptions | Month 18 | ₱200,000/mo |
| Financial services | Month 20 | ₱150,000/mo |
| Data analytics products | Month 22 | ₱100,000/mo |
| API revenue | Month 24 | ₱50,000/mo |

**Referral Goals (Phase 3):**
- 🎯 60% of new users from referrals
- 🎯 1,000+ active brokers nationwide
- 🎯 Viral coefficient > 1.0 (organic growth)
- 🎯 Professional broker network in all major Philippine regions

**Actions:**
- [ ] Launch Fleet Management product
- [ ] Implement Ship Now, Pay Later
- [ ] Build Karga Insights dashboard
- [ ] Launch public API
- [ ] Implement broker certification program
- [ ] Launch regional broker leaders program
- [ ] Create broker-exclusive features and early access
- [ ] Build broker mobile app for referral management
- [ ] Establish broker community (Facebook group, Viber)

---

## Revenue Projections

### User Growth Forecast (Referral-Driven)

| Metric | Month 6 | Month 12 | Month 24 | Month 36 |
|--------|---------|----------|----------|----------|
| **User Acquisition:** | | | | |
| Organic signups | 300 | 500 | 800 | 1,000 |
| Referral signups | 200 | 500 | 1,200 | 2,000 |
| **Total new users** | 500 | 1,000 | 2,000 | 3,000 |
| Referral % of signups | 40% | 50% | 60% | 67% |
| **Cumulative Users:** | | | | |
| Total registered | 2,000 | 6,000 | 20,000 | 45,000 |
| Active users (MAU) | 500 | 2,000 | 8,000 | 20,000 |
| **Broker Network:** | | | | |
| Active brokers | 100 | 300 | 800 | 1,500 |
| Avg referrals/broker | 2 | 3 | 4 | 5 |
| Commission payouts | ₱15K | ₱75K | ₱300K | ₱750K |
| **Viral Metrics:** | | | | |
| K-factor (viral coeff) | 0.5 | 0.8 | 1.0 | 1.2 |
| CAC (blended) | ₱200 | ₱180 | ₱150 | ₱120 |

### Monthly Revenue Forecast

| Metric | Month 6 | Month 12 | Month 24 | Month 36 |
|--------|---------|----------|----------|----------|
| Monthly GMV | ₱2.5M | ₱10M | ₱50M | ₱150M |
| Transactions | 500 | 2,000 | 10,000 | 30,000 |
| Active Users | 500 | 2,000 | 8,000 | 20,000 |
| **Revenue Streams:** | | | | |
| Transaction fees (5%) | ₱125K | ₱500K | ₱2.5M | ₱7.5M |
| Booking fees | ₱25K | ₱100K | ₱500K | ₱1.5M |
| Subscriptions | ₱0 | ₱100K | ₱400K | ₱1M |
| Premium features | ₱10K | ₱75K | ₱300K | ₱600K |
| Financial services | ₱0 | ₱50K | ₱300K | ₱800K |
| Partnerships | ₱0 | ₱25K | ₱200K | ₱600K |
| Data/API | ₱0 | ₱0 | ₱100K | ₱300K |
| **Gross Revenue** | **₱160K** | **₱850K** | **₱4.3M** | **₱12.3M** |
| **Less: Referral Costs:** | | | | |
| Broker commissions | (₱15K) | (₱75K) | (₱300K) | (₱750K) |
| Referral bonuses | (₱10K) | (₱50K) | (₱150K) | (₱300K) |
| **Net Revenue** | **₱135K** | **₱725K** | **₱3.85M** | **₱11.25M** |
| **Take Rate (Net)** | 5.4% | 7.25% | 7.7% | 7.5% |

### Referral Program ROI Analysis

| Metric | Calculation | Value |
|--------|-------------|-------|
| CAC via Paid Ads | Industry average | ₱500-1,000 |
| CAC via Referral | Bonus + Commission | ₱225 |
| **CAC Savings** | Difference | ₱275-775 |
| LTV Referred User | 2x organic | ₱3,000 |
| LTV Organic User | Baseline | ₱1,500 |
| **LTV:CAC (Referral)** | ₱3,000 / ₱225 | **13.3x** |
| LTV:CAC (Paid) | ₱1,500 / ₱750 | 2.0x |

### Annual Revenue Projection

| Year | GMV | Gross Revenue | Referral Costs | Net Revenue | Take Rate |
|------|-----|---------------|----------------|-------------|-----------|
| Year 1 | ₱50M | ₱4M | ₱400K | ₱3.6M | 7.2% |
| Year 2 | ₱300M | ₱26M | ₱2M | ₱24M | 8.0% |
| Year 3 | ₱1B | ₱85M | ₱6M | ₱79M | 7.9% |

---

## Technical Implementation

### Database Schema Additions

```sql
-- Subscription Plans Table
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  user_type ENUM('trucker', 'shipper', 'fleet'),
  price DECIMAL(10,2) NOT NULL,
  billing_period ENUM('monthly', 'yearly'),
  features JSON,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP
);

-- User Subscriptions Table
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  plan_id UUID REFERENCES subscription_plans(id),
  status ENUM('active', 'cancelled', 'expired', 'past_due'),
  started_at TIMESTAMP,
  expires_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  auto_renew BOOLEAN DEFAULT true
);

-- Premium Feature Purchases
CREATE TABLE premium_purchases (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  feature_type ENUM('bid_boost', 'featured_profile', 'urgent_listing', 'extended_reach'),
  amount DECIMAL(10,2),
  target_id UUID,  -- bid_id or listing_id
  purchased_at TIMESTAMP,
  expires_at TIMESTAMP
);

-- Escrow Transactions
CREATE TABLE escrow_transactions (
  id UUID PRIMARY KEY,
  contract_id UUID REFERENCES contracts(id),
  amount DECIMAL(12,2),
  escrow_fee DECIMAL(10,2),
  status ENUM('held', 'released', 'disputed', 'refunded'),
  held_at TIMESTAMP,
  released_at TIMESTAMP
);
```

### API Endpoints to Add

```javascript
// ===== REFERRAL ENDPOINTS (Priority) =====
// Already Implemented:
POST   /api/auth/register-broker        // Register as broker
GET    /api/auth/me                     // Get broker profile

// To Implement:
POST   /api/referrals/apply-code        // Apply referral code during signup
GET    /api/referrals/validate/:code    // Validate referral code before signup
GET    /api/referrals/my-referrals      // Get all users I referred
GET    /api/referrals/my-earnings       // Get commission history
GET    /api/referrals/leaderboard       // Weekly/monthly top referrers
POST   /api/referrals/claim-bonus       // Claim milestone bonuses
GET    /api/referrals/available-bonuses // Check available bonuses

// Broker Dashboard
GET    /api/broker/dashboard            // Summary: earnings, referrals, performance
GET    /api/broker/analytics            // Detailed analytics
POST   /api/broker/request-payout       // Cash out commissions
GET    /api/broker/payout-history       // Commission payout history
GET    /api/broker/marketing-kit        // Download promotional materials

// Admin Endpoints (for fraud prevention)
GET    /api/admin/referrals/suspicious  // Flag suspicious referral patterns
PUT    /api/admin/referrals/:id/review  // Review flagged referrals

// ===== SUBSCRIPTION ENDPOINTS =====
POST   /api/subscriptions/subscribe
GET    /api/subscriptions/my-subscription
PUT    /api/subscriptions/cancel
POST   /api/subscriptions/renew

// ===== PREMIUM FEATURES =====
POST   /api/premium/bid-boost
POST   /api/premium/featured-profile
POST   /api/premium/urgent-listing
GET    /api/premium/my-purchases

// ===== ESCROW =====
POST   /api/escrow/hold
POST   /api/escrow/release
POST   /api/escrow/dispute

// ===== FINANCIAL SERVICES =====
POST   /api/finance/instant-payout
GET    /api/finance/instant-payout-eligibility
```

### Environment Variables to Add

```env
# Fee Configuration
PLATFORM_FEE_RATE=0.05
PLATFORM_FEE_MIN=50
PLATFORM_FEE_MAX=2000
BOOKING_FEE_STANDARD=50
BOOKING_FEE_URGENT=100
ESCROW_FEE_RATE=0.01
INSTANT_PAYOUT_FEE_RATE=0.02

# Subscription Pricing
TRUCKER_PRO_PRICE=499
TRUCKER_BUSINESS_PRICE=1499
SHIPPER_BUSINESS_PRICE=999
SHIPPER_ENTERPRISE_PRICE=4999

# Premium Feature Pricing
BID_BOOST_PRICE=20
FEATURED_PROFILE_PRICE=299
URGENT_LISTING_PRICE=50
EXTENDED_REACH_PRICE=100

# Referral Program Configuration
REFERRAL_SIGNUP_BONUS_REFERRER=50
REFERRAL_SIGNUP_BONUS_REFEREE=50
REFERRAL_FIRST_TRANSACTION_BONUS=100
REFERRAL_COMMISSION_DURATION_MONTHS=12
BROKER_TIER_STARTER_RATE=0.03
BROKER_TIER_SILVER_RATE=0.04
BROKER_TIER_GOLD_RATE=0.05
BROKER_TIER_PLATINUM_RATE=0.06
BROKER_TIER_SILVER_BONUS=500
BROKER_TIER_GOLD_BONUS=1500
BROKER_TIER_PLATINUM_BONUS=3000
```

---

## Risk Mitigation

### Price Sensitivity Risks

| Risk | Mitigation |
|------|------------|
| Truckers resist 5% fee | Gradual increase, emphasize value, offer Pro discount |
| Shippers avoid booking fee | Bundle with premium features, waive for high-volume |
| Subscription churn | Monthly payment option, lock-in annual discount (20%) |

### Competitive Risks

| Risk | Mitigation |
|------|------------|
| Competitors offer lower fees | Focus on trust, verification, and support |
| Disintermediation (direct deals) | Contact masking until contract signed |
| New entrants | First-mover advantage, network effects |

### Operational Risks

| Risk | Mitigation |
|------|------------|
| Payment disputes | Robust escrow system, clear policies |
| Fraud | Verification badges, reputation system |
| Cash flow | Escrow buffer, instant payout fees |

---

## Key Performance Indicators (KPIs)

### Revenue KPIs
- **Gross Merchandise Value (GMV)**: Total transaction value
- **Take Rate**: Revenue / GMV (target: 8-10%)
- **Revenue per Active User (ARPU)**: Monthly revenue / active users
- **Lifetime Value (LTV)**: Total revenue per user over their lifetime

### Subscription KPIs
- **Monthly Recurring Revenue (MRR)**: Total subscription revenue
- **Subscriber Conversion Rate**: Free to paid ratio (target: 5-10%)
- **Churn Rate**: Monthly subscription cancellations (target: <5%)

### Transaction KPIs
- **Average Transaction Value**: GMV / transactions
- **Transactions per User**: Engagement metric
- **Premium Feature Attach Rate**: % of transactions using premium features

### Referral Program KPIs
- **K-Factor (Viral Coefficient)**: Referrals per user × conversion rate (target: >1.0)
- **Referral Rate**: % of new users from referrals (target: >50%)
- **CAC (Customer Acquisition Cost)**: Blended cost including referral bonuses (target: <₱250)
- **Active Brokers**: Number of users actively referring (target: 1,000+)
- **Broker Retention Rate**: 90-day broker activity (target: >60%)
- **Referral Conversion Rate**: Referred signups that complete first transaction (target: >30%)
- **Commission Payout Ratio**: Commission payouts / referral-driven GMV (target: <2%)

---

## Conclusion

Karga Connect's revenue strategy is designed to:

1. **Grow virally** - Referral program as the primary user acquisition engine, achieving K-factor >1.0
2. **Start lean** - Low fees during acquisition, scaling up as value is proven
3. **Reward advocates** - Broker network creates a distributed sales force across the Philippines
4. **Add value** - Premium features that genuinely help users succeed
5. **Scale sustainably** - Multiple revenue streams reduce dependency on any single source
6. **Protect margins** - Fee caps and minimums ensure profitability at all transaction sizes
7. **Build moats** - Network effects from referrals and data create competitive advantage

**Key Strategic Priorities:**

| Priority | Strategy | Expected Outcome |
|----------|----------|------------------|
| 1 | Scale referral program | 60% of new users via referrals by Month 24 |
| 2 | Build professional broker network | 1,000+ active brokers nationwide |
| 3 | Achieve viral growth | K-factor >1.0 for organic expansion |
| 4 | Monetize power users | 10% conversion to paid subscriptions |
| 5 | Expand financial services | ₱1M+ monthly revenue from financial products |

The projected net take rate of 7-8% accounts for referral program costs while remaining competitive with global marketplace benchmarks and affordable for the Philippine market.

---

## Appendix: Referral Program Quick Reference

### Broker Commission Rates
```
STARTER (0-10 deals):   3% of platform fee
SILVER  (11-30 deals):  4% of platform fee + ₱500 bonus
GOLD    (31-50 deals):  5% of platform fee + ₱1,500 bonus
PLATINUM (51+ deals):   6% of platform fee + ₱3,000 bonus
```

### Referral Bonus Structure
```
Referrer (existing user):
- ₱50 upon referee signup
- ₱100 upon referee's first completed transaction
- Ongoing 3-6% commission on platform fees (12 months)

Referee (new user):
- ₱50 wallet credit
- 50% off first transaction fee
- 7-day Pro trial
```

### Referral Code Format
```
Shipper referrers: SHP + 5 alphanumeric chars (e.g., SHPA5B2C)
Trucker referrers: TRK + 5 alphanumeric chars (e.g., TRKX9Y3Z)
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 5, 2026 | Initial comprehensive revenue strategy |
| 1.1 | Feb 5, 2026 | Added comprehensive referral program section and integration with revenue model |

---

*This document should be reviewed quarterly and updated based on market feedback and performance data.*
