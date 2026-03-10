# Support Conversations Permission Fix (karga-ph)

## Problem Summary
Users saw `FirebaseError: Missing or insufficient permissions` for support chat operations (`subscribe`, `create`, `send`).

## Confirmed Root Cause
- Hosting is served from `getgoph.web.app` (`getgoph-a09bb`), but the frontend runtime Firebase config points to `karga-ph`.
- New support code reads/writes `supportConversations/*`.
- Deployed Firestore config on `karga-ph` still used legacy `supportMessages/*` rules and indexes.
- Result: app attempted `supportConversations` operations against a project where those paths were not authorized/indexed.

## Implemented Fix Scope
- Hardened `supportConversations` and `supportConversations/{id}/messages` Firestore rules in `firestore.rules`.
- Enforced auth-derived identity in frontend support service:
  - write/query identity comes from `auth.currentUser`
  - admin send uses authenticated admin UID (no `'admin'` sentinel senderId)
  - normalized Firestore timestamps to `Date`
  - explicit `unauthenticated` error signaling
- Updated user/admin support views to handle unauthenticated session paths and updated service behavior.
- Added idempotent migration script:
  - `functions/scripts/migrate-support-messages-to-conversations.cjs`
  - supports dry-run and apply modes.
- Completed legacy migration and removed the `supportMessages` rules block from deployed policy.
- Added deployment and verification guardrails:
  - `npm run deploy:firestore:prod` deploys rules + indexes to `karga-ph`
  - `npm run verify:firestore:support:prod` validates deployed rules release, required indexes, and that legacy `supportMessages` rules are absent
  - migration script aliases added in root and functions package scripts.

## Runtime Topology (Correct)
- Hosting URL: `https://getgoph.web.app`
- Frontend Firebase project: `karga-ph`
- Firestore/Auth/Functions runtime target for support chat: `karga-ph`

## Runbook
1. Configure migration credentials (Admin SDK requirement):
   - Set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON with Firestore read/write access on `karga-ph`.
2. Dry-run migration:
   - `npm run migrate:support:dry`
3. Apply migration:
   - `npm run migrate:support:apply`
4. Deploy Firestore config to runtime backend project:
   - `npm run deploy:firestore:prod`
5. Verify deployed rules + indexes:
   - `npm run verify:firestore:support:prod`

## Post-Deploy Validation
1. Hard refresh web clients to bypass stale service-worker bundles.
2. Confirm runtime frontend bundle includes latest support chunks:
   - `HelpSupportView-*.js`
   - `supportMessageService-*.js`
3. Execute user flow:
   - create conversation
   - send message
   - verify compose input clears and no `permission-denied` in console
4. Execute admin flow:
   - open same conversation
   - verify message is visible in thread
   - send admin reply and resolve

## Acceptance Checks
- User can list/create/reply in own support conversations.
- Admin can list all conversations, reply, and resolve.
- Non-admin cannot read/write another user conversation.
- Non-admin cannot write `senderRole: 'admin'`.
- No support-chat `permission-denied` errors in normal user/admin flows.
