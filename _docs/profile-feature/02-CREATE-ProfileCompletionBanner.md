# Step 02 — Create ProfileCompletionBanner.jsx

**File to create:** `frontend/src/components/profile/ProfileCompletionBanner.jsx`
**This file does not exist yet.**

---

## PROMPT FOR CLAUDE IN VS CODE

```
Create a new file at `frontend/src/components/profile/ProfileCompletionBanner.jsx` with exactly this content:

import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

function calcCompletion(userProfile, truckerProfile, currentRole) {
  if (!userProfile) return 0;
  const checks = [
    !!userProfile.name,
    !!userProfile.businessName,
    !!userProfile.profileImage,
    (userProfile.truckPhotos?.length > 0 || userProfile.cargoPhotos?.length > 0),
  ];
  if (currentRole === 'trucker') {
    checks.push(!!truckerProfile?.driverLicenseCopy?.url);
    checks.push(!!truckerProfile?.ltoRegistrationCopy?.url);
  } else {
    checks.push(!!userProfile.shipperProfile?.businessAddress);
    checks.push(!!userProfile.shipperProfile?.businessType);
  }
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

const STORAGE_KEY = 'getgo_profile_banner_dismissed_v1';

export function ProfileCompletionBanner({ userProfile, truckerProfile, currentRole, onGoToProfile }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(STORAGE_KEY) === 'true'); }
    catch { setDismissed(false); }
  }, []);

  const pct = calcCompletion(userProfile, truckerProfile, currentRole);
  if (dismissed || pct >= 80) return null;

  const missingLabel = () => {
    if (!userProfile?.profileImage) return 'Add a profile photo to build trust';
    if (!userProfile?.truckPhotos?.length && !userProfile?.cargoPhotos?.length) {
      return currentRole === 'trucker'
        ? 'Add a truck photo — shippers will trust you more'
        : 'Add a cargo photo to attract truckers faster';
    }
    return 'Complete your profile to get more bookings';
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
  };

  return (
    <div
      onClick={onGoToProfile}
      className={cn(
        'relative flex items-center gap-3 mx-4 mb-3 px-4 py-3 rounded-2xl cursor-pointer',
        'bg-gradient-to-r from-orange-500 to-amber-500',
        'shadow-lg shadow-orange-500/20',
        'hover:from-orange-600 hover:to-amber-600 transition-all duration-200',
        'animate-in slide-in-from-top-2 fade-in duration-300'
      )}
    >
      <div className="size-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
        <Camera className="size-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white leading-tight truncate">{missingLabel()}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1.5 rounded-full bg-white/30 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] font-bold text-white/90 flex-shrink-0">{pct}% complete</span>
        </div>
      </div>
      <ChevronRight className="size-5 text-white/80 flex-shrink-0" />
      <button
        onClick={handleDismiss}
        className="absolute -top-2 -right-2 size-6 rounded-full bg-gray-800 flex items-center justify-center shadow-md hover:bg-gray-700 transition-colors"
      >
        <X className="size-3 text-white" />
      </button>
    </div>
  );
}

export default ProfileCompletionBanner;
```

---

## After Claude Creates The File

Verify:
> "Does `frontend/src/components/profile/ProfileCompletionBanner.jsx` exist and export `ProfileCompletionBanner`?"

Expected answer: **Yes.**
