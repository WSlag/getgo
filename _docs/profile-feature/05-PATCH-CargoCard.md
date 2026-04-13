# Step 05 — Patch CargoCard.jsx

**File to edit:** `frontend/src/components/cargo/CargoCard.jsx`
**You are making 3 additions. Do not delete anything.**

---

## PROMPT FOR CLAUDE IN VS CODE

```
Open `frontend/src/components/cargo/CargoCard.jsx` and make exactly these 3 changes.
Do not change any existing code — only add the new lines described.

─────────────────────────────────────────────────────────────────
CHANGE 1 of 3 — Add onViewProfile to props destructuring
─────────────────────────────────────────────────────────────────

Find the CargoCard function props. Look for this prop near the end:
  onRefer,
  canBid = true,

Add onViewProfile on a new line BETWEEN onRefer and canBid:
  onRefer,
  onViewProfile,
  canBid = true,

─────────────────────────────────────────────────────────────────
CHANGE 2 of 3 — Make the shipper name tappable (FULL card view only)
─────────────────────────────────────────────────────────────────

In the FULL card view (not the compact view), find where displayCompany is shown.
It will look something like this:
  <h3 className="font-bold text-gray-900 dark:text-white text-base" style={{ marginBottom: '4px' }}>
    {displayCompany}
  </h3>

REPLACE only that <h3> element with this <button> element:
  <button
    type="button"
    onClick={() => {
      const uid = userId || shipperId;
      if (uid) onViewProfile?.(uid);
    }}
    className="font-bold text-gray-900 dark:text-white text-base text-left hover:text-orange-500 dark:hover:text-orange-400 transition-colors underline-offset-2 hover:underline disabled:cursor-default"
    style={{ marginBottom: '4px', background: 'none', border: 'none', padding: 0 }}
    disabled={!(userId || shipperId)}
  >
    {displayCompany}
  </button>

─────────────────────────────────────────────────────────────────
CHANGE 3 of 3 — Make sure shipperId and userId are in props
─────────────────────────────────────────────────────────────────

Look at the CargoCard props destructuring. Check if `shipperId` and `userId` are already there.

If they are NOT there, add them. Find:
  id,
  shipper,
  company,

And add userId and shipperId right after id:
  id,
  userId,
  shipperId,
  shipper,
  company,

If they ARE already there, skip this change.
```

---

## After Claude Makes The Changes

Verify:
> "In CargoCard.jsx, confirm:
> 1. onViewProfile is in the props
> 2. The shipper name in the full card view is now a button element
> 3. userId and shipperId are in the props"

All 3 should be confirmed.

---

## Important Note

The COMPACT card view (used on mobile) may also show a company name.
You only need to change the full card view for now.
The compact view will be updated in a future step if needed.
