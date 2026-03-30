const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const {
  computeDocumentHash,
  extractDocumentIdentifiers,
  checkAgainstSuspendedIdentifiers,
} = require('../services/truckerDocVerification');

/**
 * Seed server-managed trucker compliance state for newly created trucker profiles.
 * Existing trucker profiles created before rollout are intentionally not backfilled.
 */
exports.onTruckerProfileCreated = onDocumentCreated(
  {
    region: 'asia-southeast1',
    document: 'users/{userId}/truckerProfile/{docId}',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const { userId, docId } = event.params;
    if (docId !== 'profile') return null;

    const db = admin.firestore();
    const complianceRef = db.collection('users').doc(userId).collection('truckerCompliance').doc('profile');
    const existing = await complianceRef.get();
    if (existing.exists) return null;

    await complianceRef.set({
      docsRequiredOnSigning: true,
      cancellationBlockUntil: null,
      cancellationBlockedAt: null,
      cancellationBlockReason: null,
      cancellationResetAt: null,
      cancellationResetBy: null,
      cancellationResetReason: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return null;
  }
);

/**
 * When a trucker profile document is updated, run OCR + perceptual hashing on any
 * changed document images (driver's license, LTO COR). Cross-check extracted
 * identifiers against the suspendedIdentifiers blocklist. If a match is found,
 * flag the user account for admin review before they can sign contracts.
 */
exports.onTruckerProfileUpdated = onDocumentUpdated(
  {
    region: 'asia-southeast1',
    document: 'users/{userId}/truckerProfile/{docId}',
  },
  async (event) => {
    const { userId, docId } = event.params;
    if (docId !== 'profile') return null;

    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};

    const licenseChanged = JSON.stringify(before.driverLicenseCopy) !== JSON.stringify(after.driverLicenseCopy);
    const ltoChanged = JSON.stringify(before.ltoRegistrationCopy) !== JSON.stringify(after.ltoRegistrationCopy);

    if (!licenseChanged && !ltoChanged) return null;

    const db = admin.firestore();
    const profileRef = db.collection('users').doc(userId).collection('truckerProfile').doc('profile');
    const profileUpdates = { ocrExtractedAt: FieldValue.serverTimestamp() };

    let licenseNumber = after.licenseNumber || null;
    let plateNumber = after.plateNumber || null;
    let driverLicenseHash = after.driverLicenseHash || null;
    let ltoRegistrationHash = after.ltoRegistrationHash || null;

    // Process driver's license if changed
    if (licenseChanged && after.driverLicenseCopy) {
      try {
        const [hash, identifiers] = await Promise.all([
          computeDocumentHash(after.driverLicenseCopy),
          extractDocumentIdentifiers(after.driverLicenseCopy, 'driver_license'),
        ]);

        if (hash) {
          driverLicenseHash = hash;
          profileUpdates.driverLicenseHash = hash;

          await db.collection('documentHashRegistry').add({
            hash,
            docType: 'driver_license',
            userId,
            accountStatus: 'active',
            uploadedAt: FieldValue.serverTimestamp(),
          });
        }

        if (identifiers.licenseNumber) {
          licenseNumber = identifiers.licenseNumber;
          profileUpdates.licenseNumber = identifiers.licenseNumber;
        }
        if (identifiers.licenseExpiry) {
          profileUpdates.licenseExpiry = identifiers.licenseExpiry;
        }
        profileUpdates.ocrLicenseConfidence = identifiers.confidence || 0;
      } catch (err) {
        console.error('onTruckerProfileUpdated: driver license processing failed [userId=%s]: %s', userId, err.message);
      }
    }

    // Process LTO COR if changed
    if (ltoChanged && after.ltoRegistrationCopy) {
      try {
        const [hash, identifiers] = await Promise.all([
          computeDocumentHash(after.ltoRegistrationCopy),
          extractDocumentIdentifiers(after.ltoRegistrationCopy, 'lto_registration'),
        ]);

        if (hash) {
          ltoRegistrationHash = hash;
          profileUpdates.ltoRegistrationHash = hash;

          await db.collection('documentHashRegistry').add({
            hash,
            docType: 'lto_registration',
            userId,
            accountStatus: 'active',
            uploadedAt: FieldValue.serverTimestamp(),
          });
        }

        if (identifiers.plateNumber) {
          plateNumber = identifiers.plateNumber;
          profileUpdates.plateNumber = identifiers.plateNumber;
        }
        if (identifiers.mvFileNumber) {
          profileUpdates.mvFileNumber = identifiers.mvFileNumber;
        }
        profileUpdates.ocrPlateConfidence = identifiers.confidence || 0;
      } catch (err) {
        console.error('onTruckerProfileUpdated: LTO registration processing failed [userId=%s]: %s', userId, err.message);
      }
    }

    // Persist OCR/hash results to truckerProfile
    await profileRef.update(profileUpdates);

    // Cross-check all extracted identifiers against the suspended blocklist
    try {
      const checkResult = await checkAgainstSuspendedIdentifiers(db, {
        licenseNumber,
        plateNumber,
        driverLicenseHash,
        ltoRegistrationHash,
      });

      if (checkResult.matched) {
        const reviewReason = `Document match: ${checkResult.matchType} = ${checkResult.matchedValue}`;
        await db.collection('users').doc(userId).update({
          requiresAdminReview: true,
          reviewReason,
          reviewFlaggedAt: FieldValue.serverTimestamp(),
          reviewClearedAt: null,
          reviewClearedBy: null,
        });

        await db.collection('adminLogs').add({
          action: 'TRUCKER_DOCUMENT_MATCH_FLAGGED',
          targetUserId: userId,
          matchType: checkResult.matchType,
          matchedValue: checkResult.matchedValue,
          reviewReason,
          performedBy: 'system',
          performedAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('onTruckerProfileUpdated: blocklist check failed [userId=%s]: %s', userId, err.message);
    }

    return null;
  }
);

/**
 * When a new truck listing is created, record the plate number in the trucker's
 * profile for historical tracking and future suspension harvesting.
 */
exports.onTruckListingCreated = onDocumentCreated(
  {
    region: 'asia-southeast1',
    document: 'truckListings/{listingId}',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return null;

    const { userId, plateNumber } = snap.data() || {};
    if (!userId || !plateNumber || typeof plateNumber !== 'string') return null;

    const normalized = plateNumber.toUpperCase().trim();
    if (!normalized) return null;

    const db = admin.firestore();
    const profileRef = db.collection('users').doc(userId).collection('truckerProfile').doc('profile');

    const profileDoc = await profileRef.get();
    if (!profileDoc.exists) return null;

    await profileRef.update({
      lastKnownPlateNumbers: FieldValue.arrayUnion(normalized),
    });

    return null;
  }
);
