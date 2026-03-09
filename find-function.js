#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const firestoreServicePath = path.join(process.cwd(), 'frontend', 'src', 'services', 'firestoreService.js');

if (!fs.existsSync(firestoreServicePath)) {
  console.error('❌ firestoreService.js not found');
  process.exit(1);
}

const content = fs.readFileSync(firestoreServicePath, 'utf8');
const lines = content.split('\n');

// Find addAdminReply function
const addAdminReplyIndex = lines.findIndex(line => line.includes('addAdminReply'));
if (addAdminReplyIndex === -1) {
  console.log('❌ addAdminReply function not found');
  process.exit(1);
}

console.log('✅ Found addAdminReply function at line:', addAdminReplyIndex + 1);

// Extract the function (approximate)
let functionLines = [];
let braceCount = 0;
let inFunction = false;

for (let i = addAdminReplyIndex; i < lines.length; i++) {
  const line = lines[i];
  functionLines.push(line);
  
  if (line.includes('{')) {
    braceCount += (line.match(/{/g) || []).length;
    inFunction = true;
  }
  if (line.includes('}')) {
    braceCount -= (line.match(/}/g) || []).length;
    if (inFunction && braceCount === 0) {
      break;
    }
  }
}

console.log('\n📋 addAdminReply function implementation:');
console.log('=====================================');
functionLines.forEach((line, index) => {
  console.log(`${addAdminReplyIndex + index + 1}: ${line}`);
});

console.log('\n🔍 Analyzing potential issues...');
const functionStr = functionLines.join('\n');

// Check for common issues
if (functionStr.includes('arrayUnion')) {
  console.log('✅ Uses arrayUnion for adding replies');
} else {
  console.log('❌ Does not use arrayUnion - this could be the issue!');
}

if (functionStr.includes('updateDoc')) {
  console.log('✅ Uses updateDoc for updating the document');
} else {
  console.log('❌ Does not use updateDoc');
}

if (functionStr.includes('serverTimestamp')) {
  console.log('✅ Uses serverTimestamp for createdAt');
} else {
  console.log('❌ Does not use serverTimestamp');
}