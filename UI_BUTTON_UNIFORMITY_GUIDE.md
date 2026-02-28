# UI Button Uniformity Guide

A reference for keeping all buttons consistent across the app, based on the **Post Cargo / Post Truck** button as the design standard.

---

## Standard Button Spec (Reference: Post Cargo button)

| Property | Value |
|---|---|
| Padding | `padding: 12–14px 16px` (vertical × horizontal) |
| Background | `background: linear-gradient(to right, #f59e0b, #f97316)` (amber-500 → orange-500) |
| Text color | `#ffffff` |
| Font weight | `bold` |
| Font size | `15px` or `1rem` (text-base) |
| Border radius | `12px` (rounded-xl) |
| Shadow | `box-shadow: 0 4px 8px rgba(249,115,22,0.4)` (shadow-lg) |
| Width | `100%` (w-full) or `flex: 1` for side-by-side |

---

## Tab / Toggle Button Spec (2-column layout)

Used when two or more buttons sit side by side as tab switchers (e.g. My Activity / Broker Activity).

| Property | Active state | Inactive state |
|---|---|---|
| Background | `linear-gradient(to right, #f59e0b, #f97316)` | `#f3f4f6` (light gray) |
| Text color | `#ffffff` | `#6b7280` (gray-500) |
| Border | none | `1px solid #e5e7eb` |
| Font weight | bold | bold |
| Shadow | `shadow-lg` with orange tint | none |

### Wrapper layout
```jsx
// Two buttons side by side
<div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
  <button style={{ flex: 1, padding: '14px 16px', fontSize: '15px', fontWeight: 'bold' }}
    className={`rounded-xl transition-all ${
      isActive
        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
    }`}
  >
    Label
  </button>
  <button style={{ flex: 1, padding: '14px 16px', fontSize: '15px', fontWeight: 'bold' }}
    className={`rounded-xl transition-all ${
      isActive
        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
    }`}
  >
    Label
  </button>
</div>
```

---

## Common Issues & Fixes

### Issue 1: Buttons look too small after deploying
**Cause:** Tailwind purges unused classes or browser serves cached CSS.
**Fix:** Use inline styles for critical sizing properties (padding, gap, font-size) so they are always applied regardless of Tailwind purge or browser cache.

```jsx
// ❌ Unreliable — may be purged or cached
className="py-4 gap-4 text-base"

// ✅ Reliable — always applied
style={{ padding: '14px 16px', gap: '12px', fontSize: '15px' }}
```

### Issue 2: Two button rows are too close together
**Cause:** Missing vertical margin between the two `div` wrappers.
**Fix:** Add `marginBottom: '12px'` inline on the first row's wrapper div.

```jsx
<div style={{ marginBottom: '12px' }}>  {/* Row 1 */}
  ...
</div>
<div style={{ marginBottom: '24px' }}>  {/* Row 2 */}
  ...
</div>
```

### Issue 3: Inactive buttons look like plain text (no visible size)
**Cause:** No background on inactive state, making rows appear uneven.
**Fix:** Always give inactive buttons a light gray background + border so they match the height/weight of active buttons visually.

```jsx
// ❌ Invisible inactive button
'text-gray-600 hover:text-gray-900'

// ✅ Visible inactive button
'bg-gray-100 dark:bg-gray-800 text-gray-600 border border-gray-200 dark:border-gray-700'
```

### Issue 4: Changes not showing after deploy
**Cause:** Stale `dist/` folder or browser cache.
**Fix:**
1. Delete `dist/` before building: `rm -rf dist && npm run build`
2. Verify classes exist in built output: `grep -o '.gap-4\|.py-4' dist/assets/index-*.css`
3. Ask user to hard refresh: **Ctrl+Shift+R**

---

## Deploy Checklist

Before deploying any UI change:

- [ ] `rm -rf frontend/dist` — clean old build
- [ ] `npm run build` — fresh build
- [ ] Verify classes in `dist/assets/*.css` if Tailwind was used
- [ ] `firebase deploy --only hosting`
- [ ] Hard refresh browser (Ctrl+Shift+R) after deploy

---

## Files to Check for Similar Buttons

| File | Buttons |
|---|---|
| `frontend/src/views/ActivityView.jsx` | My Activity, Broker Activity, My Bookings, Contracts |
| `frontend/src/KargaMarketplace.jsx` | Post Cargo, Post Truck, Submit Bid |
| `frontend/src/views/BidsView.jsx` | Tab switchers |
| `frontend/src/views/ContractsView.jsx` | Tab switchers |
| `frontend/src/components/profile/ProfilePage.jsx` | Action buttons |
