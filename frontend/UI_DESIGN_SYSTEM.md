# GetGo PH — UI Design System

This document is the single source of truth for all frontend UI decisions in the GetGo PH / Karga app. Follow these rules to maintain visual and behavioral uniformity across all pages and components.

---

## 1. Overview

| Item | Value |
|------|-------|
| App name | GetGo PH / Karga |
| Framework | React (Vite) |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Component primitives | Radix UI |
| Variant management | class-variance-authority (CVA) |
| Class composition | clsx + tailwind-merge (via `cn()` in `src/lib/utils.js`) |
| Icons | Lucide React |
| Font | Outfit (Google Fonts) |

**Always use `cn()` to compose class names.** Never concatenate raw strings.

```jsx
import { cn } from '@/lib/utils';
<div className={cn('base-classes', condition && 'conditional-class')} />
```

---

## 2. Color System

### Brand Colors

| Token | Hex | Use |
|-------|-----|-----|
| `--primary` | `#f97316` | Brand orange — CTAs, active states, links |
| `--primary-foreground` | `#ffffff` | Text on orange backgrounds |
| `--destructive` | `#d4183d` | Errors, delete actions |
| `--success` | `#22c55e` | Confirmations, open status |
| `--warning` | `#f59e0b` | Warnings, pending states |
| `--info` | `#3b82f6` | Informational, delivered status |

### Surface Colors (Light Mode)

| Token | Hex | Use |
|-------|-----|-----|
| `--background` | `#ffffff` | Page background |
| `--foreground` | `#030213` | Primary text |
| `--card` | `#ffffff` | Card backgrounds |
| `--secondary` | `#f5f5f7` | Secondary surfaces |
| `--muted` | `#ececf0` | Muted backgrounds (tabs, pills) |
| `--muted-foreground` | `#717182` | Secondary/helper text |
| `--border` | `rgba(0,0,0,0.1)` | Dividers, input borders |
| `--input-background` | `#f3f3f5` | Input fields |

### Dark Mode Overrides (`.dark` class)

| Token | Hex |
|-------|-----|
| `--background` | `#0a0a0a` |
| `--foreground` | `#fafafa` |
| `--card` | `#141414` |
| `--secondary` | `#1f1f1f` |
| `--muted` | `#262626` |
| `--muted-foreground` | `#a1a1aa` |
| `--input-background` | `#1f1f1f` |
| `--border` | `rgba(255,255,255,0.1)` |
| `--success` | `#4ade80` |
| `--warning` | `#fbbf24` |
| `--info` | `#60a5fa` |

### Gradient Utilities (defined in `src/styles/theme.css`)

```css
.gradient-primary   /* #FF9A56 → #FF6B35  (orange, primary CTA) */
.gradient-accent    /* #ff9a56 → #ffd34e  (orange-yellow accent) */
.gradient-open      /* green  — cargo/truck open status */
.gradient-waiting   /* orange — waiting/negotiating status */
.gradient-delivered /* blue   — delivered status */
.gradient-in-transit/* purple — in-transit/in-progress */
.gradient-shipper   /* blue gradient  — shipper workspace */
.gradient-trucker   /* purple gradient — trucker workspace */
```

---

## 3. Typography

**Font:** `Outfit` — imported from Google Fonts, weights 400–900.

