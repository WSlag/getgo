/**
 * User Communication Triggers
 * Sends welcome notifications to newly created eligible users.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { loadPlatformSettings } = require('../config/platformSettings');
const { sendPushToUser } = require('../services/fcmService');

const REGION = 'asia-southeast1';
const WELCOME_NOTIFICATION_DOC_ID = 'welcome_default';

function normalizeTrimmedText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRole(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'shipper' || normalized === 'trucker' || normalized === 'broker') {
    return normalized;
  }
  return null;
}

function resolveNotificationRole(userData = {}) {
  const explicitRole = normalizeRole(userData.role);
  if (explicitRole) return explicitRole;
  if (userData.isBroker === true) return 'broker';
  return null;
}

function isEligibleForWelcome(userData = {}) {
  if (userData.isActive === false) return false;
  const accountStatus = String(userData.accountStatus || 'active').trim().toLowerCase();
  if (accountStatus === 'suspended') return false;
  const role = String(userData.role || '').trim().toLowerCase();
  if (userData.isAdmin === true || role === 'admin') return false;
  return true;
}

exports.onUserCreatedSendWelcomeMessage = onDocumentCreated(
  {
    region: REGION,
    document: 'users/{userId}',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const { userId } = event.params;
    const userData = snap.data() || {};
    if (!isEligibleForWelcome(userData)) return null;

    const db = admin.firestore();
    const settings = await loadPlatformSettings(db);
    const welcomeSettings = settings?.communications?.welcome || {};
    if (welcomeSettings.enabled !== true) return null;

    const title = normalizeTrimmedText(welcomeSettings.title);
    const message = normalizeTrimmedText(welcomeSettings.message);
    if (!title || !message) return null;

    const role = resolveNotificationRole(userData);
    const notificationPayload = {
      type: 'WELCOME_MESSAGE',
      title,
      message,
      data: {
        source: 'welcome_template',
      },
      isRead: false,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (role) {
      notificationPayload.workspaceRole = role;
      notificationPayload.forRole = role;
    }

    const notificationRef = db
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .doc(WELCOME_NOTIFICATION_DOC_ID);

    try {
      await notificationRef.create(notificationPayload);
    } catch (error) {
      const messageText = String(error?.message || '').toLowerCase();
      if (error?.code === 6 || messageText.includes('already exists')) {
        return null;
      }
      throw error;
    }

    try {
      await sendPushToUser(db, userId, {
        title,
        body: message,
        data: { type: 'WELCOME_MESSAGE' },
      });
    } catch (pushErr) {
      console.error('[userCommunicationTriggers] Push notification failed (non-fatal):', pushErr.message);
    }

    return null;
  }
);
