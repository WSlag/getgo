const exportedFunctions = require("../index.js");

const requiredExports = [
  "processPaymentSubmission",
  "createPlatformFeeOrder",
  "adminApprovePayment",
  "sendPlatformFeeReminders",
];

const missing = requiredExports.filter((name) => !(name in exportedFunctions));

if (missing.length > 0) {
  console.error(`Functions smoke test failed. Missing exports: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`Functions smoke test passed. Verified ${requiredExports.length} key exports.`);
