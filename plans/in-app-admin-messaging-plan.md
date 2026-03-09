# In-App Admin Messaging Feature - Implementation Plan

## Overview
Add an in-app messaging feature to the Contact Support page that allows users to send messages directly to the admin for help and support. This will include a text area for typing messages and a send button.

## Current State Analysis

### Existing Contact Support Page
The Contact Support page is located in `frontend/src/views/HelpSupportView.jsx` within the `ContactSection` component (lines 334-402). Currently it displays:
- Email support contact (support@getgo.ph)
- Support hours
- Response time information

### Existing Messaging Infrastructure
The app already has a chat/messaging system via:
- `sendChatMessage()` function in `frontend/src/services/firestoreService.js` (lines 496-560)
- Messages are stored in Firestore under `bids/{bidId}/messages`
- Uses Firebase Cloud Functions for notifications

## Implementation Plan

### Phase 1: Add Support Message Function

**File: `frontend/src/services/firestoreService.js`**

Add a new function `sendSupportMessage()` that creates support messages in a dedicated collection:

```javascript
// ============================================================
// SUPPORT MESSAGES
// ============================================================

/**
 * Send a support message to admin
 * @param {string} userId - User ID sending the message
 * @param {string} userName - User's display name
 * @param {string} message - Message content
 * @param {string} category - Support category (optional, e.g., 'general', 'technical', 'billing')
 * @returns {Promise<Object>} - Created message with ID
 */
export const sendSupportMessage = async (userId, userName, message, category = 'general') => {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  const normalizedUserName = typeof userName === 'string' && userName.trim()
    ? userName.trim()
    : 'User';
  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  const normalizedCategory = typeof category === 'string' ? category.trim() : 'general';

  if (!normalizedUserId) {
    const err = new Error('User must be authenticated to send support message');
    err.code = 'unauthenticated';
    throw err;
  }

  if (!normalizedMessage) {
    const err = new Error('Message cannot be empty');
    err.code = 'invalid-argument';
    throw err;
  }

  if (normalizedMessage.length > 2000) {
    const err = new Error('Message is too long (max 2000 characters)');
    err.code = 'invalid-argument';
    throw err;
  }

  // Create support message document
  const supportMessagesRef = collection(db, 'supportMessages');
  const messageRef = await addDoc(supportMessagesRef, {
    userId: normalizedUserId,
    userName: normalizedUserName,
    message: normalizedMessage,
    category: normalizedCategory,
    status: 'open', // open, in_progress, resolved
    read: false,
    isRead: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Create notification for admin (optional - can be handled by Cloud Function)
  // This ensures admin gets notified of new support message

  return { 
    id: messageRef.id, 
    userId: normalizedUserId,
    userName: normalizedUserName,
    message: normalizedMessage,
    category: normalizedCategory,
    status: 'open',
    createdAt: new Date().toISOString()
  };
};
```

### Phase 2: Update Contact Support Section

**File: `frontend/src/views/HelpSupportView.jsx`**

Update the `ContactSection` component to include:
1. Import statements for the new function
2. State management for message input and sending status
3. UI components (textarea and send button)
4. Success/error feedback

#### Import Additions:
```javascript
import { sendSupportMessage } from '@/services/firestoreService';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle, Send } from 'lucide-react';
```

#### State Management in ContactSection:
```javascript
function ContactSection({ onBack, currentUser }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState(null); // 'success', 'error', null
  const [errorMessage, setErrorMessage] = useState('');
  
  // ... existing code ...
}
```

#### Send Handler:
```javascript
const handleSendMessage = async () => {
  if (!message.trim() || !currentUser) return;
  
  setSending(true);
  setSendStatus(null);
  setErrorMessage('');
  
  try {
    const userName = currentUser.displayName || currentUser.name || 'User';
    await sendSupportMessage(
      currentUser.uid,
      userName,
      message.trim(),
      'support' // category
    );
    
    setSendStatus('success');
    setMessage('');
    
    // Clear success status after 3 seconds
    setTimeout(() => setSendStatus(null), 3000);
  } catch (err) {
    console.error('Failed to send support message:', err);
    setSendStatus('error');
    setErrorMessage(err.message || 'Failed to send message. Please try again.');
  } finally {
    setSending(false);
  }
};
```

