# Step 08 — Patch OnboardingGuideModal.jsx

**File to edit:** `frontend/src/components/modals/OnboardingGuideModal.jsx`
**Add a new "Set Up Your Profile" step at the end of both SHIPPER_STEPS and TRUCKER_STEPS.**

---

## PROMPT FOR CLAUDE IN VS CODE

```
Open `frontend/src/components/modals/OnboardingGuideModal.jsx` and make exactly these 2 changes.
Do not change any existing code — only add the new lines described.

─────────────────────────────────────────────────────────────────
CHANGE 1 of 2 — Add Camera to imports
─────────────────────────────────────────────────────────────────

Find the existing import from lucide-react. It looks like:
  import { Package, Truck, FileText, CreditCard, Search, MessageSquare, ... } from 'lucide-react';

Add Camera to that import list if it is not already there.
The result should include Camera in the list.

─────────────────────────────────────────────────────────────────
CHANGE 2 of 2 — Add profile setup step to BOTH step arrays
─────────────────────────────────────────────────────────────────

Find the SHIPPER_STEPS array. It ends with a step called 'Contracts & Delivery'.
That last step object ends with a closing }, followed by ]; 

Add this new step object BEFORE the ]; of SHIPPER_STEPS:

  {
    icon: Camera,
    iconGradient: 'from-orange-400 to-orange-600',
    iconShadow: 'shadow-orange-500/30',
    title: 'Set Up Your Profile',
    subtitle: 'One last step',
    description: 'Add your photo and business details so truckers can trust your listings before placing a bid.',
    highlights: [
      { icon: Camera, label: 'Add a profile photo', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
      { icon: Package, label: 'Add cargo photos to your listings', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      { icon: Star, label: 'Complete profiles attract more truckers', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    ],
    tip: 'Shippers with photos on their listings get bids 2x faster.',
  },


Find the TRUCKER_STEPS array. It ends with a step called 'Complete & Earn'.
Add this new step object BEFORE the ]; of TRUCKER_STEPS:

  {
    icon: Camera,
    iconGradient: 'from-orange-400 to-orange-600',
    iconShadow: 'shadow-orange-500/30',
    title: 'Set Up Your Profile',
    subtitle: 'One last step',
    description: 'Add your photo and truck details so shippers can trust you before accepting your bid.',
    highlights: [
      { icon: Camera, label: 'Add a profile photo', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
      { icon: Truck, label: 'Add your truck type and capacity', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      { icon: Star, label: 'Complete profiles get 3x more bids', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    ],
    tip: 'Truckers with a complete profile get up to 3x more bookings.',
  },

Make sure Star is imported from lucide-react as well. Add it to the import if not present.
```

---

## After Claude Makes The Changes

Verify:
> "In OnboardingGuideModal.jsx, confirm:
> 1. Camera is in the lucide-react imports
> 2. SHIPPER_STEPS has a new final step titled 'Set Up Your Profile'
> 3. TRUCKER_STEPS has a new final step titled 'Set Up Your Profile'"

All 3 should be confirmed.

---

## Note On The CTA Button

The OnboardingGuideModal already has a "Get Started" or "Done" button on the last step.
When the user taps it on this new last step, the modal will close normally.
The ProfileCompletionBanner (added in Step 03) will then appear on the HomeView
and guide the user to their profile.

No additional code changes are needed for the CTA to work.
