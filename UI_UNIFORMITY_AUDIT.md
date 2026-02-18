# UI Uniformity Audit (Pages + Modals)

## Scope
Active `GetGoApp` and admin surfaces were reviewed for:
- `padding`, `margin`, spacing rhythm
- typography consistency (font sizes, tiny text on mobile)
- token usage (`bg-card`, `text-muted-foreground`, `border-border`) vs hardcoded gray scales
- duplicate or conflicting style props
- PWA/mobile shell constraints (safe area, viewport ergonomics)

Reviewed pages/views:
- `HomeView`, `TrackingView`, `ContractsView`, `BidsView`, `ChatView`, `BrokerView`
- `ProfilePage`
- `AdminDashboard` + all admin section views

Reviewed modals/sheets:
- `PostModal`, `BidModal`, `CargoDetailsModal`, `TruckDetailsModal`, `ChatModal`, `RouteOptimizerModal`, `MyBidsModal`, `ContractModal`, `NotificationsModal`, `GCashPaymentModal`, `AuthModal`, `FullMapModal`

## Findings
1. High inline-style density in core modals caused inconsistent spacing and type rhythm.
2. Multiple mobile metadata rules below readable threshold (`9px`/`10px`) in details/contract flows.
3. `ContractModal` had duplicate `style` attributes on the same elements (conflicting declarations).
4. Admin table patterns used hardcoded gray palette and ad hoc paddings rather than shared tokens.
5. PWA shell needed better mobile ergonomics:
   - viewport disabled zoom behavior
   - update banner placement did not account for safe-area + bottom navigation
   - `pb-safe` class existed in markup but had no CSS definition
6. Spacing values were fragmented (many one-off pixel values), reducing cross-screen uniformity.
7. Second-pass review found additional consistency gaps:
   - active pages without mobile safe-area bottom spacing (`TrackingView`, `BrokerView`, `AdminPaymentsView`, `ContractVerificationView`, `ProfilePage`)
   - lingering encoding-sensitive glyphs in route/currency/warning text across several modals
   - remaining `10px` mobile labels in bid/status badges

## Implemented in This Pass
1. `frontend/src/components/admin/DataTable.jsx`
   - normalized to theme tokens (`bg-card`, `text-card-foreground`, `border-border`, `text-muted-foreground`)
   - standardized section/cell/footer paddings with a consistent desktop/mobile scale
   - reduced inline styles to width-only column control

2. `frontend/src/views/HomeView.jsx`
   - improved mobile safe-area bottom spacing:
     - `paddingBottom` now includes `env(safe-area-inset-bottom)`
   - raised tiny shipment metadata text from `10px` to `11px` minimum

3. `frontend/src/components/modals/ContractModal.jsx`
   - removed conflicting duplicate `style` attributes
   - raised most metadata text from `9/10` to `11/12`
   - preserved compact badges at `10/11` for density without dropping below readability floor

4. `frontend/src/components/modals/CargoDetailsModal.jsx`
   - raised static micro-labels from `10px` to `11px`
   - raised status badges from `9/11` to `10/11`

5. `frontend/src/components/modals/TruckDetailsModal.jsx`
   - raised `9/10` metadata rules to `11/12`
   - raised status badges from `9/11` to `10/11`

6. `frontend/src/components/modals/BidModal.jsx`
   - raised `10/11` helper/error text to `11/12`

7. `frontend/src/components/modals/RouteOptimizerModal.jsx`
   - raised `10/11` route/listing metadata to `11/12`

8. PWA/mobile shell consistency
   - `frontend/index.html`
     - viewport updated to `width=device-width, initial-scale=1.0, viewport-fit=cover`
   - `frontend/src/index.css`
     - added `.pb-safe` class definition for bottom safe-area padding
   - `frontend/src/components/shared/PWAUpdateNotification.jsx`
     - responsive width and safe-area-aware bottom offset
     - moved to token-consistent utility classes

9. Views second pass (mobile-first spacing + consistency)
   - `frontend/src/views/ContractsView.jsx`
     - fixed broken fee-ledger route template string
     - normalized route separators/action hint to ASCII arrows (`->`)
     - standardized cargo metadata separator
   - `frontend/src/views/BidsView.jsx`
     - raised status badge mobile typography from `10px` to `11px`
     - normalized route arrow display
   - `frontend/src/views/ChatView.jsx`
     - normalized route arrow display
   - `frontend/src/views/TrackingView.jsx`
     - added mobile safe-area bottom padding (`calc(100px + env(safe-area-inset-bottom, 0px))`)
   - `frontend/src/views/BrokerView.jsx`
     - added mobile safe-area bottom padding across all broker states (guest/non-broker/dashboard)
   - `frontend/src/views/AdminPaymentsView.jsx`
     - added mobile safe-area bottom padding
     - normalized currency prefix rendering
   - `frontend/src/views/ContractVerificationView.jsx`
     - added mobile-safe responsive page padding
     - removed encoding-sensitive/non-ASCII status labels for stable rendering

10. Modal second pass (text floor + encoding cleanup)
   - `frontend/src/components/modals/ContractModal.jsx`
     - status badge raised to `11/12`
     - normalized route/dispute/warning text separators to ASCII
   - `frontend/src/components/modals/CargoDetailsModal.jsx`
     - status badges raised to `11/12`
     - currency format normalized to `PHP`
   - `frontend/src/components/modals/TruckDetailsModal.jsx`
     - status badges raised to `11/12`
     - currency format normalized to `PHP`
   - `frontend/src/components/modals/ChatModal.jsx`
     - currency format normalized to `PHP`
     - route arrows normalized
   - `frontend/src/components/modals/MyBidsModal.jsx`
     - currency format normalized to `PHP`
     - header helper text raised to `12px` mobile
     - route arrows normalized
   - `frontend/src/components/modals/NotificationsModal.jsx`
     - notification amount display normalized to `PHP`
   - `frontend/src/components/modals/BidModal.jsx`
     - route/separator/warning text normalized to ASCII-safe rendering
     - helper description raised to `12px` mobile
   - `frontend/src/components/modals/RouteOptimizerModal.jsx`
     - helper description raised to `12px` mobile
     - bullet separators normalized to ASCII-safe rendering
   - `frontend/src/components/modals/GCashPaymentModal.jsx`
     - currency + route summary normalized to ASCII-safe rendering
     - instruction labels simplified for consistent rendering
   - `frontend/src/components/modals/RatingModal.jsx`
     - route separator normalized

11. Profile page consistency
   - `frontend/src/components/profile/ProfilePage.jsx`
     - added mobile safe-area bottom padding
     - raised `text-[10px]` badges to `text-[11px]`
     - normalized wallet amount prefix rendering

## Remaining Follow-up (Optional, Recommended)
1. Continue reducing inline styles in large modal files by extracting shared style constants.
2. Standardize all mobile section labels to a strict floor (`11px`) across remaining pages.
3. Migrate remaining hardcoded gray classes in legacy/secondary views to theme tokens.
4. Decide whether admin-only pages should keep `₱` as a domain symbol or move to `PHP` globally for strict cross-surface currency-label uniformity.
