# GetGo agent instructions

This repository is a mobile-first PWA for GetGo built with:
- React 18 (JS/JSX)
- Vite 5
- Tailwind CSS 4
- Radix UI primitives
- Lucide icons
- Leaflet maps
- vite-plugin-pwa
- Sentry

## Primary rule
Preserve UI consistency across the app. Do not introduce one-off visual patterns.

## Read these files first
- `docs/ui-system.md`

## UI system requirements
- Mobile-first PWA
- Use shared UI primitives from `src/components/ui/`
- Do not create custom button, input, card, chip, dialog, or sheet styling inline unless explicitly requested
- Prefer shared components:
  - `AppButton`
  - `AppCard`
  - `AppInput`
  - `StatusChip`
  - `AppDialog`
  - `AppSheet`
  - `PageContainer`
  - `SectionHeader`

## Visual tokens
- Page horizontal padding:
  - mobile: `px-4`
  - desktop: `lg:px-6`
- Card radius: `rounded-[14px]`
- Input radius: `rounded-[8px]`
- Button radius: `rounded-[10px]`
- Modal radius: `rounded-[18px]`
- Primary button height: `h-12`
- Standard input height: `h-12`
- Standard card padding: `p-4`
- Section gap: `gap-4` or `gap-6`
- Use subtle, consistent shadows only

## Color semantics
- Orange = brand + primary CTA
- Green = success / active / earnings
- Yellow = pending / warning
- Red = danger / cancelled / destructive
- Blue = secure / informational
- Purple = completed / delivered when needed

Do not use orange as a generic status color unless the screen explicitly needs it.

## Interaction rules
- Keep tap targets mobile-friendly
- Prefer bottom sheets for mobile actions/forms
- Prefer skeleton states over blocking spinners
- Preserve dark mode support
- Preserve existing behavior unless asked to change behavior

## Code rules
- Use `cn()` utility for class composition
- Keep props API stable unless there is a strong reason to change it
- Remove unused imports
- Avoid inline style objects for layout, spacing, and sizing if Tailwind can express them
- Avoid random arbitrary values like `rounded-[17px]`, `px-[18px]`, custom shadows, or inconsistent heights
- Use Lucide icons only unless the repository already requires otherwise

## Refactor approach
When refactoring a screen:
1. Replace one-off styling with shared primitives
2. Preserve logic and behavior
3. Improve spacing, hierarchy, and consistency
4. Keep changes scoped and reviewable

## Before finishing
Check:
- Does this use shared UI components?
- Does this follow `docs/ui-system.md`?
- Are spacing, radius, and button/input heights consistent?
- Does it remain mobile-first and PWA-friendly?