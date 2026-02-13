# Testing Guide - Firestore Migration
**Purpose:** Verify all migrated endpoints work correctly with Firestore
**Date:** 2026-02-11

---

## 🎯 Quick Test Summary

Run these tests to verify the migration is working correctly:

### Prerequisites
1. Backend server running: `cd backend && npm start`
2. Firebase credentials configured
3. Test user credentials available
4. Postman/curl/Thunder Client ready

---

## 1️⃣ Auth Identity Mismatch Tests

### Test 1.1: Get User Profile (auth.js)
**Endpoint:** `GET /api/auth/me`
**Expected:** Returns user profile from Firestore using `req.user.uid`

```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**✅ Success Criteria:**
- Returns 200 OK
- User data includes `id` (Firebase UID)
- No `userId: undefined` in response

**❌ Failure Indicators:**
- 404 User not found
- Returns undefined fields
- Server error 500

---

### Test 1.2: Update User Profile (auth.js)
**Endpoint:** `PUT /api/auth/me`
**Expected:** Updates user in Firestore using `req.user.uid`

```bash
curl -X PUT http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name", "email": "new@email.com"}'
```

**✅ Success Criteria:**
- Returns 200 OK
- Updated fields reflected in response
- Changes persist in Firestore

---

### Test 1.3: Create Listing (listings.js)
**Endpoint:** `POST /api/listings/cargo`
**Expected:** Creates listing with `userId: req.user.uid` in Firestore

```bash
curl -X POST http://localhost:5000/api/listings/cargo \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "Manila",
    "destination": "Cebu",
    "cargoType": "Electronics",
    "weight": 500,
    "preferredTruckType": "Closed Van",
    "pickupDate": "2026-03-01"
  }'
```

**✅ Success Criteria:**
- Returns 201 Created
- Listing has correct `userId` (Firebase UID)
- Listing appears in Firestore `cargoListings` collection

**Verify in Firestore:**
```javascript
// Check that userId matches authenticated user's Firebase UID
// NOT undefined or database UUID
```

---

### Test 1.4: Place Bid (bids.js)
**Endpoint:** `POST /api/bids`
**Expected:** Creates bid with `bidderId: req.user.uid` in Firestore

```bash
curl -X POST http://localhost:5000/api/bids \
  -H "Authorization: Bearer TRUCKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "listingType": "cargo",
    "listingId": "LISTING_ID_HERE",
    "price": 15000,
    "message": "I can deliver this safely"
  }'
```

**✅ Success Criteria:**
- Returns 201 Created
- Bid has `bidderId` matching Firebase UID
- Listing owner receives notification

---

## 2️⃣ Security Vulnerability Tests (CRITICAL)

### Test 2.1: Chat Authorization - Unauthorized Access Blocked
**Endpoint:** `GET /api/chat/:bidId`
**Expected:** Returns 403 Forbidden for unauthorized users

```bash
# User A creates a bid on User B's listing (bidId: abc123)
# User C (unrelated) tries to access chat

curl -X GET http://localhost:5000/api/chat/abc123 \
  -H "Authorization: Bearer USER_C_TOKEN"
```

**✅ Success Criteria:**
- Returns **403 Forbidden**
- Error message: "Not authorized to access this chat"
- No chat messages leaked

**❌ CRITICAL FAILURE:**
- Returns 200 OK with messages
- User C can see User A and User B's private conversation

---

### Test 2.2: Chat Authorization - Authorized Access Allowed
**Endpoint:** `GET /api/chat/:bidId`
**Expected:** Returns 200 OK for bidder or listing owner

```bash
# User A (bidder) accesses their chat
curl -X GET http://localhost:5000/api/chat/abc123 \
  -H "Authorization: Bearer USER_A_TOKEN"

# User B (listing owner) accesses same chat
curl -X GET http://localhost:5000/api/chat/abc123 \
  -H "Authorization: Bearer USER_B_TOKEN"