```css
font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Type Scale

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| h1 | 1.875rem (30px) | 500 | 1.3 |
| h2 | 1.5rem (24px) | 500 | 1.4 |
| h3 | 1.25rem (20px) | 500 | 1.5 |
| h4 | 1rem (16px) | 500 | 1.5 |
| Label / Button | 0.875rem (14px) | 500 | 1.5 |
| Body / Input | 0.875rem (14px) | 400 | 1.5 |
| Caption | 0.75rem (12px) | 400 | 1.5 |

### Rules
- Use `font-medium` (500) for all headings, labels, and buttons.
- Use `font-normal` (400) for body copy, helper text, and input values.
- Use `font-semibold` (600) or `font-bold` (700) only for prices and emphasis.
- Secondary/muted text: `text-muted-foreground` (not a hardcoded gray).

---

## 4. Spacing & Layout

The app uses the default Tailwind spacing scale (1 unit = 4px).

### Common Padding Patterns

| Context | Classes |
|---------|---------|
| Page content (mobile) | `px-4` (16px) |
| Page content (desktop) | `px-6` (24px) |
| Card body | `px-6 pt-6` |
| Card footer | `px-6 pb-6` |
| Button (default) | `px-5 py-2.5` |
| Modal/dialog | `p-7` (28px) |
| Input field | `px-4 py-2` |

### Common Gap Patterns

| Context | Classes |
|---------|---------|
| Between sections in a card | `gap-6` |
| Between icon and label | `gap-2` |
| Between form fields | `gap-3` or `gap-4` |
| Between list items (cards) | `gap-3` or `gap-4` |
| Between footer buttons | `gap-2` |

### Responsive Breakpoints
- **Mobile-first.** Default styles target mobile.
- `lg:` (1024px+) switches to desktop layout.
- Use `max-lg:` to apply styles only on mobile.
- Never use `sm:` or `md:` breakpoints — only `lg:`.

---

## 5. Border Radius

| Token | Value | Tailwind class | Use |
|-------|-------|----------------|-----|
| `--radius-sm` | 6px | `rounded-md` | Badges, small chips |
| `--radius-md` | 8px | `rounded-lg` | Dropdowns, tooltips |
| `--radius-lg` | 10px | `rounded-xl` | Inputs, buttons, tabs |
| `--radius-xl` | 14px | `rounded-2xl` | Cards, modals |
| `--radius-2xl` | 18px | `rounded-3xl` | Bottom sheet top corners |
| `--radius-full` | 9999px | `rounded-full` | Avatars, pills, dots |

**Rule:** Buttons and inputs use `rounded-xl`. Cards use `rounded-2xl`. Bottom sheets use `rounded-t-3xl`.

---

## 6. Shadows & Elevation

| Level | Class | Use |
|-------|-------|-----|
| Subtle | `shadow-sm` | Inactive cards, inactive tabs |
| Default | `shadow-md` | Standard card resting state |
| Elevated | `shadow-lg` | Hovered cards, modals |
| High | `shadow-xl` | Floating elements, post button |
| Max | `shadow-2xl` | Overlays |

### Colored Glow Shadows (from `theme.css`)

```css
shadow-glow-orange   /* shadow-lg shadow-orange-500/40  */
shadow-glow-blue     /* shadow-lg shadow-blue-500/40    */
shadow-glow-green    /* shadow-lg shadow-green-500/40   */
shadow-glow-purple   /* shadow-lg shadow-purple-500/40  */
```

Apply colored glow shadows to gradient buttons to match the button color.

---

## 7. Buttons

**Component:** `src/components/ui/button.jsx`

### Variants

| Variant | Use |
|---------|-----|
| `gradient` | Primary CTA (post, submit, confirm). Orange gradient. |
| `gradient-blue` | Shipper workspace primary actions. |
| `gradient-green` | Success/confirm actions. |
| `gradient-purple` | Trucker workspace primary actions. |
| `default` | Standard solid orange button. |
| `outline` | Secondary action alongside a primary. |
| `secondary` | Tertiary/neutral action. |
| `ghost` | Icon buttons, inline actions, navigation items. |
| `glass` | Buttons on gradient/image backgrounds (light). |
| `glass-dark` | Buttons on dark gradient backgrounds. |
| `destructive` | Delete, cancel, irreversible actions. |
| `link` | Inline text links. |

### Sizes

| Size | Height | Use |
|------|--------|-----|
| `sm` | 32px | Compact contexts (table rows, chips) |
| `default` | 40px | Standard — most buttons |
| `lg` | 48px | Form submit buttons |
| `xl` | 56px | Hero/landing CTAs |
| `icon` | 40×40px | Icon-only buttons |
| `icon-sm` | 32×32px | Compact icon buttons |
| `icon-lg` | 48×48px | Feature icon buttons |

### Rules
- Primary actions: always `variant="gradient"` (or role-specific gradient).
- Destructive actions: always `variant="destructive"`.
- Never use hardcoded background colors on buttons — use a variant.
- Buttons already include `active:scale-95` and `transition-all duration-200`. Do not add these manually.

---

## 8. Badges & Status Labels

**Component:** `src/components/ui/badge.jsx`

### Variants

| Variant | Color | Use |
|---------|-------|-----|
| `default` | Orange | Primary label |
| `secondary` | Gray/muted | Neutral label |
| `outline` | Border only | Subtle label |
| `success` | Green | Positive state |
| `warning` | Amber | Caution state |
| `info` | Blue | Informational |
| `destructive` | Red | Error/danger label |
| `gradient-green` | Green gradient | Open cargo/truck |
| `gradient-orange` | Orange gradient | Negotiating/waiting |
| `gradient-blue` | Blue gradient | Delivered |
| `gradient-purple` | Purple gradient | In-transit/in-progress |
| `gradient-red` | Red gradient | Cancelled |

### Status → Badge Mapping

| Status | Badge variant |
|--------|---------------|
| `open` / `available` | `gradient-green` |
| `negotiating` / `waiting` | `gradient-orange` |
| `contracted` / `in_progress` | `gradient-purple` |
| `in_transit` | `gradient-purple` |
| `delivered` / `completed` | `gradient-blue` |
| `cancelled` | `gradient-red` |
| `pending` | `warning` |
| `accepted` | `success` |
| `rejected` | `destructive` |

### Sizes

| Size | Use |
|------|-----|
| `sm` | Inside cards, compact rows |
| `default` | Standard use |
| `lg` | Modal headers, prominent status |

---

## 9. Cards

**Component:** `src/components/ui/card.jsx`

### Sub-components
- `Card` — wrapper (`rounded-2xl border shadow-lg hover:shadow-xl transition-all`)
- `CardHeader` — top section (`px-6 pt-6`)
- `CardTitle` — heading (`font-semibold text-foreground`)
- `CardDescription` — subheading (`text-muted-foreground text-sm`)
- `CardAction` — right-side action area in header
- `CardContent` — body (`px-6`)
- `CardFooter` — bottom section (`px-6 pb-6`)

### Rules
- Cards always use `rounded-2xl`.
- Cards always have a `border` (uses `--border` token, not a hardcoded color).
- Cards have `shadow-lg` at rest and `hover:shadow-xl` on hover.
- Use `CardHeader` + `CardContent` + `CardFooter` sub-components — do not put all content in a raw `Card`.

---

## 10. Inputs & Forms

### Input (`src/components/ui/input.jsx`)
```jsx
// Styling: h-10, rounded-xl, border border-border, bg-input-background, px-4 py-2
// Focus: ring-2 ring-ring ring-offset-2
<Input placeholder="Enter value" />
```

### Textarea (`src/components/ui/textarea.jsx`)
```jsx
// Styling: min-h-[80px], rounded-xl, resize-none, px-4 py-3
<Textarea placeholder="Enter description" />
```

### Select (`src/components/ui/select.jsx`)
```jsx
// Trigger: h-10, rounded-xl, border-border, bg-input-background
<Select>
  <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
  <SelectContent>
    <SelectItem value="x">Label</SelectItem>
  </SelectContent>
