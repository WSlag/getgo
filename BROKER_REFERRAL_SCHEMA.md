# Broker Referral P0 Schema (Firebase Functions Authoritative)

This document defines the server-authoritative data model and function contracts for broker referral + commission.

## Core principles
- Primary account role remains `shipper` or `trucker`.
- Broker is an additional capability (`isBroker` + broker profile), not a separate primary role.
- Commission base is paid `platformFees` amount.
- Payouts are admin-approved.

## Firestore collections

### `brokers/{brokerId}`
Server-maintained broker summary.

Fields:
- `userId: string`
- `sourceRole: 'shipper' | 'trucker' | null`
- `referralCode: string`
- `tier: 'STARTER' | 'SILVER' | 'GOLD' | 'PLATINUM'`
- `status: 'active' | 'inactive'`
- `totalEarnings: number`
- `pendingEarnings: number`
- `availableBalance: number`
- `totalReferrals: number`
- `totalTransactions: number`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

### `users/{uid}/brokerProfile/profile`
Mirror of broker summary for user-facing reads.

### `brokerReferrals/{referredUserId}`
One-time referral attribution doc (doc id = referred user id).

Fields:
- `brokerId: string`
- `brokerCode: string`
- `referredUserId: string`
- `referredRole: string | null`
- `status: 'attributed' | 'qualified'`
- `totalQualifiedFees: number`
- `totalCommission: number`
- `totalTransactions: number`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`
- `lastQualifiedAt: Timestamp | null`

### `brokerCommissions/{platformFeeId}`
Append-only commission ledger keyed by platform fee document id (idempotent).

Fields:
- `brokerId: string`
- `referredUserId: string`
- `referralCode: string | null`
- `platformFeeId: string`
- `platformFeeAmount: number`
- `commissionRate: number`
- `commissionAmount: number`
- `contractId: string | null`
- `bidId: string | null`
- `status: 'accrued'`
- `source: 'platform_fee'`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

### `brokerPayoutRequests/{requestId}`
Broker payout requests pending admin action.

Fields:
- `brokerId: string`
- `amount: number`
- `method: string`
- `payoutDetails: object`
- `status: 'pending' | 'approved' | 'rejected'`
- `requestedAt: Timestamp`
- `reviewedAt: Timestamp | null`
- `reviewedBy: string | null`
- `reviewNotes: string | null`
- `payoutReference: string | null`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

## Cloud Functions (callable)

Broker:
- `brokerRegister(data?)`
- `brokerApplyReferralCode({ referralCode })`
- `brokerGetDashboard()`
- `brokerRequestPayout({ amount, method, payoutDetails })`

Admin:
- `adminGetBrokers({ tier?, limit? })`
- `adminUpdateBrokerTier({ brokerId, tier })`
- `adminGetBrokerPayoutRequests({ status?, limit? })`
- `adminReviewBrokerPayout({ requestId, decision, notes?, payoutReference? })`

## Trigger
- `onPlatformFeeCompleted` on `platformFees/{feeId}` create:
  - if fee is completed and fee payer has referral attribution, create commission ledger,
  - increment broker balances and referral aggregates,
  - notify broker.

## Settings dependency
- Referral rates are read from `settings/platform.referralCommission`.
- Fallback defaults:
  - `STARTER: 3`
  - `SILVER: 4`
  - `GOLD: 5`
  - `PLATINUM: 6`
