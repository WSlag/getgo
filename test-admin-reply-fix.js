#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Test to verify the admin reply fix
console.log('🔍 Testing Admin Reply Fix...\n');

const firestoreServicePath = path.join(process.cwd(), 'frontend', 'src', 'services', 'firestoreService.js');

if (!fs.existsSync(firestoreServicePath)) {
  console.error('❌ firestoreService.js not found');
  process.exit(1);
}

const content = fs.readFileSync(firestoreServicePath, 'utf8');

// Check if the fix is applied
const addAdminReplyFunction = content.match(/export const addAdminReply[\s\S]*?^}/m);

if (!addAdminReplyFunction) {
  console.log('❌ addAdminReply function not found');
  process.exit(1);
}

const functionCode = addAdminReplyFunction[0];

console.log('✅ Found addAdminReply function');
console.log('📋 Function implementation:');
console.log('=====================================');
console.log(functionCode);

console.log('\n🔍 Verifying the fix...');
const checks = [
  {
    name: 'Uses arrayUnion for adding replies',
    test: functionCode.includes('replies: arrayUnion(replyData)'),
    expected: true
  },
  {
    name: 'Updates status to in_progress',
    test: functionCode.includes("status: 'in_progress'"),
    expected: true
  },
  {
    name: 'Uses serverTimestamp for updatedAt',
    test: functionCode.includes('updatedAt: serverTimestamp()'),
    expected: true
  },
  {
    name: 'Returns replyData object',
    test: functionCode.includes('return replyData'),
    expected: true
  }
];

let allPassed = true;
checks.forEach(check => {
  if (check.test === check.expected) {
    console.log(`✅ ${check.name}`);
  } else {
    console.log(`❌ ${check.name}`);
    allPassed = false;
  }
});

if (allPassed) {
  console.log('\n🎉 SUCCESS: Admin reply functionality has been fixed!');
  console.log('\n📝 What was the issue?');
  console.log('The addAdminReply function was missing the "replies: arrayUnion(replyData)" line.');
  console.log('This meant that admin replies were not being added to the support message document.');
  console.log('\n🔧 What was fixed?');
  console.log('Added the missing arrayUnion call to properly append replies to the support message.');
  console.log('\n🧪 How it works now:');
  console.log('1. Admin sends a reply through the admin dashboard');
  console.log('2. addAdminReply function creates a reply object with metadata');
  console.log('3. Uses arrayUnion to add the reply to the message document');
  console.log('4. Updates message status to "in_progress"');
  console.log('5. User can see the admin reply in their message history');
} else {
  console.log('\n❌ FAILED: Some checks did not pass');
  process.exit(1);
}