</Select>
```

### Label (`src/components/ui/label.jsx`)
```jsx
// text-sm font-medium
<Label htmlFor="field">Field Name</Label>
```

### Switch (`src/components/ui/switch.jsx`)
```jsx
// h-5 w-9, checked state uses --primary (orange)
<Switch checked={val} onCheckedChange={setVal} />
```

### Rules
- All inputs use `bg-input-background` — never `bg-white` or `bg-gray-100`.
- All inputs use `rounded-xl` — never `rounded-md` or `rounded-lg`.
- Labels always appear above inputs with `gap-1.5` between label and input.
- Error messages use `text-destructive text-sm`.

---

## 11. Dialogs & Modals

**Component:** `src/components/ui/dialog.jsx`

### Two Variants

#### `DialogContent` — Centered Modal
- Desktop and mobile: centered on screen.
- Max width: `max-w-lg` (32rem).
- Rounded: `rounded-2xl`.
- Has a built-in close (X) button in top-right.
- Use for confirmations, forms, and alerts.

#### `DialogBottomSheet` — Mobile Bottom Sheet
- Mobile (`max-lg`): slides up from bottom, `fixed inset-x-0 bottom-0`.
- Desktop (`lg:`): converts to centered modal like `DialogContent`.
- Rounded: `rounded-t-3xl` on mobile.
- Has a drag handle at top center.
- Max height: `max-h-[90vh]`, scrollable.
- Use for detail views (cargo details, truck details, bids).

### Rules
- Use `DialogBottomSheet` for detail/info views — they feel native on mobile.
- Use `DialogContent` for compact confirmations and short forms.
- Put action buttons in a `dialog-fixed-footer` div to pin them at the bottom.
- Never hardcode `z-index` — the dialog system handles stacking automatically.

---

## 12. Navigation

### Bottom Navigation Bar (`src/components/layout/MobileNav.jsx`)
- 5 tabs: Home, Tracking, **Post (+)**, Messages, Profile.
- Visible only on mobile: `lg:hidden`.
- Fixed bottom: `fixed bottom-0 left-0 right-0 z-50`.
- Background: `bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl`.
- Apply `pb-safe` class to respect device notches.
- Active tab indicator: small orange dot below the icon.
- **Post button:** Elevated (`marginTop: -18px`), 56px square, `rounded-2xl`, orange gradient, `shadow-lg shadow-orange-500/40`.

### Header (`src/components/layout/Header.jsx`)
- Visible on desktop: `hidden lg:flex`.
- Sticky top: `sticky top-0 z-40`.
- Active nav items use orange gradient background.
- Inactive nav items use `bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm`.

### Rules
- Do not create custom navigation elements — use `MobileNav` and `Header`.
- All pages must account for the fixed bottom nav height on mobile (add `pb-20` or use `pb-safe`).

---

## 13. Icons

**Library:** Lucide React — `import { IconName } from 'lucide-react'`

### Standard Sizes

| Context | Size class | px |
|---------|------------|----|
| Navigation tabs | `size-5` | 20px |
| Inside buttons | `size-4` | 16px |
| Section headers | `size-5` | 20px |
| Feature icons (cards) | `size-6` | 24px |
| Large decorative | `size-8` | 32px |
| Empty state | `size-10` | 40px |

### Common Icons

| Use | Icon |
|-----|------|
| Home | `Home` |
| Tracking / location | `MapPin` |
| Post / add | `Plus` |
| Messages | `MessageSquare` |
| Profile / user | `User` |
| Notification | `Bell` |
| Settings | `Settings` |
| Edit | `Pencil` |
| Delete | `Trash2` |
| Close | `X` |
| Confirm | `Check` |
| Warning | `AlertTriangle` |
| Loading | `Loader2` + `animate-spin` |
| Cargo | `Package` |
| Truck | `Truck` |
| Route from | `MapPin` (green) |
| Route to | `MapPin` (red/orange) |
| Distance | `Navigation` |
| Time | `Clock` |
| Weight | `Scale` |
| Calendar | `Calendar` |
| PHP currency | `PesoIcon` (custom component in `src/components/ui/PesoIcon.jsx`) |

### Rules
- Always pass `className` for sizing — do not use the `size` prop.
- For loading states, use `<Loader2 className="size-4 animate-spin" />`.
- Use `PesoIcon` for Philippine Peso (₱), not a text character.

---

## 14. Animations & Transitions

### Standard Transition
```jsx
className="transition-all duration-200"
```
Use on all interactive elements (buttons, cards, nav items).

### Hover Scale
```jsx
className="hover:scale-105 transition-all duration-200"  // cards, feature items
className="hover:scale-110 transition-all duration-200"  // icon buttons
```

### Active Press
```jsx
className="active:scale-95"  // already in Button component — don't add manually
```

### Slow Emphasis
```jsx
className="transition-all duration-300"  // longer transitions for modals, drawers
```

### Loading Spinner
```jsx
<Loader2 className="size-4 animate-spin" />
```

### Rules
- Use `duration-200` for micro-interactions (buttons, tabs).
- Use `duration-300` for layout transitions (drawers, panels).
- Never use `duration-500` or longer except for page-level transitions.
- Animations are already built into `Button` — do not add `active:scale-95` manually to buttons.

---

## 15. Status System

### Cargo Statuses
| Status | Display label | Badge variant |
|--------|---------------|---------------|
| `open` | OPEN | `gradient-green` |
| `negotiating` | NEGOTIATING | `gradient-orange` |
| `contracted` | CONTRACTED | `gradient-purple` |
| `in_transit` | IN TRANSIT | `gradient-purple` |
| `delivered` | DELIVERED | `gradient-blue` |
| `cancelled` | CANCELLED | `gradient-red` |

### Truck Statuses
| Status | Display label | Badge variant |
|--------|---------------|---------------|
| `available` | AVAILABLE | `gradient-green` |
| `negotiating` | NEGOTIATING | `gradient-orange` |
| `contracted` | CONTRACTED | `gradient-purple` |
| `in_transit` | IN TRANSIT | `gradient-purple` |
| `completed` | COMPLETED | `gradient-blue` |
| `cancelled` | CANCELLED | `gradient-red` |

### Bid Statuses
| Status | Badge variant |
|--------|---------------|
| `pending` | `warning` |
| `accepted` | `success` |
| `rejected` | `destructive` |
| `withdrawn` | `secondary` |

### Shipment Statuses
| Status | Badge variant |
|--------|---------------|
| `pending_pickup` | `warning` |
| `picked_up` | `gradient-orange` |
| `in_transit` | `gradient-purple` |
| `delivered` | `gradient-blue` |

---

## 16. Role-Specific Theming

Each user role has an associated gradient color used for workspace headers and primary actions within that workspace.

| Role | Gradient | Tailwind classes |
|------|----------|------------------|
| Shipper | Blue | `from-blue-500 to-blue-700` |
| Trucker | Purple | `from-purple-500 to-purple-700` |
| Broker | Orange | `from-orange-400 to-orange-600` |

### Rules
- When building a Shipper-specific screen/action, use `gradient-blue` button variant.
- When building a Trucker-specific screen/action, use `gradient-purple` button variant.
- When building a Broker-specific screen/action, use `gradient` (orange) button variant.
- Generic/shared actions always use `gradient` (orange) as the primary.

---

## 17. Glassmorphism Pattern

Used for navigation bars, floating buttons, and overlays on images/gradients.

### Light Glass
```jsx
className="bg-white/50 backdrop-blur-xl border border-white/20"
// or via CSS: var(--glass-bg-light) = rgba(255,255,255,0.7) + blur(16px)
```

### Dark Glass
```jsx
className="bg-gray-900/80 dark:bg-gray-900/80 backdrop-blur-xl"
// or via CSS: var(--glass-bg-dark) = rgba(20,20,20,0.8) + blur(16px)
```

### When to Use
- Bottom navigation bar background.
- Header bar background.
- Buttons placed on top of gradient or image backgrounds.
- Floating action elements.

### When NOT to Use
- Regular card backgrounds — use `bg-card` instead.
- Form input backgrounds — use `bg-input-background`.
- Page backgrounds — use `bg-background`.

---

## 18. Empty States

**Component:** `src/components/shared/EmptyState.jsx`

```jsx
<EmptyState
  icon={Package}
  title="No cargo found"
  description="There are no cargo listings in this area yet."
  actionLabel="Post Cargo"
  onAction={() => setShowPostModal(true)}
