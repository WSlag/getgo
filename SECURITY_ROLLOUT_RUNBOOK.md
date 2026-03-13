# Security Rollout Runbook (No-Breakage)

## Purpose
This runbook captures staged security rollout gates for:
- hidden diagnostic pages in production bundles
- email magic-link request v2 (uniform responses)
- CSP hardening stage 1
- dependency hygiene checks

## Baseline Gates (Wave 0)
Run before each staged rollout wave:

```bash
npm run security:gate:baseline
```

Optional auth smoke (may fail in headless CI due interactive reCAPTCHA challenges):

```bash
npm run security:gate:auth-smoke
```

## Wave 1: Debug Pages Not Exposed
Production deploy command now includes an automatic smoke check:

```bash
npm run deploy:hosting:prod
```

Manual check only:

```bash
npm run test:smoke:hosting:no-debug-pages -- --base-url https://getgoph.com
```

Local/internal tooling pages are still kept in source under `frontend/public`.
They are removed from production build output unless `VITE_INCLUDE_DEBUG_PAGES=true`.

## Wave 2: Email Magic-Link Request v2

### Required Functions env vars
- `EMAIL_MAGIC_LINK_ENABLED=true`
- `EMAIL_MAGIC_LINK_V2_ENABLED=true`
- `EMAIL_MAGIC_LINK_API_KEY=<Firebase Web API key for Identity Toolkit sendOobCode>`
- `EMAIL_MAGIC_LINK_CONTINUE_URL=<canonical callback URL, e.g. https://getgoph.com>`

Optional:
- `EMAIL_MAGIC_LINK_RESPONSE_FLOOR_MS=650`

### Frontend flag
- `VITE_EMAIL_MAGIC_LINK_V2_ENABLED=true`

### Backward compatibility
- Legacy callable `authPrepareEmailMagicLinkSignIn` remains active for older clients.
- Frontend falls back to legacy endpoint if v2 endpoint is unavailable.

## Wave 3: CSP Hardening
Current implementation keeps enforced CSP unchanged and adds a stricter script policy in:
- `Content-Security-Policy-Report-Only`

Promote to stricter enforced `script-src` only after staging smoke/regression passes.
Keep previous CSP string available for immediate rollback.

## Wave 4: Dependency Hygiene
- CI scheduled audit runs with `--audit-level=high` (high/critical fail policy).
- Low-severity transitive chain requiring breaking changes remains tracked risk.

## Staging/Production Order
1. Deploy functions first.
2. Deploy frontend/hosting.
3. Enable stricter feature flags.
4. Run post-deploy smoke checks.
