# 🎯 How to Verify Contract Creation

## ✅ Quick Start - 2 Methods

### **Method 1: Use the Built-In Tool** (Recommended - Easiest!)

1. **Open your Karga app** in the browser (should be running at `http://localhost:3000`)

2. **Go to Admin Payments page**
   - You're probably already there since you just approved a payment!

3. **Click the purple "Verify Contracts" button** (top right, next to "Refresh")

4. **Click "Run Verification Check"**

5. **View Results:**
   - ✅ Green boxes = Contracts created successfully
   - ❌ Red boxes = Contract creation failed (with detailed reasons)
   - 📊 Statistics showing how many contracts were created vs failed

### **Method 2: Manual Firebase Console Check**

1. **Open Firebase Console** → [https://console.firebase.google.com/](https://console.firebase.google.com/)

2. **Select your project:** `karga-getgo`

3. **Go to:** Firestore Database (left sidebar)

4. **Follow these steps:**

   **Step A: Find your approved payment**
   - Click on `paymentSubmissions` collection
   - Look for documents with `status: "approved"`
   - Find your recently approved one (sort by `resolvedAt` if needed)
   - Copy the `orderId` value

   **Step B: Check the order type**
   - Click on `orders` collection
   - Open the document with the `orderId` you copied
   - Look at the `type` field:
     - If it says `"platform_fee"` → Continue to Step C
     - If it says `"topup"` or anything else → **STOP** (no contract is created for non-platform-fee payments)

   **Step C: Find the contract**
   - Copy the `bidId` from the order
   - Click on `contracts` collection
   - Look for a contract with `bidId` matching what you copied
   - **Result:**
     - ✅ **Contract found** → SUCCESS! Contract creation is working!
     - ❌ **Contract not found** → FAILED! See troubleshooting below

---

## 🔍 Understanding the Results

### **✅ Success Looks Like This:**

In the verification tool, you'll see:
```
✅ CONTRACT CREATED SUCCESSFULLY!
Contract Number: KC-2602-AB12CD
Status: draft
Agreed Price: PHP 50,000
Platform Fee: PHP 2,500
Created: Feb 8, 2026, 3:45 PM
```

### **❌ Failure Looks Like This:**

```
❌ CONTRACT NOT CREATED
Bid ID: xyz123
Bid Status: pending

Issues Found:
• Bid status is "pending" (should be "accepted" or "contracted")
```

---

## 🐛 Common Issues & Fixes

### **Issue 1: "This is a topup payment"**
- **What it means:** The payment was for wallet top-up, not a platform fee
- **Is this bad?** NO! This is normal - contracts are only for platform fees
- **Action:** None needed

### **Issue 2: "Bid status is 'pending'"**
- **What it means:** The bid was never accepted by the listing owner
- **Fix:** The listing owner needs to accept the bid BEFORE paying the platform fee

### **Issue 3: "Listing not found"**
- **What it means:** The associated cargo/truck listing was deleted
- **Fix:** This shouldn't happen - may need manual admin intervention

### **Issue 4: "User ID mismatch"**
- **What it means:** Someone other than the listing owner paid the platform fee
- **Fix:** Refund the payment and have the correct user pay

---

## 📊 Expected Workflow

```
1. Trucker submits bid on cargo listing
          ↓
2. Shipper accepts the bid
          ↓
3. System generates platform fee payment order (5% of bid price)
          ↓
4. Shipper pays platform fee via GCash
          ↓
5. Admin approves payment (or auto-approved by OCR)
          ↓
6. ✅ CONTRACT AUTO-CREATED
          ↓
7. Both parties receive notifications
          ↓
8. Contract ready for signing
```

---

## 💡 Quick Checks

**For the payment you just approved:**

1. **Check order type first:**
   ```
   Firebase Console → orders → {orderId} → type
   ```
   - If `"platform_fee"` → Contract SHOULD exist
   - If `"topup"` → No contract (this is normal)

2. **Check contract exists:**
   ```
   Firebase Console → contracts → Filter: bidId == {bidId}
   ```
   - Found → ✅ Working!
   - Not found → ❌ Failed (check bid status)

3. **Check bid status:**
   ```
   Firebase Console → bids → {bidId} → status
   ```
   - Should be: `"accepted"` or `"contracted"`
   - If `"pending"` → This is why contract wasn't created

---

## 🎯 What to Report

If you find an issue, please provide:

1. **Payment Submission ID:** (from the admin panel)
2. **Order Type:** (platform_fee or topup?)
3. **Bid ID:** (if applicable)
4. **Bid Status:** (accepted, pending, etc.)
5. **Contract Found:** YES or NO
6. **Screenshot of verification tool results** (if using Method 1)

---

## 📱 Access the Verification Tool

1. Make sure your frontend is running:
   ```
   cd frontend
   npm run dev
   ```

2. Open browser: `http://localhost:3000`

3. Sign in as admin

4. Go to: Admin Payments

5. Click: "Verify Contracts" button (purple button, top right)

6. Click: "Run Verification Check"

7. View results!

---

## ✨ Features of the Verification Tool

- **Real-time Firestore queries** - Shows current state
- **Detailed diagnostics** - Explains exactly what went wrong
- **Visual indicators** - Green for success, red for failure
- **Statistics dashboard** - See overall health at a glance
- **Issue detection** - Automatically identifies problems
- **User-friendly** - No technical knowledge required

---

**Created:** February 8, 2026
**Last Updated:** February 8, 2026
**Status:** Ready to use ✅
