/**
 * Contract Creation Verification Script
 * Run this with: node verify-contract-creation.js
 *
 * This script checks if contract creation is working properly after admin payment approval
 */

const path = require('path');
const fs = require('fs');

// Try to load firebase-admin from functions directory
let admin, db;
try {
  // Change to functions directory
  process.chdir(path.join(__dirname, 'functions'));

  admin = require('firebase-admin');

  // Try to initialize with service account
  const serviceAccountPaths = [
    path.join(__dirname, 'serviceAccountKey.json'),
    path.join(__dirname, 'functions', 'serviceAccountKey.json'),
    path.join(__dirname, 'backend', 'serviceAccountKey.json'),
  ];

  let initialized = false;
  for (const accountPath of serviceAccountPaths) {
    if (fs.existsSync(accountPath)) {
      const serviceAccount = require(accountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://karga-getgo.firebaseio.com'
      });
      console.log('✅ Firebase Admin initialized with service account from:', accountPath);
      initialized = true;
      break;
    }
  }

  if (!initialized) {
    console.log('⚠️  No service account key found. Trying default credentials...');
    admin.initializeApp();
  }

  db = admin.firestore();
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  console.error('\nPlease ensure you have:');
  console.error('1. Run "npm install" in the functions directory');
  console.error('2. Have a valid serviceAccountKey.json file');
  process.exit(1);
}

