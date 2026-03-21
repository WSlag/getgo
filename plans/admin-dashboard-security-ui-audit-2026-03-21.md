# Admin Dashboard Security-First Investigation + UI Data Completeness Audit

Date: 2026-03-21
Scope: Admin dashboard shell and all admin sub-views (`overview`, `users`, `listings`, `contracts`, `shipments`, `payments`, `financial`, `disputes`, `support`, `referrals`, `brokerPayouts`, `ratings`, `settings`)
Method: Static code/rules audit + existing admin E2E test review (no new test execution)

## Findings

### Critical

1. Revoked-admin stale-token data exposure risk on direct Firestore admin reads
- Evidence:
  - `isAdmin()` in rules grants admin access if **either** token claim is true or Firestore user doc says admin: `request.auth.token.admin == true || ...role == 'admin' || ...isAdmin == true` in `firestore.rules:16-20`.
  - Multiple admin screens read sensitive datasets directly from Firestore (not via callable `verifyAdmin`):
    - `DashboardOverview`: full reads of `users`, `cargoListings`, `truckListings`, `contracts`, and `paymentSubmissions` in `frontend/src/views/admin/DashboardOverview.jsx:87,97,104,111,138`.
    - `ContractsView`: direct `contracts` read in `frontend/src/views/admin/ContractsView.jsx:74`.
    - `ListingsManagement`: direct `cargoListings`/`truckListings` reads in `frontend/src/views/admin/ListingsManagement.jsx:181,189`.
    - `RatingsManagement`: direct `ratings` read in `frontend/src/views/admin/RatingsManagement.jsx:52`.
  - Backend callable guard is stronger (`verifyAdmin` checks custom claim and Firestore admin truth) in `functions/src/utils/adminAuth.js:20,28,40-42`.
- Risk/impact:
  - If admin claim revocation is not yet reflected in an active token, Firestore reads can remain authorized for direct-query admin screens, exposing sensitive platform data after role revocation.
- Recommendation:
  - Change rule admin predicate to require Firestore truth for admin status (not claim-only).
  - Migrate admin UI reads to callable endpoints guarded by `verifyAdmin`.
  - On admin revoke, force token/session invalidation path (for example revoke refresh tokens and enforce re-auth).

### High

2. Disputes workflow is non-authoritative and partially non-functional
- Evidence:
  - Disputes UI reads disputed contracts instead of a disputes source: `frontend/src/views/admin/DisputesManagement.jsx:186`.
  - Placeholder parties are injected (`'Shipper Name'`, `'Trucker Name'`): `frontend/src/views/admin/DisputesManagement.jsx:199-200`.
  - Resolve action currently does not call server dispute resolution; comments indicate future behavior: `frontend/src/views/admin/DisputesManagement.jsx:183,223,227`.
  - Authoritative backend callable exists but is unused by this view: `functions/src/api/admin.js:744`.
- Risk/impact:
  - Admin decisions may be made with incomplete/incorrect dispute context; "resolve" can become an operational dead-end.
- Recommendation:
  - Replace contracts-derived dispute view with canonical disputes dataset.
  - Wire resolve action to `adminResolveDispute` and display resolved-by, resolved-at, resolution code/notes.

3. Several admin views perform full-collection client scans without server pagination
- Evidence:
  - Full collection reads in:
    - `DashboardOverview` (`users`, `cargoListings`, `truckListings`, `contracts`) at `frontend/src/views/admin/DashboardOverview.jsx:87,97,104,111`.
    - `ContractsView` at `frontend/src/views/admin/ContractsView.jsx:74`.
    - `ListingsManagement` at `frontend/src/views/admin/ListingsManagement.jsx:181,189`.
    - `RatingsManagement` at `frontend/src/views/admin/RatingsManagement.jsx:52`.
  - Server-side paginated admin endpoints already exist (`adminGetContracts`, `adminGetShipments`, `adminGetUsers`, etc.) in `functions/src/api/admin.js:361,779,816`.
