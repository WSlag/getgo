# GetGo UI System

## Design direction
GetGo should feel:
- mobile-first
- operational
- trustworthy
- clean
- modern
- logistics-focused

## Layout
- Page padding: `px-4`, desktop `lg:px-6`
- Vertical rhythm: use 12 / 16 / 24 / 32 / 40
- Default card padding: `p-4`
- Default section gap: `gap-4`
- Larger section separation: `gap-6`

## Radius
- Input: 8px
- Button: 10px
- Card: 14px
- Modal / sheet: 18px
- Pills: full rounded

## Buttons
### Primary
- orange filled
- `h-12`
- `rounded-[10px]`
- strong text
- full-width on mobile where appropriate

### Secondary
- neutral filled
- same height and radius

### Outline
- orange border
- same height and radius

### Success
- green filled
- same height and radius

### Danger
- red filled
- same height and radius

## Inputs
- `h-12`
- `rounded-[8px]`
- `text-[16px]`
- consistent focus ring
- same border and helper/error treatment across forms

## Cards
### AppCard
- `rounded-[14px]`
- border
- white background
- subtle shadow
- `p-4`

### StatCard
- same radius
- same border
- lighter visual weight
- used for balances, counts, KPIs

## Chips
Use semantic variants only:
- transit
- pending
- accepted
- completed
- cancelled
- verified
- secure
- neutral

## Modals and sheets
- Mobile: bottom sheet preferred
- Desktop: centered modal
- Modal radius: 18px
- Same header and footer spacing
- Long forms should have clear section spacing and stable CTA area

## Empty states
Should include:
- icon
- title
- short explanation
- action when useful

## Skeletons
Use skeletons for:
- cards
- lists
- dashboard stats
- map/loading panels

Avoid spinner-only loading for major content blocks.

## Maps
Leaflet map containers should:
- use the same card radius
- use consistent action button styles
- show loading skeletons while map content initializes

## Typography
- Page title: 22px bold
- Section title: 18px semibold
- Card title: 16px semibold
- Body: 14px
- Meta: 12px muted
- Label: 13px medium

## Anti-patterns
Do not:
- invent new radius values per screen
- use custom one-off shadows
- use inline styles for spacing
- create page-specific button styles for the same action type
- mix unrelated card languages in one screen
- use too many visual accents in one component