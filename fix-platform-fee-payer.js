/**
 * Script to fix platform fee payer for contracts
 * Run this script to correct any contracts where the platformFeePayerId is incorrect
 *
 * Usage: node fix-platform-fee-payer.js <contractId>
 */

const admin = require('firebase-admin');
const serviceAccount = require('./path/to/serviceAccountKey.json'); // Update this path

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixContractPlatformFeePayer(contractId) {
  try {
    console.log(`\nFixing contract: ${contractId}`);

    // Get the contract
    const contractDoc = await db.collection('contracts').doc(contractId).get();
    if (!contractDoc.exists) {
      console.error('Contract not found');
      return;
    }

    const contract = contractDoc.data();
    console.log('\nCurrent contract data:');
    console.log('- Status:', contract.status);
    console.log('- Listing Type:', contract.listingType);
    console.log('- Listing Owner ID:', contract.listingOwnerId);
    console.log('- Bidder ID:', contract.bidderId);
    console.log('- Platform Fee Payer ID:', contract.platformFeePayerId);
    console.log('- Platform Fee:', contract.platformFee);
    console.log('- Platform Fee Paid:', contract.platformFeePaid);

    // Determine correct platform fee payer based on listing type
    const isCargo = contract.listingType === 'cargo';
    const correctPlatformFeePayerId = isCargo ? contract.bidderId : contract.listingOwnerId;

    console.log('\nDetermined values:');
    console.log('- Is Cargo Listing:', isCargo);
    console.log('- Trucker ID (should pay):', isCargo ? contract.bidderId : contract.listingOwnerId);
    console.log('- Shipper ID (should NOT pay):', isCargo ? contract.listingOwnerId : contract.bidderId);
    console.log('- Correct Platform Fee Payer:', correctPlatformFeePayerId);

    if (contract.platformFeePayerId === correctPlatformFeePayerId) {
      console.log('\n✅ Platform fee payer is already correct. No fix needed.');
      return;
    }

    console.log('\n⚠️  Platform fee payer is INCORRECT!');
    console.log(`   Current: ${contract.platformFeePayerId}`);
    console.log(`   Should be: ${correctPlatformFeePayerId}`);

    // Update the contract
    await db.collection('contracts').doc(contractId).update({
      platformFeePayerId: correctPlatformFeePayerId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('\n✅ Contract updated successfully!');

    // Get user details for verification
    const truckerDoc = await db.collection('users').doc(correctPlatformFeePayerId).get();
    if (truckerDoc.exists) {
      console.log(`\n✅ Verified: Platform fee should be paid by: ${truckerDoc.data().name || correctPlatformFeePayerId}`);
    }

  } catch (error) {
    console.error('Error fixing contract:', error);
  }
}

async function fixAllPendingPaymentContracts() {
  try {
    console.log('\nSearching for all pending_payment contracts...\n');

    const contractsSnap = await db.collection('contracts')
      .where('status', '==', 'pending_payment')
      .get();

    console.log(`Found ${contractsSnap.size} pending_payment contracts\n`);

    for (const contractDoc of contractsSnap.docs) {
      await fixContractPlatformFeePayer(contractDoc.id);
      console.log('\n' + '-'.repeat(80) + '\n');
    }

    console.log('✅ All contracts processed!');

  } catch (error) {
    console.error('Error processing contracts:', error);
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage:');
  console.log('  Fix specific contract: node fix-platform-fee-payer.js <contractId>');
  console.log('  Fix all pending contracts: node fix-platform-fee-payer.js --all');
  process.exit(1);
}

if (args[0] === '--all') {
  fixAllPendingPaymentContracts().then(() => process.exit(0));
} else {
  fixContractPlatformFeePayer(args[0]).then(() => process.exit(0));
}