```

**✅ Success Criteria:**
- Both return 200 OK
- Both see the same chat messages
- Messages include sender info

---

### Test 2.3: Send Message - Unauthorized Blocked
**Endpoint:** `POST /api/chat/:bidId`
**Expected:** Returns 403 Forbidden for unauthorized users

```bash
# User C tries to send message in User A & B's chat
curl -X POST http://localhost:5000/api/chat/abc123 \
  -H "Authorization: Bearer USER_C_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Trying to hijack this conversation"}'
```

**✅ Success Criteria:**
- Returns **403 Forbidden**
- Error message: "Not authorized to send messages in this chat"
- Message NOT saved to database

---

### Test 2.4: Mark Messages Read - Authorization
**Endpoint:** `PUT /api/chat/:bidId/read`
**Expected:** Only bidder or listing owner can mark messages read

```bash
# User C tries to mark User A & B's messages as read
curl -X PUT http://localhost:5000/api/chat/abc123/read \
  -H "Authorization: Bearer USER_C_TOKEN"
```

**✅ Success Criteria:**
- Returns **403 Forbidden**
- Messages remain unread
- No unauthorized state changes

---

## 3️⃣ ESM/CommonJS Mixing Tests

### Test 3.1: Server Startup
**Expected:** Server starts without module errors

```bash
cd backend
npm start
```

**✅ Success Criteria:**
- Server starts successfully
- No `require() of ES Module` errors
- No `Cannot use import statement` errors
- Logs show: "Server is running on port 5000"

**❌ Failure Indicators:**
```
Error [ERR_REQUIRE_ESM]: require() of ES Module not supported
ReferenceError: require is not defined in ES module scope
```

---

### Test 3.2: Listing Query (listings.js line 54 fix)
**Endpoint:** `GET /api/listings/cargo`
**Expected:** Returns listings without Sequelize operator errors

```bash
curl -X GET http://localhost:5000/api/listings/cargo \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**✅ Success Criteria:**
- Returns 200 OK with listings
- No runtime errors in console
- Results from Firestore, not SQLite

---

### Test 3.3: Accept Bid (bids.js line 277 fix)
**Endpoint:** `PUT /api/bids/:id/accept`
**Expected:** Accepts bid and rejects others using Firestore

```bash
curl -X PUT http://localhost:5000/api/bids/BID_ID_HERE/accept \
  -H "Authorization: Bearer LISTING_OWNER_TOKEN"
```

**✅ Success Criteria:**
- Returns 200 OK
- Bid status updated to "accepted"
- Other pending bids rejected (Firestore batch operation)
- No Sequelize.Op errors

---

## 4️⃣ Authorization & Ownership Tests

### Test 4.1: Update Own Listing (authorized)
**Endpoint:** `PUT /api/listings/cargo/:id`
**Expected:** Listing owner can update their own listing

```bash
curl -X PUT http://localhost:5000/api/listings/cargo/LISTING_ID \
  -H "Authorization: Bearer OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}'
```

**✅ Success Criteria:**
- Returns 200 OK
- Listing updated in Firestore

---

### Test 4.2: Update Other's Listing (unauthorized)
**Endpoint:** `PUT /api/listings/cargo/:id`
**Expected:** Non-owner cannot update listing

```bash
curl -X PUT http://localhost:5000/api/listings/cargo/LISTING_ID \
  -H "Authorization: Bearer DIFFERENT_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}'
```

**✅ Success Criteria:**
- Returns **403 Forbidden**
- Error: "Not authorized to update this listing"
- Listing unchanged in Firestore

---

### Test 4.3: Accept Bid (authorized - listing owner)
**Endpoint:** `PUT /api/bids/:id/accept`
**Expected:** Listing owner can accept bids on their listing

```bash
curl -X PUT http://localhost:5000/api/bids/BID_ID/accept \
  -H "Authorization: Bearer LISTING_OWNER_TOKEN"
```

**✅ Success Criteria:**
- Returns 200 OK
- Bid status = "accepted"

---

### Test 4.4: Accept Bid (unauthorized - bidder)
**Endpoint:** `PUT /api/bids/:id/accept`
**Expected:** Bidder cannot accept their own bid