async function verifyContractCreation() {
  console.log('\n🔍 KARGA CONTRACT CREATION VERIFICATION REPORT\n');
  console.log('='.repeat(80));

  try {
    // Step 1: Get recently approved payments
    console.log('\n📋 Step 1: Checking Recently Approved Payments...\n');
    const approvedPayments = await db.collection('paymentSubmissions')
      .where('status', '==', 'approved')
      .orderBy('resolvedAt', 'desc')
      .limit(5)
      .get();

    if (approvedPayments.empty) {
      console.log('❌ No approved payments found');
      return;
    }

    console.log(`✅ Found ${approvedPayments.size} approved payment(s)\n`);

    // Step 2: Check each approved payment
    for (const paymentDoc of approvedPayments.docs) {
      const payment = paymentDoc.data();
      const paymentId = paymentDoc.id;

      console.log('-'.repeat(80));
      console.log(`\n💳 Payment ID: ${paymentId}`);
      console.log(`   User ID: ${payment.userId}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Resolved At: ${payment.resolvedAt?.toDate()}`);
      console.log(`   Resolved By: ${payment.resolvedBy || 'N/A'}`);

      // Get associated order
      if (!payment.orderId) {
        console.log('   ⚠️  No orderId found in payment submission');
        continue;
      }

      const orderDoc = await db.collection('orders').doc(payment.orderId).get();
      if (!orderDoc.exists) {
        console.log('   ❌ Order not found');
        continue;
      }

      const order = orderDoc.data();
      console.log(`\n   📦 Order Details:`);
      console.log(`      Order ID: ${payment.orderId}`);
      console.log(`      Type: ${order.type}`);
      console.log(`      Amount: PHP ${order.amount?.toLocaleString()}`);
      console.log(`      Status: ${order.status}`);
      console.log(`      Bid ID: ${order.bidId || 'N/A'}`);

      // Check if this is a platform fee payment
      if (order.type !== 'platform_fee') {
        console.log(`   ℹ️  Not a platform fee payment (type: ${order.type})`);
        continue;
      }

      console.log(`\n   🎯 This is a PLATFORM FEE payment - Contract should be created!`);

      // Step 3: Check if platform fee was recorded
      const platformFeeSnap = await db.collection('platformFees')
        .where('bidId', '==', order.bidId)
        .where('submissionId', '==', paymentId)
        .get();

      if (platformFeeSnap.empty) {
        console.log(`   ❌ Platform fee NOT recorded in platformFees collection`);
      } else {
        console.log(`   ✅ Platform fee recorded (${platformFeeSnap.size} document(s))`);
        const feeData = platformFeeSnap.docs[0].data();
        console.log(`      Fee Status: ${feeData.status}`);
        console.log(`      Fee Amount: PHP ${feeData.amount?.toLocaleString()}`);
      }

      // Step 4: Check if contract exists for this bid
      if (!order.bidId) {
        console.log(`   ⚠️  No bidId in order - cannot create contract`);
        continue;
      }

      const contractSnap = await db.collection('contracts')
        .where('bidId', '==', order.bidId)
        .get();

      console.log(`\n   📜 Contract Verification:`);
      if (contractSnap.empty) {
        console.log(`   ❌ CONTRACT NOT FOUND for bid ${order.bidId}`);
        console.log(`   🔧 This indicates contract creation FAILED!`);

        // Check bid status
        const bidDoc = await db.collection('bids').doc(order.bidId).get();
        if (bidDoc.exists) {
          const bid = bidDoc.data();
          console.log(`\n   📊 Bid Details:`);
          console.log(`      Bid ID: ${order.bidId}`);
          console.log(`      Status: ${bid.status}`);
          console.log(`      Price: PHP ${bid.price?.toLocaleString()}`);
          console.log(`      Cargo Listing ID: ${bid.cargoListingId || 'N/A'}`);
          console.log(`      Truck Listing ID: ${bid.truckListingId || 'N/A'}`);

          // Check if bid is in correct status
          if (bid.status !== 'accepted' && bid.status !== 'contracted') {
            console.log(`   ⚠️  Bid status is "${bid.status}" - should be "accepted" or "contracted"`);
          }

          // Check if listing exists
          const listingId = bid.cargoListingId || bid.truckListingId;
          const listingCollection = bid.cargoListingId ? 'cargoListings' : 'truckListings';

          if (listingId) {
            const listingDoc = await db.collection(listingCollection).doc(listingId).get();
            if (!listingDoc.exists) {
              console.log(`   ❌ Listing NOT FOUND in ${listingCollection}`);
            } else {
              const listing = listingDoc.data();
              console.log(`\n   🚛 Listing Details:`);
              console.log(`      Listing ID: ${listingId}`);
              console.log(`      Type: ${listingCollection}`);
              console.log(`      Status: ${listing.status}`);
              console.log(`      Origin: ${listing.origin}`);
              console.log(`      Destination: ${listing.destination}`);
              console.log(`      Owner: ${listing.userId}`);
            }
          }
        } else {
          console.log(`   ❌ Bid NOT FOUND: ${order.bidId}`);
        }

      } else {
        console.log(`   ✅ CONTRACT FOUND! (${contractSnap.size} document(s))`);
        const contract = contractSnap.docs[0].data();
        console.log(`      Contract ID: ${contractSnap.docs[0].id}`);
        console.log(`      Contract Number: ${contract.contractNumber}`);
        console.log(`      Status: ${contract.status}`);
        console.log(`      Created At: ${contract.createdAt?.toDate()}`);
        console.log(`      Agreed Price: PHP ${contract.agreedPrice?.toLocaleString()}`);
        console.log(`      Platform Fee: PHP ${contract.platformFee?.toLocaleString()}`);
        console.log(`      Shipper: ${contract.listingOwnerName || contract.listingOwnerId}`);
        console.log(`      Trucker: ${contract.bidderName || contract.bidderId}`);
        console.log(`      Shipper Signed: ${contract.shipperSignature ? '✅' : '❌'}`);
        console.log(`      Trucker Signed: ${contract.truckerSignature ? '✅' : '❌'}`);
      }

      // Step 5: Check notifications
      console.log(`\n   📬 Checking Notifications:`);
      const userNotifications = await db.collection(`users/${payment.userId}/notifications`)
        .where('data.contractId', '!=', null)
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();

      if (!userNotifications.empty) {
        console.log(`   ✅ Found ${userNotifications.size} contract-related notification(s)`);
        userNotifications.docs.forEach((notif, idx) => {
          const n = notif.data();
          console.log(`      ${idx + 1}. ${n.type}: "${n.title}" (${n.createdAt?.toDate()})`);
        });
      } else {
        console.log(`   ⚠️  No contract-related notifications found`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ VERIFICATION COMPLETE\n');

  } catch (error) {
    console.error('\n❌ ERROR during verification:', error);
    console.error(error.stack);
  }

  process.exit(0);
}

verifyContractCreation();
