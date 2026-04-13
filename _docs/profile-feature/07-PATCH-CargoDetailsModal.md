# Step 07 — Patch CargoDetailsModal.jsx

**File to edit:** `frontend/src/components/modals/CargoDetailsModal.jsx`
**This is the most important patch — shippers view trucker profiles from the bid list here.**
**You are making 3 additions.**

---

## PROMPT FOR CLAUDE IN VS CODE

```
Open `frontend/src/components/modals/CargoDetailsModal.jsx` and make exactly these 3 changes.
Do not change any existing code — only add the new lines described.

─────────────────────────────────────────────────────────────────
CHANGE 1 of 3 — Add onViewProfile to props
─────────────────────────────────────────────────────────────────

Find the CargoDetailsModal function props destructuring.
Look for these props near the end:
  onRefer,
  userBidId,

Add onViewProfile on a new line BETWEEN onRefer and userBidId:
  onRefer,
  onViewProfile,
  userBidId,

─────────────────────────────────────────────────────────────────
CHANGE 2 of 3 — Make bidder name tappable in each bid row
─────────────────────────────────────────────────────────────────

In the bid list section, find where the bidder name is shown inside each bid row.
The bid rows map over the `bids` array. Inside each bid row, the bidder name looks like:

  <p className="font-medium text-gray-900 dark:text-white">{bid.bidder}</p>

REPLACE that <p> with a button:
  <button
    type="button"
    onClick={() => {
      const uid = bid.bidderId || bid._original?.bidderId;
      if (uid) onViewProfile?.(uid);
    }}
    className="font-medium text-gray-900 dark:text-white text-left hover:text-orange-500 dark:hover:text-orange-400 transition-colors underline-offset-2 hover:underline disabled:cursor-default"
    style={{ background: 'none', border: 'none', padding: 0 }}
    disabled={!(bid.bidderId || bid._original?.bidderId)}
  >
    {bid.bidder}
  </button>

─────────────────────────────────────────────────────────────────
CHANGE 3 of 3 — Add "View Profile" button in the bid action buttons
─────────────────────────────────────────────────────────────────

Still inside the bid rows, find the action buttons section.
There is a Chat button that looks like this:
  <Button
    variant="outline"
    size="sm"
    className="flex-1 gap-2"
    onClick={() => onOpenChat?.(bid._original, cargo)}
  >
    <MessageSquare className="size-4" />
    Chat
  </Button>

Add a new "View Profile" button BEFORE the Chat button:
  <Button
    variant="ghost"
    size="sm"
    className="gap-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
    onClick={() => {
      const uid = bid.bidderId || bid._original?.bidderId;
      if (uid) onViewProfile?.(uid);
    }}
  >
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
    View Profile
  </Button>
```

---

## After Claude Makes The Changes

Verify:
> "In CargoDetailsModal.jsx, confirm:
> 1. onViewProfile is in the props
> 2. The bid.bidder name is now a button
> 3. A 'View Profile' button appears before the Chat button in bid rows"

All 3 should be confirmed.

---

## Also Update GetGoApp.jsx To Pass The Prop

After this step, paste this prompt:

```
In `frontend/src/GetGoApp.jsx`, find where CargoDetailsModal is rendered.
It has many props like open, onClose, cargo, currentRole, etc.

Add this prop to CargoDetailsModal:
  onViewProfile={(uid) => setViewingUserId(uid)}

Then find where TruckDetailsModal is rendered.
Add the same prop to TruckDetailsModal:
  onViewProfile={(uid) => setViewingUserId(uid)}
```