```bash
curl -X PUT http://localhost:5000/api/bids/BID_ID/accept \
  -H "Authorization: Bearer BIDDER_TOKEN"
```

**✅ Success Criteria:**
- Returns **403 Forbidden**
- Error: "Not authorized to accept this bid"

---

### Test 4.5: Withdraw Bid (authorized - bidder)
**Endpoint:** `PUT /api/bids/:id/withdraw`
**Expected:** Bidder can withdraw their own bid

```bash
curl -X PUT http://localhost:5000/api/bids/BID_ID/withdraw \
  -H "Authorization: Bearer BIDDER_TOKEN"
```

**✅ Success Criteria:**
- Returns 200 OK
- Bid status = "withdrawn"

---

### Test 4.6: Withdraw Bid (unauthorized - listing owner)
**Endpoint:** `PUT /api/bids/:id/withdraw`
**Expected:** Listing owner cannot withdraw bidder's bid

```bash
curl -X PUT http://localhost:5000/api/bids/BID_ID/withdraw \
  -H "Authorization: Bearer LISTING_OWNER_TOKEN"
```

**✅ Success Criteria:**
- Returns **403 Forbidden**
- Error: "Not authorized to withdraw this bid"

---

## 5️⃣ Rating & Notification Tests

### Test 5.1: Create Rating
**Endpoint:** `POST /api/ratings`
**Expected:** Creates rating using `req.user.uid`

```bash
curl -X POST http://localhost:5000/api/ratings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "CONTRACT_ID",
    "score": 5,
    "tags": ["Professional", "On-time"],
    "comment": "Excellent service!"
  }'
```

**✅ Success Criteria:**
- Returns 201 Created
- Rating saved with `raterId` = Firebase UID
- Rated user's profile updated (badge/tier)
- Notification sent to rated user

---

### Test 5.2: Get Notifications
**Endpoint:** `GET /api/notifications`
**Expected:** Returns notifications from Firestore subcollection

```bash
curl -X GET http://localhost:5000/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**✅ Success Criteria:**
- Returns 200 OK with notifications
- Notifications from user's subcollection only
- Includes unread count

---

### Test 5.3: Mark Notification Read
**Endpoint:** `PUT /api/notifications/:id/read`
**Expected:** Marks notification as read using `req.user.uid`

```bash
curl -X PUT http://localhost:5000/api/notifications/NOTIF_ID/read \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**✅ Success Criteria:**
- Returns 200 OK
- Notification `isRead` updated to true
- Only user's own notifications affected

---

## 6️⃣ Firestore Data Verification

### Manual Firestore Console Checks

1. **Open Firebase Console** → Firestore Database

2. **Check Users Collection:**
   ```
   /users/{userId}
   - Verify userId is Firebase UID (NOT database UUID)
   - Verify user documents exist
   ```

3. **Check Listings Collection:**
   ```
   /cargoListings/{listingId}
   - Verify userId field matches Firebase UID
   - NO userId: undefined values
   ```

4. **Check Bids Collection:**
   ```
   /bids/{bidId}
   - Verify bidderId matches Firebase UID
   - Verify listingOwnerId matches Firebase UID
   ```

5. **Check Notifications Subcollection:**
   ```
   /users/{userId}/notifications/{notificationId}
   - Verify notifications are in correct user's subcollection
   - Verify structure matches expected format
   ```

6. **Check Chat Messages Subcollection:**
   ```
   /bids/{bidId}/messages/{messageId}
   - Verify senderId matches Firebase UID
   - Verify messages are in correct bid's subcollection
   ```

---

## 7️⃣ Regression Tests

### Test 7.1: Existing Functionality Still Works
- ✅ User login/logout
- ✅ Listing creation/update/delete
- ✅ Bid creation/acceptance/rejection
- ✅ Chat messaging
- ✅ Notifications delivery
- ✅ Rating submission
- ✅ Contract creation

### Test 7.2: No Sequelize References
```bash
# Search for any remaining Sequelize imports
grep -r "require('sequelize')" backend/src/routes
# Should return: no matches

grep -r "from 'sequelize'" backend/src/routes
# Should return: no matches

# Search for old user ID pattern
grep -r "req.user.id[^.]" backend/src/routes
# Should return: no matches (only req.user.uid)
```

