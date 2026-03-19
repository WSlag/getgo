const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  setDoc,
  updateDoc,
  Timestamp,
} = require('firebase/firestore');

const projectId = `anti-contact-rules-${Date.now()}`;
const rules = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');

function userDoc({ name, role, phone }) {
  return {
    phone,
    name,
    role,
    profileImage: null,
    facebookUrl: null,
    isVerified: false,
    isActive: true,
    onboardingComplete: false,
    emailAuthEnabled: false,
    emailAuthVerified: false,
    emailLinkedAt: null,
    emailAuthUpdatedAt: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

function cargoListingDoc({ userId, origin, destination, description = '' }) {
  return {
    userId,
    userName: 'Safe User',
    userTransactions: 0,
    origin,
    destination,
    originLat: 10.3157,
    originLng: 123.8854,
    destLat: 8.9475,
    destLng: 125.5406,
    routeDistanceKm: 260,
    routeDistanceUpdatedAt: Timestamp.now(),
    originStreetAddress: 'Port Area',
    destinationStreetAddress: 'Terminal Road',
    cargoType: 'General Cargo',
    weight: 10,
    weightUnit: 'tons',
    vehicleNeeded: 'Wing Van',
    askingPrice: 48000,
    description,
    pickupDate: '2026-03-20',
    photos: [],
    status: 'open',
    bidCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

function truckListingDoc({ userId, origin, destination, description = '' }) {
  return {
    userId,
    userName: 'Safe User',
    userRating: 0,
    userTrips: 0,
    origin,
    destination,
    originLat: 10.3157,
    originLng: 123.8854,
    destLat: 8.9475,
    destLng: 125.5406,
    routeDistanceKm: 260,
    routeDistanceUpdatedAt: Timestamp.now(),
    originStreetAddress: 'Port Area',
    destinationStreetAddress: 'Terminal Road',
    vehicleType: 'Wing Van',
    capacity: 10,
    capacityUnit: 'tons',
    plateNumber: 'ABC1234',
    askingPrice: 48000,
    description,
    availableDate: '2026-03-20',
    departureTime: '10:30',
    photos: [],
    status: 'open',
    bidCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

function bidDoc({ bidderId, listingOwnerId, listingId, message = 'Safe route details' }) {
  return {
    bidderId,
    bidderName: 'Trucker Safe',
    bidderType: 'trucker',
    bidderRating: 0,
    bidderTrips: 0,
    bidderTransactions: 0,
    listingId,
    cargoListingId: listingId,
    truckListingId: null,
    listingType: 'cargo',
    listingOwnerId,
    listingOwnerName: 'Shipper Safe',
    origin: 'Cebu',
    destination: 'Butuan',
    price: 48000,
    message,
    cargoType: null,
    cargoWeight: null,
    status: 'pending',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

async function main() {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });

  try {
    const userA = env.authenticatedContext('userA').firestore();
    const userB = env.authenticatedContext('userB').firestore();
    const shipper = env.authenticatedContext('shipper1').firestore();
    const trucker = env.authenticatedContext('trucker1').firestore();

    await env.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, 'users', 'shipper1'), userDoc({ name: 'Shipper Safe', role: 'shipper', phone: '+639171000001' }));
      await setDoc(doc(adminDb, 'users', 'trucker1'), userDoc({ name: 'Trucker Safe', role: 'trucker', phone: '+639171000002' }));
      await setDoc(doc(adminDb, 'users', 'userB'), userDoc({ name: 'Existing User', role: 'shipper', phone: '+639171000003' }));
      await setDoc(doc(adminDb, 'cargoListings', 'cargo-rules-1'), cargoListingDoc({ userId: 'shipper1', origin: 'Cebu', destination: 'Butuan' }));
      await setDoc(doc(adminDb, 'truckListings', 'truck-rules-1'), truckListingDoc({ userId: 'trucker1', origin: 'Davao', destination: 'Cebu' }));
    });

    await assertFails(
      setDoc(
        doc(userA, 'users', 'userA'),
        userDoc({
          name: 'Call me 09995449410',
          role: 'shipper',
          phone: '+639171000010',
        })
      )
    );

    await assertSucceeds(
      setDoc(
        doc(userA, 'users', 'userA'),
        userDoc({
          name: 'Juan Dela Cruz',
          role: 'shipper',
          phone: '+639171000011',
        })
      )
    );

    await assertFails(
      updateDoc(doc(userB, 'users', 'userB'), {
        name: 'messenger @unsafe_handle',
        updatedAt: Timestamp.now(),
      })
    );

    await assertSucceeds(
      updateDoc(doc(userB, 'users', 'userB'), {
        name: 'Updated Fullname',
        updatedAt: Timestamp.now(),
      })
    );

    await assertFails(
      setDoc(
        doc(shipper, 'cargoListings', 'cargo-rules-contact'),
        cargoListingDoc({
          userId: 'shipper1',
          origin: 'Cebu',
          destination: 'Butuan',
          description: 'Call me 09995449410',
        })
      )
    );

    await assertSucceeds(
      setDoc(
        doc(shipper, 'cargoListings', 'cargo-rules-safe'),
        cargoListingDoc({
          userId: 'shipper1',
          origin: 'Cebu',
          destination: 'Butuan',
          description: 'Pickup 10:30 PM @ terminal 2',
        })
      )
    );

    await assertSucceeds(
      updateDoc(doc(shipper, 'cargoListings', 'cargo-rules-safe'), {
        askingPrice: 50000,
        updatedAt: Timestamp.now(),
      })
    );

    await assertFails(
      updateDoc(doc(shipper, 'cargoListings', 'cargo-rules-safe'), {
        originStreetAddress: 'https://facebook.com/unsafe-route',
        updatedAt: Timestamp.now(),
      })
    );

    await assertFails(
      setDoc(
        doc(trucker, 'truckListings', 'truck-rules-contact'),
        truckListingDoc({
          userId: 'trucker1',
          origin: 'Davao',
          destination: 'Cebu',
          description: 'telegram @unsafe_handle',
        })
      )
    );

    await assertSucceeds(
      setDoc(
        doc(trucker, 'truckListings', 'truck-rules-safe'),
        truckListingDoc({
          userId: 'trucker1',
          origin: 'Davao',
          destination: 'Cebu',
          description: 'Departure 08:00, ETA 16:30',
        })
      )
    );

    await assertFails(
      setDoc(
        doc(trucker, 'bids', 'bid-rules-contact-name'),
        {
          ...bidDoc({ bidderId: 'trucker1', listingOwnerId: 'shipper1', listingId: 'cargo-rules-1' }),
          bidderName: 'fb @unsafe_handle',
        }
      )
    );

    await assertFails(
      setDoc(
        doc(trucker, 'bids', 'bid-rules-contact-message'),
        bidDoc({
          bidderId: 'trucker1',
          listingOwnerId: 'shipper1',
          listingId: 'cargo-rules-1',
          message: 'Call me at 09995449410',
        })
      )
    );

    await assertSucceeds(
      setDoc(
        doc(trucker, 'bids', 'bid-rules-safe'),
        bidDoc({
          bidderId: 'trucker1',
          listingOwnerId: 'shipper1',
          listingId: 'cargo-rules-1',
          message: 'Cebu to Butuan, pickup 10:30 PM',
        })
      )
    );

    await assertFails(
      setDoc(
        doc(trucker, 'bids', 'bid-rules-safe', 'messages', 'msg-contact-message'),
        {
          senderId: 'trucker1',
          senderName: 'Safe Name',
          message: 'Reach me at 09995449410',
          read: false,
          isRead: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }
      )
    );

    await assertFails(
      setDoc(
        doc(trucker, 'bids', 'bid-rules-safe', 'messages', 'msg-contact-sender'),
        {
          senderId: 'trucker1',
          senderName: 'ig @unsafe_handle',
          message: 'Safe route details only',
          read: false,
          isRead: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }
      )
    );

    await assertSucceeds(
      setDoc(
        doc(trucker, 'bids', 'bid-rules-safe', 'messages', 'msg-safe'),
        {
          senderId: 'trucker1',
          senderName: 'Safe Name',
          message: 'Meet at terminal 2, 10:30 PM',
          read: false,
          isRead: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }
      )
    );

    await env.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'bids', 'bid-rules-safe'), {
        status: 'rejected',
        updatedAt: Timestamp.now(),
      });
    });

    await assertFails(
      setDoc(
        doc(trucker, 'bids', 'bid-rules-safe', 'messages', 'msg-closed-bid'),
        {
          senderId: 'trucker1',
          senderName: 'Safe Name',
          message: 'Trying to send after rejection',
          read: false,
          isRead: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }
      )
    );

    console.log('anti-contact Firestore rules checks passed.');
  } finally {
    await env.cleanup();
  }
}

main().catch((error) => {
  console.error('anti-contact Firestore rules checks failed:', error);
  process.exit(1);
});
