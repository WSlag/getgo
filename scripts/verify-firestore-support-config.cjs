#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

function parseFlag(name, fallback = '') {
  const prefixed = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefixed));
  if (!arg) return fallback;
  return arg.slice(prefixed.length).trim();
}

function findFirebaseToolsConfigPath() {
  const homePath = os.homedir();
  const candidates = [
    path.join(homePath, '.config', 'configstore', 'firebase-tools.json')
  ];

  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'configstore', 'firebase-tools.json'));
  }

  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function getFirebaseAccessToken() {
  if (process.env.FIREBASE_TOKEN) {
    return process.env.FIREBASE_TOKEN.trim();
  }

  const configPath = findFirebaseToolsConfigPath();
  if (!configPath) {
    return '';
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return String(parsed?.tokens?.access_token || '').trim();
  } catch (error) {
    console.error(`[verify] Failed to parse firebase-tools config at ${configPath}:`, error.message || error);
    return '';
  }
}

function runFirebaseIndexesCommand(projectId) {
  const raw = execSync(`firebase firestore:indexes --project ${projectId} --json`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const parsed = JSON.parse(raw);
  return Array.isArray(parsed?.result?.indexes) ? parsed.result.indexes : [];
}

function normalizeIndexFields(fields = []) {
  return fields
    .filter((field) => field.fieldPath !== '__name__')
    .map((field) => `${field.fieldPath}:${field.order || field.arrayConfig || ''}`);
}

function containsRequiredIndexes(indexes) {
  const supportIndexes = indexes.filter((index) => index.collectionGroup === 'supportConversations');
  const existing = new Set(
    supportIndexes.map((index) => normalizeIndexFields(index.fields).join('|'))
  );

  const required = [
    ['userId:ASCENDING', 'updatedAt:DESCENDING'],
    ['status:ASCENDING', 'updatedAt:DESCENDING'],
    ['userId:ASCENDING', 'status:ASCENDING', 'updatedAt:DESCENDING']
  ];

  const missing = required.filter((definition) => !existing.has(definition.join('|')));
  return { missing, supportIndexes };
}

async function fetchReleaseAndRuleset(projectId, token) {
  const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`;
  const headers = { Authorization: `Bearer ${token}` };

  const releaseResponse = await fetch(releaseUrl, { headers });
  if (!releaseResponse.ok) {
    throw new Error(`Failed to fetch rules release: ${releaseResponse.status} ${releaseResponse.statusText}`);
  }

  const release = await releaseResponse.json();
  const rulesetName = String(release?.rulesetName || '').trim();
  if (!rulesetName) {
    throw new Error('Firestore release does not include a ruleset name.');
  }

  const rulesetResponse = await fetch(`https://firebaserules.googleapis.com/v1/${rulesetName}`, { headers });
  if (!rulesetResponse.ok) {
    throw new Error(`Failed to fetch ruleset content: ${rulesetResponse.status} ${rulesetResponse.statusText}`);
  }

  const ruleset = await rulesetResponse.json();
  const sourceFiles = Array.isArray(ruleset?.source?.files) ? ruleset.source.files : [];
  const combinedContent = sourceFiles.map((file) => file?.content || '').join('\n');

  return {
    releaseName: release?.name,
    releaseUpdateTime: release?.updateTime,
    rulesetName,
    combinedContent
  };
}

function printSupportIndexDetails(supportIndexes) {
  if (supportIndexes.length === 0) {
    console.log('[verify] No supportConversations indexes found.');
    return;
  }

  console.log('[verify] supportConversations indexes found:');
  supportIndexes.forEach((index) => {
    const fields = normalizeIndexFields(index.fields).join(', ');
    console.log(`  - ${fields}`);
  });
}

async function main() {
  const projectId = parseFlag('project', '');
  if (!projectId) {
    console.error('[verify] Missing --project=<firebase-project-id>');
    process.exit(1);
  }

  console.log(`[verify] Checking Firestore support config for project: ${projectId}`);

  let indexes;
  try {
    indexes = runFirebaseIndexesCommand(projectId);
  } catch (error) {
    console.error('[verify] Failed to read Firestore indexes via Firebase CLI.');
    console.error(error.message || error);
    process.exit(1);
  }

  const { missing, supportIndexes } = containsRequiredIndexes(indexes);
  printSupportIndexDetails(supportIndexes);

  const token = getFirebaseAccessToken();
  if (!token) {
    console.error('[verify] Missing Firebase access token. Run `firebase login` before verifying rules.');
    process.exit(1);
  }

  let release;
  try {
    release = await fetchReleaseAndRuleset(projectId, token);
  } catch (error) {
    console.error('[verify] Failed to validate deployed Firestore rules.');
    console.error(error.message || error);
    process.exit(1);
  }

  const hasConversationRule = release.combinedContent.includes('match /supportConversations/{conversationId}');
  const hasLegacyReadOnlyRule = release.combinedContent.includes('match /supportMessages/{messageId}');

  console.log('[verify] Firestore release:');
  console.log(`  - release: ${release.releaseName}`);
  console.log(`  - updated: ${release.releaseUpdateTime}`);
  console.log(`  - ruleset: ${release.rulesetName}`);
  console.log(`  - has supportConversations rule: ${hasConversationRule ? 'yes' : 'no'}`);
  console.log(`  - has supportMessages legacy block: ${hasLegacyReadOnlyRule ? 'yes' : 'no'}`);

  if (missing.length > 0 || !hasConversationRule || hasLegacyReadOnlyRule) {
    if (missing.length > 0) {
      console.error('[verify] Missing required supportConversations indexes:');
      missing.forEach((definition) => {
        console.error(`  - ${definition.join(', ')}`);
      });
    }
    if (!hasConversationRule) {
      console.error('[verify] Deployed ruleset is missing match /supportConversations/{conversationId}.');
    }
    if (hasLegacyReadOnlyRule) {
      console.error('[verify] Deployed ruleset still contains legacy match /supportMessages/{messageId}.');
    }
    process.exit(1);
  }

  console.log('[verify] PASS: Firestore support rules and indexes are correctly deployed.');
}

main().catch((error) => {
  console.error('[verify] Unexpected failure:', error);
  process.exit(1);
});