---

## 🚨 Critical Failure Scenarios

If ANY of these occur, DO NOT DEPLOY:

1. **Security Failure:**
   - Unauthorized user can access other users' chats
   - Unauthorized user can modify other users' resources
   - Authorization checks return 200 instead of 403

2. **Data Integrity Failure:**
   - New records have `userId: undefined`
   - Ownership checks fail for valid owners
   - Records are created in wrong collections

3. **Runtime Failure:**
   - Server crashes on startup
   - `require() of ES Module` errors
   - Sequelize-related errors

---

## ✅ Deployment Checklist

Before deploying to production:

- [ ] All auth identity tests pass
- [ ] All security tests pass (403 for unauthorized)
- [ ] All authorization tests pass
- [ ] Server starts without errors
- [ ] No Sequelize references remain
- [ ] Firestore data structure verified
- [ ] No `userId: undefined` in database
- [ ] All existing functionality works
- [ ] Performance is acceptable
- [ ] Error handling works correctly

---

## 📊 Test Results Template

```
FIRESTORE MIGRATION TEST RESULTS
Date: _________________
Tester: _______________

Auth Identity Tests:
[ ] 1.1 Get User Profile - PASS/FAIL
[ ] 1.2 Update User Profile - PASS/FAIL
[ ] 1.3 Create Listing - PASS/FAIL
[ ] 1.4 Place Bid - PASS/FAIL

Security Tests:
[ ] 2.1 Chat Unauthorized Blocked - PASS/FAIL (CRITICAL)
[ ] 2.2 Chat Authorized Allowed - PASS/FAIL
[ ] 2.3 Send Message Unauthorized - PASS/FAIL (CRITICAL)
[ ] 2.4 Mark Read Unauthorized - PASS/FAIL (CRITICAL)

ESM Tests:
[ ] 3.1 Server Startup - PASS/FAIL
[ ] 3.2 Listing Query - PASS/FAIL
[ ] 3.3 Accept Bid - PASS/FAIL

Authorization Tests:
[ ] 4.1 Update Own Listing - PASS/FAIL
[ ] 4.2 Update Other's Listing - PASS/FAIL (CRITICAL)
[ ] 4.3 Accept Bid (Owner) - PASS/FAIL
[ ] 4.4 Accept Bid (Bidder) - PASS/FAIL (CRITICAL)
[ ] 4.5 Withdraw Bid (Bidder) - PASS/FAIL
[ ] 4.6 Withdraw Bid (Owner) - PASS/FAIL (CRITICAL)

Rating & Notification Tests:
[ ] 5.1 Create Rating - PASS/FAIL
[ ] 5.2 Get Notifications - PASS/FAIL
[ ] 5.3 Mark Notification Read - PASS/FAIL

Firestore Verification:
[ ] Users collection correct - PASS/FAIL
[ ] Listings have Firebase UIDs - PASS/FAIL
[ ] Bids have Firebase UIDs - PASS/FAIL
[ ] No userId: undefined - PASS/FAIL (CRITICAL)

Overall Result: PASS / FAIL
Ready for Production: YES / NO

Notes:
_________________________________________
_________________________________________
```

---

## 🔧 Troubleshooting

### Issue: 403 Forbidden on Valid Requests
**Cause:** Token not being sent or invalid
**Fix:** Check Authorization header format: `Bearer YOUR_TOKEN`

### Issue: 404 User Not Found
**Cause:** User document doesn't exist in Firestore
**Fix:** Verify user was created via Firebase Auth, check Firestore console

### Issue: userId: undefined in Database
**Cause:** Route still using `req.user.id` instead of `req.user.uid`
**Fix:** Check the specific route file and update to `req.user.uid`

### Issue: Server Won't Start
**Cause:** Sequelize imports still present
**Fix:** Check for remaining `require('sequelize')` calls

---

**Testing Guide Version:** 1.0
**Last Updated:** 2026-02-11
**Migration Status:** Complete - Ready for Testing
