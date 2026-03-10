#!/usr/bin/env node
/* eslint-disable no-console */

const admin = require('firebase-admin');

function hasFlag(name) {
  return process.argv.includes(name);
}

function parseNumberFlag(name, fallback) {
  const raw = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!raw) return fallback;
  const parsed = Number(raw.split('=')[1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStringFlag(name, fallback = '') {
  const raw = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!raw) return fallback;
  return raw.split('=').slice(1).join('=').trim() || fallback;
}

function normalizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toTimestamp(dateValue, fallbackDate) {
  const resolvedDate = toDate(dateValue) || fallbackDate;
  return admin.firestore.Timestamp.fromDate(resolvedDate);
}

function mapLegacyStatus(status) {
  const normalized = normalizeString(status).toLowerCase();
  if (normalized === 'in_progress') return 'pending';
  if (normalized === 'resolved') return 'resolved';
  if (normalized === 'closed') return 'closed';
  return 'open';
}

function mapLegacyCategory(category) {
  const normalized = normalizeString(category).toLowerCase();
  const categoryMap = {
    account: 'account',
    billing: 'payment',
    payment: 'payment',
    contract: 'contract',
    technical: 'technical',
    bug: 'bug',
    support: 'other',
    general: 'other',
    other: 'other'
  };
  return categoryMap[normalized] || 'other';
}

function createSummary() {
  return {
    scanned: 0,
    skippedMissingUserId: 0,
    skippedMissingMessage: 0,
    alreadyMigrated: 0,
    prepared: 0,
    migrated: 0,
    failed: 0
  };
}

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function commitSetWrites(db, writes) {
  const chunks = chunkArray(writes, 400);
  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach((write) => {
      batch.set(write.ref, write.data, { merge: false });
    });
    await batch.commit();
  }
}