#### UI Additions:
Add a new card section after the existing contact information card with:
- Header: "Send us a message"
- Description: "Describe your issue and we'll get back to you"
- Textarea for message input (with character limit indicator)
- Send button with loading state
- Success/error feedback messages

### Phase 3: Firestore Security Rules

**File: `firestore.rules`**

Add security rules for the `supportMessages` collection:

```javascript
// Support Messages
match /supportMessages/{messageId} {
  // Allow users to create their own support messages
  allow create: if request.auth != null 
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.keys().hasAll(['userId', 'userName', 'message', 'status', 'createdAt'])
    && request.resource.data.status == 'open'
    && request.resource.data.read == false;
  
  // Allow users to read their own messages
  allow read: if request.auth != null 
    && resource.data.userId == request.auth.uid;
  
  // Only admins can update/delete support messages
  allow update, delete: if request.auth != null 
    && exists(/databases/$(database)/documents/users/$(request.auth.uid)/adminProfile/profile);
}
```

### Phase 4: Admin Dashboard Integration (Optional/Future)

Create a view in the admin dashboard to view and respond to support messages:
- List all support messages ordered by creation time
- Filter by status (open, in_progress, resolved)
- Reply functionality for admins
- Mark as resolved/closed

## Data Model

### Support Message Document
```typescript
interface SupportMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  category: string; // 'support', 'billing', 'technical', etc.
  status: 'open' | 'in_progress' | 'resolved';
  read: boolean;
  isRead: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Future: replies array for admin responses
}
```

## UI/UX Design

### Contact Support Page Layout
```
┌─────────────────────────────────────┐
│  ← Back                             │
├─────────────────────────────────────┤
│  [Icon]  Contact Support            │
│          Get help from our team     │
├─────────────────────────────────────┤
│  [Email Card]                       │
│  [Support Hours Card]               │
│  [Response Time Card]               │
├─────────────────────────────────────┤
│  Send us a message                  │
│  Describe your issue...             │
│  ┌───────────────────────────────┐  │
│  │ [Textarea]                    │  │
│  │                               │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│  0/2000 characters         [Send]   │
│                                     │
│  ✓ Message sent successfully!       │
└─────────────────────────────────────┘
```

## Implementation Steps

1. **Add `sendSupportMessage` function** to `firestoreService.js`
2. **Update `ContactSection` component** in `HelpSupportView.jsx`:
   - Add imports
   - Add state hooks
   - Add send handler
   - Add UI components (textarea, button, feedback)
3. **Pass `currentUser` prop** from `HelpSupportView` to `ContactSection`
4. **Add Firestore security rules** for `supportMessages` collection
5. **Test the implementation**:
   - Verify message creation in Firestore
   - Test error handling
   - Test UI feedback (loading, success, error states)

## Testing Checklist

- [ ] User can type a message in the textarea
- [ ] Character limit (2000) is enforced
- [ ] Send button is disabled when message is empty
- [ ] Loading state shows while sending
- [ ] Success message appears after sending
- [ ] Error message appears if sending fails
- [ ] Message is created in Firestore with correct fields
- [ ] Security rules prevent unauthorized access
- [ ] Only authenticated users can send messages
- [ ] Users can only read their own messages

## Future Enhancements

1. **Message History**: Show user's previous support messages
2. **Admin Replies**: Allow admins to reply to support messages
3. **File Attachments**: Allow users to attach screenshots/files
4. **Message Categories**: Dropdown to select issue type
5. **Real-time Updates**: Show when admin is typing/replies
6. **Push Notifications**: Notify admin of new messages
7. **Auto-assignment**: Assign messages to specific admin users

## Files to Modify

1. `frontend/src/services/firestoreService.js` - Add `sendSupportMessage` function
2. `frontend/src/views/HelpSupportView.jsx` - Update `ContactSection` component
3. `firestore.rules` - Add security rules for support messages

## Estimated Effort

- Frontend changes: ~2-3 hours
- Security rules: ~30 minutes
- Testing: ~1 hour
- Total: ~4 hours
