# GetGo PH — Public Profile Feature
## READ THIS FIRST

---

### What You Are Building

A **Public Profile** system for GetGo PH with photo upload.
When any user taps another user's name in the app, a profile modal opens showing:
- Their photo, badge, rating, and stats
- Truck photos / cargo photos
- Reviews from past transactions

---

### Files In This Package

| File | What It Is | Action |
|---|---|---|
| `00-READ-FIRST.md` | This file | Read first |
| `01-CREATE-PublicProfileModal.md` | New component | Create new file |
| `02-CREATE-ProfileCompletionBanner.md` | New component | Create new file |
| `03-PATCH-GetGoApp.md` | Wire everything | Edit existing file |
| `04-PATCH-HomeView.md` | Add banner + prop | Edit existing file |
| `05-PATCH-CargoCard.md` | Tap shipper name | Edit existing file |
| `06-PATCH-TruckCard.md` | Tap trucker name | Edit existing file |
| `07-PATCH-CargoDetailsModal.md` | Tap bidder name | Edit existing file |
| `08-PATCH-OnboardingGuideModal.md` | Add profile step | Edit existing file |
| `09-CHECKLIST.md` | Final verification | Run after all patches |

---

### How To Use These Files In VS Code

1. Open VS Code with your GetGo project
2. Open Claude in VS Code (sidebar)
3. For each file in order (01 → 09):
   - Open the `.md` file
   - Copy the **"PROMPT FOR CLAUDE"** section
   - Paste it into Claude in VS Code
   - Wait for Claude to make the change
   - Save the file
   - Move to the next `.md` file

**Do them in order. Do not skip steps.**

---

### Rules For Claude In VS Code

When you paste a prompt, Claude in VS Code will read your actual file and make the change.
You do not need to paste code — just paste the prompt text.

If Claude makes a mistake, say:
> "Undo that change and try again exactly as described."

---

### Total Time Estimate

- Steps 01–02 (create new files): ~5 minutes each
- Steps 03–08 (patch existing files): ~10 minutes each
- Step 09 (checklist): ~5 minutes

**Total: about 1 hour**

---

### Prerequisites — Check These First

Before starting, confirm these are true:

- [ ] `frontend/src/firebase.js` exports `db` and `storage`
- [ ] `frontend/src/services/firestoreService.js` exports `updateUserProfile`
- [ ] `@/components/ui/dialog` exports `Dialog` and `DialogContent`
- [ ] `@/components/ui/button` exports `Button`
- [ ] `@/lib/utils` exports `cn`
- [ ] `@/hooks/useMediaQuery` exports `useMediaQuery`
- [ ] `lucide-react` is installed

If any of these are missing, tell Claude in VS Code:
> "Check if [item] exists in my project and tell me the correct import path."