async function migrateSupportMessages({ db, apply, pageSize }) {
  const summary = createSummary();
  let lastDoc = null;
  const userRoleCache = new Map();

  async function resolveUserRole(userId) {
    if (!userId) return 'shipper';
    if (userRoleCache.has(userId)) {
      return userRoleCache.get(userId);
    }

    let role = 'shipper';
    try {
      const userSnap = await db.collection('users').doc(userId).get();
      if (userSnap.exists) {
        const profileRole = normalizeString(userSnap.data()?.role).toLowerCase();
        if (['shipper', 'trucker', 'broker', 'admin'].includes(profileRole)) {
          role = profileRole;
        }
      }
    } catch (error) {
      console.warn(`Unable to resolve user role for ${userId}:`, error.message || error);
    }

    userRoleCache.set(userId, role);
    return role;
  }

  while (true) {
    let legacyQuery = db.collection('supportMessages')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(pageSize);

    if (lastDoc) {
      legacyQuery = legacyQuery.startAfter(lastDoc);
    }

    const legacySnap = await legacyQuery.get();
    if (legacySnap.empty) break;

    for (const legacyDoc of legacySnap.docs) {
      summary.scanned += 1;
      const legacyData = legacyDoc.data() || {};
      const legacyId = legacyDoc.id;
      const userId = normalizeString(legacyData.userId);
      const userName = normalizeString(legacyData.userName) || 'User';
      const rootMessage = normalizeString(legacyData.message);

      if (!userId) {
        summary.skippedMissingUserId += 1;
        continue;
      }

      if (!rootMessage) {
        summary.skippedMissingMessage += 1;
        continue;
      }

      const conversationRef = db.collection('supportConversations').doc(legacyId);
      const existingConversationSnap = await conversationRef.get();
      if (existingConversationSnap.exists) {
        summary.alreadyMigrated += 1;
        continue;
      }

      const createdAtDate = toDate(legacyData.createdAt) || new Date();
      const updatedAtDate = toDate(legacyData.updatedAt) || createdAtDate;
      const status = mapLegacyStatus(legacyData.status);
      const subject = mapLegacyCategory(legacyData.category);
      const userRole = await resolveUserRole(userId);

      const messageEvents = [
        {
          senderId: userId,
          senderName: userName,
          senderRole: 'user',
          message: rootMessage,
          createdAt: createdAtDate,
          updatedAt: updatedAtDate,
          legacyReplyId: null
        }
      ];

      const replies = Array.isArray(legacyData.replies) ? legacyData.replies : [];
      replies.forEach((reply, index) => {
        const replyMessage = normalizeString(reply?.message);
        if (!replyMessage) return;
        const replyCreatedAt = toDate(reply?.createdAt) || updatedAtDate;
        const replyUpdatedAt = toDate(reply?.updatedAt) || replyCreatedAt;
        const adminId = normalizeString(reply?.adminId) || 'legacy-admin';
        const adminName = normalizeString(reply?.adminName) || 'GetGo Support';

        messageEvents.push({
          senderId: adminId,
          senderName: adminName,
          senderRole: 'admin',
          message: replyMessage,
          createdAt: replyCreatedAt,
          updatedAt: replyUpdatedAt,
          legacyReplyId: normalizeString(reply?.id) || `legacy-reply-${index + 1}`
        });
      });

      messageEvents.sort((left, right) => {
        const leftTime = left.createdAt?.getTime?.() || 0;
        const rightTime = right.createdAt?.getTime?.() || 0;
        return leftTime - rightTime;
      });

      const lastEvent = messageEvents[messageEvents.length - 1];
      const now = new Date();

      const messageWrites = messageEvents.map((event, index) => {
        const messageRef = conversationRef
          .collection('messages')
          .doc(index === 0 ? 'legacy-user-0000' : `legacy-admin-${String(index).padStart(4, '0')}`);

        return {
          ref: messageRef,
          data: {
            senderId: event.senderId,
            senderName: event.senderName,
            senderRole: event.senderRole,
            message: event.message,
            isRead: true,
            createdAt: toTimestamp(event.createdAt, createdAtDate),
            updatedAt: toTimestamp(event.updatedAt, createdAtDate),
            migratedFrom: 'supportMessages',
            legacyMessageId: legacyId,
            legacyReplyId: event.legacyReplyId
          }
        };
      });

      const conversationData = {
        userId,
        userName,
        userRole,
        status,
        subject,
        lastMessage: (lastEvent?.message || rootMessage).substring(0, 200),
        lastMessageAt: toTimestamp(lastEvent?.createdAt, updatedAtDate),
        lastMessageSenderId: lastEvent?.senderId || userId,
        unreadCount: lastEvent?.senderRole === 'admin' ? 1 : 0,
        adminUnreadCount: lastEvent?.senderRole === 'user' ? 1 : 0,
        createdAt: toTimestamp(createdAtDate, createdAtDate),
        updatedAt: toTimestamp(updatedAtDate, updatedAtDate),
        resolvedAt: status === 'resolved' || status === 'closed'
          ? toTimestamp(updatedAtDate, updatedAtDate)
          : null,
        resolvedBy: status === 'resolved' || status === 'closed'
          ? (lastEvent?.senderRole === 'admin' ? normalizeString(lastEvent.senderId) || null : null)
          : null,
        migratedFrom: 'supportMessages',
        legacyMessageId: legacyId,
        migrationVersion: 1,
        migratedAt: admin.firestore.Timestamp.fromDate(now)
      };

      summary.prepared += 1;

      if (!apply) {
        continue;
      }

      try {
        await commitSetWrites(db, messageWrites);
        await conversationRef.set(conversationData, { merge: false });
        summary.migrated += 1;
      } catch (error) {
        summary.failed += 1;
        console.error(`Failed to migrate support message ${legacyId}:`, error);
      }
    }

    lastDoc = legacySnap.docs[legacySnap.docs.length - 1];
    if (legacySnap.size < pageSize) break;
  }

  return summary;
}

function printSummary(mode, summary) {
  console.log(`\nSupport message migration summary (${mode})`);
  console.log('========================================');
  console.log(`Scanned docs: ${summary.scanned}`);
  console.log(`Skipped (missing userId): ${summary.skippedMissingUserId}`);
  console.log(`Skipped (missing message): ${summary.skippedMissingMessage}`);
  console.log(`Already migrated: ${summary.alreadyMigrated}`);
  console.log(`Prepared for migration: ${summary.prepared}`);
  console.log(`Migrated: ${summary.migrated}`);
  console.log(`Failed: ${summary.failed}`);
}

async function main() {
  const apply = hasFlag('--apply');
  const pageSize = Math.max(25, Math.min(parseNumberFlag('--page-size', 200), 500));
  const projectId = parseStringFlag(
    '--project',
    process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || process.env.PROJECT_ID || 'karga-ph'
  );

  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }

  const db = admin.firestore();

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Project: ${projectId}`);
  console.log(`Page size: ${pageSize}`);

  const summary = await migrateSupportMessages({ db, apply, pageSize });
  printSummary(apply ? 'apply' : 'dry-run', summary);

  if (apply && summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = String(error?.message || '');
  if (
    message.includes('Could not load the default credentials')
    || message.includes('Unable to detect a Project Id in the current environment')
  ) {
    console.error('Support migration failed: missing Google Application Default Credentials.');
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON or run:');
    console.error('  gcloud auth application-default login');
    process.exit(1);
  }
  console.error('Support migration failed:', error);
  process.exit(1);
});
