# PROJECT_CONTEXT.md
## KARGA Connect - Philippine Trucking Backload Marketplace

> **Generated**: February 4, 2026
> **Purpose**: AI-assisted development reference document

---

## Table of Contents
1. [Tech Stack Overview](#1-tech-stack-overview)
2. [Project Structure](#2-project-structure)
3. [Design System & Tokens](#3-design-system--tokens)
4. [Component Inventory](#4-component-inventory)
5. [Coding Conventions](#5-coding-conventions)
6. [State Management](#6-state-management)
7. [API & Data Patterns](#7-api--data-patterns)
8. [Tailwind Configuration](#8-tailwind-configuration)
9. [Inconsistencies & TODOs](#9-inconsistencies--todos)

---

## 1. Tech Stack Overview

### Frontend
| Category | Technology | Version |
|----------|------------|---------|
| **Framework** | React | 18.2.0 |
| **Build Tool** | Vite | 5.1.4 |
| **Styling** | Tailwind CSS | 4.1.12 |
| **UI Primitives** | Radix UI | Various |
| **Icons** | Lucide React | 0.487.0 |
| **Maps** | React Leaflet | 4.2.1 |
| **Backend** | Firebase | 12.8.0 |
| **PWA** | Vite PWA Plugin | 0.19.0 |

### UI Component Pattern
- **Base**: Radix UI primitives (Dialog, Popover, Select, Tabs, Tooltip)
- **Styling**: Tailwind CSS utilities
- **Variants**: class-variance-authority (CVA)
- **Class Merging**: clsx + tailwind-merge

### Backend
| Category | Technology | Version |
|----------|------------|---------|
| **Runtime** | Node.js | ES Modules |
| **Framework** | Express | 4.18.2 |
| **Real-time** | Socket.io | 4.7.4 |
| **ORM** | Sequelize | 6.37.1 |
| **Database** | SQLite3 | 5.1.7 |
| **Auth** | JWT + bcryptjs | 9.0.2 / 2.4.3 |

### Primary Database
- **Firebase Firestore** - Real-time NoSQL database (primary)
- **Firebase Authentication** - Phone OTP sign-in
- **SQLite** - Backend fallback/backup

---

## 2. Project Structure

```
Karga/
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Root with auth routing
│   │   ├── GetGoApp.jsx            # Main marketplace UI
│   │   ├── main.jsx                # Entry point
│   │   ├── firebase.js             # Firebase config
│   │   │
│   │   ├── components/
│   │   │   ├── auth/               # Login, Register screens
│   │   │   ├── layout/             # Header, Sidebar, MobileNav
│   │   │   ├── cargo/              # CargoCard
│   │   │   ├── truck/              # TruckCard
│   │   │   ├── modals/             # PostModal, BidModal
│   │   │   ├── maps/               # RouteMap, TrackingMap
│   │   │   ├── ui/                 # Shadcn-style primitives
│   │   │   └── shared/             # Logo, common components
│   │   │
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx     # Firebase auth context
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.js          # Auth context hook
│   │   │   ├── useCargoListings.js # Cargo data + filters
│   │   │   ├── useTruckListings.js # Truck data + filters
│   │   │   ├── useBids.js          # Bid management
│   │   │   ├── useModals.js        # Modal state
│   │   │   ├── useTheme.js         # Dark mode
│   │   │   └── useMarketplace.js   # UI state
│   │   │
│   │   ├── services/
│   │   │   └── firestoreService.js # Firestore CRUD
│   │   │
│   │   ├── views/
│   │   │   └── HomeView.jsx        # Main content view
│   │   │
│   │   ├── utils/
│   │   │   ├── constants.js        # Platform constants
│   │   │   ├── calculations.js     # Business logic
│   │   │   └── cityCoordinates.js  # City lat/lng map
│   │   │
│   │   ├── lib/
│   │   │   └── utils.js            # cn() utility
│   │   │
│   │   └── styles/
│   │       └── tailwind.css        # Tailwind entry
│   │
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── app.js                  # Express + Socket.io
│   │   ├── middleware/auth.js      # JWT middleware
│   │   ├── models/index.js         # Sequelize models
│   │   └── routes/                 # API endpoints
│   └── package.json
│
├── firestore.rules
├── firestore.indexes.json
├── PROJECT_CONTEXT.md              # This file
└── README.md
```

---

## 3. Design System & Tokens

### Color Palette

#### Primary Colors (Gradients)
```css
/* Orange - Primary Brand / Cargo / Shipper */
--orange-gradient: linear-gradient(to bottom-right, #fb923c, #ea580c);
/* Tailwind: from-orange-400 to-orange-600 */
/* Shadow: shadow-orange-500/30 */

/* Blue - Secondary / Trucker / Navigation */
--blue-gradient: linear-gradient(to bottom-right, #60a5fa, #2563eb);
/* Tailwind: from-blue-400 to-blue-600 OR from-blue-500 to-blue-600 */
/* Shadow: shadow-blue-500/30 */

/* Green - Success / Open Status */
--green-gradient: linear-gradient(to bottom-right, #4ade80, #16a34a);
/* Tailwind: from-green-400 to-green-600 */
/* Shadow: shadow-green-500/30 */

/* Purple - Alternative / Delivered */
--purple-gradient: linear-gradient(to bottom-right, #c084fc, #9333ea);
/* Tailwind: from-purple-400 to-purple-600 */
/* Shadow: shadow-purple-500/30 */

/* Red - Destination Marker */
--red-gradient: linear-gradient(to bottom-right, #f87171, #dc2626);
/* Tailwind: from-red-400 to-red-600 */
/* Shadow: shadow-red-500/30 */
```

#### Status Colors
| Status | Badge Style | Accent Bar |
|--------|-------------|------------|
| `open` | Green gradient | `from-orange-400 to-orange-600` |
| `waiting` | Orange gradient | `from-yellow-400 to-orange-500` |
| `in-progress` | Blue gradient | `from-blue-400 to-blue-600` |
| `delivered` | Purple gradient | `from-purple-400 to-purple-600` |

#### Neutral Colors
```css
/* Light Mode */
--bg-primary: white;
--bg-secondary: #f9fafb;    /* gray-50 */
--bg-tertiary: #f3f4f6;     /* gray-100 */
--text-primary: #111827;    /* gray-900 */
--text-secondary: #374151;  /* gray-700 */
--text-muted: #6b7280;      /* gray-500 */
--border: #e5e7eb;          /* gray-200 */

/* Dark Mode */
--bg-primary-dark: #030712;  /* gray-950 */
--bg-secondary-dark: #111827; /* gray-900 */
--bg-tertiary-dark: #1f2937;  /* gray-800 */
--text-primary-dark: white;
--text-secondary-dark: #d1d5db; /* gray-300 */
--text-muted-dark: #9ca3af;     /* gray-400 */
--border-dark: #374151;         /* gray-700 */
```

### Typography Scale
| Name | Size | Usage |
|------|------|-------|
| `xs` | 10-12px | Labels, badges, timestamps |
| `sm` | 14px | Body text, descriptions |
| `base` | 16px | Default text |
| `lg` | 18px | Card titles |
| `xl` | 20px | Section headers |
| `2xl` | 24px | Page titles, prices |
| `3xl` | 30px | Hero text |

**Font Weights**: `medium` (500), `semibold` (600), `bold` (700)

### Spacing System
```css
/* Component Internal Padding */
--space-card: 24px;           /* Card internal padding */
--space-section: 16px;        /* Section gaps */
--space-element: 12px;        /* Element gaps */
--space-tight: 8px;           /* Tight spacing */

/* Layout Spacing */
--header-padding: 16px 24px;  /* Header container */
--sidebar-padding: 24px;      /* Sidebar sections */
--main-padding: 32px 40px;    /* Main content area */
```

### Border Radius
```css
--radius-sm: 8px;     /* rounded-lg - inputs, small buttons */
--radius-md: 12px;    /* rounded-xl - cards, buttons */
--radius-lg: 16px;    /* rounded-2xl - large cards */
--radius-full: 9999px; /* rounded-full - avatars, pills */
```

### Shadows
```css
/* Standard */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
--shadow-xl: 0 20px 25px rgba(0,0,0,0.1);

/* Colored (for gradient buttons) */
--shadow-orange: 0 10px 15px rgba(249,115,22,0.3);
--shadow-blue: 0 10px 15px rgba(59,130,246,0.3);
--shadow-green: 0 10px 15px rgba(34,197,94,0.3);
--shadow-purple: 0 10px 15px rgba(168,85,247,0.3);
```

---

## 4. Component Inventory

### Layout Components

#### Header
```jsx
<Header
  activeTab="home"              // 'home' | 'tracking' | 'notifications' | 'profile'
  onTabChange={(tab) => {}}
  darkMode={false}
  onToggleDarkMode={() => {}}
  unreadNotifications={3}
  userInitial="U"
  walletBalance={5000}          // Trucker only
  currentRole="shipper"         // 'shipper' | 'trucker'
  onLogout={() => {}}
  onWalletClick={() => {}}
  onNotificationClick={() => {}}
  onProfileClick={() => {}}
/>
```

#### Sidebar
```jsx
<Sidebar
  currentRole="shipper"
  onRoleChange={(role) => {}}
  activeMarket="cargo"          // 'cargo' | 'trucks'
  onMarketChange={(market) => {}}
  cargoCount={10}
  truckCount={5}
  openCargoCount={3}
  availableTrucksCount={2}
  onPostClick={() => {}}
  onRouteOptimizerClick={() => {}}  // Trucker only
/>
```

#### MobileNav
```jsx
<MobileNav
  activeTab="home"
  onTabChange={(tab) => {}}
  onPostClick={() => {}}
  unreadMessages={2}
  unreadNotifications={5}
/>
```

### Card Components

#### CargoCard
```jsx
<CargoCard
  id="cargo123"
  shipper="ABC Trading"
  company="ABC Trading"         // Alias for shipper
  shipperTransactions={15}
  origin="Davao City"
  destination="Cebu City"
  originCoords={{ lat: 7.07, lng: 125.61 }}
  destCoords={{ lat: 10.31, lng: 123.89 }}
  weight={10}
  unit="tons"                   // 'tons' | 'kg'
  cargoType="Dry Goods"
  vehicleNeeded="10-Wheeler"
  askingPrice={18000}
  price={18000}                 // Alias for askingPrice
  description="Assorted dry goods..."
  pickupDate="2026-02-10"
  status="open"                 // 'open' | 'waiting' | 'in-progress' | 'delivered'
  postedAt={1707033600000}      // Timestamp
  timeAgo="2 hours ago"         // Pre-formatted
  cargoPhotos={[]}
  images={[]}                   // Alias for cargoPhotos
  bids={[{ id, bidder, amount }]}
  distance="408 km"
  estimatedTime="5 days"
  time="5 days"                 // Alias for estimatedTime
  category="CARGO"
  gradientClass="bg-gradient-to-r from-orange-400 to-orange-600"
  onViewDetails={() => {}}
  onContact={() => {}}
  onBid={() => {}}
  onViewMap={() => {}}
  canBid={true}
  darkMode={false}
/>
```

#### TruckCard
```jsx
<TruckCard
  id="truck123"
  trucker="Juan Trucking"
  truckerRating={4.8}
  truckerTransactions={25}
  origin="Manila"
  destination="Davao"
  vehicleType="10-Wheeler"
  plateNumber="ABC 1234"
  capacity="15 tons"
  askingRate={20000}
  availableDate="2026-02-08"
  description="Available for long haul..."
  status="available"            // 'available' | 'in-transit' | 'booked' | 'offline'
  postedAt={1707030000000}
  truckPhotos={[]}
  onViewDetails={() => {}}
  onContact={() => {}}
  onBook={() => {}}
  onViewMap={() => {}}
  canBook={true}
  darkMode={false}
/>
```

### UI Primitives (Shadcn-style)

#### Button Variants
```jsx
<Button variant="default" />     // Gray background
<Button variant="gradient" />    // Orange gradient
<Button variant="gradient-blue" />
<Button variant="gradient-green" />
<Button variant="gradient-purple" />
<Button variant="glass" />       // Translucent white
<Button variant="glass-dark" />  // Translucent dark
<Button variant="destructive" /> // Red
<Button variant="outline" />     // Border only
<Button variant="ghost" />       // No background
<Button variant="link" />        // Text link style

<Button size="sm" />   // Small
<Button size="default" />
<Button size="lg" />   // Large
<Button size="xl" />   // Extra large
<Button size="icon" /> // Square icon button
```

#### Badge Variants
```jsx
<Badge variant="default" />
<Badge variant="success" />        // Green
<Badge variant="warning" />        // Orange
<Badge variant="info" />           // Blue
<Badge variant="gradient-green" />
<Badge variant="gradient-orange" />
<Badge variant="gradient-blue" />
<Badge variant="gradient-purple" />
<Badge variant="gradient-red" />

<Badge size="sm" />
<Badge size="default" />
<Badge size="lg" />
```

---

## 5. Coding Conventions

### File Naming
```
Components:     PascalCase.jsx    (CargoCard.jsx, LoginScreen.jsx)
Hooks:          camelCase.js      (useAuth.js, useCargoListings.js)
Utilities:      camelCase.js      (calculations.js, constants.js)
Services:       camelCase.js      (firestoreService.js)
Contexts:       PascalCase.jsx    (AuthContext.jsx)
```

### Component Structure
```jsx
// 1. Imports (external → internal → styles)
import React, { useState, useEffect } from 'react';
import { SomeIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// 2. Component function with destructured props + defaults
export function ComponentName({
  prop1,
  prop2 = 'default',
  onAction,
  className,
}) {
  // 3. Hooks first
  const [state, setState] = useState(initialValue);

  // 4. Effects
  useEffect(() => {
    // side effects
    return () => { /* cleanup */ };
  }, [dependencies]);

  // 5. Handlers
  const handleClick = () => { /* ... */ };

  // 6. Render
  return (
    <div className={cn("base-classes", className)}>
      {/* JSX */}
    </div>
  );
}

// 7. Default export
export default ComponentName;
```

### Styling Pattern
```jsx
// Use cn() for conditional class merging
className={cn(
  "base-classes text-sm font-medium",
  isActive && "active-classes",
  disabled && "opacity-50 cursor-not-allowed",
  className
)}

// Use inline styles for dynamic values (Tailwind v4 limitation)
style={{ padding: '24px', marginBottom: '16px' }}

// Status-based styling
const statusStyles = {
  open: 'bg-gradient-to-br from-green-400 to-green-600',
  waiting: 'bg-gradient-to-br from-orange-400 to-orange-600',
};
<Badge className={cn("base", statusStyles[status])} />
```

### Props Pattern
```jsx
// Destructure with defaults
function Component({
  required,
  optional = 'default',
  callback,
  children,
}) { /* ... */ }

// Support multiple naming conventions for API flexibility
const displayPrice = price || askingPrice;
const displayImages = images.length > 0 ? images : cargoPhotos;
```

### Event Handlers
```jsx
// Inline for simple actions
onClick={() => onSelect?.(item)}

// Named functions for complex logic
const handleSubmit = async (e) => {
  e.preventDefault();
  if (!validate()) return;

  try {
    await submitData(formData);
    onSuccess?.();
  } catch (error) {
    setError(error.message);
  }
};
```

### Constants
```javascript
// Use UPPER_SNAKE_CASE for constants
export const PLATFORM_FEE_RATE = 0.05;
export const MINIMUM_WALLET_BALANCE = 500;
export const MAX_BID_COUNT = 10;

// Use objects for enum-like values
export const STATUS = {
  OPEN: 'open',
  WAITING: 'waiting',
  IN_PROGRESS: 'in-progress',
  DELIVERED: 'delivered',
};
```

---

## 6. State Management

### Authentication Context
```jsx
// contexts/AuthContext.jsx
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Firebase auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    authUser,
    userProfile,
    isAuthenticated: !!authUser && !!userProfile,
    currentRole: userProfile?.role || 'shipper',
    sendOtp,
    verifyOtp,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Data Fetching Hooks
```jsx
// hooks/useCargoListings.js
export function useCargoListings({ status, userId } = {}) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Build Firestore query
    let q = collection(db, 'cargoListings');
    const constraints = [];

    if (status) constraints.push(where('status', '==', status));
    if (userId) constraints.push(where('userId', '==', userId));
    constraints.push(orderBy('createdAt', 'desc'));

    q = query(q, ...constraints);

    // Real-time subscription
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date()
        }));
        setListings(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [status, userId]);

  return { listings, loading, error };
}
```

### UI State Hooks
```jsx
// hooks/useModals.js
export function useModals() {
  const [modals, setModals] = useState({
    post: false,
    bid: false,
    chat: false,
  });
  const [modalData, setModalData] = useState({});

  const openModal = (name, data = null) => {
    setModals(prev => ({ ...prev, [name]: true }));
    if (data) setModalData(prev => ({ ...prev, [name]: data }));
  };

  const closeModal = (name) => {
    setModals(prev => ({ ...prev, [name]: false }));
  };

  return { modals, modalData, openModal, closeModal };
}
```

---

## 7. API & Data Patterns

### Firestore Service Layer
```javascript
// services/firestoreService.js

// CREATE
export async function createCargoListing(userId, userProfile, data) {
  const docRef = await addDoc(collection(db, 'cargoListings'), {
    ...data,
    userId,
    shipperName: userProfile.businessName,
    status: 'open',
    bidCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { success: true, id: docRef.id };
}

// READ (via hooks with real-time listeners)

// UPDATE
export async function updateCargoListing(listingId, data) {
  await updateDoc(doc(db, 'cargoListings', listingId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  return { success: true };
}

// DELETE
export async function deleteCargoListing(listingId) {
  await deleteDoc(doc(db, 'cargoListings', listingId));
  return { success: true };
}

// BATCH OPERATIONS
export async function acceptBid(bidId, bid, listing, listingType) {
  const batch = writeBatch(db);

  // Update accepted bid
  batch.update(doc(db, 'bids', bidId), { status: 'accepted' });

  // Update listing status
  batch.update(doc(db, `${listingType}Listings`, listing.id), {
    status: 'waiting',
    acceptedBidId: bidId,
  });

  // Reject other bids
  // ... additional batch operations

  await batch.commit();
  return { success: true };
}
```

### Firestore Data Structure
```
users/{uid}
├── (profile document)
├── shipperProfile/profile
├── truckerProfile/profile
├── brokerProfile/profile
├── wallet/main
├── walletTransactions/{docId}
└── notifications/{notifId}

cargoListings/{docId}
truckListings/{docId}
bids/{docId}
├── messages/{msgId}
contracts/{docId}
shipments/{docId}
ratings/{docId}
```

### Socket.io Events (Real-time)
```javascript
// Client → Server
socket.emit('join-room', `user:${userId}`);
socket.emit('join-room', `listing:${listingId}`);
socket.emit('send-message', { bidId, message });
socket.emit('update-location', { shipmentId, lat, lng });

// Server → Client
socket.on('new-bid', (bid) => { /* update UI */ });
socket.on('chat-message', (message) => { /* add to chat */ });
socket.on('shipment-update', (update) => { /* update tracking */ });
```

---

## 8. Tailwind Configuration

```javascript
// tailwind.config.js (recommended configuration)
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand colors
        brand: {
          orange: '#f97316',
          blue: '#3b82f6',
        },
        // Status colors
        status: {
          open: '#22c55e',
          waiting: '#f97316',
          progress: '#3b82f6',
          delivered: '#a855f7',
        },
      },
      boxShadow: {
        'orange': '0 10px 15px -3px rgba(249, 115, 22, 0.3)',
        'blue': '0 10px 15px -3px rgba(59, 130, 246, 0.3)',
        'green': '0 10px 15px -3px rgba(34, 197, 94, 0.3)',
        'purple': '0 10px 15px -3px rgba(168, 85, 247, 0.3)',
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
      },
    },
  },
  plugins: [],
};
```

### Current Tailwind Setup (v4)
```css
/* src/styles/tailwind.css */
@import 'tailwindcss' source(none);
@source '../**/*.{js,jsx}';
```

**Note**: Tailwind v4 uses `@source` directive which only generates CSS for classes found in source files. For custom padding values not in the source, use inline styles:
```jsx
// Instead of className="p-[24px]"
style={{ padding: '24px' }}
```

---

## 9. Inconsistencies & TODOs

### Found Inconsistencies

#### 1. Dual Prop Names in CargoCard
```jsx
// Both naming conventions supported - consider standardizing
shipper / company
askingPrice / price
cargoPhotos / images
estimatedTime / time
```
**Recommendation**: Keep both for API flexibility, but document the primary names.

#### 2. Mixed Style Approaches
```jsx
// Some components use Tailwind classes
className="p-6 mb-4"

// Others use inline styles (for Tailwind v4 compatibility)
style={{ padding: '24px', marginBottom: '16px' }}
```
**Recommendation**: Use inline styles for custom spacing values to ensure consistency.

#### 3. Gradient Direction Inconsistency
```jsx
// Some use to-br (bottom-right)
"bg-gradient-to-br from-orange-400 to-orange-600"

// Others use to-r (right)
"bg-gradient-to-r from-orange-400 to-orange-600"
```
**Recommendation**: Standardize on `bg-gradient-to-br` for depth effect.

#### 4. Shadow Naming
```jsx
// Standard shadow with color
"shadow-lg shadow-orange-500/30"

// Direct custom shadow (less common)
"shadow-[0_10px_15px_rgba(249,115,22,0.3)]"
```
**Recommendation**: Use the Tailwind color shadow pattern (`shadow-{color}/30`).

### TODOs

- [ ] Add TypeScript support (convert .jsx → .tsx)
- [ ] Create proper Tailwind config with design tokens
- [ ] Add Storybook for component documentation
- [ ] Implement loading skeletons for better UX
- [ ] Add unit tests for hooks and services
- [ ] Optimize bundle size (lazy load modals)
- [ ] Add error boundaries
- [ ] Implement offline support via service worker

---

## Quick Reference

### Import Paths
```jsx
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { firestoreService } from '@/services/firestoreService';
import { PLATFORM_FEE_RATE } from '@/utils/constants';
```

### Common Patterns
```jsx
// Conditional classes
className={cn("base", condition && "conditional", className)}

// Optional callback
onAction?.()

// Form state
const [data, setData] = useState({ field: '' });
const handleChange = (field, value) => setData(p => ({ ...p, [field]: value }));

// Async with loading
const [loading, setLoading] = useState(false);
const handleSubmit = async () => {
  setLoading(true);
  try {
    await action();
  } finally {
    setLoading(false);
  }
};
```

---

*This document should be updated as the project evolves.*
