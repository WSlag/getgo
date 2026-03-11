# Security Smoke Test Report

Date: 2026-03-11
Scope: `frontend`, `functions`, Firebase config/rules, and a live smoke check of production-hosted endpoints/pages.

## Executive Summary
No critical vulnerabilities were found in this smoke test. Core controls look present (Firestore rules are not globally open, and live `getRoute`/`geocode` proxy endpoints returned `401` without auth/App Check).

I found 4 actionable issues:
- 2 medium-risk findings (diagnostic page attack surface and email-eligibility enumeration signal)
- 2 low-risk findings (CSP weakening and low-severity dependency advisories)

## Medium Severity

### [SEC-001] Publicly deployed diagnostic page with unsafe HTML sink patterns
- Rule ID: REACT-XSS-002 / JS-XSS-001
- Severity: Medium
- Location: `frontend/public/verify-contracts.html:372`, `frontend/public/verify-contracts.html:376`
- Evidence:
  - `results.innerHTML = html;`
  - `results.innerHTML = \`...${error.message}...${error.stack}...\``
  - Page is publicly reachable: `https://getgoph.web.app/verify-contracts.html` returned HTTP `200`.
- Impact: If this page is ever configured with live Firebase credentials and attacker-controlled Firestore fields are rendered, it can become a stored-XSS/admin-session risk surface.
- Fix: Remove this page from production hosting output, or gate it behind admin auth and replace `innerHTML` rendering with safe DOM/text APIs.
- Mitigation: Keep CSP strict and avoid deploying diagnostic utilities in `/public`.
- False positive notes: Current committed file still has placeholder Firebase config values, which lowers immediate exploitability today.

### [SEC-002] Email magic-link eligibility can be enumerated via API response signal
- Rule ID: EXPRESS-INPUT-001 (auth flow response hardening)
- Severity: Medium
- Location: `functions/src/api/auth.js:170`, `functions/src/api/auth.js:172`, `frontend/src/contexts/AuthContext.jsx:549`
- Evidence:
  - Callable response includes `shouldSend` boolean.
  - Frontend branches on `response?.shouldSend` before actually sending a link.
- Impact: An attacker can probe whether an email is an "eligible" account (exists + enabled + verified) by observing API behavior, which is an account-enumeration signal.
- Fix: Return a uniform response (no eligibility flag), and perform mail-send decision server-side only.
- Mitigation: Add stronger anti-automation controls (global/IP throttles, abuse detection, CAPTCHA challenge escalation).
- False positive notes: Existing rate limiting reduces abuse speed but does not remove the signal.

## Low Severity

### [SEC-003] CSP allows `'unsafe-inline'` scripts/styles
- Rule ID: JS-CSP-001 / REACT-CSP-001
- Severity: Low
- Location: `firebase.json:54`
- Evidence:
  - `script-src 'self' 'unsafe-inline' ...`
  - `style-src 'self' 'unsafe-inline' ...`
- Impact: If an injection point is introduced, `'unsafe-inline'` weakens CSP as a defense-in-depth control.
- Fix: Move toward nonce/hash-based CSP for scripts (and ideally styles), then remove `'unsafe-inline'`.
- Mitigation: Continue avoiding dangerous DOM sinks (`innerHTML`, `dangerouslySetInnerHTML`) in app code.
- False positive notes: Current app code largely avoids React/DOM XSS sinks in main `frontend/src` paths.

### [SEC-004] Runtime dependency advisories in Functions package (low severity)
- Rule ID: EXPRESS-DEPS-001
- Severity: Low
- Location: `functions/package-lock.json` (transitive tree; from `npm audit --omit=dev --audit-level=high`)
- Evidence:
  - `GHSA-vpq2-c234-7xj6` (`@tootallnate/once`)
  - `GHSA-fj3w-jwp8-x2g3` (`fast-xml-parser`)
  - `npm audit` reported `10 low severity vulnerabilities`.
- Impact: Low immediate risk, but increases supply-chain exposure over time.
- Fix: Plan dependency refresh for Firebase/Admin transitive chain and apply non-breaking fixes first.
- Mitigation: Keep automated dependency monitoring enabled and triage monthly.
- False positive notes: Audit did not report high/critical runtime vulnerabilities.

## Checks Performed
- Pattern scan for common frontend/backend sinks and risky APIs (`innerHTML`, `eval`, redirects, `postMessage`, token storage).
- Runtime dependency audit:
  - `npm --prefix frontend audit --omit=dev --audit-level=high` -> `0 vulnerabilities`
  - `npm --prefix functions audit --omit=dev --audit-level=high` -> low-only advisories
- Live smoke checks:
  - `npm run test:smoke:hosting:appcheck -- --skip-auth` -> PASS
  - Unauthenticated direct requests to production `getRoute`/`geocode` returned `401`.

## Recommended Next Actions
1. Remove `verify-contracts.html` (and similar tooling pages) from production artifacts, or hard-gate them.
2. Refactor email magic-link prep response to remove `shouldSend` enumeration signal.
3. Tighten CSP away from `'unsafe-inline'` in phases.
4. Schedule a dependency maintenance pass for `functions` transitive advisories.