/>
```

### Rules
- Every list view must have an empty state.
- Icon container is always 64px (`size-16`), `rounded-xl`, gray gradient background.
- Title: `text-base font-semibold`.
- Description: `text-sm text-muted-foreground`.
- Action button (if provided): `variant="gradient"`.

---

## 19. Mobile Conventions

### Safe Area
```jsx
// Apply to elements that extend to bottom of screen:
className="pb-safe"
// Equivalent to: padding-bottom: max(0.5rem, env(safe-area-inset-bottom))
```

### Touch Targets
- All tappable elements must be at least **44×44px** (iOS HIG standard).
- Icon-only buttons: use `size="icon"` (40px) or `size="icon-lg"` (48px).
- List items: minimum `min-h-[56px]`.

### Responsive Prefix Rules
| Prefix | Breakpoint | Use |
|--------|------------|-----|
| (none) | 0px+ | Mobile default |
| `lg:` | 1024px+ | Desktop override |
| `max-lg:` | <1024px | Mobile-only styles |

Never use `sm:`, `md:`, `xl:`, or `2xl:` breakpoints in this codebase.

### Bottom Nav Clearance
All page content must account for the fixed bottom nav (~64px + safe area). Use `pb-20` or `pb-24` on the main scroll container of every mobile page.

---

## 20. Do's and Don'ts

### Colors
| Do | Don't |
|----|-------|
| `text-foreground` | `text-gray-900` |
| `text-muted-foreground` | `text-gray-500` |
| `bg-card` | `bg-white` |
| `bg-muted` | `bg-gray-100` |
| `border-border` | `border-gray-200` |
| `bg-input-background` | `bg-gray-50` |
| `text-destructive` | `text-red-500` |
| `text-primary` | `text-orange-500` |

### Components
| Do | Don't |
|----|-------|
| Use `<Button variant="gradient">` | Manually style a div as a button |
| Use `<Badge variant="gradient-green">` | Use hardcoded green spans |
| Use `cn()` for conditional classes | String concatenation with `+` |
| Use `DialogBottomSheet` for detail views | Custom positioned absolute divs |
| Use `EmptyState` component | Ad-hoc "no results" text |

### Layout
| Do | Don't |
|----|-------|
| `gap-6` between card sections | `mt-6 mb-6` on each element |
| `rounded-xl` for inputs | `rounded-md` or `rounded-lg` |
| `rounded-2xl` for cards | `rounded-xl` or `rounded-3xl` for cards |
| `lg:` for desktop breakpoints | `md:` or `sm:` breakpoints |

---

## 21. Key File Reference

| File | Purpose |
|------|---------|
| [src/styles/theme.css](src/styles/theme.css) | All CSS custom properties (colors, radius, shadows, gradients) |
| [src/styles/fonts.css](src/styles/fonts.css) | Outfit font import |
| [src/index.css](src/index.css) | Global resets, scrollbar, safe area, focus ring |
| [src/lib/utils.js](src/lib/utils.js) | `cn()`, `formatCurrency()`, `formatRelativeTime()`, etc. |
| [src/utils/constants.js](src/utils/constants.js) | Status enums, vehicle types, cargo types, tier definitions |
| [src/components/ui/button.jsx](src/components/ui/button.jsx) | Button component with all variants and sizes |
| [src/components/ui/badge.jsx](src/components/ui/badge.jsx) | Badge/status label component |
| [src/components/ui/card.jsx](src/components/ui/card.jsx) | Card container with sub-components |
| [src/components/ui/dialog.jsx](src/components/ui/dialog.jsx) | Modal (DialogContent) and bottom sheet (DialogBottomSheet) |
| [src/components/ui/input.jsx](src/components/ui/input.jsx) | Text input |
| [src/components/ui/textarea.jsx](src/components/ui/textarea.jsx) | Textarea |
| [src/components/ui/select.jsx](src/components/ui/select.jsx) | Dropdown select |
| [src/components/ui/tabs.jsx](src/components/ui/tabs.jsx) | Tab navigation |
| [src/components/ui/PesoIcon.jsx](src/components/ui/PesoIcon.jsx) | Philippine Peso (₱) icon |
| [src/components/layout/MobileNav.jsx](src/components/layout/MobileNav.jsx) | Bottom navigation bar |
| [src/components/layout/Header.jsx](src/components/layout/Header.jsx) | Desktop header/nav |
| [src/components/shared/EmptyState.jsx](src/components/shared/EmptyState.jsx) | Empty state component |
| [src/components/shared/ConfirmDialog.jsx](src/components/shared/ConfirmDialog.jsx) | Confirmation dialog |