- Risk/impact:
  - Performance degradation and higher read costs as data grows; poor reliability on weak connections; inconsistent behavior vs server-authoritative views.
- Recommendation:
  - Replace direct reads with paginated callable-backed fetches, with consistent cursoring and bounded limits.

4. Admin-role mutation can overwrite business role context and claims payload
- Evidence:
  - Revocation hard-sets role to `shipper`: `functions/src/api/admin.js:668`.
  - Custom claims are overwritten to `{ admin: true/false }`: `functions/src/api/admin.js:663,674`.
- Risk/impact:
  - Role data loss for non-shipper admins on revoke; potential loss of other custom claims if introduced/used.
- Recommendation:
  - Preserve/restorable prior non-admin role on grant/revoke.
  - Merge claims instead of replacing entire claim object.
  - Add safety checks to prevent accidental last-admin lockout.

### Medium

5. Dashboard contains placeholder/non-authoritative metrics that can mislead operations
- Evidence:
  - Badges set `openDisputes: 0` with "not yet implemented" note: `frontend/src/views/admin/AdminDashboard.jsx:75`.
  - `openSupportTickets` exists in state and sidebar badge binding but is not populated in refresh set-state: `frontend/src/views/admin/AdminDashboard.jsx:54,75-76`; `frontend/src/components/admin/AdminSidebar.jsx:31`.
  - Financial `pendingPayouts` hardcoded to `0`: `frontend/src/views/admin/FinancialOverview.jsx:47,144`.
  - Platform health statuses are static literals: `frontend/src/views/admin/DashboardOverview.jsx:39,42,49,56,63`.
- Risk/impact:
  - Operators may trust stale/placeholder signals for prioritization and incident response.
- Recommendation:
  - Replace placeholders with authoritative counts or hide cards/badges behind "data unavailable" state.

6. Referral "Active Brokers" KPI is likely always incorrect
- Evidence:
  - Broker mapping does not assign `status`: `frontend/src/views/admin/ReferralManagement.jsx:104-105`.
  - KPI derives active brokers from `broker.status === 'active'`: `frontend/src/views/admin/ReferralManagement.jsx:115`.
- Risk/impact:
  - KPI under-reports/incorrectly reports active broker population.
- Recommendation:
  - Include canonical broker status from backend response and compute KPI from that field only.

7. Partial/incomplete admin actions in shipments and ratings
- Evidence:
  - Shipments map explicitly "Coming soon": `frontend/src/views/admin/ShipmentsView.jsx:289-290`.
  - Shipments row `Track` action has no handler behavior: `frontend/src/views/admin/ShipmentsView.jsx:228-230`.
  - Ratings view "Eye" action button has no behavior while delete is active: `frontend/src/views/admin/RatingsManagement.jsx:182-184,191`.
- Risk/impact:
  - Incomplete controls increase operator confusion and reduce triage speed.
- Recommendation:
  - Either implement actionable detail flows or remove dormant controls until ready.

8. Contract Verification is discoverable only via quick action, not sidebar nav
- Evidence:
  - Section exists (`contractVerification`) in dashboard and quick actions: `frontend/src/views/admin/AdminDashboard.jsx:32,141`; `frontend/src/views/admin/DashboardOverview.jsx:200`.
  - Sidebar nav items omit `contractVerification`: `frontend/src/components/admin/AdminSidebar.jsx:22-34`.
- Risk/impact:
  - Important operational flow becomes less discoverable and inconsistently reachable.
- Recommendation:
  - Add explicit sidebar entry or remove quick action if feature is intentionally hidden.

### Low

9. Admin UI test suite is primarily smoke/access and misses high-risk workflows
- Evidence:
  - Smoke test checks section rendering and navigation: `tests/e2e/ui/admin-dashboard-smoke.spec.js:54,59`.
  - Mobile test covers deep-link block and drawer back action: `tests/e2e/ui/admin-mobile-access.spec.js:54,78,96`.
