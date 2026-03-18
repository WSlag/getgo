const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const {
  containsContactInfo,
  sanitizeContactText,
  sanitizePublicName,
} = require('../src/utils/contactModeration');

function expectTrue(value, message) {
  assert.strictEqual(value, true, message);
}

function expectFalse(value, message) {
  assert.strictEqual(value, false, message);
}

async function main() {
  const frontendModuleUrl = pathToFileURL(
    path.resolve(__dirname, '../../frontend/src/utils/messageUtils.js')
  ).href;
  const frontendUtils = await import(frontendModuleUrl);

  const blockedSamples = [
    'Call me at 09995449410',
    'Email me: shipper@example.com',
    'fb: @shipper_name',
    'Reach me via telegram @cargo_ops',
    'https://facebook.com/cargo.ops',
  ];

  blockedSamples.forEach((sample) => {
    expectTrue(containsContactInfo(sample), `backend should flag contact in: ${sample}`);
    expectTrue(frontendUtils.hasContactInfo(sample), `frontend should flag contact in: ${sample}`);
  });

  const allowedSamples = [
    'Cebu to Butuan',
    'Price is 48000',
    'Pickup 10:30 PM @ terminal 2',
    'Departure 08:00, ETA 16:30',
    'Route: Caraga via CDO',
  ];

  allowedSamples.forEach((sample) => {
    expectFalse(containsContactInfo(sample), `backend should allow non-contact in: ${sample}`);
    expectFalse(frontendUtils.hasContactInfo(sample), `frontend should allow non-contact in: ${sample}`);
  });

  const sanitizedBackend = sanitizeContactText('Call me 09995449410 via fb @shipper_name or a@b.com');
  assert(!sanitizedBackend.includes('09995449410'), 'backend sanitizer must hide phone number');
  assert(!sanitizedBackend.includes('@shipper_name'), 'backend sanitizer must hide handle');
  assert(!sanitizedBackend.includes('a@b.com'), 'backend sanitizer must hide email');
  assert(sanitizedBackend.includes('[Contact Hidden]'), 'backend sanitizer should include contact token');
  assert(sanitizedBackend.includes('[Handle Hidden]'), 'backend sanitizer should include handle token');
  assert(sanitizedBackend.includes('[Email Hidden]'), 'backend sanitizer should include email token');

  const sanitizedFrontend = frontendUtils.sanitizeMessage('Cebu to Butuan, call 09995449410');
  assert(sanitizedFrontend.includes('Cebu to Butuan'), 'frontend sanitizer must preserve route text');
  assert(!sanitizedFrontend.includes('09995449410'), 'frontend sanitizer must hide phone number');

  assert.strictEqual(
    sanitizePublicName('Juan Dela Cruz'),
    'Juan Dela Cruz',
    'safe public name should remain unchanged'
  );
  assert.strictEqual(
    sanitizePublicName('Juan 09995449410', 'User'),
    'Juan',
    'public name sanitizer should remove contact payload'
  );
  assert.strictEqual(
    frontendUtils.sanitizePublicName('fb @juan_doe', 'User'),
    'User',
    'frontend public name sanitizer should fall back when only contact payload exists'
  );

  console.log('anti-contact unit checks passed.');
}

main().catch((error) => {
  console.error('anti-contact unit checks failed:', error);
  process.exit(1);
});
