#!/usr/bin/env node

/**
 * Guardrail to prevent accidental deploys to the wrong Firebase project.
 * Usage:
 *   node scripts/guard-firebase-project.cjs <scope>
 */

const scope = process.argv[2] || '';
const projectId =
  process.env.GCLOUD_PROJECT ||
  process.env.PROJECT_ID ||
  process.env.FIREBASE_PROJECT ||
  process.env.FIREBASE_DEPLOY_PROJECT ||
  '';

const expectedProjectByScope = {
  functions: 'karga-ph',
  firestore: 'karga-ph',
  storage: 'karga-ph',
  'hosting:main': 'getgoph-a09bb',
  hosting: 'getgoph-a09bb',
};

const expectedProject = expectedProjectByScope[scope];

if (!expectedProject) {
  console.error(`[deploy-guard] Unknown scope "${scope}".`);
  process.exit(1);
}

if (!projectId) {
  console.error('[deploy-guard] Could not determine target project from environment.');
  console.error('[deploy-guard] Re-run deploy with an explicit --project flag.');
  process.exit(1);
}

if (projectId !== expectedProject) {
  console.error(`[deploy-guard] Blocked deploy for scope "${scope}".`);
  console.error(`[deploy-guard] Current project: "${projectId}"`);
  console.error(`[deploy-guard] Expected project: "${expectedProject}"`);
  console.error('[deploy-guard] Use the correct --project flag to continue.');
  process.exit(1);
}

console.log(`[deploy-guard] OK: "${scope}" -> "${projectId}"`);
