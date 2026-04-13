# Step 03 — Patch GetGoApp.jsx

**File to edit:** `frontend/src/GetGoApp.jsx`
**You are making 4 additions. Do not delete anything.**

---

## PROMPT FOR CLAUDE IN VS CODE

```
Open `frontend/src/GetGoApp.jsx` and make exactly these 4 changes.
Do not change any existing code — only add the new lines described.

─────────────────────────────────────────────────────────────────
CHANGE 1 of 4 — Add 2 import lines
─────────────────────────────────────────────────────────────────

Find this existing import line (it already exists):
  import { OnboardingGuideModal } from '@/components/modals/OnboardingGuideModal';

Add these 2 lines DIRECTLY AFTER it:
  import { PublicProfileModal } from '@/components/profile/PublicProfileModal';
  import { ProfileCompletionBanner } from '@/components/profile/ProfileCompletionBanner';

─────────────────────────────────────────────────────────────────
CHANGE 2 of 4 — Add 1 state variable
─────────────────────────────────────────────────────────────────

Find this existing line (it already exists):
  const [ratingTarget, setRatingTarget] = useState(null);

Add this line DIRECTLY AFTER it:
  const [viewingUserId, setViewingUserId] = useState(null);

─────────────────────────────────────────────────────────────────
CHANGE 3 of 4 — Add PublicProfileModal to the JSX modal block
─────────────────────────────────────────────────────────────────

Find the BrokerOnboardingGuideModal render block. It looks like this:
  <BrokerOnboardingGuideModal
    open={showBrokerGuide}
    onClose={() => setShowBrokerGuide(false)}
    ...
  />

Add these lines DIRECTLY AFTER the closing /> of BrokerOnboardingGuideModal:

  {/* Public Profile Modal */}
  <PublicProfileModal
    open={!!viewingUserId}
    onClose={() => setViewingUserId(null)}
    userId={viewingUserId}
    currentUserId={authUser?.uid}
    onOpenChat={(uid) => {
      setViewingUserId(null);
    }}
  />

─────────────────────────────────────────────────────────────────
CHANGE 4 of 4 — Pass onViewUserProfile prop to HomeView
─────────────────────────────────────────────────────────────────

Find where HomeView is rendered in the JSX. It will have many props like:
  <HomeView
    activeMarket={activeMarket}
    cargoListings={...}
    ...
  />

Add this prop to HomeView (add it on its own line with the other props):
  onViewUserProfile={(uid) => setViewingUserId(uid)}

Also, find where ProfileCompletionBanner should render.
Find the line that renders HomeView (the opening <HomeView tag).
Add the ProfileCompletionBanner DIRECTLY BEFORE the HomeView opening tag.
It should look like this after the change:

  <ProfileCompletionBanner
    userProfile={userProfile}
    truckerProfile={truckerProfile}
    currentRole={currentRole}
    onGoToProfile={() => setActiveTab('profile')}
  />
  <HomeView
    activeMarket={activeMarket}
    ...existing props unchanged...
    onViewUserProfile={(uid) => setViewingUserId(uid)}
  />
```

---

## After Claude Makes The Changes

Verify by asking:
> "In GetGoApp.jsx, confirm:
> 1. PublicProfileModal is imported
> 2. viewingUserId state exists
> 3. PublicProfileModal is rendered in the JSX
> 4. ProfileCompletionBanner is rendered before HomeView
> 5. HomeView has the onViewUserProfile prop"

All 5 should be confirmed.

---

## Common Errors

**Error:** "Cannot find module '@/components/profile/PublicProfileModal'"
**Fix:** Make sure you completed Step 01 first.

**Error:** "viewingUserId is not defined"
**Fix:** Make sure Change 2 was applied — the useState line must be inside the component function.
