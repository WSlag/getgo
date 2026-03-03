# GCash Payment Anti-Deceit Hardening Plan

## Objective
Increase resistance to forged or replayed GCash screenshot submissions while preserving legitimate user success rate and operational visibility.

## Implementation Status (as of 2026-03-03)
1. Phase 1: Completed
2. Phase 2: Completed
3. Phase 3: Completed
4. Phase 4: Completed (metadata verification shipped with mode toggle: `off|warn|enforce`)
5. Phase 5: Pending
6. Phase 6: Pending

## Current-State Validation (Completed Before Implementation)
Validated against current codebase and test tooling:

1. Baseline smoke flow exists and passes.
- Command: `npm run test:smoke:gcash`
- Result: passes (`8/8 GCash payment smoke test passed`).

2. Existing tests do not cover key anti-fraud race conditions.
- Current script: `functions/scripts/gcash-payment-smoke.cjs`
- Gap: no concurrent submission race tests, no duplicate atomicity race tests, no forced replay double-credit test.

3. High-risk logic gaps are present in decisioning.
- Auto-approval path can still occur with incomplete receiver/timestamp evidence due to scoring-based decision.
- Duplicate reference/hash checks are non-atomic (`get` then `set/add`).
- Submission processing lacks explicit per-order idempotent approval guard.

4. Controls already in place.
- Firestore/Storage rules constrain ownership and upload type/size.
- Server validates trusted storage URL, order ownership, and expiry.
- Admin actions require both claim and Firestore admin status.

## Scope
In scope:
- `functions/src/services/ocr.js`
- `functions/src/services/fraud.js`
- `functions/index.js`
- `functions/src/utils/storageUrl.js`
- `firestore.rules`
- `functions/scripts/gcash-payment-smoke.cjs` (and/or new hardening test script)

Out of scope:
- UI redesign
- Replacing OCR provider
- Major data model migration unrelated to anti-fraud

## Implementation Strategy (Phased)

## Phase 1: Decision Policy Hardening (Critical)
Goal: prevent auto-approval when core trust signals are missing.

Changes:
1. Require strict minimum signals for `approved`:
- `amountMatch == true`
- `referencePresent == true`
- `receiverMatch == true`
- `timestampValid == true` (or explicit config override)
2. Apply `MAX_AUTO_APPROVE_AMOUNT` in final decision policy.
3. Route uncertain extractions to `manual_review`, not `approved`.
4. Add explicit negative rules for missing receiver/timestamp.

Acceptance criteria:
1. Any submission missing receiver or timestamp cannot become `approved`.
2. Amount/reference-only match produces `manual_review`.
3. Existing happy-path valid submission still approves.

Validation tests:
1. Unit-level decision tests for `determineFinalStatus`.
2. Integration test with mocked OCR payload variants.

## Phase 2: Idempotency and Replay Protection (Critical)
Goal: one financial effect per order/submission.

Changes:
1. Add approval idempotency check before side effects:
- If order already `verified` with `verifiedSubmissionId`, skip re-credit/re-record.
2. Guard top-up credit path with deterministic transaction id keyed by submission.
3. Add order-level processing lock semantics to prevent parallel approval races.
4. Ensure rejected/expired orders cannot be reused for approval side effects.

Acceptance criteria:
1. Parallel approvals on same order do not double-credit wallet or duplicate platform fee effects.
2. Reprocessing same submission is side-effect safe.
3. Order state remains consistent under concurrent triggers.

Validation tests:
1. Emulator race test using `Promise.all` for two submissions targeting one order.
2. Assert single wallet/platform fee side effect.

## Phase 3: Atomic Duplicate Detection (High)
Goal: eliminate TOCTOU duplicate bypass.

Changes:
1. Replace reference duplicate `get`+`set` with atomic create semantics.
2. Replace image-hash query+add with deterministic doc id or transaction guard.
3. Ensure duplicate checks are consistent under concurrency.

Acceptance criteria:
1. Two simultaneous submissions with same reference cannot both pass duplicate check.
2. Two simultaneous submissions with same image hash cannot both pass.

Validation tests:
1. Concurrency tests on `referenceNumbers` and `imageHashes` writes.

## Phase 4: URL and Evidence Integrity Hardening (High)
Goal: tighten screenshot source trust and payload integrity.

Changes:
1. Parse Firebase Storage object path robustly by host format instead of substring checks.
2. Require strict path ownership match (`payments/{uid}/...`) from parsed object name.
3. Optionally verify storage metadata (`contentType`, `size`) server-side before OCR.
4. Reject malformed URLs and ambiguous query-based path tricks.

Acceptance criteria:
1. Query-string tricks cannot satisfy payment path validation.
2. Only user-owned payment path objects are accepted.

Validation tests:
1. Positive and negative URL parser test matrix for both Firebase host styles.

## Phase 5: Rules and Submission Flow Tightening (Medium)
Goal: reduce multi-submission abuse surface.

Changes:
1. Restrict allowable submission creation to stricter order states if needed.
2. Add deterministic submission id or server-claimed lock to reduce duplicates.
3. Keep legitimate retry path supported (expired/rejected -> new order).

Acceptance criteria:
1. Users cannot flood multiple active submissions for same order without server control.
2. Legitimate retries remain possible through intended flow.

Validation tests:
1. Firestore rules emulator tests for allowed/denied submission scenarios.

## Phase 6: Observability and Operations (Medium)
Goal: make fraud outcomes auditable and actionable.

Changes:
1. Add decision trace fields:
- required-check outcomes
- reason code for final decision
2. Add aggregate metrics/log counters for duplicate attempts and manual review rate.
3. Document incident runbook for admin reviewers.

Acceptance criteria:
1. Every rejected/manual-review decision includes machine-readable reason codes.
2. Dashboard queries can measure fraud pressure and false-positive trends.

## Test Plan
Run after each phase:
1. `npm run test:smoke:gcash`
2. New hardening emulator tests:
- concurrency replay test
- duplicate reference race test
- duplicate image race test
- strict decision matrix test
3. Targeted lint/tests in affected packages.

Release gate:
1. No regression in existing smoke pass.
2. New anti-fraud tests pass consistently across 3 repeated runs.
3. Manual QA scenario:
- valid receipt approves
- missing receiver -> manual review/reject
- expired order -> reject and new-order retry path works
- duplicate reference -> reject

## Rollout Plan
1. Deploy Phase 1 + Phase 2 together (highest risk reduction).
2. Monitor manual-review volume and approval latency for 24-48 hours.
3. Deploy Phase 3 + 4.
4. Deploy Phase 5 + 6 and finalize runbook.

## Rollback Plan
If false positives spike:
1. Keep idempotency/replay protections enabled.
2. Temporarily relax only strict decision thresholds to `manual_review` (not `approved`).
3. Preserve duplicate atomic checks; do not roll them back.

## Proposed Execution Order
1. Implement Phase 1 + tests.
2. Implement Phase 2 + tests.
3. Re-validate baseline smoke + hardening tests.
4. Continue with Phase 3 and beyond after review.
