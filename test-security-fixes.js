/**
 * Security Fix Verification Test Script
 *
 * This script tests the Firestore security rules to verify that admin privilege
 * escalation is properly prevented.
 *
 * IMPORTANT: Run this against the Firebase emulator, NOT production!
 *
 * Setup:
 * 1. npm install -g firebase-tools
 * 2. firebase emulators:start --only firestore,auth
 * 3. node test-security-fixes.js
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInAnonymously, signOut, connectAuthEmulator } = require('firebase/auth');
const { getFirestore, doc, setDoc, updateDoc, connectFirestoreEmulator } = require('firebase/firestore');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');

// Firebase config (use emulator)
const firebaseConfig = {
  apiKey: "test-api-key",
  authDomain: "test-project.firebaseapp.com",
  projectId: "test-project",
  storageBucket: "test-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// Connect to emulators
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, 'localhost', 8080);
connectFunctionsEmulator(functions, 'localhost', 5001);

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details) {
  testResults.tests.push({ name, passed, details });
  if (passed) {
    console.log(`✅ PASS: ${name}`);
    testResults.passed++;
  } else {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   Details: ${details}`);
    testResults.failed++;
  }
}

async function runTests() {
  console.log('\n🔐 Starting Security Fix Verification Tests...\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Normal user creation should succeed
    console.log('\n📝 Test 1: Normal user creation (should PASS)');
    try {
      const userCred = await signInAnonymously(auth);
      const userId = userCred.user.uid;

      await setDoc(doc(db, 'users', userId), {
        name: "Test User",
        email: "test@example.com",
        role: "shipper",
        isActive: true,
        phone: "+639123456789"
      });

      logTest('Normal user creation', true, 'User created successfully with role=shipper');

      // Cleanup
      await signOut(auth);
    } catch (error) {
      logTest('Normal user creation', false, error.message);
    }

    // Test 2: Attempt to set isAdmin=true during creation (should FAIL)
    console.log('\n📝 Test 2: Malicious creation with isAdmin=true (should FAIL)');
    try {
      const userCred = await signInAnonymously(auth);
      const userId = userCred.user.uid;

      await setDoc(doc(db, 'users', userId), {
        name: "Attacker",
        email: "attacker@example.com",
        isAdmin: true,  // Should be blocked!
        role: "shipper"
      });

      logTest('Block isAdmin during creation', false, 'Security rules allowed isAdmin=true during creation!');
      await signOut(auth);
    } catch (error) {
      if (error.code === 'permission-denied') {
        logTest('Block isAdmin during creation', true, 'Correctly blocked isAdmin=true');
      } else {
        logTest('Block isAdmin during creation', false, `Unexpected error: ${error.message}`);
      }
      await signOut(auth);
    }

    // Test 3: Attempt to set role=admin during creation (should FAIL)
    console.log('\n📝 Test 3: Malicious creation with role=admin (should FAIL)');
    try {
      const userCred = await signInAnonymously(auth);
      const userId = userCred.user.uid;

      await setDoc(doc(db, 'users', userId), {
        name: "Attacker",
        email: "attacker2@example.com",
        role: "admin"  // Should be blocked!
      });

      logTest('Block role=admin during creation', false, 'Security rules allowed role=admin during creation!');
      await signOut(auth);
    } catch (error) {
      if (error.code === 'permission-denied') {
        logTest('Block role=admin during creation', true, 'Correctly blocked role=admin');
      } else {
        logTest('Block role=admin during creation', false, `Unexpected error: ${error.message}`);
      }
      await signOut(auth);
    }

    // Test 4: Valid role values should be allowed (shipper, trucker, broker)
    console.log('\n📝 Test 4: Valid role values (should PASS)');
    const validRoles = ['shipper', 'trucker', 'broker'];

    for (const role of validRoles) {
      try {
        const userCred = await signInAnonymously(auth);
        const userId = userCred.user.uid;

        await setDoc(doc(db, 'users', userId), {
          name: `Test ${role}`,
          email: `${role}@example.com`,
          role: role
        });

        logTest(`Allow role=${role}`, true, `Correctly allowed role=${role}`);
        await signOut(auth);
      } catch (error) {
        logTest(`Allow role=${role}`, false, `Should allow role=${role}: ${error.message}`);
        await signOut(auth);
      }
    }

    // Test 5: Attempt to update isAdmin after creation (should FAIL)
    console.log('\n📝 Test 5: Update isAdmin after creation (should FAIL)');
    try {
      const userCred = await signInAnonymously(auth);
      const userId = userCred.user.uid;

      // First create the user normally
      await setDoc(doc(db, 'users', userId), {
        name: "Test User Update",
        email: "testupdate@example.com",
        role: "shipper",
        isAdmin: false
      });

      // Try to update isAdmin
      await updateDoc(doc(db, 'users', userId), {
        isAdmin: true  // Should be blocked by update rule
      });

      logTest('Block isAdmin update', false, 'Security rules allowed isAdmin update!');
      await signOut(auth);
    } catch (error) {
      if (error.code === 'permission-denied') {
        logTest('Block isAdmin update', true, 'Correctly blocked isAdmin update');
      } else {
        logTest('Block isAdmin update', false, `Unexpected error: ${error.message}`);
      }
      await signOut(auth);
    }

    // Test 6: Attempt to update role to admin after creation (should FAIL)
    console.log('\n📝 Test 6: Update role to admin after creation (should FAIL)');
    try {
      const userCred = await signInAnonymously(auth);
      const userId = userCred.user.uid;

      // First create the user normally
      await setDoc(doc(db, 'users', userId), {
        name: "Test User Role Update",
        email: "testroleupdate@example.com",
        role: "shipper"
      });

      // Try to update role to admin
      await updateDoc(doc(db, 'users', userId), {
        role: "admin"  // Should be blocked by update rule
      });

      logTest('Block role=admin update', false, 'Security rules allowed role=admin update!');
      await signOut(auth);
    } catch (error) {
      if (error.code === 'permission-denied') {
        logTest('Block role=admin update', true, 'Correctly blocked role=admin update');
      } else {
        logTest('Block role=admin update', false, `Unexpected error: ${error.message}`);
      }
      await signOut(auth);
    }

  } catch (error) {
    console.error('\n❌ Fatal error during tests:', error);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TEST SUMMARY:');
  console.log(`   Total Tests: ${testResults.passed + testResults.failed}`);
  console.log(`   ✅ Passed: ${testResults.passed}`);
  console.log(`   ❌ Failed: ${testResults.failed}`);
  console.log(`   Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Security fixes are working correctly.\n');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED! Please review the security rules.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
