# Step 06 — Patch TruckCard.jsx

**File to edit:** `frontend/src/components/truck/TruckCard.jsx`
**You are making 3 additions. Same pattern as CargoCard.**

---

## PROMPT FOR CLAUDE IN VS CODE

```
Open `frontend/src/components/truck/TruckCard.jsx` and make exactly these 3 changes.
Do not change any existing code — only add the new lines described.

─────────────────────────────────────────────────────────────────
CHANGE 1 of 3 — Add onViewProfile to props destructuring
─────────────────────────────────────────────────────────────────

Find the TruckCard function props. Look for this prop near the end:
  onRefer,
  canBook = true,

Add onViewProfile on a new line BETWEEN onRefer and canBook:
  onRefer,
  onViewProfile,
  canBook = true,

─────────────────────────────────────────────────────────────────
CHANGE 2 of 3 — Make the trucker name tappable (FULL card view only)
─────────────────────────────────────────────────────────────────

In the FULL card view (not the compact view), find where the trucker name
or company name is shown. It will look something like:
  <h3 className="font-bold text-gray-900 dark:text-white text-base" style={{ marginBottom: '4px' }}>
    {trucker}
  </h3>

Or it may show {trucker || company} or similar.

REPLACE only that <h3> (or <p>) element showing the trucker name with:
  <button
    type="button"
    onClick={() => {
      const uid = truckerId || userId;
      if (uid) onViewProfile?.(uid);
    }}
    className="font-bold text-gray-900 dark:text-white text-base text-left hover:text-orange-500 dark:hover:text-orange-400 transition-colors underline-offset-2 hover:underline disabled:cursor-default"
    style={{ marginBottom: '4px', background: 'none', border: 'none', padding: 0 }}
    disabled={!(truckerId || userId)}
  >
    {trucker || company}
  </button>

─────────────────────────────────────────────────────────────────
CHANGE 3 of 3 — Make sure truckerId and userId are in props
─────────────────────────────────────────────────────────────────

Look at the TruckCard props destructuring. Check if `truckerId` and `userId` are there.

If they are NOT there, add them. Find:
  id,
  trucker,

And add truckerId and userId right after id:
  id,
  truckerId,
  userId,
  trucker,

If they ARE already there, skip this change.
```

---

## After Claude Makes The Changes

Verify:
> "In TruckCard.jsx, confirm:
> 1. onViewProfile is in the props
> 2. The trucker name in the full card view is now a button element
> 3. truckerId and userId are in the props"

All 3 should be confirmed.
