# Karga Connect - Project Progress

Last Updated: February 21, 2026

## Scope of This Update
This report captures current local working-tree progress after the latest local commit (`cc40109`, February 21, 2026), focused on admin platform-fee monitoring and overdue-status handling.

## Working Tree Snapshot (Current)

| Metric | Value |
|---|---:|
| Branch | `master` |
| Files included in this update | 3 |
| Change breakdown | 3 modified / 0 added / 0 deleted |
| Diff size | 41 insertions / 8 deletions |
| Last local commit | `cc40109` on 2026-02-21 (`chore: sweep recent app and function updates`) |

## Major Changes Since Last Update

### 1. Outstanding Fee Query Stabilization (Cloud Functions)
- Updated `adminGetOutstandingFees` in `functions/src/api/admin.js`:
  - Replaced Firestore query ordering by `platformFeeDueDate` with document-ID ordering for cursor-safe pagination.
  - Added `toComparableTimestamp(...)` helper to normalize due date and timestamp comparison values.
  - Added deterministic in-memory sorting by due date, then by creation timestamp.
  - Ensured `platformFeeStatus === 'overdue'` is treated as overdue even when no due date exists.

### 2. Admin Payments Due-State UX Correction
- Updated `frontend/src/views/admin/PaymentsView.jsx`:
  - Contracts without due dates now show `Overdue` when backend status is already overdue.
  - Overdue labeling now avoids misleading day counts when status is overdue but date delta is non-positive.

### 3. Firestore Indexing for Platform Fee Queries
- Updated `firestore.indexes.json` with a composite index for `contracts`:
  - `platformFeePaid` ascending
  - `platformFeeDueDate` ascending
- Supports unpaid-fee filtering and due-date-ordered query paths used by admin payment monitoring.

## Operational Notes
- Working tree currently includes only targeted admin-payment refinements; no new files were introduced.
- Git reports CRLF normalization warnings for these modified files on next Git touch; no functional impact expected.
