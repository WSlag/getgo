# Step 09 — Final Verification Checklist

**Run this after completing all 8 steps.**
**Paste each prompt into Claude in VS Code one at a time.**

---

## VERIFICATION PROMPT 1 — Check all new/modified files exist

```
Check that these files exist in my project and confirm each one:
1. frontend/src/components/profile/PublicProfileModal.jsx
2. frontend/src/components/profile/ProfileCompletionBanner.jsx

For each file, confirm it exists and exports the named component.
```

Expected result: Both files confirmed.

---

## VERIFICATION PROMPT 2 — Check GetGoApp.jsx wiring

```
Open frontend/src/GetGoApp.jsx and confirm all of these are present:
1. Import: PublicProfileModal from '@/components/profile/PublicProfileModal'
2. Import: ProfileCompletionBanner from '@/components/profile/ProfileCompletionBanner'
3. State: const [viewingUserId, setViewingUserId] = useState(null)
4. JSX: <PublicProfileModal open={!!viewingUserId} ... /> is rendered
5. JSX: <ProfileCompletionBanner ... onGoToProfile={() => setActiveTab('profile')} /> is rendered
6. HomeView has the prop: onViewUserProfile={(uid) => setViewingUserId(uid)}
7. CargoDetailsModal has the prop: onViewProfile={(uid) => setViewingUserId(uid)}
8. TruckDetailsModal has the prop: onViewProfile={(uid) => setViewingUserId(uid)}

List any that are missing.
```

Expected result: All 8 confirmed.

---

## VERIFICATION PROMPT 3 — Check CargoCard and TruckCard

```
1. Open frontend/src/components/cargo/CargoCard.jsx
   Confirm: onViewProfile is in the props AND the shipper name in the full card view is a <button> element

2. Open frontend/src/components/truck/TruckCard.jsx
   Confirm: onViewProfile is in the props AND the trucker name in the full card view is a <button> element
```

Expected result: Both confirmed.

---

## VERIFICATION PROMPT 4 — Check CargoDetailsModal

```
Open frontend/src/components/modals/CargoDetailsModal.jsx and confirm:
1. onViewProfile is in the props
2. In the bids list, bid.bidder is displayed inside a <button> element
3. A "View Profile" button exists in the bid action buttons section
```

Expected result: All 3 confirmed.

---

## VERIFICATION PROMPT 5 — Check OnboardingGuideModal

```
Open frontend/src/components/modals/OnboardingGuideModal.jsx and confirm:
1. Camera is imported from lucide-react
2. SHIPPER_STEPS has a step with title 'Set Up Your Profile'
3. TRUCKER_STEPS has a step with title 'Set Up Your Profile'
```

Expected result: All 3 confirmed.

---

## VERIFICATION PROMPT 6 — Check HomeView

```
Open frontend/src/views/HomeView.jsx and confirm:
1. onViewUserProfile is in the props destructuring
2. CargoCard render has the prop: onViewProfile={onViewUserProfile}
3. TruckCard render has the prop: onViewProfile={onViewUserProfile}
```

Expected result: All 3 confirmed.

---

## FINAL BUILD TEST

```
Run this command and check for errors:
npm run build

If there are any errors, show me the first error message.
```

Expected result: Build completes with no errors.

---

## IF SOMETHING IS WRONG

For any failed check, tell Claude in VS Code:
> "Step [number] check failed — [what is missing]. Please fix it now."

Claude will find the issue and fix it.

---

## WHAT YOU SHOULD BE ABLE TO DO AFTER ALL CHECKS PASS

| Action | What Should Happen |
|---|---|
| Open app, see cargo listing | Tap shipper name → PublicProfileModal opens |
| Open app, see truck listing | Tap trucker name → PublicProfileModal opens |
| Open cargo details, see bids | Tap trucker name or "View Profile" → modal opens |
| New user signs up | After onboarding guide, sees "Set Up Your Profile" step |
| Profile < 80% complete | Orange banner appears on home feed |
| Own profile → Photos tab | Can upload truck photos and cargo photos |
| Tap own avatar photo | Camera icon appears → can replace photo |

---

## STORAGE RULES TO VERIFY IN FIREBASE CONSOLE

After deploying, check Firebase Storage rules allow writes to these paths:
- `profile-photos/{userId}/*`
- `profile-gallery/{userId}/*`

If photos fail to upload, add these rules in Firebase Storage:
```
match /profile-photos/{userId}/{allPaths=**} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.uid == userId;
}
match /profile-gallery/{userId}/{allPaths=**} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.uid == userId;
}
```
