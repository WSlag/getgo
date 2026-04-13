# Step 04 — Patch HomeView.jsx

**File to edit:** `frontend/src/views/HomeView.jsx`
**You are making 3 additions. Do not delete anything.**

---

## PROMPT FOR CLAUDE IN VS CODE

```
Open `frontend/src/views/HomeView.jsx` and make exactly these 3 changes.
Do not change any existing code — only add the new lines described.

─────────────────────────────────────────────────────────────────
CHANGE 1 of 3 — Add onViewUserProfile to props
─────────────────────────────────────────────────────────────────

Find the HomeView function signature. It starts with:
  export function HomeView({
    activeMarket = 'cargo',
    onMarketChange,
    ...

Find this existing prop near the end of the props list:
  onPostListing,

Add onViewUserProfile on a new line AFTER onPostListing:
  onPostListing,
  onViewUserProfile,

─────────────────────────────────────────────────────────────────
CHANGE 2 of 3 — Pass onViewProfile to each CargoCard
─────────────────────────────────────────────────────────────────

Find the CargoCard render inside the listings map. It looks like:
  <CargoCard
    key={cargo.id}
    {...cargo}
    compact={isMobile}
    onViewDetails={() => onViewCargoDetails?.(cargo)}
    onBid={() => onBidCargo?.(cargo)}
    onContact={() => onContactShipper?.(cargo)}
    onViewMap={() => onViewMap?.(cargo)}
    canBid={...}
    isOwner={...}
    canRefer={...}
    onRefer={() => onReferListing?.(cargo, 'cargo')}
    darkMode={darkMode}
  />

Add this prop to the CargoCard (add it on a new line before the closing />):
  onViewProfile={onViewUserProfile}

─────────────────────────────────────────────────────────────────
CHANGE 3 of 3 — Pass onViewProfile to each TruckCard
─────────────────────────────────────────────────────────────────

Find the TruckCard render inside the listings map. It looks like:
  <TruckCard
    key={truck.id}
    {...truck}
    compact={isMobile}
    onViewDetails={() => onViewTruckDetails?.(truck)}
    onBook={() => onBookTruck?.(truck)}
    onContact={() => onContactTrucker?.(truck)}
    onViewMap={() => onViewMap?.(truck)}
    canBook={...}
    isOwner={...}
    canRefer={...}
    onRefer={() => onReferListing?.(...)}
    darkMode={darkMode}
  />

Add this prop to the TruckCard (add it on a new line before the closing />):
  onViewProfile={onViewUserProfile}
```

---

## After Claude Makes The Changes

Verify:
> "In HomeView.jsx, confirm:
> 1. onViewUserProfile is in the props destructuring
> 2. CargoCard has onViewProfile={onViewUserProfile}
> 3. TruckCard has onViewProfile={onViewUserProfile}"

All 3 should be confirmed.