- Risk/impact:
  - Regressions in approvals/rejections, dispute resolution, role revocation behavior, and data correctness may ship unnoticed.
- Recommendation:
  - Add action-level E2E for critical admin operations and revoked-admin edge conditions.

## UI Data Completeness Review (Acceptance Criteria Check)

Legend: `Pass`, `Partial`, `Fail`

- Overview: `Partial`
  - Captures core counts but relies on static health and partial badges.
- Users: `Pass`
  - Good decision context for user moderation actions.
- Listings: `Partial`
  - Good per-row context; lacks stronger moderation/audit context (who/when deactivated history in table).
- Contracts: `Partial`
  - Strong detail panel; missing clear cancellation actor trail in list/detail summary.
- Shipments: `Fail`
  - Critical map/action workflows are placeholders (`Coming soon`, no-op track button).
- Payments: `Pass`
  - Strong operational context and fraud-review data.
- Financial: `Partial`
  - Core amounts visible but includes hardcoded `pendingPayouts`.
- Disputes: `Fail`
  - Non-authoritative source + placeholder participants + unresolved resolve path.
- Support: `Pass`
  - Conversation-level workflow and status controls are present.
- Referrals: `Partial`
  - Rich data, but active-broker KPI derivation bug.
- Broker Payouts: `Pass`
  - Clear review controls and status context.
- Settings: `Pass`
  - Editable system parameters with validation and save flow.

## Recommendations

### Immediate hardening actions

1. Unify admin authorization semantics across Rules and Callables
- Make Firestore admin access depend on authoritative Firestore admin state (not stale claim-only path).
- Preserve callable `verifyAdmin` as server gate for all privileged reads/writes.

2. Migrate direct-query admin views to callable-backed endpoints
- Priority order: `DashboardOverview`, `DisputesManagement`, `ContractsView`, `ListingsManagement`, `RatingsManagement`.

3. Fix dispute operations to authoritative workflow
- Use `disputes` source + `adminResolveDispute` for writes; remove placeholders.

4. Harden admin role mutation
- Preserve prior role on revoke; merge claims; add safety guard for minimum-admin continuity.

### UI data completeness improvements

1. Remove/replace placeholder metrics and badges
- `openDisputes`, `openSupportTickets`, `pendingPayouts`, static "Platform Health".

2. Ensure each high-risk row has: stable ID, latest update timestamp, actor attribution, and reason/history
- Especially for contracts cancellations, listing deactivations, disputes, payout reviews.

3. Complete or hide non-functional actions
- Shipments `Track`, ratings `Eye`, and any placeholder-only cards.

4. Align navigation with feature availability
- Add `Contract Verification` to sidebar if intended as active workflow.

### Near-term reliability/scalability refactors

1. Standardize paginated list contract across admin sections
- `{ items, total, nextCursor }`, server-side filtering/sorting, explicit max limits.

2. Move expensive aggregation off client
- Overview/financial aggregates should come from callable summaries, not collection scans.

3. Add operational observability
- Surface data staleness timestamps and load-source/fallback indicators in admin UI.

### Test and monitoring additions

1. Add critical admin E2E flows
- Payment approve/reject, dispute resolve, listing deactivate, admin grant/revoke, trucker cancellation reset.

2. Add revoked-admin regression tests
- Validate immediate loss of admin read/write capability across direct and callable paths.

3. Add KPI correctness tests
- Badge counts, referral active broker KPI, financial pending payout calculations.

4. Add audit-log assertions for admin actions
- Confirm actor, target, reason, timestamp, and action type are consistently recorded.

## Notes

- This audit intentionally did not run new tests or mutate business logic.
- Existing callable authorization coverage is generally strong; biggest risk is inconsistent usage from frontend views.
